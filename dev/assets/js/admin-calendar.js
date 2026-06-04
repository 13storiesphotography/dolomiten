    const calendarRoot=$('calendarRoot');
    const calTitle=$('calTitle');
    const calPrev=$('calPrev');
    const calNext=$('calNext');
    const calToday=$('calToday');
    const calScaleEl=$('calScale');
    const calLayersEl=$('calLayers');

    const MONTH_NAMES=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const WEEKDAY_SHORT=['Mo','Di','Mi','Do','Fr','Sa','So'];
    const CAL_SCALE_KEY='dolomiten.admin.calendar.scale';
    const CAL_CURSOR_KEY='dolomiten.admin.calendar.cursor';
    const CAL_LAYERS_KEY='dolomiten.admin.calendar.layers';

    let calendarScale=readCalScale();
    let calendarCursor=readCalCursor();
    let calendarLayers=readCalLayers();

    function readCalScale(){
      try{
        const v=localStorage.getItem(CAL_SCALE_KEY);
        return v==='day'||v==='month'||v==='year'?v:'month';
      }catch{return 'month'}
    }
    function writeCalScale(v){try{localStorage.setItem(CAL_SCALE_KEY,v)}catch{}}
    function readCalCursor(){
      try{
        const v=localStorage.getItem(CAL_CURSOR_KEY);
        if(!v)return startOfDay(new Date());
        const d=new Date(v);
        return Number.isFinite(d.getTime())?startOfDay(d):startOfDay(new Date());
      }catch{return startOfDay(new Date())}
    }
    function writeCalCursor(d){try{localStorage.setItem(CAL_CURSOR_KEY,startOfDay(d).toISOString())}catch{}}
    function readCalLayers(){
      try{
        const v=JSON.parse(localStorage.getItem(CAL_LAYERS_KEY)||'');
        if(v&&typeof v==='object')return{shootings:v.shootings!==false,events:v.events!==false,external:v.external!==false};
      }catch{}
      return {shootings:true,events:true,external:true};
    }
    function writeCalLayers(){try{localStorage.setItem(CAL_LAYERS_KEY,JSON.stringify(calendarLayers))}catch{}}

    function startOfDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
    function startOfMonth(d){return new Date(d.getFullYear(),d.getMonth(),1)}
    function startOfYear(d){return new Date(d.getFullYear(),0,1)}
    function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
    function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
    function pad2(n){return String(n).padStart(2,'0')}

    function mondayBasedWeekday(d){return (d.getDay()+6)%7}

    function calendarRows(){
      if(typeof filteredRows==='function')return filteredRows();
      return rows||[];
    }

    function getExternalForCalendar(){
      if(typeof getImportedCalendarEvents!=='function')return [];
      return getImportedCalendarEvents();
    }

    function renderExternalChip(ev,compact){
      const start=new Date(ev.startsAt);
      const time=ev.allDay?'Ganztag':start.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      const linked=ev.linkedShootingId;
      if(compact)return `<button type="button" class="cal-chip cal-chip-external" data-cal-external="${escapeHtml(ev.uid)}" ${linked?`data-cal-open="${escapeHtml(linked)}"`:''} title="${escapeHtml(ev.title)}"><span class="cal-chip-time">${escapeHtml(time)}</span><span class="cal-chip-title">${escapeHtml(ev.title)}</span></button>`;
      return `<button type="button" class="cal-agenda-item cal-chip-external" data-cal-external="${escapeHtml(ev.uid)}" ${linked?`data-cal-open="${escapeHtml(linked)}"`:''}>
        <span class="cal-agenda-time">${escapeHtml(time)}</span>
        <span class="cal-agenda-main">
          <strong>${escapeHtml(ev.title)}</strong>
          <span>${escapeHtml(ev.location||'Importierter Termin')}${linked?' · mit Shooting verknüpft':''}</span>
        </span>
      </button>`;
    }

    function rowsByDateKey(list){
      const map=new Map();
      const undated=[];
      list.forEach(row=>{
        const d=parseDateLabel(row.date_label);
        if(!d){undated.push(row);return}
        const key=dateKey(d);
        if(!map.has(key))map.set(key,{date:d,shootings:[]});
        map.get(key).shootings.push(row);
      });
      map.forEach(bucket=>{bucket.shootings.sort((a,b)=>{const at=parseTimeValue(a.meeting_time),bt=parseTimeValue(b.meeting_time);if(at!==null&&bt!==null)return at-bt;if(at!==null)return -1;if(bt!==null)return 1;return 0})});
      return {map,undated};
    }

    function eventMetaForProject(projectName){
      const name=String(projectName||'').trim();
      if(!name)return null;
      const ev=events.find(e=>String(e.name||'').trim()===name);
      return {name,status:ev?.status||'aktiv',id:ev?.id||''};
    }

    function syncCalScaleButtons(){
      calScaleEl?.querySelectorAll('[data-cal-scale]').forEach(btn=>{
        btn.classList.toggle('active',btn.dataset.calScale===calendarScale);
        btn.setAttribute('aria-selected',btn.dataset.calScale===calendarScale?'true':'false');
      });
    }

    function syncCalLayerButtons(){
      calLayersEl?.querySelectorAll('[data-cal-layer]').forEach(btn=>{
        const key=btn.dataset.calLayer;
        btn.classList.toggle('active',!!calendarLayers[key]);
      });
    }

    function navTitle(){
      if(calendarScale==='day'){
        return calendarCursor.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      }
      if(calendarScale==='month')return `${MONTH_NAMES[calendarCursor.getMonth()]} ${calendarCursor.getFullYear()}`;
      return String(calendarCursor.getFullYear());
    }

    function shiftCursor(delta){
      const c=new Date(calendarCursor);
      if(calendarScale==='day')c.setDate(c.getDate()+delta);
      else if(calendarScale==='month')c.setMonth(c.getMonth()+delta);
      else c.setFullYear(c.getFullYear()+delta);
      calendarCursor=startOfDay(c);
      writeCalCursor(calendarCursor);
      renderCalendar();
    }

    function goToDate(d,scale){
      calendarCursor=startOfDay(d);
      if(scale)calendarScale=scale;
      writeCalCursor(calendarCursor);
      writeCalScale(calendarScale);
      syncCalScaleButtons();
      renderCalendar();
    }

    function renderShootingChip(row,compact){
      const time=row.meeting_time||'–';
      const place=row.meeting_place||row.location_name||'';
      const project=String(row.project_name||'').trim();
      const status=autoStatusForRow(row);
      if(compact)return `<button type="button" class="cal-chip cal-chip-${escapeHtml(status)}" data-cal-open="${escapeHtml(row.id)}" title="${escapeHtml(row.title)}"><span class="cal-chip-time">${escapeHtml(time)}</span><span class="cal-chip-title">${escapeHtml(row.title)}</span></button>`;
      return `<button type="button" class="cal-agenda-item cal-chip-${escapeHtml(status)}" data-cal-open="${escapeHtml(row.id)}">
        <span class="cal-agenda-time">${escapeHtml(time)}</span>
        <span class="cal-agenda-main">
          <strong>${escapeHtml(row.title)}</strong>
          <span>${escapeHtml(place)}${project?` · ${escapeHtml(project)}`:''}</span>
        </span>
      </button>`;
    }

    function renderDayView(){
      const today=startOfDay(new Date());
      const key=dateKey(calendarCursor);
      const {map,undated}=rowsByDateKey(calendarRows());
      const extMap=typeof importedEventsByDateKey==='function'?importedEventsByDateKey(getExternalForCalendar()):new Map();
      const extBucket=extMap.get(key);
      const bucket=map.get(key);
      const isToday=sameDay(calendarCursor,today);
      let html=`<div class="cal-day ${isToday?'is-today':''}">`;
      const hasShootings=bucket&&bucket.shootings.length;
      const hasExternal=calendarLayers.external&&extBucket&&extBucket.events.length;
      if(!hasShootings&&!hasExternal){
        html+=`<div class="card hint cal-empty">Keine Shootings oder importierten Termine an diesem Tag.</div>`;
      }
      if(hasShootings){
        if(calendarLayers.shootings){
          html+=`<div class="cal-section"><div class="cal-section-title">Shootings</div><div class="cal-agenda">${bucket.shootings.map(r=>renderShootingChip(r,false)).join('')}</div></div>`;
        }
        if(calendarLayers.events){
          const projects=[...new Set(bucket.shootings.map(r=>String(r.project_name||'').trim()).filter(Boolean))];
          if(projects.length){
            html+=`<div class="cal-section"><div class="cal-section-title">Events</div><div class="cal-event-tags">${projects.map(p=>{const meta=eventMetaForProject(p);const st=meta?.status||'aktiv';return `<span class="cal-event-tag status-${escapeHtml(st)}">${escapeHtml(p)}</span>`}).join('')}</div></div>`;
          }
        }
      }
      if(hasExternal){
        html+=`<div class="cal-section"><div class="cal-section-title">Importiert (Kalender)</div><div class="cal-agenda">${extBucket.events.map(ev=>renderExternalChip(ev,false)).join('')}</div></div>`;
      }
      if(undated.length&&sameDay(calendarCursor,today)){
        html+=`<div class="cal-section cal-muted"><div class="cal-section-title">Ohne Datum (${undated.length})</div><div class="cal-agenda">${undated.slice(0,4).map(r=>renderShootingChip(r,false)).join('')}</div></div>`;
      }
      html+=`</div>`;
      return html;
    }

    function renderMonthCell(date,inMonth,bucket,extBucket){
      const today=startOfDay(new Date());
      const isToday=sameDay(date,today);
      const hasExt=calendarLayers.external&&extBucket&&extBucket.events.length;
      const classes=['cal-month-cell',inMonth?'':'is-outside',isToday?'is-today':'',bucket||hasExt?'has-items':''].filter(Boolean).join(' ');
      const count=bucket?.shootings?.length||0;
      let body=`<span class="cal-month-day">${date.getDate()}</span>`;
      if(bucket&&count){
        if(calendarLayers.shootings){
          const preview=bucket.shootings.slice(0,2).map(r=>`<span class="cal-month-dot cal-dot-${escapeHtml(autoStatusForRow(r))}" title="${escapeHtml(r.title)}"></span>`).join('');
          body+=`<span class="cal-month-dots">${preview}${count>2?`<span class="cal-month-more">+${count-2}</span>`:''}</span>`;
        }
        if(calendarLayers.events){
          const projects=[...new Set(bucket.shootings.map(r=>String(r.project_name||'').trim()).filter(Boolean))];
          if(projects[0])body+=`<span class="cal-month-event">${escapeHtml(projects[0].slice(0,14))}${projects.length>1?'…':''}</span>`;
        }
      }else if(hasExt){
        body+=`<span class="cal-month-dots"><span class="cal-month-dot cal-dot-external"></span></span>`;
      }
      if(hasExt)body+=`<span class="cal-month-ext-badge" title="Importiert">↗${extBucket.events.length}</span>`;
      return `<button type="button" class="${classes}" data-cal-day="${dateKey(date)}" ${inMonth?'':'tabindex="-1"'}>${body}</button>`;
    }

    function renderMonthView(){
      const monthStart=startOfMonth(calendarCursor);
      const gridStart=new Date(monthStart);
      gridStart.setDate(gridStart.getDate()-mondayBasedWeekday(gridStart));
      const {map}=rowsByDateKey(calendarRows());
      const extMap=typeof importedEventsByDateKey==='function'?importedEventsByDateKey(getExternalForCalendar()):new Map();
      let html=`<div class="cal-month"><div class="cal-weekdays">${WEEKDAY_SHORT.map(d=>`<span>${d}</span>`).join('')}</div><div class="cal-month-grid">`;
      for(let i=0;i<42;i++){
        const date=new Date(gridStart);
        date.setDate(gridStart.getDate()+i);
        const inMonth=date.getMonth()===monthStart.getMonth();
        const dk=dateKey(date);
        html+=renderMonthCell(date,inMonth,map.get(dk),extMap.get(dk));
      }
      html+=`</div></div>`;
      return html;
    }

    function renderMiniMonth(year,monthIndex,map,extMap){
      const monthStart=new Date(year,monthIndex,1);
      const gridStart=new Date(monthStart);
      gridStart.setDate(gridStart.getDate()-mondayBasedWeekday(gridStart));
      let cells='';
      for(let i=0;i<42;i++){
        const date=new Date(gridStart);
        date.setDate(gridStart.getDate()+i);
        const inMonth=date.getMonth()===monthIndex;
        const dk=dateKey(date);
        const has=map.has(dk)||(calendarLayers.external&&extMap&&extMap.has(dk));
        const today=sameDay(date,startOfDay(new Date()));
        cells+=`<span class="cal-year-mini-day ${inMonth?'':'is-outside'} ${has?'has-item':''} ${today?'is-today':''}"></span>`;
      }
      return `<button type="button" class="cal-year-month" data-cal-month="${year}-${pad2(monthIndex+1)}">
        <span class="cal-year-month-name">${MONTH_NAMES[monthIndex].slice(0,3)}</span>
        <span class="cal-year-mini-grid">${cells}</span>
      </button>`;
    }

    function renderYearView(){
      const year=calendarCursor.getFullYear();
      const {map}=rowsByDateKey(calendarRows());
      const extMap=typeof importedEventsByDateKey==='function'?importedEventsByDateKey(getExternalForCalendar()):new Map();
      let html=`<div class="cal-year">${MONTH_NAMES.map((_,i)=>renderMiniMonth(year,i,map,extMap)).join('')}</div>`;
      return html;
    }

    function renderCalendar(){
      if(!calendarRoot||currentView!=='calendar')return;
      if(typeof refreshImportedCalendarEvents==='function')refreshImportedCalendarEvents();
      syncCalScaleButtons();
      syncCalLayerButtons();
      if(calTitle)calTitle.textContent=navTitle();
      if(calendarScale==='day')calendarRoot.innerHTML=renderDayView();
      else if(calendarScale==='year')calendarRoot.innerHTML=renderYearView();
      else calendarRoot.innerHTML=renderMonthView();
      bindCalendarInteractions();
    }

    function bindCalendarInteractions(){
      calendarRoot.querySelectorAll('[data-cal-open]').forEach(btn=>{
        btn.addEventListener('click',()=>openShootingInList(btn.dataset.calOpen));
      });
      calendarRoot.querySelectorAll('[data-cal-external]:not([data-cal-open])').forEach(btn=>{
        btn.addEventListener('click',()=>showToast('Nur Anzeige — „Als Shooting-Entwürfe“ beim Import nutzen'));
      });
      calendarRoot.querySelectorAll('[data-cal-day]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const parts=btn.dataset.calDay.split('-').map(Number);
          if(parts.length===3)goToDate(new Date(parts[0],parts[1]-1,parts[2]),'day');
        });
      });
      calendarRoot.querySelectorAll('[data-cal-month]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const [y,m]=btn.dataset.calMonth.split('-').map(Number);
          goToDate(new Date(y,m-1,1),'month');
        });
      });
    }

    async function openShootingInList(id){
      if(!id)return;
      if(dirtyForms.size&&!confirm('Ungespeicherte Änderungen. Trotzdem zur Liste wechseln?'))return;
      await setView('timeline');
      requestAnimationFrame(()=>{
        const card=shootingsEl?.querySelector(`[data-id="${CSS.escape(id)}"]`)||shootingsEl?.querySelector(`[data-id="${id}"]`);
        if(card){card.open=true;card.scrollIntoView({behavior:'smooth',block:'center'})}
      });
    }

    function initCalendarUI(){
      if(!calScaleEl)return;
      syncCalScaleButtons();
      syncCalLayerButtons();
      calPrev?.addEventListener('click',()=>shiftCursor(-1));
      calNext?.addEventListener('click',()=>shiftCursor(1));
      calToday?.addEventListener('click',()=>goToDate(new Date(),calendarScale==='year'?'month':calendarScale));
      calTitle?.addEventListener('click',()=>{
        if(calendarScale==='year')goToDate(new Date(),'month');
        else if(calendarScale==='month')goToDate(new Date(),'day');
      });
      calScaleEl.querySelectorAll('[data-cal-scale]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          calendarScale=btn.dataset.calScale;
          writeCalScale(calendarScale);
          if(calendarScale==='month')calendarCursor=startOfMonth(calendarCursor);
          if(calendarScale==='year')calendarCursor=startOfYear(calendarCursor);
          writeCalCursor(calendarCursor);
          syncCalScaleButtons();
          renderCalendar();
        });
      });
      calLayersEl?.querySelectorAll('[data-cal-layer]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const key=btn.dataset.calLayer;
          calendarLayers[key]=!calendarLayers[key];
          writeCalLayers();
          syncCalLayerButtons();
          renderCalendar();
        });
      });
    }

    initCalendarUI();
