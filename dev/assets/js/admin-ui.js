    function setAddMenuOpen(open){addMenu.classList.toggle('hidden',false);addMenu.classList.toggle('is-open',open);document.body.classList.toggle('add-menu-open',open);addMenu.setAttribute('aria-hidden',open?'false':'true');addBtn.classList.toggle('is-open',open);addBtn.setAttribute('aria-expanded',open?'true':'false');if(!open)setTimeout(()=>{if(!addMenu.classList.contains('is-open'))addMenu.classList.add('hidden')},260)}

    function toggleAddMenu(){setAddMenuOpen(!addMenu.classList.contains('is-open'))}

    async function setView(view){
      if(view!==currentView&&dirtyForms.size&&!isRestoringAdminSession&&!confirm('Du hast ungespeicherte Änderungen. Ansicht trotzdem wechseln?'))return;
      currentView=normalizeAdminView(view);
      writeStoredAdminView(currentView);
      const isList=currentView==='timeline';
      const isCalendar=currentView==='calendar';
      const isLocations=currentView==='locations';
      adminBox.classList.toggle('hidden',!isList);
      calendarBox.classList.toggle('hidden',!isCalendar);
      locationsBox.classList.toggle('hidden',!isLocations);
      toolbar.classList.toggle('hidden',!isList&&!isCalendar);
      viewTabs.classList.remove('locations-active','calendar-active');
      if(isLocations)viewTabs.classList.add('locations-active');
      if(isCalendar)viewTabs.classList.add('calendar-active');
      timelineTab.classList.toggle('active',isList);
      calendarTab.classList.toggle('active',isCalendar);
      locationsTab.classList.toggle('active',isLocations);
      addBtn.setAttribute('aria-label','Neu erstellen');
      if(isCalendar&&typeof renderCalendar==='function')renderCalendar();
      if(isLocations){
        if(!locations.length)await loadLocations();
        else if(typeof renderLocations==='function')renderLocations();
      }
      if(typeof refreshAppStatus==='function')refreshAppStatus();
    }

    async function runAddAction(action){
      if(action==='location'){setAddMenuOpen(false);await setView('locations');await createNewLocation();return}
      await setView('timeline');
      if(action==='event'){setAddMenuOpen(false);activeProject='all';activeStatus='all';activeWorkflowFilter='all';const pf=$('projectFilter');if(pf)pf.value='all';syncStatusButtons();syncWorkflowFilterButtons();await createNewEvent();return}
      setAddMenuOpen(false);
      await createNewRow(defaultsForCurrentEventFilters());
    }
    
    function syncStatusButtons(){document.querySelectorAll('[data-status-filter]').forEach(b=>b.classList.toggle('active',activeStatus!=='all'&&b.dataset.statusFilter===activeStatus))}

    function syncWorkflowFilterButtons(){
      document.querySelectorAll('[data-workflow-filter]').forEach(b=>b.classList.toggle('active',activeWorkflowFilter!=='all'&&b.dataset.workflowFilter===activeWorkflowFilter));
    }

    function renderWorkflowFilterButtons(){
      const toolbar=$('workflowStatusToolbar');
      if(!toolbar)return;
      const labels=[...new Set([...workflowStatusPresets,...readCustomWorkflowStatuses()])];
      toolbar.innerHTML=`<span class="toolbar-filter-label">Planung</span>${labels.map(label=>{
        const slug=workflowSlug(label);
        return `<button class="pill-button" type="button" data-workflow-filter="${escapeHtml(slug)}" title="Nur Shootings ohne Event-Zuordnung">${escapeHtml(label)}</button>`;
      }).join('')}`;
      toolbar.querySelectorAll('[data-workflow-filter]').forEach(b=>b.addEventListener('click',()=>setWorkflowFilter(b.dataset.workflowFilter)));
      syncWorkflowFilterButtons();
    }

    function setWorkflowFilter(filter){
      if(dirtyForms.size&&!confirm('Du hast ungespeicherte Änderungen. Filter trotzdem wechseln?'))return;
      activeWorkflowFilter=activeWorkflowFilter===filter?'all':filter;
      orderDirty=false;
      updateOrderButton();
      updateUnsavedBar();
      syncWorkflowFilterButtons();
      renderAll();
    }

    function setStatusFilter(filter){if(dirtyForms.size&&!confirm('Du hast ungespeicherte Änderungen. Filter trotzdem wechseln?'))return;activeStatus=activeStatus===filter?'all':filter;orderDirty=false;updateOrderButton();updateUnsavedBar();syncStatusButtons();renderAll()}

    function setProjectFilter(filter){if(dirtyForms.size&&!confirm('Du hast ungespeicherte Änderungen. Filter trotzdem wechseln?'))return;activeProject=filter;if(filter==='all')activeStatus='all';orderDirty=false;updateOrderButton();updateUnsavedBar();const pf=$('projectFilter');if(pf)pf.value=filter;syncStatusButtons();renderAll()}

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
    logoutBtn.addEventListener('click',async()=>{clearAdminDraftSession();await db.auth.signOut();await boot()});
    whatsNewBtn.addEventListener('click',toggleFeaturePanel);eventNameForm.addEventListener('submit',event=>{event.preventDefault();resolveEventName(eventNameInput.value)});eventNameCancel.addEventListener('click',()=>resolveEventName(null));addBtn.addEventListener('click',event=>{event.preventDefault();toggleAddMenu()});addMenu.querySelectorAll('[data-add-action]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();runAddAction(button.dataset.addAction)}));document.addEventListener('pointerdown',event=>{if(addMenu.classList.contains('is-open')&&!event.target.closest('#addMenu')&&!event.target.closest('#addBtn'))setAddMenuOpen(false)});document.addEventListener('keydown',event=>{if(event.key==='Escape'){setAddMenuOpen(false);if(!eventNameDialog.classList.contains('hidden'))resolveEventName(null);if(typeof setIcsDialogOpen==='function'&&!$('icsImportDialog')?.classList.contains('hidden'))setIcsDialogOpen(false,{clearSession:true})}});searchInput.addEventListener('input',()=>{orderDirty=false;updateOrderButton();updateUnsavedBar();renderAll()});locationSearchInput.addEventListener('input',renderLocations);countryFilter.addEventListener('change',renderLocations);regionFilter.addEventListener('change',renderLocations);categoryFilter.addEventListener('change',renderLocations);favoriteLocationsBtn.addEventListener('click',()=>{locationFavoritesOnly=!locationFavoritesOnly;syncLocationFavoritesFilterBtn();renderLocations()});syncLocationFavoritesFilterBtn();if(typeof syncLocationSortSelect==='function')syncLocationSortSelect();if(typeof syncLocationGroupSelect==='function')syncLocationGroupSelect();locationSortSelect?.addEventListener('change',event=>{if(typeof setLocationSort==='function')setLocationSort(event.currentTarget.value)});locationGroupSelect?.addEventListener('change',event=>{if(typeof setLocationGroup==='function')setLocationGroup(event.currentTarget.value)});timelineTab.addEventListener('click',()=>setView('timeline'));calendarTab.addEventListener('click',()=>setView('calendar'));locationsTab.addEventListener('click',()=>setView('locations'));saveOpenBtn.addEventListener('click',async()=>{const dirtyIds=[...dirtyForms];const forms=dirtyIds.map(id=>shootingsEl.querySelector(`form[data-id="${id}"]`)).filter(Boolean);for(const form of forms){await saveForm({preventDefault(){},currentTarget:form})}});discardOpenBtn.addEventListener('click',discardOpenChanges);refreshDataBtn?.addEventListener('click',()=>refreshAdminData());window.addEventListener('beforeunload',()=>{if(typeof persistAdminDrafts==='function')persistAdminDrafts()});window.addEventListener('beforeunload',e=>{const icsOpen=typeof hasOpenIcsImport==='function'&&hasOpenIcsImport();if(!hasUnsavedChanges()&&!icsOpen)return;e.preventDefault();e.returnValue=''});document.querySelectorAll('[data-status-filter]').forEach(b=>b.addEventListener('click',()=>setStatusFilter(b.dataset.statusFilter)));$('projectFilter')?.addEventListener('change',event=>setProjectFilter(event.currentTarget.value));

    async function boot(){clearError();const {data,error}=await db.auth.getSession();if(error){setStatus('Session Fehler');showError('Session Fehler: '+error.message);return}const session=data.session;loginBox.classList.toggle('hidden',!!session);const show=!!session;adminBox.classList.toggle('hidden',!show||currentView!=='timeline');calendarBox.classList.toggle('hidden',!show||currentView!=='calendar');toolbar.classList.toggle('hidden',!show||currentView==='locations');viewTabs.classList.toggle('hidden',!show);locationsBox.classList.toggle('hidden',!show||currentView!=='locations');logoutBtn.classList.toggle('hidden',!show);whatsNewBtn.classList.toggle('hidden',!show);setFeaturePanelOpen(false);setAddMenuOpen(false);addMenu.classList.add('hidden');addBtn.classList.toggle('hidden',!show);currentView=normalizeAdminView(currentView);viewTabs.classList.toggle('locations-active',currentView==='locations');viewTabs.classList.toggle('calendar-active',currentView==='calendar');timelineTab.classList.toggle('active',currentView==='timeline');calendarTab.classList.toggle('active',currentView==='calendar');locationsTab.classList.toggle('active',currentView==='locations');if(!session){clearAdminDraftSession();setStatus('Nicht angemeldet');return}renderWorkflowFilterButtons();setStatus('Angemeldet als '+session.user.email);await loadShootings({skipConfirm:true});
      if(typeof restoreIcsImportSession==='function'){
        isRestoringAdminSession=true;
        try{await restoreIcsImportSession()}finally{isRestoringAdminSession=false}
      }
      if(typeof restoreEventNameDialog==='function')restoreEventNameDialog();
    }
    try{initSupabase();boot()}catch(error){setStatus('Shooting Planer konnte nicht starten');showError(error.message+' · Prüfe, ob der Supabase Script-Tag korrekt geladen wird.');console.error(error)}
