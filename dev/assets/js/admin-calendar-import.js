    const IMPORTED_EVENTS_KEY='dolomiten.imported.events.v1';
    const icsImportDialog=$('icsImportDialog');
    const icsFileInput=$('icsFileInput');
    const icsPickFile=$('icsPickFile');
    const icsPreview=$('icsPreview');
    const icsPreviewList=$('icsPreviewList');
    const icsPreviewMeta=$('icsPreviewMeta');
    const icsImportCancel=$('icsImportCancel');
    const icsImportDisplay=$('icsImportDisplay');
    const icsImportShootings=$('icsImportShootings');
    const icsClearImported=$('icsClearImported');
    const icsSelectAll=$('icsSelectAll');
    const icsSelectNone=$('icsSelectNone');
    const icsSelectMaster=$('icsSelectMaster');
    const icsPreviewFoot=$('icsPreviewFoot');
    const icsImportDisplaySub=$('icsImportDisplaySub');
    const icsImportShootingsSub=$('icsImportShootingsSub');
    const icsClearMeta=$('icsClearMeta');
    const calImportBtn=$('calImportBtn');

    const ICS_FILTER_KEY='dolomiten.ics.import.filter';
    const ICS_SESSION_KEY='dolomiten.ics.import.session.v1';
    const ICS_COL_FR_KEY='dolomiten.ics.preview.colfr.v1';
    const ICS_COL_FR_DEFAULTS={titleFr:2.8,locFr:1.15};
    const ICS_COL_FR_SUM=ICS_COL_FR_DEFAULTS.titleFr+ICS_COL_FR_DEFAULTS.locFr;
    const ICS_COL_FR_LIMITS={titleFr:[1.2,4.2],locFr:[0.55,2.4]};
    let icsColResize=null;
    let importedCalendarEvents=loadImportedCalendarEvents();
    let icsPreviewEvents=[];
    let icsPreviewFilter=readIcsPreviewFilter();
    let icsLastFileName='';
    let lastIcsSelectedUids=[];
    let isRestoringIcsSession=false;

    function clampFr(value,[min,max]){
      return Math.min(max,Math.max(min,value));
    }

    function normalizeColFr(cols={}){
      let titleFr=Number(cols.titleFr);
      if(!Number.isFinite(titleFr))titleFr=ICS_COL_FR_DEFAULTS.titleFr;
      titleFr=clampFr(titleFr,ICS_COL_FR_LIMITS.titleFr);
      let locFr=ICS_COL_FR_SUM-titleFr;
      locFr=clampFr(locFr,ICS_COL_FR_LIMITS.locFr);
      titleFr=ICS_COL_FR_SUM-locFr;
      return {
        titleFr:Math.round(titleFr*100)/100,
        locFr:Math.round(locFr*100)/100,
      };
    }

    function buildIcsColTemplate(fr){
      const {titleFr,locFr}=normalizeColFr(fr);
      return `44px 96px 80px minmax(0,${titleFr}fr) minmax(100px,${locFr}fr) 68px`;
    }

    function icsPreviewUsesTableLayout(){
      const wrap=icsPreview?.querySelector('.ics-preview-grid-wrap');
      return (wrap?.clientWidth||0)>520;
    }

    function readIcsColFr(){
      try{
        const raw=localStorage.getItem(ICS_COL_FR_KEY);
        const saved=raw?JSON.parse(raw):null;
        if(saved&&typeof saved==='object')return normalizeColFr(saved);
      }catch{}
      return {...ICS_COL_FR_DEFAULTS};
    }

    function writeIcsColFr(cols){
      try{localStorage.setItem(ICS_COL_FR_KEY,JSON.stringify(normalizeColFr(cols)))}catch{}
    }

    function applyIcsColFr(cols=readIcsColFr()){
      if(!icsPreview)return;
      icsPreview.style.setProperty('--ics-preview-cols',buildIcsColTemplate(cols));
    }

    function resetIcsColFr(){
      writeIcsColFr(ICS_COL_FR_DEFAULTS);
      applyIcsColFr(ICS_COL_FR_DEFAULTS);
      showToast('Spaltenverteilung zurückgesetzt');
    }

    function initIcsColumnResize(){
      if(!icsPreview||icsPreview.dataset.colsInit==='1')return;
      icsPreview.dataset.colsInit='1';
      try{localStorage.removeItem('dolomiten.ics.preview.colwidths.v1')}catch{}
      applyIcsColFr();
      const endResize=()=>{
        if(!icsColResize)return;
        icsColResize.handle?.classList.remove('is-dragging');
        document.body.classList.remove('ics-col-resizing');
        writeIcsColFr(icsColResize.cols);
        icsColResize=null;
        document.removeEventListener('pointermove',onColResizeMove);
        document.removeEventListener('pointerup',endResize);
        document.removeEventListener('pointercancel',endResize);
      };
      const onColResizeMove=event=>{
        if(!icsColResize)return;
        const wrap=icsPreview.querySelector('.ics-preview-grid-wrap');
        const width=wrap?.clientWidth||900;
        const deltaFr=((event.clientX-icsColResize.startX)/width)*ICS_COL_FR_SUM*1.35;
        let titleFr=icsColResize.startTitleFr;
        if(icsColResize.key==='title')titleFr+=deltaFr;
        else titleFr-=deltaFr;
        icsColResize.cols=normalizeColFr({titleFr});
        applyIcsColFr(icsColResize.cols);
      };
      icsPreview.addEventListener('pointerdown',event=>{
        const handle=event.target.closest('[data-resize-col]');
        if(!handle||!icsPreviewUsesTableLayout())return;
        event.preventDefault();
        event.stopPropagation();
        const key=handle.dataset.resizeCol;
        if(key!=='title'&&key!=='loc')return;
        const cols=readIcsColFr();
        icsColResize={key,startX:event.clientX,startTitleFr:cols.titleFr,handle,cols:{...cols}};
        handle.classList.add('is-dragging');
        document.body.classList.add('ics-col-resizing');
        document.addEventListener('pointermove',onColResizeMove);
        document.addEventListener('pointerup',endResize);
        document.addEventListener('pointercancel',endResize);
      });
    }

    function readIcsPreviewFilter(){
      try{
        const v=localStorage.getItem(ICS_FILTER_KEY);
        if(v==='all'||v==='past'||v==='upcoming')return v;
      }catch{}
      return 'upcoming';
    }
    function writeIcsPreviewFilter(v){try{localStorage.setItem(ICS_FILTER_KEY,v)}catch{}}

    function icsDayStart(d){
      return new Date(d.getFullYear(),d.getMonth(),d.getDate());
    }

    function isUpcomingEvent(ev){
      const today=icsDayStart(new Date());
      const start=new Date(ev.startsAt);
      const end=ev.endsAt?new Date(ev.endsAt):start;
      if(!Number.isFinite(start.getTime()))return false;
      const endDay=icsDayStart(end);
      return endDay>=today;
    }

    function isPastEvent(ev){
      return !isUpcomingEvent(ev);
    }

    function partitionPreviewEvents(list){
      const upcoming=[];
      const past=[];
      list.forEach(ev=>(isUpcomingEvent(ev)?upcoming:past).push(ev));
      return {upcoming,past};
    }

    function getVisiblePreviewEvents(){
      const {upcoming,past}=partitionPreviewEvents(icsPreviewEvents);
      if(icsPreviewFilter==='past')return [...past].sort((a,b)=>new Date(b.startsAt)-new Date(a.startsAt));
      if(icsPreviewFilter==='all')return [...upcoming,...past.sort((a,b)=>new Date(b.startsAt)-new Date(a.startsAt))];
      return [...upcoming].sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
    }

    function syncIcsFilterButtons(){
      document.querySelectorAll('[data-ics-filter]').forEach(btn=>{
        const on=btn.dataset.icsFilter===icsPreviewFilter;
        btn.classList.toggle('active',on);
        btn.setAttribute('aria-selected',on?'true':'false');
      });
    }

    function setIcsPreviewFilter(filter){
      icsPreviewFilter=filter;
      writeIcsPreviewFilter(filter);
      syncIcsFilterButtons();
      renderIcsPreview();
    }

    function loadImportedCalendarEvents(){
      try{
        const raw=localStorage.getItem(IMPORTED_EVENTS_KEY);
        const list=raw?JSON.parse(raw):[];
        return Array.isArray(list)?list:[];
      }catch{return []}
    }

    function persistImportedCalendarEvents(){
      try{localStorage.setItem(IMPORTED_EVENTS_KEY,JSON.stringify(importedCalendarEvents))}catch{}
    }

    function getImportedCalendarEvents(){
      return importedCalendarEvents;
    }

    function refreshImportedCalendarEvents(){
      importedCalendarEvents=loadImportedCalendarEvents();
    }

    function existingImportedByUid(){
      return Object.fromEntries(importedCalendarEvents.map(e=>[e.uid,e]));
    }

    function formatIcsTimeRange(ev){
      const start=new Date(ev.startsAt);
      const end=ev.endsAt?new Date(ev.endsAt):null;
      if(ev.allDay)return 'Ganztägig';
      const t=start.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      if(!end||end<=start)return t;
      return `${t} – ${end.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;
    }

    function formatIcsDate(ev){
      return new Date(ev.startsAt).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
    }

    function dayLabelFromDateObj(d){
      return d.toLocaleDateString('de-DE',{weekday:'long'});
    }

    function timeLabelFromDate(d,allDay){
      if(allDay)return null;
      return d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    }

    function shootingDraftFromImported(ev){
      const start=new Date(ev.startsAt);
      if(!Number.isFinite(start.getTime()))throw new Error('Ungültiges Datum im Kalender-Termin');
      const end=ev.endsAt?new Date(ev.endsAt):null;
      const meeting=timeLabelFromDate(start,ev.allDay);
      let endTime=null;
      if(end&&!ev.allDay){
        const et=timeLabelFromDate(end,false);
        if(et&&et!==meeting)endTime=et;
      }
      const shootingStart=meeting||'09:00';
      return{
        workflow_status:'fix',
        __icsImportLocation:!!String(ev.location||'').trim(),
        title:ev.title,
        date_label:dateLabelFromDate(start),
        day_label:dayLabelFromDateObj(start),
        meeting_time:shootingStart,
        shooting_time:shootingStart,
        end_time:endTime,
        meeting_place:ev.location||'',
        location_name:ev.location||'',
        subtitle:ev.description?ev.description.slice(0,180):'',
        shooting_note:ev.description?`Import (${ev.uid}):\n${ev.description}`:`Import: ${ev.uid}`
      };
    }

    function mergeImportedEvents(parsed,options={}){
      const {linkedByUid={}}=options;
      const byUid=existingImportedByUid();
      const now=new Date().toISOString();
      let added=0,updated=0;
      parsed.forEach(ev=>{
        const prev=byUid[ev.uid];
        const entry={
          uid:ev.uid,
          title:ev.title,
          location:ev.location,
          description:ev.description,
          startsAt:ev.startsAt,
          endsAt:ev.endsAt,
          allDay:!!ev.allDay,
          importedAt:prev?.importedAt||now,
          updatedAt:now,
          linkedShootingId:linkedByUid[ev.uid]||prev?.linkedShootingId||null
        };
        if(prev){
          const idx=importedCalendarEvents.findIndex(e=>e.uid===ev.uid);
          if(idx>=0)importedCalendarEvents[idx]=entry;
          updated++;
        }else{
          importedCalendarEvents.push(entry);
          added++;
        }
      });
      importedCalendarEvents.sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
      persistImportedCalendarEvents();
      return {added,updated};
    }

    function importedEventsByDateKey(list){
      const map=new Map();
      list.forEach(ev=>{
        const d=new Date(ev.startsAt);
        if(!Number.isFinite(d.getTime()))return;
        const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if(!map.has(key))map.set(key,{events:[]});
        map.get(key).events.push(ev);
      });
      map.forEach(bucket=>{
        bucket.events.sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
      });
      return map;
    }

    function clearIcsImportSession(){
      try{sessionStorage.removeItem(ICS_SESSION_KEY)}catch{}
    }

    function readIcsImportSession(){
      try{
        const raw=sessionStorage.getItem(ICS_SESSION_KEY);
        return raw?JSON.parse(raw):null;
      }catch{return null}
    }

    function persistIcsImportSession(){
      try{
        const dialogOpen=icsImportDialog&&!icsImportDialog.classList.contains('hidden');
        if(!dialogOpen&&!icsPreviewEvents.length){clearIcsImportSession();return}
        const selectedUids=dialogOpen&&icsPreviewList
          ?[...icsPreviewList.querySelectorAll('input[data-ics-uid]:checked')].map(cb=>cb.dataset.icsUid)
          :lastIcsSelectedUids;
        sessionStorage.setItem(ICS_SESSION_KEY,JSON.stringify({
          dialogOpen,
          view:typeof currentView==='string'?currentView:'calendar',
          fileName:icsLastFileName||'',
          events:icsPreviewEvents,
          filter:icsPreviewFilter,
          selectedUids,
          savedAt:new Date().toISOString(),
        }));
      }catch{}
    }

    function hasOpenIcsImport(){
      return !!(icsImportDialog&&!icsImportDialog.classList.contains('hidden'));
    }

    async function restoreIcsImportSession(){
      const saved=readIcsImportSession();
      if(!saved||!Array.isArray(saved.events)||!saved.events.length)return;
      isRestoringIcsSession=true;
      isRestoringAdminSession=true;
      try{
        icsPreviewEvents=saved.events;
        icsPreviewFilter=saved.filter||readIcsPreviewFilter();
        icsLastFileName=saved.fileName||'';
        lastIcsSelectedUids=Array.isArray(saved.selectedUids)?saved.selectedUids:[];
        if(saved.view&&saved.view!==currentView&&typeof setView==='function')await setView(saved.view);
        if(saved.dialogOpen)setIcsDialogOpen(true);
        renderIcsPreview();
        if(icsPreviewList&&lastIcsSelectedUids.length){
          const uids=new Set(lastIcsSelectedUids);
          icsPreviewList.querySelectorAll('input[data-ics-uid]').forEach(cb=>{cb.checked=uids.has(cb.dataset.icsUid)});
          syncIcsMasterCheckbox();
          updateIcsPreviewActions();
        }
        if(saved.dialogOpen){
          showToast(icsLastFileName?`Import fortgesetzt · ${icsLastFileName}`:'Import-Vorschau fortgesetzt');
        }
      }finally{
        isRestoringIcsSession=false;
        isRestoringAdminSession=false;
      }
    }

    function setIcsDialogOpen(open,{clearSession=false}={}){
      if(!icsImportDialog)return;
      icsImportDialog.classList.toggle('hidden',!open);
      icsImportDialog.setAttribute('aria-hidden',open?'false':'true');
      document.body.classList.toggle('ics-dialog-open',open);
      if(open){
        refreshImportedCalendarEvents();
        updateIcsClearMeta();
        if(icsPreviewEvents.length){
          icsPreview?.classList.remove('hidden');
          renderIcsPreview();
        }
      }
      if(!open){
        if(clearSession){
          icsPreviewEvents=[];
          icsLastFileName='';
          lastIcsSelectedUids=[];
          clearIcsImportSession();
        }else{
          persistIcsImportSession();
        }
        if(icsFileInput)icsFileInput.value='';
        if(icsPreview)icsPreview.classList.add('hidden');
        [icsImportDisplay,icsImportShootings].forEach(btn=>{
          if(btn){btn.disabled=false;btn.classList.add('is-disabled');btn.setAttribute('aria-disabled','true')}
        });
      }else{
        persistIcsImportSession();
      }
    }

    function countSelectedPreview(){
      if(!icsPreviewList)return 0;
      return icsPreviewList.querySelectorAll('input[data-ics-uid]:checked').length;
    }

    function monthGroupLabel(ev){
      const d=new Date(ev.startsAt);
      return d.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
    }

    function renderPreviewRowsGrouped(events,existing,{isPast=false,defaultChecked=false}={}){
      let html='';
      let lastMonth='';
      events.forEach(ev=>{
        const month=monthGroupLabel(ev);
        if(month!==lastMonth){
          lastMonth=month;
          html+=`<div class="ics-preview-month">${escapeHtml(month)}</div>`;
        }
        const past=isPast||isPastEvent(ev);
        const checked=defaultChecked&&!existing[ev.uid];
        html+=renderPreviewRow(ev,existing,{isPast:past,defaultChecked:checked});
      });
      return html;
    }

    function renderPreviewRow(ev,existing,options={}){
      const prev=existing[ev.uid];
      const isPast=options.isPast;
      const defaultChecked=!!options.defaultChecked;
      const date=escapeHtml(formatIcsDate(ev));
      const time=escapeHtml(formatIcsTimeRange(ev));
      const loc=escapeHtml(ev.location||'–');
      const statusPill=prev
        ?'<span class="ics-status-pill ics-status-pill-known">Im Kalender</span>'
        :'<span class="ics-status-pill ics-status-pill-new">Neu</span>';
      const mobMeta=[date,time,loc!=='–'?loc:''].filter(Boolean).join(' · ');
      return `<div class="ics-preview-row ${isPast?'is-past':''}">
          <label class="ics-check ics-preview-check" title="Termin auswählen">
            <input type="checkbox" data-ics-uid="${escapeHtml(ev.uid)}" ${defaultChecked?'checked':''} aria-label="Auswählen: ${escapeHtml(ev.title)}" />
            <span class="ics-check-box" aria-hidden="true"></span>
          </label>
          <span class="ics-preview-date ics-only-desk">${date}</span>
          <span class="ics-preview-time ics-only-desk">${time}</span>
          <span class="ics-preview-title" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</span>
          <span class="ics-preview-loc ics-only-desk">${loc}</span>
          ${statusPill}
          <span class="ics-preview-mob-meta ics-only-mob">${mobMeta}</span>
        </div>`;
    }

    function bindPreviewListInteractions(){
      icsPreviewList.querySelectorAll('input[data-ics-uid]').forEach(cb=>{
        cb.addEventListener('change',()=>{syncIcsMasterCheckbox();updateIcsPreviewActions()});
      });
      syncIcsMasterCheckbox();
      icsPreviewList.querySelectorAll('.ics-preview-row').forEach(row=>{
        row.addEventListener('click',event=>{
          if(event.target.closest('input[type=checkbox]'))return;
          const cb=row.querySelector('input[data-ics-uid]');
          if(cb){cb.checked=!cb.checked;syncIcsMasterCheckbox();updateIcsPreviewActions()}
        });
      });
    }

    function updateIcsClearMeta(){
      const n=importedCalendarEvents.length;
      if(icsClearImported){
        icsClearImported.disabled=n===0;
        icsClearImported.textContent=n
          ?`Blaue Import-Termine entfernen (${n})`
          :'Blaue Import-Termine entfernen';
      }
      if(icsClearMeta){
        icsClearMeta.textContent=n
          ?`${n} blau${n===1?'er':'e'} Termin${n===1?'':'e'} im Kalender · wird nur die Import-Anzeige gelöscht, nicht deine Shootings.`
          :'Betrifft nur die blaue „Importiert“-Anzeige — nicht deine Shootings in der Liste.';
      }
    }

    function updateIcsPreviewActions(){
      const {upcoming,past}=partitionPreviewEvents(icsPreviewEvents);
      const visible=getVisiblePreviewEvents();
      const selected=countSelectedPreview();
      const filterLabel=icsPreviewFilter==='upcoming'?'Zukünftig':icsPreviewFilter==='past'?'Vergangen':'Alle';
      icsPreviewMeta.textContent=`${icsPreviewEvents.length} in Datei · ${upcoming.length} zukünftig · ${past.length} vergangen · ${visible.length} angezeigt (${filterLabel}) · ${selected} ausgewählt`;
      if(icsPreviewFoot){
        icsPreviewFoot.textContent=selected
          ?`${selected} ausgewählt — unten bei Schritt 3 eine Aktion wählen (Kalender oder Liste).`
          : visible.length?'Bitte mindestens einen sichtbaren Termin auswählen.':'Keine Termine in dieser Ansicht — Filter „Alle“ oder „Vergangen“ probieren.';
      }
      const hasSelection=selected>0;
      const subLabel=hasSelection?`${selected} Termin${selected===1?'':'e'} übernehmen`:'Bitte Termine auswählen';
      [icsImportDisplay,icsImportShootings].forEach(btn=>{
        if(!btn)return;
        btn.disabled=false;
        btn.classList.toggle('is-disabled',!hasSelection);
        btn.setAttribute('aria-disabled',hasSelection?'false':'true');
      });
      if(icsImportDisplaySub)icsImportDisplaySub.textContent=subLabel;
      if(icsImportShootingsSub)icsImportShootingsSub.textContent=subLabel;
      if(hasSelection&&icsPreviewList){
        lastIcsSelectedUids=[...icsPreviewList.querySelectorAll('input[data-ics-uid]:checked')].map(cb=>cb.dataset.icsUid);
      }
      updateIcsClearMeta();
      if(!isRestoringIcsSession)persistIcsImportSession();
    }

    function renderIcsPreview(){
      if(!icsPreview||!icsPreviewList)return;
      const existing=existingImportedByUid();
      const visible=getVisiblePreviewEvents();
      const {upcoming,past}=partitionPreviewEvents(icsPreviewEvents);
      const defaultCheckNewOnly=icsPreviewFilter==='upcoming';

      if(!visible.length){
        const hint=icsPreviewFilter==='upcoming'
          ?`<div class="card hint ics-preview-empty">Keine <strong>zukünftigen</strong> Termine in dieser Datei (${icsPreviewEvents.length} insgesamt, davon ${past.length} vergangen). Wechsle zu <strong>Alle</strong>, wenn du ältere Termine importieren willst.</div>`
          :`<div class="card hint ics-preview-empty">Keine Termine in dieser Ansicht.</div>`;
        icsPreviewList.innerHTML=hint;
        if(icsSelectMaster){icsSelectMaster.checked=false;icsSelectMaster.indeterminate=false;icsSelectMaster.disabled=true}
      }else{
        if(icsSelectMaster)icsSelectMaster.disabled=false;
        let html='';
        if(icsPreviewFilter==='all'){
          if(upcoming.length){
            html+=`<div class="ics-preview-section-label">Kommend · ${upcoming.length}</div>`;
            html+=renderPreviewRowsGrouped(upcoming,existing,{isPast:false,defaultChecked:true});
          }
          if(past.length){
            html+=`<div class="ics-preview-section-label ics-preview-section-label-past">Vergangen · ${past.length}</div>`;
            html+=renderPreviewRowsGrouped(past,existing,{isPast:true,defaultChecked:false});
          }
        }else{
          html=renderPreviewRowsGrouped(visible,existing,{
            isPast:icsPreviewFilter==='past',
            defaultChecked:defaultCheckNewOnly,
          });
        }
        icsPreviewList.innerHTML=html;
        bindPreviewListInteractions();
      }

      icsPreview.classList.remove('hidden');
      syncIcsFilterButtons();
      updateIcsPreviewActions();
    }

    function setAllPreviewChecked(checked){
      if(!icsPreviewList)return;
      icsPreviewList.querySelectorAll('input[data-ics-uid]').forEach(cb=>{cb.checked=checked});
      syncIcsMasterCheckbox();
      updateIcsPreviewActions();
    }

    function syncIcsMasterCheckbox(){
      if(!icsSelectMaster||!icsPreviewList)return;
      const boxes=icsPreviewList.querySelectorAll('input[data-ics-uid]');
      if(!boxes.length){icsSelectMaster.checked=false;icsSelectMaster.indeterminate=false;return}
      const total=boxes.length;
      const selected=[...boxes].filter(cb=>cb.checked).length;
      icsSelectMaster.indeterminate=selected>0&&selected<total;
      icsSelectMaster.checked=total>0&&selected===total;
    }

    function getSelectedPreviewEvents(){
      if(!icsPreviewList)return [];
      const uids=new Set([...icsPreviewList.querySelectorAll('input[data-ics-uid]:checked')].map(cb=>cb.dataset.icsUid));
      return icsPreviewEvents.filter(ev=>uids.has(ev.uid));
    }

    async function applyIcsDisplayOnly(){
      const selected=getSelectedPreviewEvents();
      if(!selected.length){showToast('Bitte mindestens einen Termin auswählen');return}
      const {added,updated}=mergeImportedEvents(selected);
      renderIcsPreview();
      if(typeof renderCalendar==='function')renderCalendar();
      showToast(`${selected.length} blau im Kalender · ${added} neu, ${updated} aktualisiert`);
      setStatus(`${importedCalendarEvents.length} externe Kalender-Termine`);
    }

    async function applyIcsAsShootings(){
      const selected=getSelectedPreviewEvents();
      if(!selected.length){showToast('Bitte mindestens einen Termin auswählen');return}
      if(!confirm(`${selected.length} Shooting-Entwurf${selected.length===1?'':'e'} in der Liste anlegen?\n\n→ Nur die Shooting-Liste (Tab Liste), nicht blau im Kalender.\n→ Danach jeden Entwurf prüfen und speichern.`))return;
      if(dirtyForms.size&&!confirm('Du hast ungespeicherte Änderungen. Trotzdem fortfahren?'))return;

      const appendDraft=typeof appendShootingDraftRow==='function'?appendShootingDraftRow:window.appendShootingDraftRow;
      if(typeof appendDraft!=='function'){
        showError('Shooting-Entwürfe konnten nicht angelegt werden. Bitte Seite neu laden.');
        return;
      }

      const prevRestoring=isRestoringAdminSession;
      isRestoringAdminSession=true;
      try{
        await setView('timeline');
      }finally{
        isRestoringAdminSession=prevRestoring;
      }

      setStatus(`Lege ${selected.length} Entwürfe an…`);
      const newIds=[];
      try{
        for(let i=0;i<selected.length;i++){
          const ev=selected[i];
          const overrides=shootingDraftFromImported(ev);
          overrides.project_name=activeProject==='all'?'':activeProject;
          overrides.project_status=activeStatus==='archiviert'?'archiviert':'aktiv';
          overrides.id=`shooting-ics-${Date.now()}-${i}`;
          const id=appendDraft(overrides);
          if(id)newIds.push(id);
        }
      }catch(error){
        console.error(error);
        showError('Shooting-Entwürfe konnten nicht angelegt werden: '+(error.message||'Unbekannter Fehler'));
        return;
      }

      if(!newIds.length){
        showError('Es wurden keine Entwürfe angelegt.');
        return;
      }

      updateProjectFilter();
      const reveal=typeof revealDraftsInList==='function'?revealDraftsInList:window.revealDraftsInList;
      if(typeof reveal==='function')reveal(newIds);
      renderAll();
      newIds.forEach(id=>{
        const form=shootingsEl.querySelector(`form[data-id="${id}"]`);
        if(form)setFormDirty(form,true);
      });
      updateUnsavedBar();
      schedulePersistAdminDrafts();

      setIcsDialogOpen(false);
      persistIcsImportSession();

      const first=newIds[0]?shootingsEl.querySelector(`[data-id="${newIds[0]}"]`):null;
      if(first){
        first.open=true;
        first.scrollIntoView({behavior:'smooth',block:'center'});
      }
      const withLocation=newIds.filter(id=>currentRowsById[id]?.__icsImportLocation).length;
      showToast(withLocation
        ?`${newIds.length} Entwurf${newIds.length===1?'':'e'} · Status Fix · ${withLocation} mit Location-Hinweis`
        :`${newIds.length} Shooting-Entwurf${newIds.length===1?'':'e'} · Tab Liste · bitte speichern`);
      setStatus(`${newIds.length} Entwürfe in der Liste`);
    }

    function handleIcsFile(file){
      if(!file)return;
      icsLastFileName=file.name||'';
      const reader=new FileReader();
      reader.onload=()=>{
        try{
          icsPreviewEvents=parseIcsFile(reader.result);
          if(!icsPreviewEvents.length){
            showError('In der Datei wurden keine Termine (VEVENT) gefunden.');
            return;
          }
          clearError();
          icsPreviewFilter=readIcsPreviewFilter();
          renderIcsPreview();
        }catch(err){
          console.error(err);
          showError('Die .ics-Datei konnte nicht gelesen werden.');
        }
      };
      reader.onerror=()=>showError('Datei konnte nicht gelesen werden.');
      reader.readAsText(file,'UTF-8');
    }

    function initCalendarImportUI(){
      initIcsColumnResize();
      $('icsColsReset')?.addEventListener('click',resetIcsColFr);
      calImportBtn?.addEventListener('click',()=>setIcsDialogOpen(true));
      icsPickFile?.addEventListener('click',()=>icsFileInput?.click());
      icsFileInput?.addEventListener('change',()=>{const f=icsFileInput.files?.[0];if(f)handleIcsFile(f)});
      icsImportCancel?.addEventListener('click',()=>setIcsDialogOpen(false,{clearSession:true}));
      icsSelectAll?.addEventListener('click',()=>setAllPreviewChecked(true));
      icsSelectNone?.addEventListener('click',()=>setAllPreviewChecked(false));
      icsSelectMaster?.addEventListener('change',()=>setAllPreviewChecked(icsSelectMaster.checked));
      document.querySelectorAll('[data-ics-filter]').forEach(btn=>{
        btn.addEventListener('click',()=>setIcsPreviewFilter(btn.dataset.icsFilter));
      });
      icsImportDisplay?.addEventListener('click',e=>{
        e.preventDefault();
        if(!countSelectedPreview()){
          showToast('Bitte mindestens einen Termin auswählen (Kästchen setzen)');
          return;
        }
        applyIcsDisplayOnly();
      });
      icsImportShootings?.addEventListener('click',async e=>{
        e.preventDefault();
        if(!countSelectedPreview()){
          showToast('Bitte mindestens einen Termin auswählen (Kästchen setzen)');
          return;
        }
        await applyIcsAsShootings();
      });
      icsClearImported?.addEventListener('click',()=>{
        if(!importedCalendarEvents.length)return;
        if(!confirm(`${importedCalendarEvents.length} blaue Import-Termin${importedCalendarEvents.length===1?'':'e'} aus dem Kalender entfernen?\n\nDeine Shootings in der Liste bleiben unverändert.`))return;
        importedCalendarEvents=[];
        persistImportedCalendarEvents();
        if(typeof renderCalendar==='function')renderCalendar();
        updateIcsClearMeta();
        showToast('Blaue Import-Termine entfernt');
      });
      document.addEventListener('keydown',e=>{
        if(e.key==='Escape'&&icsImportDialog&&!icsImportDialog.classList.contains('hidden'))setIcsDialogOpen(false,{clearSession:true});
      });
      syncIcsFilterButtons();
      updateIcsClearMeta();
      ['timelineTab','calendarTab','locationsTab'].forEach(id=>{
        $(id)?.addEventListener('click',()=>persistIcsImportSession());
      });
    }

    initCalendarImportUI();
