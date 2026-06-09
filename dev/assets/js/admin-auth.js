    const APP_WORK_TITLE='Shooting Planer';
    const LAST_STUDIO_STORAGE_KEY='dolomiten.admin.lastStudio.v1';
    const DEFAULT_STUDIO_FALLBACK='13 Stories Photography';

    let passwordRecoveryActive=false;
    let cachedProfile=null;
    let authListenersBound=false;

    function readLastStudioName(){
      try{return String(localStorage.getItem(LAST_STUDIO_STORAGE_KEY)||'').trim()}catch{return ''}
    }

    function writeLastStudioName(studio){
      const value=String(studio||'').trim();
      if(!value)return;
      try{localStorage.setItem(LAST_STUDIO_STORAGE_KEY,value)}catch{}
    }

    function getAuthRedirectUrl(){
      if(window.location.protocol==='file:'){
        return 'https://13storiesphotography.github.io/dolomiten/dev/admin';
      }
      const url=new URL(window.location.href);
      url.hash='';
      url.search='';
      return url.href;
    }

    function hasRecoveryHash(){
      const hash=String(window.location.hash||'');
      return hash.includes('type=recovery')||hash.includes('type=signup');
    }

    async function fetchUserProfile(userId){
      if(!db||!userId)return null;
      try{
        const {data,error}=await db.from('profiles').select('display_name,studio_name,role').eq('id',userId).maybeSingle();
        if(error)return null;
        return data||null;
      }catch{
        return null;
      }
    }

    async function resolveStudioNameForUser(user){
      if(!user)return '';
      const profile=await fetchUserProfile(user.id);
      cachedProfile=profile;
      const fromProfile=String(profile?.studio_name||'').trim();
      if(fromProfile)return fromProfile;
      const fromMeta=String(user.user_metadata?.studio_name||'').trim();
      if(fromMeta)return fromMeta;
      return DEFAULT_STUDIO_FALLBACK;
    }

    async function rememberStudioForUser(user){
      const studio=await resolveStudioNameForUser(user);
      if(studio)writeLastStudioName(studio);
      return studio;
    }

    function renderLoginBranding(){
      const titleEl=$('loginWorkTitle');
      const subtitleEl=$('loginStudioSubtitle');
      if(titleEl)titleEl.textContent=APP_WORK_TITLE;
      const studio=readLastStudioName();
      if(!subtitleEl)return;
      if(studio){
        subtitleEl.textContent=studio;
        subtitleEl.hidden=false;
      }else{
        subtitleEl.textContent='';
        subtitleEl.hidden=true;
      }
    }

    function syncAuthenticatedChrome(session){
      document.body.classList.toggle('is-authenticated',!!session&&!passwordRecoveryActive);
      const topStudio=$('topStudioName');
      const profileBtn=$('profileBtn');
      const logoutBtn=$('logoutBtn');
      if(profileBtn)profileBtn.classList.toggle('hidden',!session||passwordRecoveryActive);
      if(logoutBtn)logoutBtn.classList.toggle('hidden',!session||passwordRecoveryActive);
      if(topStudio&&session&&!passwordRecoveryActive){
        const studio=readLastStudioName();
        topStudio.textContent=studio||DEFAULT_STUDIO_FALLBACK;
      }
    }

    function setLoginView(mode){
      $('loginFormView')?.classList.toggle('hidden',mode!=='login');
      $('forgotPasswordView')?.classList.toggle('hidden',mode!=='forgot');
      $('recoveryPasswordView')?.classList.toggle('hidden',mode!=='recovery');
    }

    function showLoginMessage(message,{isError=false}={}){
      const box=$('loginMessageBox');
      if(!box)return;
      if(!message){box.classList.add('hidden');box.textContent='';box.classList.remove('is-error','is-success');return}
      box.textContent=message;
      box.classList.remove('hidden','is-error','is-success');
      box.classList.add(isError?'is-error':'is-success');
    }

    function hideAppChrome(){
      loginBox?.classList.remove('hidden');
      adminBox?.classList.add('hidden');
      calendarBox?.classList.add('hidden');
      locationsBox?.classList.add('hidden');
      toolbar?.classList.add('hidden');
      viewTabs?.classList.add('hidden');
      addBtn?.classList.add('hidden');
      $('profileBtn')?.classList.add('hidden');
      whatsNewBtn?.classList.add('hidden');
      document.body.classList.remove('is-authenticated');
      renderLoginBranding();
      syncAuthenticatedChrome(null);
      setStatus('');
    }

    function showPasswordRecoveryUI(){
      passwordRecoveryActive=true;
      hideAppChrome();
      setLoginView('recovery');
      showLoginMessage('Bitte lege ein neues Passwort fest.');
      clearError();
    }

    function isPasswordRecoveryActive(){
      return passwordRecoveryActive||hasRecoveryHash();
    }

    async function handleForgotPassword(){
      clearError();
      const email=($('forgotEmail')?.value||$('email')?.value||'').trim();
      if(!email){showLoginMessage('Bitte E-Mail eingeben.',{isError:true});return}
      const btn=$('forgotPasswordSendBtn');
      if(btn)btn.disabled=true;
      try{
        const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:getAuthRedirectUrl()});
        if(error){showLoginMessage('E-Mail konnte nicht gesendet werden: '+error.message,{isError:true});return}
        showLoginMessage('Falls ein Konto existiert, ist eine E-Mail mit dem Link unterwegs. Posteingang und Spam prüfen.');
      }catch(error){
        showLoginMessage('E-Mail konnte nicht gesendet werden: '+(error.message||error),{isError:true});
      }finally{
        if(btn)btn.disabled=false;
      }
    }

    async function handleRecoveryPassword(){
      clearError();
      const password=$('recoveryPassword')?.value||'';
      const confirm=$('recoveryPasswordConfirm')?.value||'';
      if(!password||password.length<8){showLoginMessage('Passwort mindestens 8 Zeichen.',{isError:true});return}
      if(password!==confirm){showLoginMessage('Passwörter stimmen nicht überein.',{isError:true});return}
      const btn=$('recoveryPasswordBtn');
      if(btn)btn.disabled=true;
      try{
        const {error}=await db.auth.updateUser({password});
        if(error){showLoginMessage('Passwort konnte nicht gespeichert werden: '+error.message,{isError:true});return}
        passwordRecoveryActive=false;
        if(window.location.hash)history.replaceState(null,'',window.location.pathname+window.location.search);
        showLoginMessage('Passwort gespeichert — du wirst eingeloggt…');
        setLoginView('login');
        await boot();
      }catch(error){
        showLoginMessage('Passwort konnte nicht gespeichert werden: '+(error.message||error),{isError:true});
      }finally{
        if(btn)btn.disabled=false;
      }
    }

    function setProfileDialogOpen(open){
      const dialog=$('profileDialog');
      if(!dialog)return;
      dialog.classList.toggle('hidden',!open);
      dialog.setAttribute('aria-hidden',open?'false':'true');
      document.body.classList.toggle('event-dialog-open',open);
    }

    async function openProfileDialog(){
      const {data}=await db.auth.getSession();
      const session=data?.session;
      if(!session)return;
      const profile=await fetchUserProfile(session.user.id)||cachedProfile;
      cachedProfile=profile;
      const displayName=String(profile?.display_name||'').trim()||session.user.email;
      const studio=String(profile?.studio_name||'').trim()||readLastStudioName()||DEFAULT_STUDIO_FALLBACK;
      const role=String(profile?.role||'').trim();
      $('profileDisplayName').textContent=displayName;
      $('profileStudioName').textContent=studio;
      $('profileEmail').textContent=session.user.email;
      $('profileRole').textContent=role||'—';
      $('profileNewPassword').value='';
      $('profileNewPasswordConfirm').value='';
      $('profilePasswordMessage').textContent='';
      $('profilePasswordMessage').className='hint profile-password-message hidden';
      setProfileDialogOpen(true);
    }

    async function handleProfilePasswordChange(){
      const password=$('profileNewPassword')?.value||'';
      const confirm=$('profileNewPasswordConfirm')?.value||'';
      const msg=$('profilePasswordMessage');
      if(!password){if(msg){msg.textContent='';msg.classList.add('hidden')}return}
      if(password.length<8){msg.textContent='Mindestens 8 Zeichen.';msg.classList.remove('hidden','is-success');msg.classList.add('is-error');return}
      if(password!==confirm){msg.textContent='Passwörter stimmen nicht überein.';msg.classList.remove('hidden','is-success');msg.classList.add('is-error');return}
      const btn=$('profilePasswordSaveBtn');
      if(btn)btn.disabled=true;
      try{
        const {error}=await db.auth.updateUser({password});
        if(error){msg.textContent=error.message;msg.classList.remove('hidden','is-success');msg.classList.add('is-error');return}
        $('profileNewPassword').value='';
        $('profileNewPasswordConfirm').value='';
        msg.textContent='Passwort gespeichert.';
        msg.classList.remove('hidden','is-error');
        msg.classList.add('is-success');
        showToast('Passwort gespeichert');
      }catch(error){
        msg.textContent=error.message||String(error);
        msg.classList.remove('hidden','is-success');
        msg.classList.add('is-error');
      }finally{
        if(btn)btn.disabled=false;
      }
    }

    async function handleProfileLogout(){
      setProfileDialogOpen(false);
      if(typeof clearAdminDraftSession==='function')clearAdminDraftSession();
      try{await db.auth.signOut({scope:'global'})}catch{await db.auth.signOut()}
      await boot();
    }

    function bindAuthListeners(){
      if(authListenersBound)return;
      authListenersBound=true;

      db.auth.onAuthStateChange((event)=>{
        if(event==='PASSWORD_RECOVERY')showPasswordRecoveryUI();
      });

      $('forgotPasswordLink')?.addEventListener('click',event=>{
        event.preventDefault();
        clearError();
        showLoginMessage('');
        const email=$('email')?.value?.trim();
        if(email&&$('forgotEmail'))$('forgotEmail').value=email;
        setLoginView('forgot');
      });
      $('forgotPasswordBackBtn')?.addEventListener('click',event=>{
        event.preventDefault();
        showLoginMessage('');
        setLoginView('login');
      });
      $('forgotPasswordSendBtn')?.addEventListener('click',event=>{event.preventDefault();handleForgotPassword()});
      $('recoveryPasswordBtn')?.addEventListener('click',event=>{event.preventDefault();handleRecoveryPassword()});
      $('profileBtn')?.addEventListener('click',event=>{event.preventDefault();openProfileDialog()});
      $('logoutBtn')?.addEventListener('click',event=>{event.preventDefault();handleProfileLogout()});
      $('profileCloseBtn')?.addEventListener('click',event=>{event.preventDefault();setProfileDialogOpen(false)});
      $('profileLogoutBtn')?.addEventListener('click',event=>{event.preventDefault();handleProfileLogout()});
      $('profilePasswordSaveBtn')?.addEventListener('click',event=>{event.preventDefault();handleProfilePasswordChange()});
      $('profileDialog')?.addEventListener('click',event=>{if(event.target===$('profileDialog'))setProfileDialogOpen(false)});
      ['forgotEmail','recoveryPassword','recoveryPasswordConfirm'].forEach(id=>{
        $(id)?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(id==='forgotEmail')handleForgotPassword();else handleRecoveryPassword()}});
      });
    }

    function initAuth(){
      bindAuthListeners();
      if(hasRecoveryHash())passwordRecoveryActive=true;
    }

    window.renderLoginBranding=renderLoginBranding;
    window.syncAuthenticatedChrome=syncAuthenticatedChrome;
    window.rememberStudioForUser=rememberStudioForUser;
    window.readLastStudioName=readLastStudioName;
    window.initAuth=initAuth;
    window.isPasswordRecoveryActive=isPasswordRecoveryActive;
    window.showPasswordRecoveryUI=showPasswordRecoveryUI;
    window.setLoginView=setLoginView;
    window.fetchUserProfile=fetchUserProfile;
    window.setProfileDialogOpen=setProfileDialogOpen;
