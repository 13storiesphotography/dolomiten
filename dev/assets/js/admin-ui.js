    function setAddMenuOpen(open){addMenu.classList.toggle('hidden',false);addMenu.classList.toggle('is-open',open);document.body.classList.toggle('add-menu-open',open);addMenu.setAttribute('aria-hidden',open?'false':'true');addBtn.classList.toggle('is-open',open);addBtn.setAttribute('aria-expanded',open?'true':'false');if(!open)setTimeout(()=>{if(!addMenu.classList.contains('is-open'))addMenu.classList.add('hidden')},260)}

    function toggleAddMenu(){setAddMenuOpen(!addMenu.classList.contains('is-open'))}

    async function setView(view){currentView=view;const isTimeline=view==='timeline';adminBox.classList.toggle('hidden',!isTimeline);locationsBox.classList.toggle('hidden',isTimeline);toolbar.classList.toggle('hidden',!isTimeline);viewTabs.classList.toggle('locations-active',!isTimeline);timelineTab.classList.toggle('active',isTimeline);locationsTab.classList.toggle('active',!isTimeline);addBtn.setAttribute('aria-label','Neu erstellen');if(!isTimeline&&!locations.length)await loadLocations()}

    async function runAddAction(action){
      if(action==='location'){setAddMenuOpen(false);await setView('locations');await createNewLocation();return}
      await setView('timeline');
      if(action==='event'){setAddMenuOpen(false);activeProject='all';activeStatus='all';projectFilter.value='all';syncStatusButtons();await createNewEvent();return}
      setAddMenuOpen(false);
      await createNewRow(defaultsForCurrentEventFilters());
    }
    
    function syncStatusButtons(){document.querySelectorAll('[data-status-filter]').forEach(b=>b.classList.toggle('active',activeStatus!=='all'&&b.dataset.statusFilter===activeStatus))}

    function setStatusFilter(filter){if(dirtyForms.size&&!confirm('Du hast ungespeicherte Änderungen. Filter trotzdem wechseln?'))return;activeStatus=activeStatus===filter?'all':filter;orderDirty=false;updateOrderButton();updateUnsavedBar();syncStatusButtons();renderAll()}

    function setProjectFilter(filter){if(dirtyForms.size&&!confirm('Du hast ungespeicherte Änderungen. Filter trotzdem wechseln?'))return;activeProject=filter;if(filter==='all')activeStatus='all';orderDirty=false;updateOrderButton();updateUnsavedBar();projectFilter.value=filter;syncStatusButtons();renderAll()}

    async function handleLogin(){
      clearError();
      const email=$('email').value.trim(),password=$('password').value;
      if(!email||!password){showError('Bitte E-Mail und Passwort eingeben.');return}
      setStatus('Login läuft…');
      loginBtn.disabled=true;
      try{
        const loginPromise=db.auth.signInWithPassword({email,password});
        const timeoutPromise=new Promise(resolve=>setTimeout(()=>resolve({error:{message:'Login dauert ungewöhnlich lange. Bitte Internet/Supabase prüfen.'}}),15000));
        const {error}=await Promise.race([loginPromise,timeoutPromise]);
        if(error){setStatus('Login fehlgeschlagen');showError('Login fehlgeschlagen: '+error.message);return}
        setStatus('Login erfolgreich · lade Daten…');
        await boot();
      }catch(error){
        setStatus('Login fehlgeschlagen');
        showError('Login fehlgeschlagen: '+(error.message||error));
      }finally{
        loginBtn.disabled=false;
      }
    }
    loginBtn.addEventListener('click',handleLogin);
    ['email','password'].forEach(id=>$(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();handleLogin()}}));
    logoutBtn.addEventListener('click',async()=>{await db.auth.signOut();await boot()});
    whatsNewBtn.addEventListener('click',toggleFeaturePanel);document.addEventListener('pointermove',event=>moveNewsButtonToPanelEdge(event.clientX,event.clientY));window.addEventListener('resize',()=>{if(!featurePanel.classList.contains('hidden'))resetNewsButtonPosition()});eventNameForm.addEventListener('submit',event=>{event.preventDefault();resolveEventName(eventNameInput.value)});eventNameCancel.addEventListener('click',()=>resolveEventName(null));addBtn.addEventListener('click',event=>{event.preventDefault();toggleAddMenu()});addMenu.querySelectorAll('[data-add-action]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();runAddAction(button.dataset.addAction)}));document.addEventListener('pointerdown',event=>{if(addMenu.classList.contains('is-open')&&!event.target.closest('#addMenu')&&!event.target.closest('#addBtn'))setAddMenuOpen(false)});document.addEventListener('keydown',event=>{if(event.key==='Escape'){setAddMenuOpen(false);if(!eventNameDialog.classList.contains('hidden'))resolveEventName(null)}});searchInput.addEventListener('input',()=>{orderDirty=false;updateOrderButton();updateUnsavedBar();renderAll()});locationSearchInput.addEventListener('input',renderLocations);countryFilter.addEventListener('change',renderLocations);regionFilter.addEventListener('change',renderLocations);categoryFilter.addEventListener('change',renderLocations);newLocationBtn.addEventListener('click',createNewLocation);reloadLocationsBtn.addEventListener('click',loadLocations);favoriteLocationsBtn.addEventListener('click',()=>{locationFavoritesOnly=!locationFavoritesOnly;favoriteLocationsBtn.classList.toggle('primary',locationFavoritesOnly);favoriteLocationsBtn.textContent=locationFavoritesOnly?'★ Favoriten':'☆ Favoriten';renderLocations()});timelineTab.addEventListener('click',()=>setView('timeline'));locationsTab.addEventListener('click',()=>setView('locations'));saveOpenBtn.addEventListener('click',async()=>{const dirtyIds=[...dirtyForms];const forms=dirtyIds.map(id=>shootingsEl.querySelector(`form[data-id="${id}"]`)).filter(Boolean);for(const form of forms){await saveForm({preventDefault(){},currentTarget:form})}});discardOpenBtn.addEventListener('click',discardOpenChanges);window.addEventListener('beforeunload',e=>{if(!hasUnsavedChanges())return;e.preventDefault();e.returnValue=''});document.querySelectorAll('[data-status-filter]').forEach(b=>b.addEventListener('click',()=>setStatusFilter(b.dataset.statusFilter)));projectFilter.addEventListener('change',()=>setProjectFilter(projectFilter.value));

    async function boot(){clearError();const {data,error}=await db.auth.getSession();if(error){setStatus('Session Fehler');showError('Session Fehler: '+error.message);return}const session=data.session;loginBox.classList.toggle('hidden',!!session);adminBox.classList.toggle('hidden',!session);toolbar.classList.toggle('hidden',!session||currentView!=='timeline');viewTabs.classList.toggle('hidden',!session);locationsBox.classList.toggle('hidden',!session||currentView!=='locations');logoutBtn.classList.toggle('hidden',!session);whatsNewBtn.classList.toggle('hidden',!session);setFeaturePanelOpen(false);setAddMenuOpen(false);addMenu.classList.add('hidden');addBtn.classList.toggle('hidden',!session);if(!session){setStatus('Nicht angemeldet');return}setStatus('Angemeldet als '+session.user.email);await loadShootings()}
    try{initSupabase();boot()}catch(error){setStatus('Admin konnte nicht starten');showError(error.message+' · Prüfe, ob der Supabase Script-Tag korrekt geladen wird.');console.error(error)}
