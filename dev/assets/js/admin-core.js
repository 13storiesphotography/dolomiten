    const SUPABASE_URL='https://hidqxungaqlzyzsxjfqb.supabase.co';
    const SUPABASE_KEY='sb_publishable_sbU-WVaWQh4x_vC14dnd6w_otutO8f8';
    const MAPS_RESOLVER_URL='https://maps-resolveryournameworkersdev.florian-e6d.workers.dev';

    const $=id=>document.getElementById(id);
    const statusEl=$('status'),errorBox=$('errorBox'),loginBox=$('loginBox'),adminBox=$('adminBox'),toolbar=$('toolbar'),shootingsEl=$('shootings'),loginBtn=$('loginBtn'),logoutBtn=$('logoutBtn'),addBtn=$('addBtn'),addMenu=$('addMenu'),eventNameDialog=$('eventNameDialog'),eventNameForm=$('eventNameForm'),eventNameInput=$('eventNameInput'),eventNameCancel=$('eventNameCancel'),toast=$('toast'),searchInput=$('searchInput'),statUpdated=$('statUpdated'),saveOrderBtn=$('saveOrderBtn'),whatsNewBtn=$('whatsNewBtn'),featurePanel=$('featurePanel'),unsavedBar=$('unsavedBar'),unsavedText=$('unsavedText'),saveOpenBtn=$('saveOpenBtn'),discardOpenBtn=$('discardOpenBtn'),viewTabs=$('viewTabs'),timelineTab=$('timelineTab'),locationsTab=$('locationsTab'),locationsBox=$('locationsBox'),locationsList=$('locationsList'),newLocationBtn=$('newLocationBtn'),reloadLocationsBtn=$('reloadLocationsBtn'),favoriteLocationsBtn=$('favoriteLocationsBtn'),locationSearchInput=$('locationSearchInput'),countryFilter=$('countryFilter'),regionFilter=$('regionFilter'),categoryFilter=$('categoryFilter'),projectFilter=$('projectFilter');

    let db=null,rows=[],events=[],locations=[],currentRowsById={},currentEventsById={},currentLocationsById={},activeStatus='all',activeProject='all',currentView='timeline',locationFavoritesOnly=false,toastTimer=null,draggedCard=null,orderDirty=false,dirtyForms=new Set();
    let pendingEventNameResolve=null;

    const badgePresets=['Goldene Stunde','Picknick','Sonnenaufgang','Farben','Paar-Momente','Kreativ','Aussicht','Gitarre','Goldenes Licht','Spaziergang','Ruhe','Portraits','Perspektiven','Gemeinsame Bilder','Dolomiten','Natur','Abenteuer'];
    const projectStatusLabels={aktiv:'Aktiv',abgeschlossen:'Abgeschlossen',archiviert:'Archiv'};
    const dayOptions=['Freitag','Samstag','Sonntag'];
    const spotPresets={
      'Val di Funes':{image_url:'https://www.montagnaestate.it/wp-content/uploads/val-di-funes-al-tramonto-in-estate-890x593.jpg',location_name:'Val di Funes',title:'Shooting „Val di Funes“'},
      'Seiser-Alm-Panorama':{image_url:'https://mountainmoments.de/wp-content/uploads/2021/06/mountainmoments-95.jpg',location_name:'Seiser-Alm-Panorama',title:'Shooting #1 · Seiser-Alm-Panorama'},
      'Langental':{image_url:'https://www.val-gardena.com/fileadmin/_processed_/0/9/csm_pra-da-ri-langental-02_de2ca4ac91.jpg',location_name:'Langental',title:'Shooting #2 · Langental'},
      'Grödner Joch':{image_url:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80',location_name:'Grödner Joch',title:'Shooting #1 · Grödner Joch'},
      'Lago Pian Da Mur':{image_url:'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80',location_name:'Lago Pian Da Mur',title:'Shooting #2 · Lago Pian Da Mur'},
      'Passo Pordoi':{image_url:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1800&q=80',location_name:'Passo Pordoi',title:'Shooting #3 · Passo Pordoi'}
    };

    const simpleFields=[['title','Titel','text'],['date_label','Datum','date'],['subtitle','Untertitel / Mood','text']];
    const projectFields=[['project_name','Event / Projekt','event-select']];
    const timeFields=[['meeting_time','Treffzeit','time'],['shooting_time','Shootingzeit','time']];
    const placeFields=[['location_id','Location-Bibliothek','location-select']];
    const manualPlaceFields=[['location_name','Location','text'],['meeting_place','Treffpunkt / Adresse','text']];
    const linkFields=[['meeting_link','Treffpunkt Maps-Link','url'],['location_link','Location Maps-Link','url'],['image_url','Bild URL','url']];
    const allFieldGroups=[...simpleFields,...projectFields,...timeFields,...placeFields,...manualPlaceFields,...linkFields];

    function setStatus(m){statusEl.textContent=m}
    function showError(m){errorBox.textContent=m;errorBox.classList.remove('hidden')}
    function clearError(){errorBox.textContent='';errorBox.classList.add('hidden')}
    function showToast(m='Gespeichert'){toast.textContent=m;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1800)}
    function formatError(e){return e?[e.message,e.code?'Code: '+e.code:'',e.details?'Details: '+e.details:'',e.hint?'Hint: '+e.hint:''].filter(Boolean).join(' · '):'Unbekannter Fehler'}
    function escapeHtml(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")}
    function parseBadges(v){return Array.isArray(v)?v:String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
    function dateLabelToInput(v=''){const m=String(v||'').match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:''}
    function inputToDateLabel(v=''){const m=String(v||'').match(/(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:(v||null)}
    function timeToInput(v=''){const m=String(v||'').match(/(\d{1,2}):(\d{2})/);return m?`${String(m[1]).padStart(2,'0')}:${m[2]}`:''}
    function valueForInput(row,key,type='text'){const v=row[key];if(type==='select-project-status')return String(v||'')==='archiviert'?'archiviert':'auto';if((key==='location_name'||key==='meeting_place')&&String(v||'').trim()==='TBA')return '';if(Array.isArray(v))return v.join(', ');if(type==='date')return dateLabelToInput(v);if(type==='time')return timeToInput(v);return v??''}

    function initSupabase(){
      if(!window.supabase||typeof window.supabase.createClient!=='function')throw new Error('Supabase SDK nicht geladen');
      db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    }

    function canSortNow(){return activeStatus==='all'&&activeProject==='all'&&!searchInput.value.trim()}
    function updateOrderButton(){saveOrderBtn.disabled=!orderDirty;saveOrderBtn.classList.toggle('primary',orderDirty)}
    function hasUnsavedChanges(){return orderDirty||dirtyForms.size>0}
    function updateUnsavedBar(){if(!unsavedBar)return;const total=dirtyForms.size+(orderDirty?1:0);unsavedText.textContent=orderDirty&&dirtyForms.size?'Reihenfolge + '+dirtyForms.size+' Shooting(s) ungespeichert':orderDirty?'Reihenfolge ungespeichert':dirtyForms.size?dirtyForms.size+' Shooting(s) ungespeichert':'Alles gespeichert';unsavedBar.classList.toggle('show',total>0)}
    function readProjectGroupState(){try{return JSON.parse(localStorage.getItem('adminProjectGroups')||'{}')}catch{return {}}}
    function writeProjectGroupState(state){try{localStorage.setItem('adminProjectGroups',JSON.stringify(state))}catch{}}
    function projectGroupKey(group){return group.eventId?`event:${group.eventId}`:`project:${group.project||'__unassigned__'}`}
    function isProjectGroupOpen(group){return readProjectGroupState()[projectGroupKey(group)]===true}
    function setProjectGroupOpen(key,open){const state=readProjectGroupState();state[key]=open;writeProjectGroupState(state)}
    function setFormDirty(form,dirty=true){const id=form?.dataset?.id;if(!id)return;const card=form.closest('.spot-card'),btn=form.querySelector('.form-save-btn'),state=form.querySelector('[data-save-state]');if(dirty){dirtyForms.add(id);card?.classList.add('is-dirty');btn?.classList.add('is-dirty');if(state)state.textContent='Nicht gespeichert'}else{dirtyForms.delete(id);card?.classList.remove('is-dirty');btn?.classList.remove('is-dirty');if(state)state.textContent='Gespeichert'}updateUnsavedBar()}
    function normalizeForCompare(value){return String(value??'').trim()}
    function snapshotForm(form){const payload=collectPayload(form);delete payload.updated_at;delete payload.weather_label;delete payload.weather_id;if(Array.isArray(payload.badges))payload.badges=[...payload.badges].map(normalizeForCompare).filter(Boolean).sort();Object.keys(payload).forEach(key=>{if(key!=='badges')payload[key]=normalizeForCompare(payload[key])});return JSON.stringify(payload)}
    function setFormBaseline(form){form.dataset.baseline=snapshotForm(form)}
    function refreshFormDirtyState(form){if(!form.dataset.baseline)setFormBaseline(form);setFormDirty(form,snapshotForm(form)!==form.dataset.baseline)}
    function clampValue(value,min,max){return Math.min(Math.max(value,min),max)}
    function moveNewsButtonToPanelEdge(clientX,clientY){
      if(featurePanel.classList.contains('hidden'))return;
      const rect=featurePanel.getBoundingClientRect();
      const distances=[
        {edge:'top',value:Math.abs(clientY-rect.top)},
        {edge:'right',value:Math.abs(clientX-rect.right)},
        {edge:'bottom',value:Math.abs(clientY-rect.bottom)},
        {edge:'left',value:Math.abs(clientX-rect.left)}
      ].sort((a,b)=>a.value-b.value);
      const edge=distances[0].edge;
      let x=clientX,y=clientY;
      if(edge==='top'||edge==='bottom'){
        x=clampValue(clientX,rect.left,rect.right);
        y=edge==='top'?rect.top:rect.bottom;
      }else{
        x=edge==='left'?rect.left:rect.right;
        y=clampValue(clientY,rect.top,rect.bottom);
      }
      whatsNewBtn.style.setProperty('--news-x',`${x}px`);
      whatsNewBtn.style.setProperty('--news-y',`${y}px`);
    }
    function resetNewsButtonPosition(){
      const rect=featurePanel.getBoundingClientRect();
      whatsNewBtn.style.setProperty('--news-x',`${rect.right-18}px`);
      whatsNewBtn.style.setProperty('--news-y',`${rect.top}px`);
    }
    function setNewsHomePosition(){
      const rect=whatsNewBtn.getBoundingClientRect();
      whatsNewBtn.style.setProperty('--news-home-x',`${rect.left+rect.width/2}px`);
      whatsNewBtn.style.setProperty('--news-home-y',`${rect.top+rect.height/2}px`);
      whatsNewBtn.style.setProperty('--news-x',`${rect.left+rect.width/2}px`);
      whatsNewBtn.style.setProperty('--news-y',`${rect.top+rect.height/2}px`);
    }
    function finishNewsReturn(){
      whatsNewBtn.classList.add('is-settling');
      whatsNewBtn.classList.remove('is-open','is-returning');
      whatsNewBtn.closest('.top-actions')?.classList.remove('news-open');
      requestAnimationFrame(()=>requestAnimationFrame(()=>whatsNewBtn.classList.remove('is-settling')));
    }
    function setFeaturePanelOpen(open){
      if(open){
        document.body.classList.add('news-panel-open');
        setNewsHomePosition();
        featurePanel.classList.remove('hidden');
        whatsNewBtn.setAttribute('aria-expanded','true');
        whatsNewBtn.setAttribute('aria-label','Neuigkeiten schließen');
        whatsNewBtn.classList.remove('is-returning');
        whatsNewBtn.classList.add('is-open');
        whatsNewBtn.closest('.top-actions')?.classList.add('news-open');
        requestAnimationFrame(()=>requestAnimationFrame(resetNewsButtonPosition));
        return;
      }
      if(whatsNewBtn.classList.contains('is-open')){
        document.body.classList.remove('news-panel-open');
        featurePanel.classList.add('hidden');
        whatsNewBtn.setAttribute('aria-expanded','false');
        whatsNewBtn.setAttribute('aria-label','Neuigkeiten öffnen');
        whatsNewBtn.classList.add('is-returning');
        setTimeout(finishNewsReturn,280);
        return;
      }
      featurePanel.classList.add('hidden');
      document.body.classList.remove('news-panel-open');
      whatsNewBtn.setAttribute('aria-expanded','false');
      whatsNewBtn.setAttribute('aria-label','Neuigkeiten öffnen');
      whatsNewBtn.closest('.top-actions')?.classList.remove('news-open');
      whatsNewBtn.classList.remove('is-open','is-returning');
    }
    function toggleFeaturePanel(){setFeaturePanelOpen(featurePanel.classList.contains('hidden'))}

    function parseDateLabel(dateLabel){
      const parts=String(dateLabel||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if(!parts)return null;
      const [,day,month,year]=parts;
      const date=new Date(`${year}-${month}-${day}T00:00:00`);
      return Number.isFinite(date.getTime())?date:null;
    }

    function todayStart(){
      const now=new Date();
      return new Date(now.getFullYear(),now.getMonth(),now.getDate());
    }

    function autoStatusForRow(row){
      if(String(row.project_status||'')==='archiviert')return 'archiviert';
      const date=parseDateLabel(row.date_label);
      return date&&date<todayStart()?'abgeschlossen':'aktiv';
    }

    function normalizeRowStatus(row){
      return {...row,project_status:autoStatusForRow(row)};
    }

    function projectStatusForRows(projectRows){
      const statuses=projectRows.map(autoStatusForRow);
      if(statuses.length&&statuses.every(status=>status==='archiviert'))return 'archiviert';
      const visible=statuses.filter(status=>status!=='archiviert');
      return visible.length&&visible.every(status=>status==='abgeschlossen')?'abgeschlossen':'aktiv';
    }

    function parseTimeValue(time){
      const parts=String(time||'').match(/^(\d{1,2}):(\d{2})$/);
      if(!parts)return null;
      const value=Number(parts[1])*60+Number(parts[2]);
      return Number.isFinite(value)?value:null;
    }

    function sortRowsByDateAndTime(rows){
      return [...rows].sort((a,b)=>{
        const aDate=parseDateLabel(a.date_label);
        const bDate=parseDateLabel(b.date_label);
        if(aDate&&bDate){
          const dateDiff=aDate.getTime()-bDate.getTime();
          if(dateDiff)return dateDiff;
        } else if(aDate||bDate){
          return aDate? -1 : 1;
        }
        const aTime=parseTimeValue(a.meeting_time);
        const bTime=parseTimeValue(b.meeting_time);
        if(aTime!==null&&bTime!==null){
          const timeDiff=aTime-bTime;
          if(timeDiff)return timeDiff;
        } else if(aTime!==null||bTime!==null){
          return aTime!==null? -1 : 1;
        }
        const dayOrder={Freitag:1,Samstag:2,Sonntag:3};
        const aDay=dayOrder[a.day_label]||99;
        const bDay=dayOrder[b.day_label]||99;
        if(aDay!==bDay)return aDay-bDay;
        return (Number(a.sort_order||0) - Number(b.sort_order||0)) || String(a.title||'').localeCompare(String(b.title||''), 'de', {sensitivity:'base'});
      });
    }

