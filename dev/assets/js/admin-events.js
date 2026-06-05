    function locationSearchHaystack(location){
      return [location.name,location.country,location.region,location.area,location.category,location.address,location.meeting_place,...(location.tags||[]),...(location.seasons||[])].filter(Boolean).join(' ').toLowerCase();
    }

    function locationFinderDisplayName(row){
      const linked=row.location_id?currentLocationsById[row.location_id]:null;
      const raw=valueForInput(row,'location_name','text');
      if(linked&&!raw)return linked.name||'';
      return raw||'';
    }

    function countLibraryFinderMatches(search='',country='all',category='all'){
      const term=String(search||'').trim().toLowerCase();
      return locations.filter(location=>{
        const okCountry=country==='all'||location.country===country;
        const okCategory=category==='all'||location.category===category;
        const okSearch=!term||locationSearchHaystack(location).includes(term);
        return okCountry&&okCategory&&okSearch;
      }).length;
    }

    function locationSetupShouldShow(row){
      if(row.location_id)return false;
      const term=String(row.location_name||'').trim();
      return term.length>=3||!!String(row.location_link||'').trim()||!!String(row.meeting_place||'').trim();
    }

    function renderLocationFinderStatus(row){
      const linked=row.location_id?currentLocationsById[row.location_id]:null;
      if(linked){
        const display=String(row.location_name||'').trim();
        const differs=display&&display!==String(linked.name||'').trim();
        return `<span class="location-finder-badge is-library">Bibliothek · ${escapeHtml(linked.name)}</span>${differs?`<span class="location-finder-hint">Anzeigename: ${escapeHtml(display)}</span>`:''}`;
      }
      const name=String(row.location_name||'').trim();
      if(name){
        return `<span class="location-finder-badge is-onetime">Neuer Ort · Bibliothek beim Speichern</span>`;
      }
      return `<span class="location-finder-hint">Name tippen, Maps-Link einfügen — zuerst Bibliothek, sonst Karte.</span>`;
    }

    function renderLibrarySaveChoice(row){
      if(row.location_id)return '';
      return `<label class="checkbox-card checkbox-card-compact library-save-choice">
        <input type="checkbox" name="skip_library_autosave" data-skip-library-autosave />
        <div>
          <strong>Nur für dieses Shooting</strong>
          <span>Aktivieren, wenn der Ort nicht in die Location-Bibliothek soll. Standard: Orte mit Adresse oder Maps-Link werden beim Speichern übernommen.</span>
        </div>
      </label>`;
    }


    function renderLocationFinderIcsBlock(row){
      if(!row.__icsImportLocation||row.location_id)return '';
      const label=String(row.location_name||row.meeting_place||'').trim();
      if(!label)return '';
      const match=typeof findSimilarLibraryLocation==='function'?findSimilarLibraryLocation(row):null;
      const matchBtn=match
        ?`<button type="button" class="btn" data-import-location-link="${escapeHtml(row.id)}" data-location-id="${escapeHtml(match.id)}">Bestehende: „${escapeHtml(match.name)}“</button>`
        :'';
      return `<div class="location-finder-ics import-location-offer" data-import-location-offer="${escapeHtml(row.id)}">
        <p class="import-location-offer-title">Aus Kalender-Import</p>
        <p class="import-location-offer-text"><strong>${escapeHtml(label)}</strong> — in die Bibliothek übernehmen?</p>
        <div class="btnbar import-location-offer-actions">
          <button type="button" class="btn primary" data-import-location-accept="${escapeHtml(row.id)}">In Bibliothek anlegen</button>
          ${matchBtn}
          <button type="button" class="btn" data-import-location-skip="${escapeHtml(row.id)}">Nur dieses Shooting</button>
        </div>
      </div>`;
    }

    function renderLocationFinderSimilar(term,current){
      const similar=typeof findSimilarLibraryLocation==='function'
        ?findSimilarLibraryLocation({location_name:term,meeting_place:term})
        :null;
      if(!similar||current)return '';
      return `<div class="location-finder-similar">
        <button type="button" class="btn" data-pick-location="${escapeHtml(similar.id)}">Meintest du „${escapeHtml(similar.name)}“ aus der Bibliothek?</button>
      </div>`;
    }

    function renderLocationSetupPanel(row){
      const linkVal=escapeHtml(valueForInput(row,'location_link','url'));
      const show=locationSetupShouldShow(row);
      const open=show&&!row.location_id;
      return `<details class="editor-subpanel location-setup-panel ${show?'':'hidden'}" data-location-setup ${open?'open':''}>
        <summary class="editor-subpanel-summary">
          <strong>Neuen Ort vorbereiten</strong>
          <span>Maps & Bibliothek</span>
        </summary>
        <div class="editor-subpanel-body">
          <div class="field full">
            <label>Google-Maps-Link</label>
            <input name="location_link" type="url" inputmode="url" value="${linkVal}" placeholder="Link einfügen, dann „Erkennen“" data-place-link="location" />
          </div>
          <div class="maps-tools">
            <button class="btn" type="button" data-detect-place="location">Aus Maps-Link erkennen</button>
            <span class="maps-status" data-maps-status="location"></span>
          </div>
          ${renderLibrarySaveChoice(row)}
        </div>
      </details>`;
    }

    function renderLocationFinderSummary(row){
      const linked=row.location_id?currentLocationsById[row.location_id]:null;
      const display=String(locationFinderDisplayName(row)||'').trim();
      if(linked){
        const displayText=display&&display!==String(linked.name||'').trim()?` · Anzeige: ${display}`:'';
        return `Bibliothek · ${linked.name}${displayText}`;
      }
      if(display)return `Neuer Ort · ${display}`;
      return 'Noch keine Location';
    }


    function renderLocationFinder(row){
      const current=row.location_id||'';
      const displayName=locationFinderDisplayName(row);
      const countryOptions=[...new Set(locations.map(l=>l.country).filter(Boolean))].sort();
      const categoryOptions=[...new Set(locations.map(l=>l.category).filter(Boolean))].sort();
      const mode=current?'library':displayName?'onetime':'';
      const captureHint=typeof LOCATION_CAPTURE_HINT!=='undefined'?LOCATION_CAPTURE_HINT:'Name tippen (Kartensuche), Maps-Link einfügen oder <strong>📍</strong> am aktuellen Spot.';
      return `<div class="field full location-finder-field">
        <label>Ort im Shooting</label>
        <p class="hint editor-block-hint location-finder-hint-block">${captureHint}</p>
        <input type="hidden" name="location_id" value="${escapeHtml(current)}" data-location-hidden>
        <div class="location-finder is-open" data-location-finder data-location-mode="${escapeHtml(mode)}">
          <div class="location-finder-main-with-gps">
            <input class="location-finder-input" name="location_name" type="text" value="${escapeHtml(displayName)}" placeholder="Anzeigename, Kartensuche oder Maps-Link" data-location-finder-input autocomplete="off" />
            <button type="button" class="btn location-gps-btn" data-capture-gps-shooting title="Aktuellen Standort" aria-label="Aktuellen Standort">📍</button>
          </div>
          <div class="location-finder-status" data-location-finder-status>${renderLocationFinderStatus(row)}</div>
          <details class="location-finder-filters-wrap">
            <summary class="location-finder-filters-summary">Bibliothek filtern</summary>
            <div class="location-finder-filters" data-location-finder-filters>
              <select data-location-finder-country aria-label="Land filtern"><option value="all">Alle Länder</option>${countryOptions.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
              <select data-location-finder-category aria-label="Kategorie filtern"><option value="all">Alle Kategorien</option>${categoryOptions.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
            </div>
          </details>
          <div class="location-finder-results location-picker-grid" data-location-finder-grid>${renderLocationFinderResults(displayName,'all','all',current,row)}</div>
          <div class="location-finder-results location-picker-grid location-osm-grid" data-osm-results></div>
          ${renderLocationSetupPanel(row)}
        </div>
      </div>`;
    }


    function renderLocationFinderResults(search='',country='all',category='all',current='',row={}){
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
        const locFocus=String(location.image_focus||'50% 50%').replace(/"/g,'');
        const image=location.image_url?`style="background-image:url('${escapeHtml(location.image_url)}');background-position:${escapeHtml(locFocus)};"`:'';
        return `<button class="location-option ${current===location.id?'active':''}" type="button" data-pick-location="${escapeHtml(location.id)}">
          <div class="location-option-thumb" ${image}></div>
          <div><div class="location-option-title">${escapeHtml(location.name)}</div><div class="location-option-meta">${escapeHtml(meta||'Noch nicht kategorisiert')}</div></div>
          <span class="location-option-star ${location.is_favorite?'active':''}" data-toggle-location-favorite="${escapeHtml(location.id)}" title="Favorit">★</span>
        </button>`;
      };

      let output=renderLocationFinderIcsBlock(row);

      if(hasSearch){
        const results=[...base].sort(bySmartScore).slice(0,14);
        if(!results.length){
          if(term){
            return output+renderLocationFinderSimilar(String(search||'').trim(),current)+`<div class="location-picker-section-title">Bibliothek</div><div class="location-picker-empty">Kein Treffer — Kartensuche lädt…</div>`;
          }
          return output+`<div class="location-picker-empty">Keine Treffer mit diesen Filtern.</div>`;
        }
        return output+`<div class="location-picker-section-title">Bibliothek (${base.length})</div>`+results.map(renderOption).join('');
      }

      const favorites=[...locations].filter(l=>l.is_favorite).sort(bySmartScore).slice(0,6);
      const recent=[...locations].filter(l=>l.last_used_at&&!favorites.some(f=>f.id===l.id)).sort(bySmartScore).slice(0,6);
      const frequent=[...locations].filter(l=>Number(l.usage_count||0)>0&&!favorites.some(f=>f.id===l.id)&&!recent.some(r=>r.id===l.id)).sort(bySmartScore).slice(0,6);

      if(favorites.length)output+=`<div class="location-picker-section-title">⭐ Favoriten</div>`+favorites.map(renderOption).join('');
      if(recent.length)output+=`<div class="location-picker-section-title">🕒 Zuletzt verwendet</div>`+recent.map(renderOption).join('');
      if(frequent.length)output+=`<div class="location-picker-section-title">Häufig verwendet</div>`+frequent.map(renderOption).join('');

      if(!favorites.length&&!recent.length&&!frequent.length){
        const starter=[...locations].sort(bySmartScore).slice(0,10);
        output+=`<div class="location-picker-section-title">Bibliothek</div>`+starter.map(renderOption).join('');
      }

      if(!output.replace(renderLocationFinderIcsBlock(row),'').trim()){
        output+=`<div class="location-finder-hint location-finder-hint-block">Noch keine Locations — Name eingeben, Kartensuche nutzen.</div>`;
      }

      return output;
    }

    function rowFromLocationFinderForm(form){
      const base=currentRowsById[form?.dataset?.id]||{};
      return {
        ...base,
        location_id:form?.elements?.location_id?.value||'',
        location_name:form?.elements?.location_name?.value||'',
        __icsImportLocation:base.__icsImportLocation
      };
    }

    function refreshLocationFinderUI(form){
      const finder=form?.querySelector('[data-location-finder]');
      if(!finder)return;
      const row=rowFromLocationFinderForm(form);
      const input=finder.querySelector('[data-location-finder-input]');
      const grid=finder.querySelector('[data-location-finder-grid]');
      const country=finder.querySelector('[data-location-finder-country]');
      const category=finder.querySelector('[data-location-finder-category]');
      const status=finder.querySelector('[data-location-finder-status]');
      const hidden=form.elements.location_id;
      if(status)status.innerHTML=renderLocationFinderStatus(row);
      if(grid){
        grid.innerHTML=renderLocationFinderResults(input?.value||'',country?.value||'all',category?.value||'all',hidden?.value||'',row);
      }
      finder.dataset.locationMode=row.location_id?'library':String(row.location_name||'').trim()?'onetime':'';
      if(typeof syncLocationSetupPanel==='function')syncLocationSetupPanel(form);
      if(typeof refreshLocationFinderOsm==='function')refreshLocationFinderOsm(form);
    }

    window.countLibraryFinderMatches=countLibraryFinderMatches;

    function maybeUnlinkLibraryOnNameEdit(form){
      const id=form?.elements?.location_id?.value;
      if(!id)return;
      const loc=currentLocationsById[id];
      const name=String(form?.elements?.location_name?.value||'').trim();
      if(!loc||!name)return;
      const needle=typeof normalizeLocationNeedle==='function'?normalizeLocationNeedle: v=>String(v||'').trim().toLowerCase();
      if(needle(name)!==needle(loc.name)){
        form.elements.location_id.value='';
        delete form.dataset.libraryMeetingPlace;
        delete form.dataset.libraryMeetingLink;
        if(typeof syncLocationSetupPanel==='function')syncLocationSetupPanel(form);
        if(typeof syncShootingMeetingLibraryState==='function')syncShootingMeetingLibraryState(form);
        showToast('Bibliotheks-Verknüpfung gelöst — einmalige Location');
      }
    }

    function bindLocationFinders(){
      shootingsEl.querySelectorAll('[data-location-finder]').forEach(finder=>{
        if(finder.dataset.bound==='true')return;
        finder.dataset.bound='true';
        const form=finder.closest('form');
        if(typeof bindLocationImageField==='function')bindLocationImageField(form);
        if(form.dataset.placeAnchorRev==null)form.dataset.placeAnchorRev='0';
        if(form.dataset.imageSuggestRev==null)form.dataset.imageSuggestRev='0';
        const input=finder.querySelector('[data-location-finder-input]');
        const country=finder.querySelector('[data-location-finder-country]');
        const category=finder.querySelector('[data-location-finder-category]');
        let osmTimer=null;
        let imageSuggestTimer=null;
        const maybeScheduleImageSuggest=()=>{
          clearTimeout(imageSuggestTimer);
          imageSuggestTimer=setTimeout(()=>{
            if(typeof canAutoReplaceLocationImage!=='function'||typeof scheduleLocationImageSuggestion!=='function')return;
            if(!canAutoReplaceLocationImage(form))return;
            const meta=typeof readFormRegionArea==='function'?readFormRegionArea(form):{};
            scheduleLocationImageSuggestion(form,meta,null);
          },900);
        };

        const refresh=()=>{
          maybeUnlinkLibraryOnNameEdit(form);
          refreshLocationFinderUI(form);
          if(typeof syncLocationGeoFieldsVisibility==='function')syncLocationGeoFieldsVisibility(form);
          refreshLivePreview(form);
          refreshFormDirtyState(form);
        };

        const refreshWithOsm=()=>{
          const term=String(input?.value||'').trim();
          refresh();
          maybeScheduleImageSuggest();
          clearTimeout(osmTimer);
          if(typeof looksLikeMapsLink==='function'&&looksLikeMapsLink(term)){
            osmTimer=setTimeout(()=>{
              if(typeof applyMapsLinkFromFinder==='function')applyMapsLinkFromFinder(form,term);
            },350);
            return;
          }
          osmTimer=setTimeout(()=>{
            if(typeof refreshLocationFinderOsm==='function')refreshLocationFinderOsm(form);
          },420);
        };

        input?.addEventListener('input',refreshWithOsm);
        country?.addEventListener('change',refreshWithOsm);
        category?.addEventListener('change',refreshWithOsm);
        form.querySelector('[data-capture-gps-shooting]')?.addEventListener('click',()=>{
          if(typeof captureGpsToShootingForm==='function')captureGpsToShootingForm(form);
        });

        finder.addEventListener('click',async event=>{
          const star=event.target.closest('[data-toggle-location-favorite]');
          if(star){
            event.preventDefault();
            event.stopPropagation();
            await toggleLocationFavorite(star.dataset.toggleLocationFavorite);
            refreshLocationFinderUI(form);
            return;
          }
          const pick=event.target.closest('[data-pick-location]');
          if(pick){
            const id=pick.dataset.pickLocation||'';
            if(form?.elements.location_id)form.elements.location_id.value=id;
            const location=currentLocationsById[id];
            if(location&&form?.elements.location_name)form.elements.location_name.value=location.name||'';
            if(location){
              applyPickedLocationToForm(form,location);
              markLocationUsed(location.id);
              const setup=form?.querySelector('[data-location-setup]');
              if(setup)setup.classList.add('hidden');
            }else{
              refreshLivePreview(form);
              refreshFormDirtyState(form);
              refreshLocationFinderUI(form);
            }
            return;
          }
          const osmPick=event.target.closest('[data-pick-osm]');
          if(osmPick){
            const hit=finder._osmResults?.[Number(osmPick.dataset.pickOsm)];
            if(hit&&typeof applyOsmPickToForm==='function')applyOsmPickToForm(form,hit);
            return;
          }
        });
      });
    }

    window.renderLocationFinderResults=renderLocationFinderResults;
    window.refreshLocationFinderUI=refreshLocationFinderUI;

    function renderField(row,[key,label,type]){
      const value=escapeHtml(valueForInput(row,key,type));
      if(type==='select-day')return `<div class="field"><label>${label}</label><select name="${key}">${dayOptions.map(day=>`<option value="${escapeHtml(day)}" ${row[key]===day?'selected':''}>${escapeHtml(day)}</option>`).join('')}</select></div>`;
      if(type==='event-select'){
        const current=String(row[key]||'').trim();
        const names=[...new Set([...events.map(event=>String(event.name||'').trim()),...rows.map(item=>String(item.project_name||'').trim()),current].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
        return `<div class="field"><label>${label}</label><select name="${key}"><option value="" ${!current?'selected':''}>Einzel-Shooting (kein Event)</option>${names.map(name=>`<option value="${escapeHtml(name)}" ${current===name?'selected':''}>${escapeHtml(name)}</option>`).join('')}</select></div>`;
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
      if(type==='location-select'){return renderLocationFinder(row)}if(type==='spot-select'){
        const current=row[key]||'',names=Object.keys(spotPresets),hasPreset=names.includes(current);
        return `<div class="field"><label>${label}</label><select name="${key}" data-spot-select><option value="${escapeHtml(current)}">${hasPreset?'Preset wählen…':(escapeHtml(current)||'Eigener Ort')}</option>${names.map(spot=>`<option value="${escapeHtml(spot)}" ${current===spot?'selected':''}>${escapeHtml(spot)}</option>`).join('')}</select></div>`;
      }
      const placeholder=key==='location_name'?'Name der Location':key==='meeting_place'?'Adresse manuell oder nach Maps-Erkennung bearbeiten':key==='meeting_link'||key==='location_link'?'Google-Maps-Link einfügen':key==='image_url'?'Direkte Bild-URL einfügen':key==='subtitle'?'Mood / Beschreibung':key==='title'?'z. B. Shooting am Pragser Wildsee':'';const fullWidth=key==='title'||key==='subtitle'||key==='image_url'||key==='location_link'||key==='meeting_link';return `<div class="field ${fullWidth?'full':''}"><label>${label}</label><input name="${key}" type="${type}" value="${value}" placeholder="${escapeHtml(placeholder)}" ${type==='url'?'inputmode="url"':''}/></div>`;
    }
    function renderGroup(title,row,fields,cols='two'){
      const titleHtml=title?`<div class="section-title">${escapeHtml(title)}</div>`:'';
      return `${titleHtml}<div class="grid ${cols}">${fields.map(f=>renderField(row,f)).join('')}</div>`;
    }
    function renderEventSection(row){
      const archived=String(row.project_status||'')==='archiviert';
      const bound=isShootingBoundToEvent(row);
      const project=String(row.project_name||'').trim();
      return `<section class="event-assignment">
        <input type="hidden" name="project_status" value="${archived?'archiviert':'auto'}" />
        <div class="event-assignment-head">
          <span class="event-assignment-chip ${bound?'is-event':'is-single'}">${bound?'Event':'Einzel-Shooting'}</span>
          <span class="event-assignment-name">${escapeHtml(project||'Kein Event zugeordnet')}</span>
        </div>
        <p class="hint event-section-hint">${bound?'Dieses Shooting wird in der Liste unter dem Event gruppiert.':'Ohne Event-Zuordnung nutzt du den Shooting-Status darunter.'}</p>
        <div class="event-assignment-grid">${projectFields.map(f=>renderField(row,['project_name','Event-Zuordnung',f[2]])).join('')}</div>
        <details class="archive-panel">
          <summary class="archive-panel-summary"><strong>Archiv</strong><span>${archived?'Archiviert':'Aktiv nach Datum'}</span></summary>
          <div class="archive-panel-body">
            <button class="archive-toggle ${archived?'active':''}" type="button" data-toggle-archive title="${archived?'Aus Archiv holen':'In Archiv verschieben'}" aria-label="${archived?'Aus Archiv holen':'In Archiv verschieben'}">${archived?'Aus Archiv holen':'In Archiv verschieben'}</button>
          </div>
        </details>
      </section>`;
    }


    function renderWorkflowSection(row){
      if(isShootingBoundToEvent(row)){
        return `<div class="workflow-section workflow-section-bound" data-workflow-section>
          <input type="hidden" name="workflow_status" value="" />
        </div>`;
      }
      const currentSlug=workflowSlug(row.workflow_status||'angefragt');
      const labels=knownWorkflowStatusLabels(row);
      return `<div class="workflow-section" data-workflow-section>
        <div class="section-title">Shooting-Status</div>
        <p class="hint workflow-section-hint">Nur für Shootings <strong>ohne Event</strong>. Vorgaben oder eigenen Status per <strong>+</strong> hinzufügen.</p>
        <input type="hidden" name="workflow_status" value="${escapeHtml(currentSlug)}" data-workflow-value />
        <div class="workflow-picker">${labels.map(label=>{
          const slug=workflowSlug(label);
          const active=slug===currentSlug;
          return `<button type="button" class="workflow-chip ${active?'active':''}" data-workflow-pick="${escapeHtml(slug)}" title="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
        }).join('')}<button type="button" class="workflow-chip workflow-chip-add" data-add-workflow-status aria-label="Eigenen Status hinzufügen">+</button></div>
      </div>`;
    }

    function refreshWorkflowChips(form){
      if(!form?.elements?.workflow_status)return;
      const current=workflowSlug(form.elements.workflow_status.value);
      form.querySelectorAll('[data-workflow-pick]').forEach(btn=>{
        btn.classList.toggle('active',btn.dataset.workflowPick===current);
      });
    }

    function refreshWorkflowSectionInForm(form){
      if(!form)return;
      const id=form.dataset.id;
      const row={...(currentRowsById[id]||{}),project_name:form.elements.project_name?.value??''};
      const section=form.querySelector('[data-workflow-section]');
      if(!section)return;
      const wrap=document.createElement('div');
      wrap.innerHTML=renderWorkflowSection(row);
      const next=wrap.firstElementChild;
      section.replaceWith(next);
      bindWorkflowPickers(form);
      refreshFormDirtyState(form);
    }

    function bindWorkflowPickers(root=document){
      root.querySelectorAll('form[data-id]').forEach(form=>{
        form.querySelectorAll('[data-workflow-pick]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const input=form.elements.workflow_status;
            if(!input)return;
            input.value=btn.dataset.workflowPick;
            refreshWorkflowChips(form);
            refreshFormDirtyState(form);
          });
        });
        form.querySelectorAll('[data-add-workflow-status]').forEach(btn=>{
          btn.addEventListener('click',e=>addCustomWorkflowStatus(e));
        });
      });
    }

    function addCustomWorkflowStatus(e){
      const btn=e.currentTarget;
      const section=btn.closest('[data-workflow-section]');
      const form=btn.closest('form');
      if(!section||!form)return;
      if(section.querySelector('.workflow-inline-input'))return;
      const wrap=document.createElement('span');
      wrap.className='workflow-chip workflow-chip-inline';
      wrap.innerHTML='<input class="workflow-inline-input" type="text" placeholder="Neuer Status" maxlength="32" />';
      btn.replaceWith(wrap);
      const input=wrap.querySelector('.workflow-inline-input');
      input.focus();
      const commit=()=>{
        const label=String(input.value||'').trim();
        if(!label){refreshWorkflowSectionInForm(form);return}
        const custom=readCustomWorkflowStatuses();
        if(!custom.some(s=>workflowSlug(s)===workflowSlug(label)))writeCustomWorkflowStatuses([...custom,label]);
        if(form.elements.workflow_status)form.elements.workflow_status.value=workflowSlug(label);
        refreshWorkflowSectionInForm(form);
        if(typeof renderWorkflowFilterButtons==='function')renderWorkflowFilterButtons();
      };
      input.addEventListener('keydown',ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commit()}
        if(ev.key==='Escape'){ev.preventDefault();refreshWorkflowSectionInForm(form)}
      });
      input.addEventListener('blur',commit);
    }
    function renderBadges(row){
      const active=parseBadges(row.badges),known=[...new Set([...badgePresets,...active])];
      const count=active.length;
      return `<details class="editor-subpanel editor-subpanel-badges">
        <summary class="editor-subpanel-summary">
          <strong>Badges</strong>
          <span>${count?`${count} aktiv`:'optional — Mood & Stimmung'}</span>
        </summary>
        <div class="editor-subpanel-body">
          <div class="badge-tools"><div class="badge-picker">${known.map(b=>`<button type="button" class="badge-chip ${active.includes(b)?'active':''}" data-badge="${escapeHtml(b)}">${escapeHtml(b)}${active.includes(b)?'<span class="badge-chip-remove" data-remove-badge>x</span>':''}</button>`).join('')}<button type="button" class="badge-chip add-badge" data-add-badge aria-label="Badge hinzufügen">+</button></div><textarea name="badges" hidden>${escapeHtml(active.join(', '))}</textarea></div>
        </div>
      </details>`;
    }

    function renderBasicsSection(row){
      return `<section class="editor-block editor-block-basics">
        <div class="editor-block-head"><h3 class="editor-block-title">Shooting</h3></div>
        ${renderGroup('',row,basicsFields,'two')}
      </section>`;
    }

    function renderScheduleSection(row){
      const duration=durationMinutesBetween(row.meeting_time,row.end_time);
      const dayAuto=dayLabelFromDateLabel(row.date_label)||row.day_label||'';
      return `<section class="editor-block editor-block-schedule">
        <div class="editor-block-head"><h3 class="editor-block-title">Termin</h3></div>
        <input type="hidden" name="day_label" value="${escapeHtml(dayAuto)}" data-day-label-hidden />
        <div class="grid two schedule-grid">
          ${renderField(row,['date_label','Datum','date'])}
          ${renderField(row,['meeting_time','Beginn / Treff','time'])}
          <div class="field schedule-duration-field">
            <label>Dauer ab Beginn (Min.)</label>
            <input name="duration_minutes" type="number" min="15" step="15" placeholder="z. B. 120" value="${escapeHtml(duration)}" data-duration-minutes />
            <span class="hint-inline">Setzt das <strong>Ende</strong> automatisch ab Beginn/Treff.</span>
          </div>
          ${renderField(row,['end_time','Ende','time'])}
          ${renderField(row,['shooting_time','Shooting ab','time'])}
        </div>
        <p class="hint-inline schedule-day-hint" data-day-label-hint>${dayAuto?`Wochentag: <strong>${escapeHtml(dayAuto)}</strong> (automatisch aus Datum)`:'Wochentag wird automatisch aus dem Datum gesetzt.'}</p>
        <p class="hint editor-block-hint">„Beginn / Treff“ ist die Basis fuer die Dauer. „Shooting ab“ bleibt optional fuer die Kundenansicht.</p>
      </section>`;
    }

    function renderPreview(row)
    function renderPreview(row){const image=row.image_url?`url('${escapeHtml(row.image_url)}')`:'';return `<div class="link-preview" data-link-preview><a class="preview-button ${row.meeting_link?'':'disabled'}" ${row.meeting_link?`href="${escapeHtml(row.meeting_link)}" target="_blank" rel="noopener"`:''}>Treffpunkt ${row.meeting_link?'öffnen':'leer'}</a><a class="preview-button primary ${row.location_link?'':'disabled'}" ${row.location_link?`href="${escapeHtml(row.location_link)}" target="_blank" rel="noopener"`:''}>Location ${row.location_link?'öffnen':'leer'}</a></div><div class="image-preview" data-image-preview style="--preview-image:${image};">${row.image_url?'Bildvorschau':'Keine Bild-URL gesetzt'}</div>`}

    function renderImportLocationOffer(row){
      if(!row.__icsImportLocation||row.location_id)return '';
      const label=String(row.location_name||row.meeting_place||'').trim();
      if(!label)return '';
      const match=typeof findSimilarLibraryLocation==='function'?findSimilarLibraryLocation(row):null;
      const matchBtn=match
        ?`<button type="button" class="btn" data-import-location-link="${escapeHtml(row.id)}" data-location-id="${escapeHtml(match.id)}">Bestehende: „${escapeHtml(match.name)}“</button>`
        :'';
      return `<div class="import-location-offer" data-import-location-offer="${escapeHtml(row.id)}">
        <p class="import-location-offer-title">Location aus Kalender-Import</p>
        <p class="import-location-offer-text"><strong>${escapeHtml(label)}</strong> — in die Location-Bibliothek übernehmen und mit diesem Shooting verknüpfen?</p>
        <div class="btnbar import-location-offer-actions">
          <button type="button" class="btn primary" data-import-location-accept="${escapeHtml(row.id)}">Ja, übernehmen</button>
          ${matchBtn}
          <button type="button" class="btn" data-import-location-skip="${escapeHtml(row.id)}">Nein, nur dieses Shooting</button>
        </div>
      </div>`;
    }

    function renderMapsPlaceBlock(kind,row){
      const isMeeting=kind==='meeting';
      const linkKey=isMeeting?'meeting_link':'location_link';
      const linkLabel=isMeeting?'Maps-Link (Treffpunkt)':'Maps-Link (Location)';
      const linkVal=escapeHtml(valueForInput(row,linkKey,'url'));
      return `<div class="place-maps-block" data-place-maps="${escapeHtml(kind)}">
        <div class="field full">
          <label>${linkLabel}</label>
          <input name="${linkKey}" type="url" inputmode="url" value="${linkVal}" placeholder="Google-Maps-Link einfügen" data-place-link="${escapeHtml(kind)}" />
        </div>
        <div class="maps-tools">
          <button class="btn" type="button" data-detect-place="${escapeHtml(kind)}">Aus Maps-Link erkennen</button>
          <span class="maps-status" data-maps-status="${escapeHtml(kind)}"></span>
        </div>
      </div>`;
    }

    function renderShootingMeetingPanel(row){
      const hasLib=!!row.location_id;
      const placeVal=escapeHtml(valueForInput(row,'meeting_place','text'));
      const linkVal=escapeHtml(valueForInput(row,'meeting_link','url'));
      const meetHint=typeof MEETING_CAPTURE_HINT!=='undefined'?MEETING_CAPTURE_HINT:'Name, Kartensuche, Maps-Link oder GPS.';
      const libHint=hasLib
        ?'Aus der Location-Bibliothek — hier nur für <strong>dieses Shooting</strong> änderbar. Geänderten Treff unten in die Bibliothek zurückspeichern.'
        :'Eigener Treffpunkt — leer = die Location-Adresse oben gilt als Treff.';
      return `<div class="shooting-meeting-panel" data-shooting-meeting-body>
        <p class="hint editor-block-hint">${libHint}</p>
        <p class="hint-inline">${meetHint}</p>
        <div class="field full">
          <label>Treffpunkt</label>
          <div class="location-capture-row">
            <input class="location-capture-name" name="meeting_place" type="text" value="${placeVal}" placeholder="Treff suchen, Name oder Google-Maps-Link" data-meeting-lib-name data-place-address="shared" autocomplete="off" />
            <button type="button" class="btn location-gps-btn" data-capture-gps-meeting title="Aktuellen Standort als Treff" aria-label="GPS Treffpunkt">📍</button>
          </div>
          <input type="hidden" name="meeting_capture_lat" value="" data-meeting-capture-lat />
          <input type="hidden" name="meeting_capture_lon" value="" data-meeting-capture-lon />
          <div class="location-lib-osm address-search-panel hidden" data-shooting-meeting-osm aria-live="polite"></div>
        </div>
        <div class="field full">
          <label>Maps-Link (Treffpunkt)</label>
          <input name="meeting_link" type="url" inputmode="url" value="${linkVal}" placeholder="Google-Maps-Link einfügen" data-place-link="meeting" />
        </div>
        <div class="maps-tools">
          <button class="btn" type="button" data-detect-meeting-from-maps>Aus Maps-Link erkennen</button>
          <span class="maps-status" data-maps-status="meeting"></span>
        </div>
        <button type="button" class="btn hidden" data-save-meeting-to-library>Treff in Location speichern</button>
      </div>`;
    }

    function renderLocationBlock(row){
      const separate=rowUsesSeparateMeeting(row);
      const libLinked=!!row.location_id;
      const openMeeting=libLinked||separate;
      const openLocation=!libLinked||row.__draft;
      const locationSummary=renderLocationFinderSummary(row);
      const imageVal=escapeHtml(valueForInput(row,'image_url','url'));
      const showImagePanel=!libLinked||!!String(row.image_url||'').trim();
      const imageSummary=libLinked?'aus Location / optional':'optional fuer neuen Ort';
      return `<section class="editor-block editor-block-location">
        <details class="editor-subpanel editor-subpanel-location-main" ${openLocation?'open':''}>
          <summary class="editor-subpanel-summary">
            <strong>Location</strong>
            <span>${escapeHtml(locationSummary)}</span>
          </summary>
          <div class="editor-subpanel-body">
            <div class="location-picker-block">${renderLocationFinder(row)}</div>
          </div>
        </details>
        <details class="editor-subpanel editor-subpanel-media ${showImagePanel?'':'is-secondary'}">
          <summary class="editor-subpanel-summary"><strong>Bild</strong><span>${imageSummary}</span></summary>
          <div class="editor-subpanel-body">
            <p class="hint-inline">Nach Ortserfassung Bildvorschlag (Wikipedia / Wikimedia) — URL jederzeit austauschbar.</p>
            <div class="field full"><label>Bild URL</label><input name="image_url" type="url" inputmode="url" value="${imageVal}" placeholder="Direkte Bild-URL einfügen" /></div>
            <button type="button" class="btn location-image-clear-btn" data-clear-suggested-image>Bild entfernen</button>
          </div>
        </details>
        <details class="editor-subpanel" data-shooting-meeting-panel data-separate-meeting-panel ${openMeeting?'open':''}>
          <summary class="editor-subpanel-summary">
            <strong>Treffpunkt</strong>
            <span>${libLinked?'aus Bibliothek':'optional'}</span>
          </summary>
          <div class="editor-subpanel-body">
            ${renderShootingMeetingPanel(row)}
          </div>
        </details>
        ${renderLocationExtrasPanel(row)}
      </section>`;
    }

    function renderLocationExtrasPanel(row){
      const showExtras=!row.location_id||!!String(row.shooting_note||'').trim();
      if(!showExtras){
        return `<input type="hidden" name="shooting_note" value="${escapeHtml(row.shooting_note||'')}" />`;
      }
      return `<details class="editor-subpanel editor-subpanel-extras">
        <summary class="editor-subpanel-summary">
          <strong>Notiz &amp; Links</strong>
          <span>${row.location_id?'vorhandene Notiz':'nur neuer Ort'}</span>
        </summary>
        <div class="editor-subpanel-body">
          <div class="field full"><label>Notiz für dieses Shooting</label><textarea name="shooting_note" placeholder="Parkplatz, Anfahrt, Besonderheiten…">${escapeHtml(row.shooting_note || '')}</textarea></div>
          ${renderPreview(row)}
          <input type="hidden" name="location_meta_name" value="${escapeHtml(row.location_name||'')}" />
          <input type="hidden" name="location_meta_country" value="" />
          <input type="hidden" name="location_meta_region" value="" />
          <input type="hidden" name="location_meta_area" value="" />
          <input type="hidden" name="location_meta_category" value="" />
        </div>
      </details>`;
    }



    function filteredRows(){


    function filteredRows(){
      const search=searchInput.value.trim().toLowerCase();
      return rows.filter(row=>{
        const matchesStatus=activeStatus==='all'||autoStatusForRow(row)===activeStatus;
        const matchesWorkflow=rowMatchesWorkflowFilter(row);
        const matchesProject=activeProject==='all'||String(row.project_name||'')===activeProject;
        const haystack=[row.project_name,row.title,row.subtitle,row.day_label,row.date_label,row.meeting_place,row.location_name,...(row.badges||[])].filter(Boolean).join(' ').toLowerCase();
        return matchesStatus&&matchesWorkflow&&matchesProject&&(!search||haystack.includes(search));
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
      const el=$('projectFilter');
      if(!el)return;
      const projects=[...new Set([...events.map(e=>String(e.name||'').trim()),...rows.map(r=>String(r.project_name||'').trim())])].sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
      const current=el.value!=='all'?el.value:'all';
      el.innerHTML=`<option value="all">Alle Events</option>`+projects.map(project=>{
        const value=project||'';
        const label=project||'Keine Projektzuordnung';
        return `<option value="${escapeHtml(value)}" ${value===current?'selected':''}>${escapeHtml(label)}</option>`;
      }).join('');
      if(current!=='all'&&!projects.includes(current))el.value='all';
    }

    const DRAFT_SESSION_KEY='dolomiten.admin.drafts.v1';
    let draftPersistTimer=null;

    function clearAdminDraftSession(){
      try{sessionStorage.removeItem(DRAFT_SESSION_KEY)}catch{}
    }

    function formToSnapshot(form){
      const id=form.dataset.id;
      const base=currentRowsById[id]||{};
      const payload=collectPayload(form);
      return normalizeRowStatus({
        ...base,
        ...payload,
        id,
        sort_order:base.sort_order,
        __draft:form.dataset.draft==='true',
      });
    }

    function schedulePersistAdminDrafts(){
      clearTimeout(draftPersistTimer);
      draftPersistTimer=setTimeout(persistAdminDrafts,400);
    }

    function persistAdminDrafts(){
      try{
        if(!shootingsEl)return;
        const entries=[];
        shootingsEl.querySelectorAll('form[data-id]').forEach(form=>{
          const id=form.dataset.id;
          if(form.dataset.draft==='true'||dirtyForms.has(id)){
            entries.push({
              id,
              row:formToSnapshot(form),
              open:!!form.closest('details')?.open,
            });
          }
        });
        if(!entries.length){
          clearAdminDraftSession();
          return;
        }
        sessionStorage.setItem(DRAFT_SESSION_KEY,JSON.stringify({
          savedAt:new Date().toISOString(),
          view:currentView,
          activeProject,
          activeStatus,
          activeWorkflowFilter,
          search:searchInput?.value||'',
          entries,
        }));
      }catch(error){console.warn('Entwürfe konnten nicht gespeichert werden',error)}
    }

    async function restoreAdminDrafts(){
      let saved=null;
      try{
        const raw=sessionStorage.getItem(DRAFT_SESSION_KEY);
        saved=raw?JSON.parse(raw):null;
      }catch{return}
      if(!saved||!Array.isArray(saved.entries)||!saved.entries.length)return;

      isRestoringAdminSession=true;
      try{
        if(saved.search!=null)searchInput.value=saved.search;
        if(saved.activeProject)activeProject=saved.activeProject;
        if(saved.activeStatus)activeStatus=saved.activeStatus;
        if(saved.activeWorkflowFilter)activeWorkflowFilter=saved.activeWorkflowFilter;
        if(saved.view&&saved.view!==currentView&&typeof setView==='function')await setView(saved.view);
        const pf=$('projectFilter');if(pf)pf.value=activeProject||'all';
        syncStatusButtons();
        if(typeof syncWorkflowFilterButtons==='function')syncWorkflowFilterButtons();

        saved.entries.forEach(entry=>{
          if(!entry?.id||!entry.row)return;
          const row=normalizeRowStatus({...entry.row,id:entry.id});
          const idx=rows.findIndex(r=>r.id===entry.id);
          const isDraft=!!row.__draft;
          if(isDraft){
            if(idx>=0)rows[idx]=row;
            else rows.push(row);
            currentRowsById[entry.id]=row;
          }else if(idx>=0){
            rows[idx]=row;
            currentRowsById[entry.id]=row;
          }
        });
        rows=sortRowsByDateAndTime(rows);
        updateProjectFilter();
        renderAll();

        requestAnimationFrame(()=>{
          let restored=0;
          saved.entries.forEach(entry=>{
            const card=shootingsEl.querySelector(`[data-id="${entry.id}"]`);
            const form=card?.querySelector('form');
            const row=currentRowsById[entry.id];
            if(!form||!row)return;
            fillFormFromRow(form,row);
            setFormDirty(form,true);
            if(entry.open)card.open=true;
            restored++;
          });
          updateUnsavedBar();
          if(restored)showToast(`${restored} Entwurf${restored===1?'':'e'} nach Neuladen wiederhergestellt`);
        });
      }finally{
        isRestoringAdminSession=false;
      }
    }

    async function loadShootings(options={}){
      const {skipConfirm=false,skipRestore=false}=options;
      if(!skipConfirm&&!isRestoringAdminSession&&hasUnsavedChanges()){
        const parts=[];
        if(dirtyForms.size)parts.push(`${dirtyForms.size} ungespeicherte Shooting${dirtyForms.size===1?'':'s'}`);
        if(orderDirty)parts.push('geänderte Reihenfolge');
        if(!confirm(`Ungespeicherte Änderungen (${parts.join(', ')}) gehen verloren.\n\nDaten wirklich vom Server neu laden?`))return false;
        clearAdminDraftSession();
      }
      clearError();orderDirty=false;dirtyForms.clear();updateOrderButton();updateUnsavedBar();setStatus('Daten werden geladen…');
      const {data,error}=await db.from('shootings').select('*');
      if(error){setStatus('Fehler beim Laden');showError('Fehler beim Laden: '+formatError(error));return false}
      rows=sortRowsByDateAndTime((data||[]).map(r=>normalizeRowStatus({...r,project_name:r.project_name||'',project_status:r.project_status||'aktiv',workflow_status:r.workflow_status||null,end_time:r.end_time||null})));
      await loadEvents();
      if(!locations.length)await loadLocations();
      currentRowsById=Object.fromEntries(rows.map(r=>[r.id,r]));
      updateProjectFilter();
      updateDataStamp();
      if(typeof renderWorkflowFilterButtons==='function')renderWorkflowFilterButtons();
      renderAll();
      if(locations.length&&typeof renderLocations==='function')renderLocations();
      setStatus(rows.length+' Einträge geladen');
      if(!skipRestore)await restoreAdminDrafts();
      return true;
    }

    async function refreshAdminData(){
      if(hasUnsavedChanges()){
        const parts=[];
        if(dirtyForms.size)parts.push(`${dirtyForms.size} ungespeicherte Shooting${dirtyForms.size===1?'':'s'}`);
        if(orderDirty)parts.push('geänderte Reihenfolge');
        if(!confirm(`Ungespeicherte Änderungen (${parts.join(', ')}) gehen verloren.\n\nDaten wirklich vom Server neu laden?`))return;
      }
      clearAdminDraftSession();
      const ok=await loadShootings({skipConfirm:true,skipRestore:true});
      if(ok!==false)showToast('Daten vom Server aktualisiert');
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
      const hasListFilter=activeStatus!=='all'||activeWorkflowFilter!=='all';
      const visible=sortRowsByDateAndTime(filteredRows());

      if(hasListFilter){
        const groups=groupRowsByProject(visible);
        shootingsEl.innerHTML=groups.length?groups.map(renderProjectGroup).join(''):`<div class="card hint">Keine passenden Shootings${activeWorkflowFilter!=='all'?' mit diesem Planungsstatus':''} gefunden.</div>`;
        bindEditors();
        if(currentView==='calendar'&&typeof renderCalendar==='function')renderCalendar();
        return;
      }

      const matchingRows=rows.filter(row=>rowMatchesProjectAndSearch(row)&&rowMatchesWorkflowFilter(row));
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
      if(currentView==='calendar'&&typeof renderCalendar==='function')renderCalendar();
    }

    function bindShootingEditorPanels(form){
      const durationInput=form.querySelector('[data-duration-minutes]');
      const startEl=form.elements.meeting_time;
      const endEl=form.elements.end_time;
      const syncDurationFromTimes=()=>{
        if(!durationInput||!startEl||!endEl)return;
        const d=durationMinutesBetween(startEl.value,endEl.value);
        if(d)durationInput.value=d;
      };
      durationInput?.addEventListener('change',()=>{
        const mins=Number(durationInput.value);
        if(!Number.isFinite(mins)||mins<=0||!startEl?.value||!endEl)return;
        endEl.value=addMinutesToTime(startEl.value,mins);
        refreshFormDirtyState(form);
        refreshLivePreview(form);
      });
      startEl?.addEventListener('change',syncDurationFromTimes);
      endEl?.addEventListener('change',syncDurationFromTimes);
      const dateInput=form.elements.date_label;
      const syncDayLabel=()=>{
        const hidden=form.querySelector('[data-day-label-hidden]');
        const hint=form.querySelector('[data-day-label-hint]');
        const label=dayLabelFromDateLabel(inputToDateLabel(dateInput?.value||''));
        if(hidden)hidden.value=label||'';
        if(hint){
          hint.innerHTML=label
            ?`Wochentag: <strong>${escapeHtml(label)}</strong> (automatisch aus Datum)`
            :'Wochentag wird automatisch aus dem Datum gesetzt.';
        }
      };
      dateInput?.addEventListener('change',syncDayLabel);
      dateInput?.addEventListener('input',syncDayLabel);
      if(typeof bindPlaceMapsBlocks==='function')bindPlaceMapsBlocks(form);
      if(typeof bindMeetingCapture==='function')bindMeetingCapture(form);
      if(typeof syncShootingMeetingLibraryState==='function')syncShootingMeetingLibraryState(form);
    }

    function renderEditor(row){
      const thumb=row.image_url?`style="background-image:url('${escapeHtml(row.image_url)}')"`:'';
      const rowStatus=displayStatusKeyForRow(row);
      const statusLabel=displayStatusLabelForRow(row);
      const statusClass=`status-${escapeHtml(rowStatus)}`;
      const projectName=String(row.project_name||'').trim();
      const timeSummary=[row.meeting_time,row.end_time?`– ${row.end_time}`:''].filter(Boolean).join(' ')||'TBA';
      const placeSummary=row.meeting_place||row.location_name||'TBA';
      const titleDisplay=String(row.title||'').trim()||'(ohne Titel)';
      return `<details class="spot-card" data-id="${escapeHtml(row.id)}" ${row.__draft?'open':''}><summary><div class="thumb" ${thumb}></div><div class="summary-main"><div class="summary-title">${escapeHtml(titleDisplay)}</div><div class="summary-sub">${escapeHtml(row.date_label||'')} · ${escapeHtml(timeSummary)} · ${escapeHtml(placeSummary)}${projectName?` · ${escapeHtml(projectName)}`:''}</div><div class="dirty-badge">${row.__draft?'Entwurf':'Nicht gespeichert'}</div></div><div class="summary-day"><span class="status-chip ${statusClass}">${escapeHtml(statusLabel)}</span></div></summary><div class="editor"><form data-id="${escapeHtml(row.id)}" ${row.__draft?'data-draft="true"':''}><div class="editor-admin-meta">${renderEventSection(row)}${renderWorkflowSection(row)}</div>${renderBasicsSection(row)}${renderLocationBlock(row)}${renderScheduleSection(row)}${renderBadges(row)}<div class="sticky-actions"><button class="btn" type="button" data-cancel="${escapeHtml(row.id)}">Abbrechen</button><button class="btn primary form-save-btn" type="submit">Speichern</button></div><div class="danger-zone"><div class="form-meta-row"><div class="save-state" data-save-state>${row.__draft?'Entwurf':'Gespeichert'}</div><div class="btnbar"><button class="btn" type="button" data-duplicate="${escapeHtml(row.id)}">Duplizieren</button><button class="btn danger" type="button" data-delete="${escapeHtml(row.id)}">Löschen</button></div></div></div></form></div></details>`;
    }

    function bindEditors(){
      shootingsEl.querySelectorAll('form').forEach(form=>{
        setFormBaseline(form);
        if(form.dataset.draft==='true')setFormDirty(form,true);
        form.addEventListener('submit',saveForm);
        form.addEventListener('input',()=>{refreshLivePreview(form);refreshFormDirtyState(form)});
        form.addEventListener('change',event=>{
          refreshLivePreview(form);
          refreshFormDirtyState(form);
          if(event.target?.name==='project_name')refreshWorkflowSectionInForm(form);
        });
      });
      bindWorkflowPickers(shootingsEl);
      shootingsEl.querySelectorAll('form[data-id]').forEach(form=>bindShootingEditorPanels(form));
      shootingsEl.querySelectorAll('.project-group').forEach(group=>group.addEventListener('toggle',event=>{if(event.target===group)setProjectGroupOpen(group.dataset.projectKey,group.open)}));
      shootingsEl.querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',cancelForm));
      shootingsEl.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',deleteRow));
      shootingsEl.querySelectorAll('[data-duplicate]').forEach(b=>b.addEventListener('click',duplicateRow));
      shootingsEl.querySelectorAll('[data-badge]').forEach(b=>b.addEventListener('click',toggleBadge));
      shootingsEl.querySelectorAll('[data-add-badge]').forEach(b=>b.addEventListener('click',addCustomBadge));
      shootingsEl.querySelectorAll('[data-toggle-archive]').forEach(b=>b.addEventListener('click',toggleArchiveStatus));
      shootingsEl.querySelectorAll('[data-edit-event]').forEach(b=>b.addEventListener('pointerdown',renameEvent));
      shootingsEl.querySelectorAll('[data-delete-event]').forEach(b=>b.addEventListener('pointerdown',deleteEmptyEvent));
      shootingsEl.querySelectorAll('[data-spot-select]').forEach(s=>s.addEventListener('change',applySpotPreset));bindLocationFinders();if(typeof bindImportLocationOffers==='function')bindImportLocationOffers();shootingsEl.querySelectorAll('[data-open-location-panel]').forEach(b=>b.addEventListener('click',openLocationPanel));shootingsEl.querySelectorAll('[data-close-location-panel]').forEach(b=>b.addEventListener('click',closeLocationPanel));shootingsEl.querySelectorAll('[data-save-as-location]').forEach(b=>b.addEventListener('click',saveShootingAsLocation));shootingsEl.querySelectorAll('[data-save-meeting-to-library]').forEach(b=>b.addEventListener('click',e=>{if(typeof saveMeetingToLibraryFromShooting==='function')saveMeetingToLibraryFromShooting(e)}));
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
    function toggleArchiveStatus(e){const btn=e.currentTarget,form=btn.closest('form'),input=form.elements.project_status,archived=input.value==='archiviert';input.value=archived?'auto':'archiviert';btn.classList.toggle('active',!archived);btn.textContent=archived?'In Archiv verschieben':'Aus Archiv holen';btn.title=btn.textContent;btn.setAttribute('aria-label',btn.title);refreshFormDirtyState(form)}
    function refreshLivePreview(form){refreshLinkPreview(form);refreshImagePreview(form);const recurringPreview=form.querySelector('[data-recurring-location-image-preview]');if(recurringPreview){const url=form.elements.location_meta_image_url?.value||'';setImagePreviewState(recurringPreview,url)}}
    function refreshLinkPreview(form){const p=form.querySelector('[data-link-preview]');if(!p)return;const meeting=form.elements.meeting_link?.value,location=form.elements.location_link?.value;p.innerHTML=`<a class="preview-button ${meeting?'':'disabled'}" ${meeting?`href="${escapeHtml(meeting)}" target="_blank" rel="noopener"`:''}>Treffpunkt ${meeting?'öffnen':'leer'}</a><a class="preview-button primary ${location?'':'disabled'}" ${location?`href="${escapeHtml(location)}" target="_blank" rel="noopener"`:''}>Location ${location?'öffnen':'leer'}</a>`}
    function classifyImageUrl(value){
      const url=String(value||'').trim();
      if(!url)return {ok:false,type:'empty',message:'Keine Bild-URL gesetzt'};

      const lower=url.toLowerCase();

      if(lower.includes('maps.app.goo.gl')||lower.includes('google.com/maps')||lower.includes('goo.gl/maps')||lower.includes('maps.google.')||lower.includes('share.google/')){
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
      const trustedImageHost=lower.includes('images.unsplash.com')||lower.includes('images.pexels.com')||lower.includes('upload.wikimedia.org')||lower.includes('commons.wikimedia.org')||lower.includes('wikipedia.org')||lower.includes('cdn.');

      if(looksLikeImage||trustedImageHost){
        return {ok:true,type:'image',message:'Bildvorschau'};
      }

      return {
        ok:true,
        type:'unknown',
        message:'Bildvorschau – falls nichts erscheint, ist es vermutlich keine direkte Bild-URL.'
      };
    }

    function parseImageFocus(value){
      const raw=String(value||'').trim();
      const match=raw.match(/([\d.]+)\s*%?\s+([\d.]+)\s*%?/);
      if(!match)return{x:50,y:50};
      return{
        x:Math.max(0,Math.min(100,Number(match[1]))),
        y:Math.max(0,Math.min(100,Number(match[2])))
      };
    }

    function formatImageFocus(x,y){
      const fx=Math.max(0,Math.min(100,Number(x)));
      const fy=Math.max(0,Math.min(100,Number(y)));
      return `${fx.toFixed(1)}% ${fy.toFixed(1)}%`;
    }

    function applyImageFocusToPreview(preview,focus){
      if(!preview)return;
      const {x,y}=parseImageFocus(focus);
      const pos=formatImageFocus(x,y);
      preview.style.setProperty('--preview-position',pos);
      preview.style.backgroundPosition=pos;
      preview.dataset.imageFocus=pos;
    }

    function setImagePreviewState(preview,url,focus){
      const result=classifyImageUrl(url);
      preview.classList.toggle('warning',!result.ok&&result.type!=='empty');
      preview.classList.toggle('is-pannable',!!(result.ok&&url));

      if(!url){
        preview.style.setProperty('--preview-image','linear-gradient(135deg,rgba(216,177,106,.18),rgba(143,181,161,.12))');
        preview.classList.remove('is-pannable');
        preview.textContent=result.message;
        applyImageFocusToPreview(preview,'50% 50%');
        return;
      }

      if(!result.ok){
        preview.style.setProperty('--preview-image','linear-gradient(135deg,rgba(216,177,106,.18),rgba(217,108,108,.12))');
        preview.classList.remove('is-pannable');
        const lines=result.message.split('\\n');
        preview.innerHTML=`<div><strong>${escapeHtml(lines[0])}</strong>${escapeHtml(lines.slice(1).join(' '))}</div>`;
        applyImageFocusToPreview(preview,'50% 50%');
        return;
      }

      preview.style.setProperty('--preview-image',`url('${url.replaceAll("'","%27")}')`);
      preview.textContent=result.message;
      applyImageFocusToPreview(preview,focus||preview.dataset.imageFocus||'50% 50%');
    }

    window.parseImageFocus=parseImageFocus;
    window.formatImageFocus=formatImageFocus;
    window.applyImageFocusToPreview=applyImageFocusToPreview;

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
    function applySpotPreset(e){const preset=spotPresets[e.currentTarget.value];if(!preset)return;const form=e.currentTarget.closest('form');if(form.elements.location_id)form.elements.location_id.value='';if(form.elements.location_name)form.elements.location_name.value=preset.location_name;if(form.elements.title&&!form.elements.title.value.trim())form.elements.title.value=preset.title;if(form.elements.image_url&&!form.elements.image_url.value.trim())form.elements.image_url.value=preset.image_url;refreshLivePreview(form);refreshFormDirtyState(form);if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form)}

    function fillFormFromRow(form,row){allFieldGroups.forEach(([key,label,type])=>{const f=form.elements[key];if(f)f.value=valueForInput(row,key,type)});if(form.elements.project_status)form.elements.project_status.value=String(row.project_status||'')==='archiviert'?'archiviert':'auto';const archiveBtn=form.querySelector('[data-toggle-archive]');if(archiveBtn)archiveBtn.classList.toggle('active',String(row.project_status||'')==='archiviert');if(form.elements.badges)form.elements.badges.value=parseBadges(row.badges).join(', ');if(form.elements.shooting_note)form.elements.shooting_note.value=row.shooting_note||'';refreshWorkflowSectionInForm(form);refreshBadgeChips(form);refreshLivePreview(form);setFormBaseline(form);refreshFormDirtyState(form)}
    function collectPayload(form){const fd=new FormData(form),p={};allFieldGroups.forEach(([key,label,type])=>{const raw=fd.get(key);p[key]=type==='date'?inputToDateLabel(raw):(type==='time'?(raw||null):(raw||null))});p.day_label=dayLabelFromDateLabel(p.date_label)||String(fd.get('day_label')||'').trim()||null;p.project_name=String(fd.get('project_name')||'').trim();const archived=String(fd.get('project_status')||'')==='archiviert';p.project_status=archived?'archiviert':autoStatusForRow(p);p.workflow_status=isShootingBoundToEvent(p)?null:workflowSlug(fd.get('workflow_status')||'angefragt');p.badges=parseBadges(fd.get('badges'));p.shooting_note=fd.get('shooting_note')||null;p.weather_label=null;p.weather_id=null;p.updated_at=new Date().toISOString();const meetPlace=String(p.meeting_place||'').trim();const meetLink=String(p.meeting_link||'').trim();if(!meetPlace&&!meetLink)p.meeting_place=String(p.location_name||'').trim()||null;return p}

    function cancelForm(e){const id=e.currentTarget.dataset.cancel,form=e.currentTarget.closest('form'),row=currentRowsById[id];if(!form||!row)return;if(form.dataset.draft==='true'){if(!confirm('Neues Shooting/Event verwerfen?'))return;rows=rows.filter(r=>r.id!==id);delete currentRowsById[id];dirtyForms.delete(id);renderAll();updateUnsavedBar();schedulePersistAdminDrafts();showToast('Entwurf verworfen');return}fillFormFromRow(form,row);setFormDirty(form,false);form.closest('details').open=false;setStatus('Änderungen verworfen: '+id);showToast('Änderungen verworfen')}
    async function saveForm(e){e.preventDefault();clearError();const form=e.currentTarget,id=form.dataset.id,card=form.closest('.spot-card'),isDraft=form.dataset.draft==='true';let payload=collectPayload(form);if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;card?.classList.add('is-saving');setStatus((isDraft?'Erstelle ':'Speichere ')+id+'…');try{payload=await maybeAutoAddLocationToLibrary(form,id,payload)}catch(error){card?.classList.remove('is-saving');if(error.message!=='INVALID_IMAGE_URL')showError('Location-Bibliothek konnte nicht aktualisiert werden: '+formatError(error));return}payload=normalizeRowStatus(payload);const savePayload=isDraft?{...payload,id,sort_order:currentRowsById[id]?.sort_order||rows.length+1}:payload;const {error}=isDraft?await db.from('shootings').insert(savePayload):await db.from('shootings').update(payload).eq('id',id);card?.classList.remove('is-saving');if(error){
        setStatus('Fehler beim Speichern');
        const msg=formatError(error);
        showError(/workflow_status/i.test(msg)?'Spalte workflow_status fehlt in Supabase. Bitte Migration docs/migrations/add_workflow_status.sql ausführen.':/end_time/i.test(msg)?'Spalte end_time fehlt in Supabase. Bitte Migration docs/migrations/add_end_time.sql ausführen.':('Fehler beim Speichern: '+msg));
        return;
      }
      const index=rows.findIndex(r=>r.id===id);if(index>=0)rows[index]=normalizeRowStatus({...rows[index],...savePayload,__draft:false});currentRowsById[id]=rows[index]||normalizeRowStatus({...currentRowsById[id],...savePayload,__draft:false});setFormBaseline(form);setFormDirty(form,false);updateProjectFilter();updateDataStamp();renderAll();if(typeof renderLocations==='function'&&locations.length)renderLocations();const newCard=shootingsEl.querySelector(`[data-id="${id}"]`);if(newCard)newCard.open=true;setStatus('Gespeichert: '+id);showToast(isDraft?'Erstellt':'Gespeichert')}
    async function duplicateRow(e){const id=e.currentTarget.dataset.duplicate,source=currentRowsById[id];if(!source)return;const copy=normalizeRowStatus({...source,id:`${source.id}-kopie-${Date.now()}`,title:`${source.title||'Shooting'} · Kopie`,sort_order:rows.length?Math.max(...rows.map(r=>Number(r.sort_order||0)))+1:1,project_name:source.project_name||'',project_status:String(source.project_status||'')==='archiviert'?'archiviert':'aktiv',updated_at:new Date().toISOString()});delete copy.weather_label;delete copy.weather_id;delete copy.__draft;const {error}=await db.from('shootings').insert(copy);if(error){showError('Duplizieren fehlgeschlagen: '+formatError(error));return}showToast('Dupliziert');clearAdminDraftSession();await loadShootings({skipConfirm:true,skipRestore:true})}
    async function ensureEventForProject(name,status='aktiv'){
      const project=String(name||'').trim();
      if(!project||events.some(event=>String(event.name||'').trim()===project))return;
      const payload={id:'event-'+Date.now(),name:project,status,updated_at:new Date().toISOString()};
      const {error}=await db.from('events').insert(payload);
      if(error)throw error;
      events=[...events,payload];currentEventsById[payload.id]=payload;
    }
    async function deleteRow(e){const id=e.currentTarget.dataset.delete,row=currentRowsById[id];if(!row)return;if(row.__draft){if(!confirm('Diesen Entwurf verwerfen?'))return;rows=rows.filter(r=>r.id!==id);delete currentRowsById[id];dirtyForms.delete(id);renderAll();updateUnsavedBar();schedulePersistAdminDrafts();showToast('Entwurf verworfen');return}if(!confirm(`Shooting wirklich löschen?\n\n${row.title||id}`))return;const projectName=String(row.project_name||'').trim(),isLastInProject=projectName&&rows.filter(r=>String(r.project_name||'').trim()===projectName).length===1;try{if(isLastInProject)await ensureEventForProject(projectName,autoStatusForRow(row))}catch(error){showError('Event konnte nicht erhalten bleiben: '+formatError(error));return}const {error}=await db.from('shootings').delete().eq('id',id);      if(error){showError('Löschen fehlgeschlagen: '+formatError(error));return}showToast('Gelöscht');clearAdminDraftSession();await loadShootings({skipConfirm:true,skipRestore:true})}
    const EVENT_DIALOG_SESSION_KEY='dolomiten.admin.event-dialog.v1';
    function setEventNameDialogOpen(open){
      eventNameDialog.classList.toggle('hidden',!open);
      eventNameDialog.setAttribute('aria-hidden',open?'false':'true');
      document.body.classList.toggle('event-dialog-open',open);
      try{
        if(open)sessionStorage.setItem(EVENT_DIALOG_SESSION_KEY,'open');
        else sessionStorage.removeItem(EVENT_DIALOG_SESSION_KEY);
      }catch{}
      if(open)setTimeout(()=>eventNameInput.focus(),30);
    }
    function restoreEventNameDialog(){
      let wasOpen=false;
      try{wasOpen=sessionStorage.getItem(EVENT_DIALOG_SESSION_KEY)==='open'}catch{}
      if(!wasOpen)return;
      try{sessionStorage.removeItem(EVENT_DIALOG_SESSION_KEY)}catch{}
      pendingEventNameResolve=null;
      showToast('„Neues Event“ wurde unterbrochen — bitte über + erneut starten.');
    }
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
      currentEventsById[normalizedEvent.id]=normalizedEvent;activeProject=name;activeStatus='all';syncStatusButtons();updateProjectFilter();const pf=$('projectFilter');if(pf)pf.value=name;renderAll();setStatus('Event erstellt');showToast('Event erstellt');
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
        currentRowsById=Object.fromEntries(rows.map(row=>[row.id,row]));activeProject=(activeProject===oldName||isUnassigned)?newName:activeProject;updateProjectFilter();const pf2=$('projectFilter');if(pf2)pf2.value=activeProject;renderAll();setStatus(isUnassigned?'Event erstellt':'Event umbenannt');showToast(isUnassigned?'Event erstellt und Shootings zugeordnet':'Event umbenannt');
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
      orderDirty=false;updateOrderButton();updateUnsavedBar();renderAll();clearAdminDraftSession();showToast('Änderungen verworfen');
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

    function buildShootingDraftRow(overrides={}){
      const sortOrder=rows.length?Math.max(...rows.map(r=>Number(r.sort_order||0)))+1:1;
      const id=overrides.id??'shooting-'+Date.now();
      return normalizeRowStatus({
        id,
        sort_order:overrides.sort_order??sortOrder,
        day_label:overrides.day_label??dayLabelFromDateLabel(overrides.date_label??dateLabelFromDate(new Date())),
        project_name:overrides.project_name??'',
        project_status:overrides.project_status??'aktiv',
        date_label:overrides.date_label??dateLabelFromDate(new Date()),
        title:overrides.title??'',
        subtitle:overrides.subtitle??'',
        meeting_time:overrides.meeting_time??'09:00',
        meeting_place:overrides.meeting_place??'',
        shooting_time:overrides.shooting_time??'10:00',
        end_time:overrides.end_time??null,
        location_name:overrides.location_name??'',
        meeting_link:overrides.meeting_link??'',
        location_link:overrides.location_link??'',
        image_url:overrides.image_url??'',
        shooting_note:overrides.shooting_note??null,
        workflow_status:overrides.workflow_status??null,
        badges:overrides.badges??[],
        weather_label:null,
        weather_id:null,
        updated_at:new Date().toISOString(),
        __draft:true,
        __icsImportLocation:!!overrides.__icsImportLocation,
      });
    }

    function appendShootingDraftRow(overrides={}){
      const row=buildShootingDraftRow(overrides);
      rows=sortRowsByDateAndTime([...rows.filter(r=>r.id!==row.id),row]);
      currentRowsById[row.id]=row;
      dirtyForms.add(row.id);
      return row.id;
    }

    function projectGroupKeyForRow(row){
      const projectName=String(row?.project_name||'').trim();
      if(!projectName)return 'project:__unassigned__';
      const event=events.find(e=>String(e.name||'').trim()===projectName);
      return event?.id?`event:${event.id}`:`project:${projectName}`;
    }

    function revealDraftsInList(ids){
      if(!ids?.length)return;
      const row=currentRowsById[ids[0]];
      if(!row)return;
      setProjectGroupOpen(projectGroupKeyForRow(row),true);
      const status=autoStatusForRow(row);
      if(status==='abgeschlossen')setTimelineSectionOpen('past',true);
      if(status==='archiviert')setTimelineSectionOpen('archived',true);
    }

    async function createNewRow(overrides={},options={}){
      const {batch=false}=options;
      clearError();
      if(!batch&&addBtn?.disabled)return null;

      if(!batch){
        addBtn.disabled=true;
        addBtn.classList.add('is-busy');
        setStatus('Neuer Entwurf…');
      }

      try{
        const id=appendShootingDraftRow(overrides);
        if(!batch){
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
          schedulePersistAdminDrafts();
        }
        return id;
      }catch(error){
        console.error(error);
        setStatus('Fehler beim Erstellen');
        showError('Fehler beim Erstellen: '+(error.message||error));
        return null;
      }finally{
        if(!batch){
          addBtn.disabled=false;
          addBtn.classList.remove('is-busy');
        }
      }
    }

    window.appendShootingDraftRow=appendShootingDraftRow;
    window.revealDraftsInList=revealDraftsInList;
