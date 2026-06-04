    const SUPABASE_URL='https://hidqxungaqlzyzsxjfqb.supabase.co';
    const SUPABASE_KEY='sb_publishable_sbU-WVaWQh4x_vC14dnd6w_otutO8f8';
    const MAPS_RESOLVER_URL='https://maps-resolveryournameworkersdev.florian-e6d.workers.dev';

    const $=id=>document.getElementById(id);
    const statusEl=$('status'),errorBox=$('errorBox'),loginBox=$('loginBox'),adminBox=$('adminBox'),calendarBox=$('calendarBox'),toolbar=$('toolbar'),shootingsEl=$('shootings'),loginBtn=$('loginBtn'),logoutBtn=$('logoutBtn'),addBtn=$('addBtn'),addMenu=$('addMenu'),eventNameDialog=$('eventNameDialog'),eventNameForm=$('eventNameForm'),eventNameInput=$('eventNameInput'),eventNameCancel=$('eventNameCancel'),toast=$('toast'),searchInput=$('searchInput'),statUpdated=$('statUpdated'),saveOrderBtn=$('saveOrderBtn'),refreshDataBtn=$('refreshDataBtn'),whatsNewBtn=$('whatsNewBtn'),featurePanel=$('featurePanel'),unsavedBar=$('unsavedBar'),unsavedText=$('unsavedText'),saveOpenBtn=$('saveOpenBtn'),discardOpenBtn=$('discardOpenBtn'),viewTabs=$('viewTabs'),timelineTab=$('timelineTab'),calendarTab=$('calendarTab'),locationsTab=$('locationsTab'),locationsBox=$('locationsBox'),locationsList=$('locationsList'),favoriteLocationsBtn=$('favoriteLocationsBtn'),locationSearchInput=$('locationSearchInput'),countryFilter=$('countryFilter'),regionFilter=$('regionFilter'),categoryFilter=$('categoryFilter'),projectFilter=$('projectFilter');

    let db=null,rows=[],events=[],locations=[],currentRowsById={},currentEventsById={},currentLocationsById={},activeStatus='all',activeWorkflowFilter='all',activeProject='all',currentView='timeline',locationFavoritesOnly=false,toastTimer=null,draggedCard=null,orderDirty=false,dirtyForms=new Set(),isRestoringAdminSession=false;
    let pendingEventNameResolve=null;

    const badgePresets=['Goldene Stunde','Picknick','Sonnenaufgang','Farben','Paar-Momente','Kreativ','Aussicht','Gitarre','Goldenes Licht','Spaziergang','Ruhe','Portraits','Perspektiven','Gemeinsame Bilder','Dolomiten','Natur','Abenteuer'];
    const locationOnlyTagPresets=['Parkplatz'];
    const projectStatusLabels={aktiv:'Aktiv',abgeschlossen:'Abgeschlossen',archiviert:'Archiv'};
    const workflowStatusPresets=['Angefragt','Option','Fix','Geplant','Bestätigt','Abgesagt'];
    const WORKFLOW_STATUS_STORAGE_KEY='dolomiten.shooting.workflow-statuses.v1';
    const dayOptions=['Freitag','Samstag','Sonntag'];
    const spotPresets={
      'Val di Funes':{image_url:'https://www.montagnaestate.it/wp-content/uploads/val-di-funes-al-tramonto-in-estate-890x593.jpg',location_name:'Val di Funes',title:'Shooting „Val di Funes“'},
      'Seiser-Alm-Panorama':{image_url:'https://mountainmoments.de/wp-content/uploads/2021/06/mountainmoments-95.jpg',location_name:'Seiser-Alm-Panorama',title:'Shooting #1 · Seiser-Alm-Panorama'},
      'Langental':{image_url:'https://www.val-gardena.com/fileadmin/_processed_/0/9/csm_pra-da-ri-langental-02_de2ca4ac91.jpg',location_name:'Langental',title:'Shooting #2 · Langental'},
      'Grödner Joch':{image_url:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80',location_name:'Grödner Joch',title:'Shooting #1 · Grödner Joch'},
      'Lago Pian Da Mur':{image_url:'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80',location_name:'Lago Pian Da Mur',title:'Shooting #2 · Lago Pian Da Mur'},
      'Passo Pordoi':{image_url:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1800&q=80',location_name:'Passo Pordoi',title:'Shooting #3 · Passo Pordoi'}
    };

    const basicsFields=[['title','Titel','text'],['subtitle','Untertitel / Mood','text']];
    const projectFields=[['project_name','Event / Projekt','event-select']];
    const scheduleFields=[['date_label','Datum','date'],['meeting_time','Beginn / Treff','time'],['shooting_time','Shooting ab','time'],['end_time','Ende','time']];
    const placeFields=[];
    const locationQuickFields=[['location_link','Maps-Link (Location)','url'],['image_url','Bild URL','url']];
    const meetingFields=[['meeting_place','Treffpunkt / Adresse','text'],['meeting_link','Maps-Link (Treff)','url']];
    const allFieldGroups=[...basicsFields,...projectFields,...scheduleFields,...placeFields,...locationQuickFields,...meetingFields];

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

    function rowMatchesWorkflowFilter(row){
      if(activeWorkflowFilter==='all')return true;
      if(isShootingBoundToEvent(row))return false;
      return displayStatusKeyForRow(row)===activeWorkflowFilter;
    }

    function canSortNow(){return activeStatus==='all'&&activeWorkflowFilter==='all'&&activeProject==='all'&&!searchInput.value.trim()}
    function updateOrderButton(){saveOrderBtn.disabled=!orderDirty;saveOrderBtn.classList.toggle('primary',orderDirty)}
    function hasUnsavedChanges(){return orderDirty||dirtyForms.size>0}
    function updateUnsavedBar(){if(!unsavedBar)return;const total=dirtyForms.size+(orderDirty?1:0);unsavedText.textContent=orderDirty&&dirtyForms.size?'Reihenfolge + '+dirtyForms.size+' Shooting(s) ungespeichert':orderDirty?'Reihenfolge ungespeichert':dirtyForms.size?dirtyForms.size+' Shooting(s) ungespeichert':'Alles gespeichert';unsavedBar.classList.toggle('show',total>0)}
    function readProjectGroupState(){try{return JSON.parse(localStorage.getItem('adminProjectGroups')||'{}')}catch{return {}}}
    function writeProjectGroupState(state){try{localStorage.setItem('adminProjectGroups',JSON.stringify(state))}catch{}}
    function projectGroupKey(group){return group.eventId?`event:${group.eventId}`:`project:${group.project||'__unassigned__'}`}
    function isProjectGroupOpen(group){return readProjectGroupState()[projectGroupKey(group)]===true}
    function setProjectGroupOpen(key,open){const state=readProjectGroupState();state[key]=open;writeProjectGroupState(state)}
    function setFormDirty(form,dirty=true){const id=form?.dataset?.id;if(!id)return;const card=form.closest('.spot-card'),btn=form.querySelector('.form-save-btn'),state=form.querySelector('[data-save-state]');if(dirty){dirtyForms.add(id);card?.classList.add('is-dirty');btn?.classList.add('is-dirty');if(state)state.textContent='Nicht gespeichert'}else{dirtyForms.delete(id);card?.classList.remove('is-dirty');btn?.classList.remove('is-dirty');if(state)state.textContent='Gespeichert'}updateUnsavedBar();if(typeof schedulePersistAdminDrafts==='function')schedulePersistAdminDrafts()}
    function normalizeForCompare(value){return String(value??'').trim()}
    function snapshotForm(form){const payload=collectPayload(form);delete payload.updated_at;delete payload.weather_label;delete payload.weather_id;if(Array.isArray(payload.badges))payload.badges=[...payload.badges].map(normalizeForCompare).filter(Boolean).sort();Object.keys(payload).forEach(key=>{if(key!=='badges')payload[key]=normalizeForCompare(payload[key])});return JSON.stringify(payload)}
    function setFormBaseline(form){form.dataset.baseline=snapshotForm(form)}
    function refreshFormDirtyState(form){if(!form.dataset.baseline)setFormBaseline(form);setFormDirty(form,snapshotForm(form)!==form.dataset.baseline)}
    function clampValue(value,min,max){return Math.min(Math.max(value,min),max)}
    let newsBtnHomeSlot=null;

    function rememberNewsBtnHomeSlot(){
      if(newsBtnHomeSlot)return;
      const parent=whatsNewBtn.parentElement;
      if(!parent)return;
      newsBtnHomeSlot={parent,next:whatsNewBtn.nextElementSibling};
    }

    function dockNewsBtnToPanel(){
      rememberNewsBtnHomeSlot();
      if(whatsNewBtn.parentElement===featurePanel)return;
      featurePanel.prepend(whatsNewBtn);
      whatsNewBtn.classList.add('is-docked');
    }

    function undockNewsBtnToHeader(){
      whatsNewBtn.classList.remove('is-docked','is-open','is-returning');
      const slot=newsBtnHomeSlot;
      const parent=slot?.parent||document.querySelector('.top-actions');
      const logoutBtn=$('logoutBtn');
      if(!parent)return;
      if(slot?.next&&slot.next.parentElement===parent)parent.insertBefore(whatsNewBtn,slot.next);
      else if(logoutBtn&&logoutBtn.parentElement===parent)parent.insertBefore(whatsNewBtn,logoutBtn);
      else parent.appendChild(whatsNewBtn);
    }

    function setFeaturePanelOpen(open){
      if(open){
        document.body.classList.add('news-panel-open');
        featurePanel.classList.remove('hidden');
        dockNewsBtnToPanel();
        whatsNewBtn.classList.add('is-open');
        whatsNewBtn.setAttribute('aria-expanded','true');
        whatsNewBtn.setAttribute('aria-label','Neuigkeiten schließen');
        whatsNewBtn.closest('.top-actions')?.classList.add('news-open');
        return;
      }
      if(whatsNewBtn.classList.contains('is-open')){
        whatsNewBtn.classList.remove('is-open');
        whatsNewBtn.setAttribute('aria-expanded','false');
        whatsNewBtn.setAttribute('aria-label','Neuigkeiten öffnen');
        undockNewsBtnToHeader();
        featurePanel.classList.add('hidden');
        document.body.classList.remove('news-panel-open');
        whatsNewBtn.closest('.top-actions')?.classList.remove('news-open');
        return;
      }
      featurePanel.classList.add('hidden');
      document.body.classList.remove('news-panel-open');
      whatsNewBtn.setAttribute('aria-expanded','false');
      whatsNewBtn.setAttribute('aria-label','Neuigkeiten öffnen');
      undockNewsBtnToHeader();
      whatsNewBtn.closest('.top-actions')?.classList.remove('news-open');
    }
    function toggleFeaturePanel(){setFeaturePanelOpen(featurePanel.classList.contains('hidden'))}

    function dayLabelFromDateLabel(dateLabel){
      const d=parseDateLabel(dateLabel);
      if(!d)return '';
      return d.toLocaleDateString('de-DE',{weekday:'long'});
    }

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

    function isShootingBoundToEvent(row){
      return !!String(row?.project_name||'').trim();
    }

    function readCustomWorkflowStatuses(){
      try{
        const list=JSON.parse(localStorage.getItem(WORKFLOW_STATUS_STORAGE_KEY)||'[]');
        return Array.isArray(list)?list.filter(Boolean):[];
      }catch{return []}
    }

    function writeCustomWorkflowStatuses(list){
      try{localStorage.setItem(WORKFLOW_STATUS_STORAGE_KEY,JSON.stringify([...new Set(list.map(s=>String(s||'').trim()).filter(Boolean))]))}catch{}
    }

    function workflowSlug(value){
      return String(value||'')
        .trim()
        .toLowerCase()
        .replace(/ä/g,'ae')
        .replace(/ö/g,'oe')
        .replace(/ü/g,'ue')
        .replace(/ß/g,'ss')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9]+/g,'-')
        .replace(/^-|-$/g,'')||'angefragt';
    }

    function workflowLabel(slug){
      const key=workflowSlug(slug);
      const preset=workflowStatusPresets.find(p=>workflowSlug(p)===key);
      if(preset)return preset;
      const custom=readCustomWorkflowStatuses().find(s=>workflowSlug(s)===key);
      if(custom)return custom;
      return key.split('-').filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
    }

    function knownWorkflowStatusLabels(row){
      const current=row?.workflow_status?workflowLabel(row.workflow_status):'';
      return [...new Set([...workflowStatusPresets,...readCustomWorkflowStatuses(),current].filter(Boolean))];
    }

    function autoStatusForRow(row){
      if(String(row.project_status||'')==='archiviert')return 'archiviert';
      const date=parseDateLabel(row.date_label);
      return date&&date<todayStart()?'abgeschlossen':'aktiv';
    }

    function displayStatusKeyForRow(row){
      if(String(row.project_status||'')==='archiviert')return 'archiviert';
      if(isShootingBoundToEvent(row))return autoStatusForRow(row);
      return workflowSlug(row.workflow_status)||'angefragt';
    }

    function displayStatusLabelForRow(row){
      const key=displayStatusKeyForRow(row);
      if(projectStatusLabels[key])return projectStatusLabels[key];
      return workflowLabel(key);
    }

    function normalizeRowStatus(row){
      const bound=isShootingBoundToEvent(row);
      const archived=String(row.project_status||'')==='archiviert';
      const project_status=archived?'archiviert':autoStatusForRow(row);
      const workflow_status=bound?null:(row.workflow_status?workflowSlug(row.workflow_status):'angefragt');
      return {...row,project_status,workflow_status};
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

    function addMinutesToTime(time,minutes){
      const base=parseTimeValue(time);
      if(base===null||!Number.isFinite(minutes))return time||null;
      const total=base+minutes;
      const h=Math.floor(total/60)%24;
      const m=total%60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function durationMinutesBetween(start,end){
      const a=parseTimeValue(start);
      const b=parseTimeValue(end);
      if(a===null||b===null||b<=a)return '';
      return String(b-a);
    }

    function rowUsesSeparateMeeting(row){
      const place=String(row?.meeting_place||'').trim();
      const loc=String(row?.location_name||'').trim();
      const meetLink=String(row?.meeting_link||'').trim();
      if(meetLink)return true;
      if(!place)return false;
      if(!loc)return true;
      return place.toLowerCase()!==loc.toLowerCase();
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

