    function locationSearchHaystack(location){
      return [location.name,location.country,location.region,location.area,location.category,location.address,location.meeting_place,...(location.tags||[]),...(location.seasons||[])].filter(Boolean).join(' ').toLowerCase();
    }

    function renderLocationPicker(row,key,label){
      const current=row[key]||'';
      const currentLocation=currentLocationsById[current];
      const countryOptions=[...new Set(locations.map(l=>l.country).filter(Boolean))].sort();
      const categoryOptions=[...new Set(locations.map(l=>l.category).filter(Boolean))].sort();
      return `<div class="field full">
        <label>${label}</label>
        <input type="hidden" name="${key}" value="${escapeHtml(current)}" data-location-hidden>
        <div class="location-picker" data-location-picker>
          <div class="location-picker-head">
            <input class="location-picker-search" type="search" placeholder="Location suchen…" data-location-picker-search>
            <select data-location-picker-country><option value="all">Alle Länder</option>${countryOptions.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
            <select data-location-picker-category><option value="all">Alle Kategorien</option>${categoryOptions.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
          </div>
          <div class="hint" data-location-current>${currentLocation ? 'Ausgewählt: '+escapeHtml(currentLocation.name) : 'Keine Bibliotheks-Location ausgewählt'}</div>
          <div class="location-picker-grid" data-location-picker-grid>${renderLocationPickerOptions('', 'all', 'all', current)}</div>
        </div>
      </div>`;
    }

    function renderLocationPickerOptions(search='',country='all',category='all',current=''){
      const term=String(search||'').trim().toLowerCase();
      const hasSearch=term.length>0||country!=='all'||category!=='all';

      const base=locations.filter(location=>{
        const okCountry=country==='all'||location.country===country;
        const okCategory=category==='all'||location.category===category;
        const okSearch=!term||locationSearchHaystack(location).includes(term);
        return okCountry&&okCategory&&okSearch;
      });

      const bySmartScore=(a,b)=>{
        const fav=(b.is_favorite?1:0)-(a.is_favorite?1:0);
        if(fav)return fav;
        const last=new Date(b.last_used_at||0)-new Date(a.last_used_at||0);
        if(last)return last;
        return Number(b.usage_count||0)-Number(a.usage_count||0);
      };

      const renderOption=location=>{
        const meta=[location.country,location.region,location.area,location.category].filter(Boolean).join(' · ');
        const image=location.image_url?`style="background-image:url('${escapeHtml(location.image_url)}')"`:'';
        return `<button class="location-option ${current===location.id?'active':''}" type="button" data-pick-location="${escapeHtml(location.id)}">
          <div class="location-option-thumb" ${image}></div>
          <div><div class="location-option-title">${escapeHtml(location.name)}</div><div class="location-option-meta">${escapeHtml(meta||'Noch nicht kategorisiert')}</div></div>
          <span class="location-option-star ${location.is_favorite?'active':''}" data-toggle-location-favorite="${escapeHtml(location.id)}" title="Favorit">★</span>
        </button>`;
      };

      const clearOption=`<button class="location-option ${!current?'active':''}" type="button" data-pick-location="">
        <div class="location-option-thumb"></div>
        <div><div class="location-option-title">Keine Bibliotheks-Location</div><div class="location-option-meta">Manuelle Location verwenden</div></div>
      </button>`;

      if(hasSearch){
        const results=[...base].sort(bySmartScore).slice(0,14);
        if(!results.length){
          return clearOption+`<div class="location-picker-empty">Keine passende Location gefunden. Du kannst die Location manuell eintragen und anschließend „Als Location speichern“ nutzen.</div>`;
        }
        return clearOption+`<div class="location-picker-section-title">Suchergebnisse (${base.length})</div>`+results.map(renderOption).join('');
      }

      const favorites=[...locations].filter(l=>l.is_favorite).sort(bySmartScore).slice(0,6);
      const recent=[...locations].filter(l=>l.last_used_at&&!favorites.some(f=>f.id===l.id)).sort(bySmartScore).slice(0,6);
      const frequent=[...locations].filter(l=>Number(l.usage_count||0)>0&&!favorites.some(f=>f.id===l.id)&&!recent.some(r=>r.id===l.id)).sort(bySmartScore).slice(0,6);

      let output=clearOption;
      if(favorites.length)output+=`<div class="location-picker-section-title">⭐ Favoriten</div>`+favorites.map(renderOption).join('');
      if(recent.length)output+=`<div class="location-picker-section-title">🕒 Zuletzt verwendet</div>`+recent.map(renderOption).join('');
      if(frequent.length)output+=`<div class="location-picker-section-title">Häufig verwendet</div>`+frequent.map(renderOption).join('');

      if(!favorites.length&&!recent.length&&!frequent.length){
        const starter=[...locations].sort(bySmartScore).slice(0,10);
        output+=`<div class="location-picker-section-title">Erste Locations</div>`+starter.map(renderOption).join('');
      }

      return output;
    }

    function renderField(row,[key,label,type]){
      const value=escapeHtml(valueForInput(row,key,type));
      if(type==='select-day')return `<div class="field"><label>${label}</label><select name="${key}">${dayOptions.map(day=>`<option value="${escapeHtml(day)}" ${row[key]===day?'selected':''}>${escapeHtml(day)}</option>`).join('')}</select></div>`;
      if(type==='event-select'){
        const current=String(row[key]||'').trim();
        const names=[...new Set([...events.map(event=>String(event.name||'').trim()),...rows.map(item=>String(item.project_name||'').trim()),current].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
        return `<div class="field"><label>${label}</label><select name="${key}"><option value="" ${!current?'selected':''}>Keine Projektzuordnung</option>${names.map(name=>`<option value="${escapeHtml(name)}" ${current===name?'selected':''}>${escapeHtml(name)}</option>`).join('')}</select></div>`;
      }
      if(type==='select-status'){
        const options=[['aktiv','Aktiv'],['abgeschlossen','Abgeschlossen'],['archiviert','Archiv']];
        return `<div class="field"><label>${label}</label><select name="${key}">${options.map(([value,label])=>`<option value="${escapeHtml(value)}" ${String(row[key]||'aktiv')===value?'selected':''}>${escapeHtml(label)}</option>`).join('')}</select></div>`;
      }
      if(type==='select-project-status'){
        const current=String(row[key]||'')==='archiviert'?'archiviert':'auto';
        const options=[['auto','Automatisch'],['archiviert','Archiviert']];
        return `<div class="field"><label>${label}</label><select name="${key}">${options.map(([value,label])=>`<option value="${escapeHtml(value)}" ${current===value?'selected':''}>${escapeHtml(label)}</option>`).join('')}</select></div>`;
      }
      if(type==='location-select'){return renderLocationPicker(row,key,label)}if(type==='spot-select'){
        const current=row[key]||'',names=Object.keys(spotPresets),hasPreset=names.includes(current);
        return `<div class="field"><label>${label}</label><select name="${key}" data-spot-select><option value="${escapeHtml(current)}">${hasPreset?'Preset wählen…':(escapeHtml(current)||'Eigener Ort')}</option>${names.map(spot=>`<option value="${escapeHtml(spot)}" ${current===spot?'selected':''}>${escapeHtml(spot)}</option>`).join('')}</select></div>`;
      }
      const placeholder=key==='location_name'?'Name der Location':key==='meeting_place'?'Adresse oder Treffpunkt eingeben':key==='meeting_link'||key==='location_link'?'Google Maps Link einfügen':key==='image_url'?'Direkte Bild-URL einfügen':key==='subtitle'?'Mood / Beschreibung':key==='title'?'Titel des Shootings':'';return `<div class="field ${key==='title'||key==='subtitle'||key==='image_url'?'full':''}"><label>${label}</label><input name="${key}" type="${type}" value="${value}" placeholder="${escapeHtml(placeholder)}" ${type==='url'?'inputmode="url"':''}/></div>`;
    }
    function renderGroup(title,row,fields,cols='two'){return `<div class="section-title">${title}</div><div class="grid ${cols}">${fields.map(f=>renderField(row,f)).join('')}</div>`}
    function renderEventSection(row){const archived=String(row.project_status||'')==='archiviert';return `<div class="event-head"><div class="section-title">Event</div><button class="archive-toggle ${archived?'active':''}" type="button" data-toggle-archive title="${archived?'Archiviert':'Archivieren'}" aria-label="${archived?'Archiviert':'Archivieren'}">${archived?'Archiviert':'Archivieren'}</button></div><input type="hidden" name="project_status" value="${archived?'archiviert':'auto'}"><div class="grid two">${projectFields.map(f=>renderField(row,f)).join('')}</div>`}
    function renderBadges(row){const active=parseBadges(row.badges),known=[...new Set([...badgePresets,...active])];return `<div class="section-title">Badges</div><div class="badge-tools"><div class="badge-picker">${known.map(b=>`<button type="button" class="badge-chip ${active.includes(b)?'active':''}" data-badge="${escapeHtml(b)}">${escapeHtml(b)}${active.includes(b)?'<span class="badge-chip-remove" data-remove-badge>x</span>':''}</button>`).join('')}<button type="button" class="badge-chip add-badge" data-add-badge aria-label="Badge hinzufügen">+</button></div><textarea name="badges" hidden>${escapeHtml(active.join(', '))}</textarea></div>`}
    function renderPreview(row){const image=row.image_url?`url('${escapeHtml(row.image_url)}')`:'';return `<div class="link-preview" data-link-preview><a class="preview-button ${row.meeting_link?'':'disabled'}" ${row.meeting_link?`href="${escapeHtml(row.meeting_link)}" target="_blank" rel="noopener"`:''}>Treffpunkt ${row.meeting_link?'öffnen':'leer'}</a><a class="preview-button primary ${row.location_link?'':'disabled'}" ${row.location_link?`href="${escapeHtml(row.location_link)}" target="_blank" rel="noopener"`:''}>Location ${row.location_link?'öffnen':'leer'}</a></div><div class="image-preview" data-image-preview style="--preview-image:${image};">${row.image_url?'Bildvorschau':'Keine Bild-URL gesetzt'}</div>`}

    function renderLocationConvertTools(row){
      const hasLocation = !!row.location_id;
      return `<div class="location-actions">
        <button class="btn" type="button" data-open-location-panel="${escapeHtml(row.id)}">${hasLocation ? 'Location aktualisieren' : 'Als Location speichern'}</button>
      </div>
      <div class="location-convert-panel" data-location-panel="${escapeHtml(row.id)}">
        <div class="location-convert-title">${hasLocation ? 'Bibliotheks-Location aktualisieren' : 'Neue Location aus Shooting erstellen'}</div>
        <div class="location-mini-grid">
          <div class="field"><label>Name</label><input name="location_meta_name" type="text" value="${escapeHtml(row.location_name || row.title || 'Neue Location')}" /></div>
          <div class="field"><label>Land</label><input name="location_meta_country" type="text" list="countrySuggestions" value="" placeholder="Deutschland, Italien…" /></div>
          <div class="field"><label>Region</label><input name="location_meta_region" type="text" placeholder="Bayern, Südtirol…" /></div>
          <div class="field"><label>Gebiet</label><input name="location_meta_area" type="text" placeholder="Dolomiten, Allgäu…" /></div>
          <div class="field"><label>Kategorie</label><input name="location_meta_category" type="text" list="categorySuggestions" placeholder="Berge, See, Stadt…" /></div>
          <div class="field"><label>Tags</label><input name="location_meta_tags" type="text" value="${escapeHtml(parseBadges(row.badges).join(', '))}" placeholder="Sonnenaufgang, Paarshooting…" /></div>
          <div class="field full"><label>Jahreszeiten</label><input name="location_meta_seasons" type="text" placeholder="Sommer, Herbst…" /></div><div class="field full"><div class="maps-tools"><button class="btn" type="button" data-detect-shooting-location>Infos aus Maps-Link erkennen</button><span class="maps-status" data-maps-status></span></div></div>
        </div>
        <div class="btnbar">
          <button class="btn primary" type="button" data-save-as-location="${escapeHtml(row.id)}">${hasLocation ? 'Location aktualisieren' : 'Location speichern & verknüpfen'}</button>
          <button class="btn" type="button" data-close-location-panel="${escapeHtml(row.id)}">Abbrechen</button>
        </div>
        <div class="hint" style="margin-top:8px;">Übernommen werden Name, Treffpunkt, Maps-Link und Bild aus diesem Shooting. Zusatzinfos füllst du nur aus, wenn die Location wiederverwendbar werden soll.</div>
      </div>`;
    }



    function filteredRows(){
      const search=searchInput.value.trim().toLowerCase();
      return rows.filter(row=>{
        const matchesStatus=activeStatus==='all'||autoStatusForRow(row)===activeStatus;
        const matchesProject=activeProject==='all'||String(row.project_name||'')===activeProject;
        const haystack=[row.project_name,row.title,row.subtitle,row.day_label,row.date_label,row.meeting_place,row.location_name,...(row.badges||[])].filter(Boolean).join(' ').toLowerCase();
        return matchesStatus&&matchesProject&&(!search||haystack.includes(search));
      });
    }

    function groupRowsByDay(rows){
      const groups=[];
      const lookup=new Map();
      rows.forEach(row=>{
        const day=String(row.day_label||'').trim();
        const date=String(row.date_label||'').trim();
        const key=`${day}||${date}`;
        if(!lookup.has(key)){
          lookup.set(key,{day,date,rows:[]});
          groups.push(lookup.get(key));
        }
        lookup.get(key).rows.push(row);
      });
      return groups.sort((a,b)=>{
        const aDate=parseDateLabel(a.date)?.getTime()||Infinity;
        const bDate=parseDateLabel(b.date)?.getTime()||Infinity;
        if(aDate!==bDate)return aDate-bDate;
        const order={Freitag:1,Samstag:2,Sonntag:3};
        return (order[a.day]||99)-(order[b.day]||99);
      });
    }

    function groupRowsByProject(rows){
      const groups=[];
      const lookup=new Map();
      rows.forEach(row=>{
        const project=String(row.project_name||'').trim();
        const projectKey=project||'__no_project__';
        if(!lookup.has(projectKey)){
          lookup.set(projectKey,{project,rows:[]});
          groups.push(lookup.get(projectKey));
        }
        lookup.get(projectKey).rows.push(row);
      });
      events.forEach(event=>{
        const project=String(event.name||'').trim();
        if(!project)return;
        const key=project||'__no_project__';
        const matchesProject=activeProject==='all'||project===activeProject;
        const matchesStatus=activeStatus==='all'||String(event.status||'aktiv')===activeStatus;
        const search=searchInput.value.trim().toLowerCase();
        const matchesSearch=!search||project.toLowerCase().includes(search);
        if(!lookup.has(key)&&matchesProject&&matchesStatus&&matchesSearch){
          lookup.set(key,{project,eventId:event.id,eventStatus:event.status||'aktiv',rows:[]});
          groups.push(lookup.get(key));
        }else if(lookup.has(key)){
          const group=lookup.get(key);
          group.eventId=group.eventId||event.id;
          group.eventStatus=group.eventStatus||event.status||'aktiv';
        }
      });
      return groups;
    }

    function renderDayGroup(group){
      const day=group.day||'Unbekannter Tag';
      const date=group.date||'';
      return `<div class="day-group"><div class="day-heading"><strong>${escapeHtml(day)}</strong>${date?`<span class="day-date">${escapeHtml(date)}</span>`:''}</div><div class="day-items">${group.rows.map(renderEditor).join('')}</div></div>`;
    }

    function renderProjectGroup(group){
      const title=group.project||'Keine Projektzuordnung';
      const projectRows=rows.filter(row=>String(row.project_name||'').trim()===(group.project||''));
      const projectStatus=projectRows.length?projectStatusForRows(projectRows):group.eventStatus||projectStatusForRows(group.rows);
      const statusClass=`status-${escapeHtml(projectStatus)}`;
      const statusLabel=projectStatusLabels[projectStatus]||String(projectStatus||'Aktiv');
      const canDelete=group.eventId&&group.rows.length===0;
      const body=group.rows.length?groupRowsByDay(group.rows).map(renderDayGroup).join(''):`<div class="project-empty">Noch keine Shootings in diesem Event.</div>`;
      const key=projectGroupKey(group);
      return `<details class="project-group" ${isProjectGroupOpen(group)?'open':''} data-project-key="${escapeHtml(key)}" data-event-id="${escapeHtml(group.eventId||'')}" data-project-name="${escapeHtml(title)}"><summary class="project-summary"><div class="project-title"><span class="project-name-wrap"><strong>${escapeHtml(title)}</strong><button class="project-edit" type="button" data-edit-event title="Event umbenennen" aria-label="Event umbenennen">✎</button></span><span class="project-count">(${group.rows.length} Shooting${group.rows.length===1?'':'s'})</span></div><div class="project-actions"><span class="status-chip ${statusClass}">${escapeHtml(statusLabel)}</span>${canDelete?'<button class="project-delete" type="button" data-delete-event title="Leeres Event löschen" aria-label="Leeres Event löschen">×</button>':''}<span class="project-chevron" aria-hidden="true"></span></div></summary><div class="project-days">${body}</div></details>`;
    }

    function updateProjectFilter(){
      const projects=[...new Set([...events.map(e=>String(e.name||'').trim()),...rows.map(r=>String(r.project_name||'').trim())])].sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
      const current=projectFilter.value!==null?projectFilter.value:'all';
      projectFilter.innerHTML=`<option value="all">Alle Events</option>`+projects.map(project=>{
        const value=project||'';
        const label=project||'Keine Projektzuordnung';
        return `<option value="${escapeHtml(value)}" ${value===current?'selected':''}>${escapeHtml(label)}</option>`;
      }).join('');
      if(current!=='all'&&!projects.includes(current))projectFilter.value='all';
    }

    async function loadShootings(){
      clearError();orderDirty=false;dirtyForms.clear();updateOrderButton();updateUnsavedBar();setStatus('Daten werden geladen…');
      const {data,error}=await db.from('shootings').select('*');
      if(error){setStatus('Fehler beim Laden');showError('Fehler beim Laden: '+formatError(error));return}
      rows=sortRowsByDateAndTime((data||[]).map(r=>normalizeRowStatus({...r, project_name:r.project_name||'', project_status:r.project_status||'aktiv'})));
      await loadEvents();
      if(!locations.length)await loadLocations();currentRowsById=Object.fromEntries(rows.map(r=>[r.id,r]));updateProjectFilter();updateDataStamp();renderAll();setStatus(rows.length+' Einträge geladen');
    }

    async function loadEvents(){
      const {data,error}=await db.from('events').select('*');
      if(error){events=[];currentEventsById={};return}
      events=(data||[]).map(event=>({...event,status:event.status||'aktiv'}));
      currentEventsById=Object.fromEntries(events.map(event=>[event.id,event]));
    }

    function updateDataStamp(){
      statUpdated.textContent='Zuletzt aktualisiert '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    }

    function rowMatchesProjectAndSearch(row){
      const search=searchInput.value.trim().toLowerCase();
      const matchesProject=activeProject==='all'||String(row.project_name||'')===activeProject;
      const haystack=[row.project_name,row.title,row.subtitle,row.day_label,row.date_label,row.meeting_place,row.location_name,...(row.badges||[])].filter(Boolean).join(' ').toLowerCase();
      return matchesProject&&(!search||haystack.includes(search));
    }

    function timelineSectionOpenKey(section){return `admin_timeline_section_${section}_open`}

    function isTimelineSectionOpen(section,defaultOpen=false){
      try{
        const stored=localStorage.getItem(timelineSectionOpenKey(section));
        return stored===null?defaultOpen:stored==='true';
      }catch(error){
        return defaultOpen;
      }
    }

    function setTimelineSectionOpen(section,open){
      try{localStorage.setItem(timelineSectionOpenKey(section),open?'true':'false')}catch(error){}
    }

    function renderTimelineSection(section,title,sectionRows,defaultOpen=false){
  if(!sectionRows.length)return '';

  const groups=groupRowsByProject(sortRowsByDateAndTime(sectionRows));
  const eventCount=groups.length;
  const shootingCount=sectionRows.length;
  const open=isTimelineSectionOpen(section,defaultOpen);

  const subtitle=
    `${eventCount} Event${eventCount===1?'':'s'} · `+
    `${shootingCount} Shooting${shootingCount===1?'':'s'}`;

  return `
    <details
      class="timeline-section timeline-section-${escapeHtml(section)}"
      data-timeline-section="${escapeHtml(section)}"
      ${open?'open':''}
    >
      <summary class="timeline-divider">

        <span class="timeline-divider-line"></span>

        <span class="timeline-divider-label">
          ${escapeHtml(title)}
          <small>${escapeHtml(subtitle)}</small>
        </span>

        <span class="timeline-divider-line"></span>

        <span class="timeline-section-chevron" aria-hidden="true"></span>

      </summary>

      <div class="timeline-section-body">
        ${groups.map(renderProjectGroup).join('')}
      </div>
    </details>
  `;
}

    function bindTimelineSections(){
      shootingsEl.querySelectorAll('[data-timeline-section]').forEach(section=>{
        section.addEventListener('toggle',event=>{
          if(event.target===section)setTimelineSectionOpen(section.dataset.timelineSection,section.open);
        });
      });
    }

    function renderAll(){
      const hasStatusFilter=activeStatus!=='all';
      const visible=sortRowsByDateAndTime(filteredRows());

      if(hasStatusFilter){
        const groups=groupRowsByProject(visible);
        shootingsEl.innerHTML=groups.length?groups.map(renderProjectGroup).join(''):`<div class="card hint">Keine passenden Shootings gefunden.</div>`;
        bindEditors();
        return;
      }

      const matchingRows=rows.filter(rowMatchesProjectAndSearch);
      const upcoming=sortRowsByDateAndTime(matchingRows.filter(row=>autoStatusForRow(row)==='aktiv'));
      const past=sortRowsByDateAndTime(matchingRows.filter(row=>autoStatusForRow(row)==='abgeschlossen'));
      const archived=sortRowsByDateAndTime(matchingRows.filter(row=>autoStatusForRow(row)==='archiviert'));

      const upcomingGroups=groupRowsByProject(upcoming);
      let html=upcomingGroups.length?upcomingGroups.map(renderProjectGroup).join(''):`<div class="card hint">Keine kommenden Events gefunden.</div>`;
      html+=renderTimelineSection('past','Vergangene Events',past,false);
      html+=renderTimelineSection('archived','Archivierte Events',archived,false);

      shootingsEl.innerHTML=html;
      bindTimelineSections();
      bindEditors();
    }

    function renderManualOverrides(row){
      const hasLibraryLocation=!!row.location_id;
      return `<details class="one-time-location-panel">
        <summary>
          <div class="one-time-location-title">
            <strong>${hasLibraryLocation?'Einmalige Location / Anpassung erfassen':'Einmalige Location erfassen'}</strong>
            <span>${hasLibraryLocation?'Nur öffnen, wenn dieses Shooting von der gewählten Bibliotheks-Location abweicht.':'Optional öffnen, wenn du keine Bibliotheks-Location auswählen möchtest.'}</span>
          </div>
          <div class="manual-overrides-chevron">⌄</div>
        </summary>
        <div class="one-time-location-body">
          ${renderGroup('Location für dieses Shooting',row,manualPlaceFields,'two')}
          ${renderGroup('Links & Bild',row,linkFields,'two')}
          ${renderPreview(row)}
          <div class="field full" style="margin-top:12px;"><label>Notiz für dieses Shooting</label><textarea name="shooting_note" placeholder="z.B. Parkplatz hinter dem Hotel nutzen, bei Regen direkt zum Aussichtspunkt…">${escapeHtml(row.shooting_note || '')}</textarea></div>

          <label class="checkbox-card">
            <input type="checkbox" name="save_as_recurring_location" data-save-as-recurring-location>
            <div>
              <strong>Als wiederkehrende Location speichern</strong>
              <span>Diese Location wird zusätzlich in deiner Location-Bibliothek gespeichert und kann später wiederverwendet werden.</span>
            </div>
          </label>

          <div class="recurring-location-fields" data-recurring-location-fields>
            <div class="section-title">Location-Bibliothek</div>
            <div class="hint" style="margin-bottom:12px;">Diese Felder entsprechen dem Location-Editor im Bereich „Locations“.</div>

            <div class="grid two">
              <div class="field"><label>Name</label><input name="location_meta_name" type="text" value="${escapeHtml(row.location_name === 'TBA' ? (row.title || '') : (row.location_name || row.title || ''))}" placeholder="Name der Location" /></div>
              <div class="field"><label>Kategorie</label><input name="location_meta_category" type="text" list="categorySuggestions" placeholder="Berge, See, Stadt…" /></div>
              <div class="field"><label>Land</label><input name="location_meta_country" type="text" list="countrySuggestions" placeholder="Deutschland, Italien…" /></div>
              <div class="field"><label>Bundesland / Region</label><input name="location_meta_region" type="text" placeholder="Bayern, Südtirol…" /></div>
              <div class="field"><label>Gebiet / Landschaft</label><input name="location_meta_area" type="text" placeholder="Dolomiten, Allgäu…" /></div>
              <div class="field"><label>Aktiv</label><select name="location_meta_active"><option value="true" selected>Aktiv</option><option value="false">Archiviert</option></select></div>
            </div>

            <div class="section-title">Ort & Links</div>
            <div class="grid two">
              <div class="field full"><label>Adresse</label><input name="location_meta_address" type="text" value="${escapeHtml(row.meeting_place === 'TBA' ? '' : (row.meeting_place || ''))}" placeholder="Adresse / Treffpunkt" /></div>
              <div class="field"><label>Google Maps Link</label><input name="location_meta_maps_link" type="url" inputmode="url" value="${escapeHtml(row.location_link || row.meeting_link || '')}" /></div>
              <div class="field"><label>Standard-Treffpunkt</label><input name="location_meta_meeting_place" type="text" value="${escapeHtml(row.meeting_place === 'TBA' ? '' : (row.meeting_place || ''))}" /></div>
              <div class="field full"><label>Bild URL</label><input name="location_meta_image_url" type="url" inputmode="url" value="${escapeHtml(row.image_url || '')}" /></div>
            </div>

            <div class="image-preview" data-recurring-location-image-preview style="--preview-image:${row.image_url ? `url('${escapeHtml(row.image_url)}')` : ''};">${row.image_url ? 'Bildvorschau' : 'Keine Bild-URL gesetzt'}</div>

            <div class="section-title">Beschreibung & Tags</div>
            <div class="grid two">
              <div class="field full"><label>Beschreibung</label><textarea name="location_meta_description" placeholder="Kurze Beschreibung für die Location-Bibliothek">${escapeHtml(row.subtitle || '')}</textarea></div>
              <div class="field"><label>Tags, kommagetrennt</label><textarea name="location_meta_tags">${escapeHtml(parseBadges(row.badges).join(', '))}</textarea></div>
              <div class="field"><label>Jahreszeiten, kommagetrennt</label><textarea name="location_meta_seasons" placeholder="Sommer, Herbst…"></textarea></div>
            </div>

            <div class="maps-tools"><button class="btn" type="button" data-detect-shooting-location>Infos aus Maps-Link erkennen</button><span class="maps-status" data-maps-status></span></div>
          </div>
        </div>
      </details>`;
    }

    function renderEditor(row){
      const thumb=row.image_url?`style="background-image:url('${escapeHtml(row.image_url)}')"`:'';
      const rowStatus=autoStatusForRow(row);
      const statusLabel=projectStatusLabels[rowStatus]||String(rowStatus||'Aktiv');
      const statusClass=`status-${escapeHtml(rowStatus)}`;
      const projectName=String(row.project_name||'').trim();
      return `<details class="spot-card" data-id="${escapeHtml(row.id)}" ${row.__draft?'open':''}><summary><div class="thumb" ${thumb}></div><div class="summary-main"><div class="summary-title">${escapeHtml(row.title)}</div><div class="summary-sub">${escapeHtml(row.date_label||'')} · ${escapeHtml(row.meeting_time||'TBA')} · ${escapeHtml(row.meeting_place||row.location_name||'TBA')}${projectName?` · ${escapeHtml(projectName)}`:''}</div><div class="dirty-badge">${row.__draft?'Entwurf':'Nicht gespeichert'}</div></div><div class="summary-day"><span class="status-chip ${statusClass}">${escapeHtml(statusLabel)}</span></div></summary><div class="editor"><form data-id="${escapeHtml(row.id)}" ${row.__draft?'data-draft="true"':''}>${renderEventSection(row)}${renderGroup('Basis',row,simpleFields,'two')}${renderGroup('Zeiten',row,timeFields,'two')}${renderGroup('Orte',row,placeFields,'two')}${renderManualOverrides(row)}${renderBadges(row)}<div class="sticky-actions"><button class="btn" type="button" data-cancel="${escapeHtml(row.id)}">Abbrechen</button><button class="btn primary form-save-btn" type="submit">Speichern</button></div><div class="danger-zone"><div class="form-meta-row"><div class="save-state" data-save-state>${row.__draft?'Entwurf':'Gespeichert'}</div><div class="btnbar"><button class="btn" type="button" data-duplicate="${escapeHtml(row.id)}">Duplizieren</button><button class="btn danger" type="button" data-delete="${escapeHtml(row.id)}">Löschen</button></div></div></div></form></div></details>`;
    }

    function bindEditors(){
      shootingsEl.querySelectorAll('form').forEach(form=>{setFormBaseline(form);if(form.dataset.draft==='true')setFormDirty(form,true);form.addEventListener('submit',saveForm);form.addEventListener('input',()=>{refreshLivePreview(form);refreshFormDirtyState(form)});form.addEventListener('change',()=>{refreshLivePreview(form);refreshFormDirtyState(form)})});
      shootingsEl.querySelectorAll('.project-group').forEach(group=>group.addEventListener('toggle',event=>{if(event.target===group)setProjectGroupOpen(group.dataset.projectKey,group.open)}));
      shootingsEl.querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',cancelForm));
      shootingsEl.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',deleteRow));
      shootingsEl.querySelectorAll('[data-duplicate]').forEach(b=>b.addEventListener('click',duplicateRow));
      shootingsEl.querySelectorAll('[data-badge]').forEach(b=>b.addEventListener('click',toggleBadge));
      shootingsEl.querySelectorAll('[data-add-badge]').forEach(b=>b.addEventListener('click',addCustomBadge));
      shootingsEl.querySelectorAll('[data-toggle-archive]').forEach(b=>b.addEventListener('click',toggleArchiveStatus));
      shootingsEl.querySelectorAll('[data-edit-event]').forEach(b=>b.addEventListener('pointerdown',renameEvent));
      shootingsEl.querySelectorAll('[data-delete-event]').forEach(b=>b.addEventListener('pointerdown',deleteEmptyEvent));
      shootingsEl.querySelectorAll('[data-spot-select]').forEach(s=>s.addEventListener('change',applySpotPreset));bindLocationPickers();shootingsEl.querySelectorAll('[data-open-location-panel]').forEach(b=>b.addEventListener('click',openLocationPanel));shootingsEl.querySelectorAll('[data-close-location-panel]').forEach(b=>b.addEventListener('click',closeLocationPanel));shootingsEl.querySelectorAll('[data-save-as-location]').forEach(b=>b.addEventListener('click',saveShootingAsLocation));shootingsEl.querySelectorAll('[data-detect-shooting-location]').forEach(b=>b.addEventListener('click',detectShootingLocationFromMaps));shootingsEl.querySelectorAll('[data-save-as-recurring-location]').forEach(c=>c.addEventListener('change',toggleRecurringLocationFields));
    }

    function refreshBadgeChips(form){const badges=parseBadges(form.elements.badges?.value);form.querySelectorAll('[data-badge]').forEach(chip=>chip.classList.toggle('active',badges.includes(chip.dataset.badge)))}
    function toggleBadge(e){const chip=e.currentTarget,form=chip.closest('form'),textarea=form.elements.badges,badges=parseBadges(textarea.value),badge=chip.dataset.badge;if(e.target.closest('[data-remove-badge]')){e.preventDefault();e.stopPropagation();const usedElsewhere=rows.some(row=>row.id!==form.dataset.id&&parseBadges(row.badges).includes(badge));if(usedElsewhere&&!confirm(`„${badge}“ wird auch in anderen Shootings verwendet. Aus diesem Shooting entfernen?`))return;textarea.value=badges.filter(x=>x!==badge).join(', ');chip.querySelector('[data-remove-badge]')?.remove()}else textarea.value=(badges.includes(badge)?badges.filter(x=>x!==badge):[...badges,badge]).join(', ');const nextBadges=parseBadges(textarea.value);if(nextBadges.includes(badge)&&!chip.querySelector('[data-remove-badge]'))chip.insertAdjacentHTML('beforeend','<span class="badge-chip-remove" data-remove-badge>x</span>');refreshBadgeChips(form);refreshLivePreview(form);refreshFormDirtyState(form)}
    function commitInlineBadge(input){
      const form=input.closest('form'),textarea=form.elements.badges,value=input.value.trim(),wrap=input.closest('.badge-inline');
      if(input.dataset.committed==='true')return;
      input.dataset.committed='true';
      if(!wrap)return;
      if(value){
        const badges=parseBadges(textarea.value);
        if(!badges.includes(value)){
          textarea.value=[...badges,value].join(', ');
          const chip=document.createElement('button');
          chip.type='button';chip.className='badge-chip active';chip.dataset.badge=value;chip.innerHTML=`${escapeHtml(value)}<span class="badge-chip-remove" data-remove-badge>x</span>`;
          chip.addEventListener('click',toggleBadge);
          wrap.before(chip);
        }
        refreshFormDirtyState(form);
      }
      wrap.replaceWith(makeAddBadgeButton());
    }
    function makeAddBadgeButton(){const button=document.createElement('button');button.type='button';button.className='badge-chip add-badge';button.dataset.addBadge='';button.setAttribute('aria-label','Badge hinzufügen');button.textContent='+';button.addEventListener('click',addCustomBadge);return button}
    function addCustomBadge(e){const addButton=e.currentTarget,input=document.createElement('input');input.className='badge-inline-input';input.type='text';input.placeholder='Badge';const wrap=document.createElement('span');wrap.className='badge-inline badge-chip';wrap.append(input);addButton.replaceWith(wrap);input.focus();input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitInlineBadge(input)}if(event.key==='Escape'){wrap.replaceWith(makeAddBadgeButton())}});input.addEventListener('blur',()=>commitInlineBadge(input))}
    function toggleArchiveStatus(e){const btn=e.currentTarget,form=btn.closest('form'),input=form.elements.project_status,archived=input.value==='archiviert';input.value=archived?'auto':'archiviert';btn.classList.toggle('active',!archived);btn.textContent=archived?'Archivieren':'Archiviert';btn.title=btn.textContent;btn.setAttribute('aria-label',btn.title);refreshFormDirtyState(form)}
    function refreshLivePreview(form){refreshLinkPreview(form);refreshImagePreview(form);const recurringPreview=form.querySelector('[data-recurring-location-image-preview]');if(recurringPreview){const url=form.elements.location_meta_image_url?.value||'';setImagePreviewState(recurringPreview,url)}}
    function refreshLinkPreview(form){const p=form.querySelector('[data-link-preview]');if(!p)return;const meeting=form.elements.meeting_link?.value,location=form.elements.location_link?.value;p.innerHTML=`<a class="preview-button ${meeting?'':'disabled'}" ${meeting?`href="${escapeHtml(meeting)}" target="_blank" rel="noopener"`:''}>Treffpunkt ${meeting?'öffnen':'leer'}</a><a class="preview-button primary ${location?'':'disabled'}" ${location?`href="${escapeHtml(location)}" target="_blank" rel="noopener"`:''}>Location ${location?'öffnen':'leer'}</a>`}
    function classifyImageUrl(value){
      const url=String(value||'').trim();
      if(!url)return {ok:false,type:'empty',message:'Keine Bild-URL gesetzt'};

      const lower=url.toLowerCase();

      if(lower.includes('maps.app.goo.gl')||lower.includes('google.com/maps')||lower.includes('goo.gl/maps')||lower.includes('maps.google.')){
        return {
          ok:false,
          type:'maps',
          message:'⚠️ Kein Bild-Link erkannt\\nGoogle-Maps-Links können nicht als Bild dargestellt werden. Verwende hier eine direkte Bild-URL (.jpg, .png, .webp).'
        };
      }

      if(lower.includes('drive.google.com')){
        return {
          ok:false,
          type:'drive',
          message:'⚠️ Google-Drive-Link erkannt\\nFür die Vorschau brauchst du eine direkt öffentlich abrufbare Bild-URL, nicht den Drive-Teilen-Link.'
        };
      }

      if(lower.includes('dropbox.com')){
        return {
          ok:false,
          type:'dropbox',
          message:'⚠️ Dropbox-Link erkannt\\nDropbox-Links sind oft keine direkten Bilddateien. Verwende am besten eine direkte .jpg/.png/.webp URL.'
        };
      }

      if(lower.includes('instagram.com')){
        return {
          ok:false,
          type:'instagram',
          message:'⚠️ Instagram-Link erkannt\\nInstagram-Links können nicht als Bildvorschau geladen werden. Verwende eine direkte Bild-URL.'
        };
      }

      const looksLikeImage=/\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(url);
      const trustedImageHost=lower.includes('images.unsplash.com')||lower.includes('images.pexels.com')||lower.includes('cdn.');

      if(looksLikeImage||trustedImageHost){
        return {ok:true,type:'image',message:'Bildvorschau'};
      }

      return {
        ok:true,
        type:'unknown',
        message:'Bildvorschau – falls nichts erscheint, ist es vermutlich keine direkte Bild-URL.'
      };
    }

    function setImagePreviewState(preview,url){
      const result=classifyImageUrl(url);
      preview.classList.toggle('warning',!result.ok&&result.type!=='empty');

      if(!url){
        preview.style.setProperty('--preview-image','linear-gradient(135deg,rgba(216,177,106,.18),rgba(143,181,161,.12))');
        preview.textContent=result.message;
        return;
      }

      if(!result.ok){
        preview.style.setProperty('--preview-image','linear-gradient(135deg,rgba(216,177,106,.18),rgba(217,108,108,.12))');
        const lines=result.message.split('\\n');
        preview.innerHTML=`<div><strong>${escapeHtml(lines[0])}</strong>${escapeHtml(lines.slice(1).join(' '))}</div>`;
        return;
      }

      preview.style.setProperty('--preview-image',`url('${url.replaceAll("'","%27")}')`);
      preview.textContent=result.message;
    }

    function validateImageBeforeSave(imageUrl,label='Bild URL'){
      const url=String(imageUrl||'').trim();
      if(!url)return true;
      const result=classifyImageUrl(url);
      if(result.ok)return true;

      const message=result.message.replaceAll('\\n',' ');
      showError(`Ungültige ${label}: ${message} Bitte das Feld leer lassen oder eine direkte Bild-URL verwenden.`);
      return false;
    }


    function refreshImagePreview(form){const p=form.querySelector('[data-image-preview]');if(!p)return;const url=form.elements.image_url?.value||'';setImagePreviewState(p,url)}
    function applySpotPreset(e){const preset=spotPresets[e.currentTarget.value];if(!preset)return;const form=e.currentTarget.closest('form');if(form.elements.location_name)form.elements.location_name.value=preset.location_name;if(form.elements.title&&!form.elements.title.value.trim())form.elements.title.value=preset.title;if(form.elements.image_url&&!form.elements.image_url.value.trim())form.elements.image_url.value=preset.image_url;refreshLivePreview(form);refreshFormDirtyState(form)}

    function fillFormFromRow(form,row){allFieldGroups.forEach(([key,label,type])=>{const f=form.elements[key];if(f)f.value=valueForInput(row,key,type)});if(form.elements.project_status)form.elements.project_status.value=String(row.project_status||'')==='archiviert'?'archiviert':'auto';const archiveBtn=form.querySelector('[data-toggle-archive]');if(archiveBtn)archiveBtn.classList.toggle('active',String(row.project_status||'')==='archiviert');if(form.elements.badges)form.elements.badges.value=parseBadges(row.badges).join(', ');if(form.elements.shooting_note)form.elements.shooting_note.value=row.shooting_note||'';refreshBadgeChips(form);refreshLivePreview(form);setFormBaseline(form);refreshFormDirtyState(form)}
    function collectPayload(form){const fd=new FormData(form),p={};allFieldGroups.forEach(([key,label,type])=>{const raw=fd.get(key);p[key]=type==='date'?inputToDateLabel(raw):(type==='time'?(raw||null):(raw||null))});p.project_status=String(fd.get('project_status')||'')==='archiviert'?'archiviert':autoStatusForRow(p);p.badges=parseBadges(fd.get('badges'));p.shooting_note=fd.get('shooting_note')||null;p.weather_label=null;p.weather_id=null;p.updated_at=new Date().toISOString();return p}

    function cancelForm(e){const id=e.currentTarget.dataset.cancel,form=e.currentTarget.closest('form'),row=currentRowsById[id];if(!form||!row)return;if(form.dataset.draft==='true'){if(!confirm('Neues Shooting/Event verwerfen?'))return;rows=rows.filter(r=>r.id!==id);delete currentRowsById[id];dirtyForms.delete(id);renderAll();updateUnsavedBar();showToast('Entwurf verworfen');return}fillFormFromRow(form,row);setFormDirty(form,false);form.closest('details').open=false;setStatus('Änderungen verworfen: '+id);showToast('Änderungen verworfen')}
    async function saveForm(e){e.preventDefault();clearError();const form=e.currentTarget,id=form.dataset.id,card=form.closest('.spot-card'),isDraft=form.dataset.draft==='true';let payload=collectPayload(form);if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;card?.classList.add('is-saving');setStatus((isDraft?'Erstelle ':'Speichere ')+id+'…');try{payload=await maybeCreateRecurringLocationFromForm(form,id,payload)}catch(error){card?.classList.remove('is-saving');if(error.message!=='INVALID_IMAGE_URL')showError('Wiederkehrende Location konnte nicht erstellt werden: '+formatError(error));return}payload=normalizeRowStatus(payload);const savePayload=isDraft?{...payload,id,sort_order:currentRowsById[id]?.sort_order||rows.length+1}:payload;const {error}=isDraft?await db.from('shootings').insert(savePayload):await db.from('shootings').update(payload).eq('id',id);card?.classList.remove('is-saving');if(error){setStatus('Fehler beim Speichern');showError('Fehler beim Speichern: '+formatError(error));return}const index=rows.findIndex(r=>r.id===id);if(index>=0)rows[index]=normalizeRowStatus({...rows[index],...savePayload,__draft:false});currentRowsById[id]=rows[index]||normalizeRowStatus({...currentRowsById[id],...savePayload,__draft:false});setFormBaseline(form);setFormDirty(form,false);updateProjectFilter();updateDataStamp();renderAll();const newCard=shootingsEl.querySelector(`[data-id="${id}"]`);if(newCard)newCard.open=true;setStatus('Gespeichert: '+id);showToast(isDraft?'Erstellt':'Gespeichert')}
    async function duplicateRow(e){const id=e.currentTarget.dataset.duplicate,source=currentRowsById[id];if(!source)return;const copy=normalizeRowStatus({...source,id:`${source.id}-kopie-${Date.now()}`,title:`${source.title||'Shooting'} · Kopie`,sort_order:rows.length?Math.max(...rows.map(r=>Number(r.sort_order||0)))+1:1,project_name:source.project_name||'',project_status:String(source.project_status||'')==='archiviert'?'archiviert':'aktiv',updated_at:new Date().toISOString()});delete copy.weather_label;delete copy.weather_id;delete copy.__draft;const {error}=await db.from('shootings').insert(copy);if(error){showError('Duplizieren fehlgeschlagen: '+formatError(error));return}showToast('Dupliziert');await loadShootings()}
    async function ensureEventForProject(name,status='aktiv'){
      const project=String(name||'').trim();
      if(!project||events.some(event=>String(event.name||'').trim()===project))return;
      const payload={id:'event-'+Date.now(),name:project,status,updated_at:new Date().toISOString()};
      const {error}=await db.from('events').insert(payload);
      if(error)throw error;
      events=[...events,payload];currentEventsById[payload.id]=payload;
    }
    async function deleteRow(e){const id=e.currentTarget.dataset.delete,row=currentRowsById[id];if(!row)return;if(row.__draft){if(!confirm('Diesen Entwurf verwerfen?'))return;rows=rows.filter(r=>r.id!==id);delete currentRowsById[id];dirtyForms.delete(id);renderAll();updateUnsavedBar();showToast('Entwurf verworfen');return}if(!confirm(`Shooting wirklich löschen?\n\n${row.title||id}`))return;const projectName=String(row.project_name||'').trim(),isLastInProject=projectName&&rows.filter(r=>String(r.project_name||'').trim()===projectName).length===1;try{if(isLastInProject)await ensureEventForProject(projectName,autoStatusForRow(row))}catch(error){showError('Event konnte nicht erhalten bleiben: '+formatError(error));return}const {error}=await db.from('shootings').delete().eq('id',id);if(error){showError('Löschen fehlgeschlagen: '+formatError(error));return}showToast('Gelöscht');await loadShootings()}
    function setEventNameDialogOpen(open){eventNameDialog.classList.toggle('hidden',!open);eventNameDialog.setAttribute('aria-hidden',open?'false':'true');document.body.classList.toggle('event-dialog-open',open);if(open)setTimeout(()=>eventNameInput.focus(),30)}
    function resolveEventName(value){if(!pendingEventNameResolve)return;const resolve=pendingEventNameResolve;pendingEventNameResolve=null;setEventNameDialogOpen(false);resolve(value)}
    function askEventName(){return new Promise(resolve=>{pendingEventNameResolve=resolve;eventNameInput.value='';setEventNameDialogOpen(true)})}
    async function createNewEvent(){
      clearError();
      const requestedName=await askEventName();
      const name=String(requestedName||'').trim();
      if(!name)return;
      if(events.some(event=>String(event.name||'').trim()===name)){showError('Ein Event mit diesem Namen gibt es schon.');return}
      const id='event-'+Date.now();
      const payload={id,name,status:'aktiv',updated_at:new Date().toISOString()};
      setStatus('Event wird erstellt…');
      const first=await db.from('events').insert(payload);
      let saved=payload,error=first.error;
      if(error){
        const retryPayload={name,status:'aktiv',updated_at:payload.updated_at};
        const retry=await db.from('events').insert(retryPayload);
        saved={...retryPayload,id:name};
        error=retry.error;
      }
      if(error){setStatus('Fehler beim Erstellen');showError('Event konnte nicht gespeichert werden: '+formatError(error));return}
      await loadEvents();
      saved=events.find(event=>String(event.name||'').trim()===name)||saved;
      const normalizedEvent={...saved,status:saved.status||'aktiv'};
      if(!events.some(event=>event.id===normalizedEvent.id))events=[...events,normalizedEvent];
      currentEventsById[normalizedEvent.id]=normalizedEvent;activeProject=name;activeStatus='all';syncStatusButtons();updateProjectFilter();projectFilter.value=name;renderAll();setStatus('Event erstellt');showToast('Event erstellt');
    }

    async function commitEventRename(group,input,oldName,eventId){
      if(input.dataset.committed==='true')return;
      input.dataset.committed='true';
      const name=input.value;
      if(!name||!name.trim()||name.trim()===oldName){renderAll();return}
      const newName=name.trim(),now=new Date().toISOString(),isUnassigned=oldName==='Keine Projektzuordnung';
      const matchesOldProject=row=>isUnassigned?!String(row.project_name||'').trim():String(row.project_name||'').trim()===oldName;
      let savedEvent=null;
      clearError();
      setStatus('Event wird umbenannt…');
      try{
        const affected=rows.filter(matchesOldProject);
        if(affected.length){
          const {error}=await db.from('shootings').update({project_name:newName,updated_at:now}).in('id',affected.map(row=>row.id));
          if(error)throw new Error((isUnassigned?'Shootings konnten nicht zugeordnet werden: ':'Shootings konnten nicht umbenannt werden: ')+formatError(error));
        }
        if(eventId){
          const {error}=await db.from('events').update({name:newName,updated_at:now}).eq('id',eventId);
          if(error)throw new Error('Event konnte nicht umbenannt werden: '+formatError(error));
        }else if(isUnassigned&&!events.some(event=>String(event.name||'').trim()===newName)){
          const payload={id:'event-'+Date.now(),name:newName,status:'aktiv',updated_at:now};
          const {error}=await db.from('events').insert(payload);
          if(error)console.warn('Event konnte nicht separat angelegt werden:',error);
          else savedEvent=payload;
        }
        if(savedEvent){
          const normalizedEvent={...savedEvent,status:savedEvent.status||'aktiv'};
          events=[...events,normalizedEvent];currentEventsById[normalizedEvent.id]=normalizedEvent;
        }
        events=events.map(event=>event.id===eventId?{...event,name:newName,updated_at:now}:event);
        rows=rows.map(row=>matchesOldProject(row)?{...row,project_name:newName,updated_at:now}:row);
        currentRowsById=Object.fromEntries(rows.map(row=>[row.id,row]));activeProject=(activeProject===oldName||isUnassigned)?newName:activeProject;updateProjectFilter();projectFilter.value=activeProject;renderAll();setStatus(isUnassigned?'Event erstellt':'Event umbenannt');showToast(isUnassigned?'Event erstellt und Shootings zugeordnet':'Event umbenannt');
      }catch(error){
        setStatus('Fehler beim Umbenennen');
        showError(formatError(error));
        renderAll();
      }
    }

    function renameEvent(e){
      e.preventDefault();e.stopPropagation();
      const editButton=e.currentTarget,group=editButton.closest('.project-group'),eventId=group?.dataset.eventId||'',oldName=group?.dataset.projectName||'',wrap=editButton.closest('.project-name-wrap'),strong=wrap?.querySelector('strong');
      if(!group||!wrap||!strong||wrap.querySelector('input'))return;
      const input=document.createElement('input');
      input.className='event-name-input';
      input.value=oldName;
      strong.replaceWith(input);
      editButton.remove();
      const actions=document.createElement('span');
      actions.className='event-name-actions';
      actions.innerHTML='<button class="event-name-action" type="button" data-confirm-event-rename aria-label="Eventnamen speichern">✓</button><button class="event-name-action" type="button" data-cancel-event-rename aria-label="Abbrechen">×</button>';
      wrap.appendChild(actions);
      input.focus();
      input.select();
      input.addEventListener('pointerdown',event=>event.stopPropagation());
      actions.addEventListener('pointerdown',event=>event.stopPropagation());
      actions.querySelector('[data-confirm-event-rename]').addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();commitEventRename(group,input,oldName,eventId)});
      actions.querySelector('[data-cancel-event-rename]').addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();renderAll()});
      actions.querySelectorAll('button').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation()}));
      input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitEventRename(group,input,oldName,eventId)}if(event.key==='Escape'){event.preventDefault();renderAll()}});
      input.addEventListener('blur',()=>setTimeout(()=>{if(input.isConnected)commitEventRename(group,input,oldName,eventId)},80));
    }

    async function deleteEmptyEvent(e){
      e.preventDefault();e.stopPropagation();
      const group=e.currentTarget.closest('.project-group'),eventId=group?.dataset.eventId||'',name=group?.dataset.projectName||'';
      if(!eventId||rows.some(row=>String(row.project_name||'').trim()===name))return;
      if(!confirm(`Leeres Event löschen?\n\n${name}`))return;
      const {error}=await db.from('events').delete().eq('id',eventId);
      if(error){showError('Event konnte nicht gelöscht werden: '+formatError(error));return}
      events=events.filter(event=>event.id!==eventId);delete currentEventsById[eventId];if(activeProject===name)activeProject='all';updateProjectFilter();renderAll();showToast('Event gelöscht');
    }
    function discardOpenChanges(){
      const ids=[...dirtyForms];
      ids.forEach(id=>{
        const form=shootingsEl.querySelector(`form[data-id="${id}"]`),row=currentRowsById[id];
        if(!form||!row)return;
        if(form.dataset.draft==='true'){rows=rows.filter(r=>r.id!==id);delete currentRowsById[id];dirtyForms.delete(id);return}
        fillFormFromRow(form,row);setFormDirty(form,false);
      });
      orderDirty=false;updateOrderButton();updateUnsavedBar();renderAll();showToast('Änderungen verworfen');
    }
    function dateLabelFromDate(date){return `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}`}

    function defaultsForCurrentEventFilters(){
      const date=new Date();
      if(activeStatus==='abgeschlossen')date.setDate(date.getDate()-1);
      return {
        project_name:activeProject==='all'?undefined:activeProject,
        project_status:activeStatus==='archiviert'?'archiviert':'aktiv',
        date_label:dateLabelFromDate(date)
      };
    }

    async function createNewRow(overrides={}){
      clearError();
      if(addBtn.disabled)return;

      addBtn.disabled=true;
      addBtn.classList.add('is-busy');
      setStatus('Neuer Entwurf…');

      try{
        const sortOrder=rows.length?Math.max(...rows.map(r=>Number(r.sort_order||0)))+1:1;
        const id='shooting-'+Date.now();
        const dateLabel=overrides.date_label??dateLabelFromDate(new Date());

        const row={
          id,
          sort_order:sortOrder,
          day_label:'Freitag',
          project_name:overrides.project_name??'',
          project_status:overrides.project_status??'aktiv',
          date_label:dateLabel,
          title:overrides.title??'Neues Shooting',
          subtitle:'',
          meeting_time:'09:00',
          meeting_place:'',
          shooting_time:'10:00',
          location_name:'',
          meeting_link:'',
          location_link:'',
          image_url:'',
          badges:[],
          weather_label:null,
          weather_id:null,
          updated_at:new Date().toISOString(),
          __draft:true
        };

        rows=sortRowsByDateAndTime([...rows,row]);
        currentRowsById[id]=row;
        updateProjectFilter();
        renderAll();
        updateUnsavedBar();
        showToast(overrides.project_name?'Neues Event vorbereitet':'Neues Shooting vorbereitet');

        const card=shootingsEl.querySelector(`[data-id="${id}"]`);
        if(card){
          card.open=true;
          card.scrollIntoView({behavior:'smooth',block:'center'});
          const titleInput=card.querySelector('input[name="title"]');
          if(titleInput)setTimeout(()=>titleInput.focus(),350);
          const form=card.querySelector('form');
          if(form)setFormDirty(form,true);
        }
      }catch(error){
        console.error(error);
        setStatus('Fehler beim Erstellen');
        showError('Fehler beim Erstellen: '+(error.message||error));
      }finally{
        addBtn.disabled=false;
        addBtn.classList.remove('is-busy');
      }
    }
