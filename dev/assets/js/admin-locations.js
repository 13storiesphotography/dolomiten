    function parseCsv(value){if(Array.isArray(value))return value;return String(value||'').split(',').map(x=>x.trim()).filter(Boolean)}
    function csv(value){return Array.isArray(value)?value.join(', '):(value||'')}
    function locationMeta(l){return [l.country,l.region,l.area].filter(Boolean).join(' · ')}
    async function loadLocations(){const {data,error}=await db.from('locations').select('*').order('country',{ascending:true}).order('region',{ascending:true}).order('name',{ascending:true});if(error){showError('Locations konnten nicht geladen werden: '+formatError(error));return}locations=data||[];currentLocationsById=Object.fromEntries(locations.map(l=>[l.id,l]));renderLocationFilters();renderLocations()}
    function renderLocationFilters(){const fill=(select,values,label)=>{const current=select.value;select.innerHTML=`<option value="all">${label}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current};fill(countryFilter,[...new Set(locations.map(l=>l.country).filter(Boolean))].sort(),'Alle Länder');fill(regionFilter,[...new Set(locations.map(l=>l.region).filter(Boolean))].sort(),'Alle Regionen');fill(categoryFilter,[...new Set(locations.map(l=>l.category).filter(Boolean))].sort(),'Alle Kategorien')}
    function filteredLocations(){const search=locationSearchInput.value.trim().toLowerCase();return locations.filter(l=>{if(l.__draft)return true;const okCountry=countryFilter.value==='all'||l.country===countryFilter.value,okRegion=regionFilter.value==='all'||l.region===regionFilter.value,okCategory=categoryFilter.value==='all'||l.category===categoryFilter.value;const haystack=[l.name,l.country,l.region,l.area,l.category,l.address,l.meeting_place,l.description,...(l.tags||[]),...(l.seasons||[])].filter(Boolean).join(' ').toLowerCase();const okFavorite=!locationFavoritesOnly||l.is_favorite;return okCountry&&okRegion&&okCategory&&okFavorite&&(!search||haystack.includes(search))})}
    function renderLocations(){const visible=filteredLocations();locationsList.innerHTML=visible.length?visible.map(renderLocationEditor).join(''):`<div class="card hint location-empty">Keine Location gefunden. Lege über „Neue Location“ deine erste Location an.</div>`;bindLocationEditors()}
    function renderLocationEditor(l){const image=l.image_url?`style="background-image:url('${escapeHtml(l.image_url)}')"`:'';const tags=[...(l.tags||[]),...(l.seasons||[])].filter(Boolean);return `<details class="spot-card location-card" data-location-id="${escapeHtml(l.id)}" ${l.__draft?'open':''}><summary class="location-summary"><div class="location-thumb" ${image}></div><div><div class="location-title">${escapeHtml(l.name||'Neue Location')}${l.__draft?' <span class="dirty-badge" style="display:inline-flex">Entwurf</span>':''}${l.category?`<span class="location-title-separator">·</span><span class="location-title-category">${escapeHtml(l.category)}</span>`:''}</div><div class="location-meta">${escapeHtml(locationMeta(l)||'Noch nicht kategorisiert')}</div>${tags.length?`<div class="tag-row">${tags.slice(0,6).map(t=>`<span class="tiny-chip">${escapeHtml(t)}</span>`).join('')}</div>`:''}</div><div class="location-admin-actions"><button class="location-admin-star ${l.is_favorite?'active':''}" type="button" data-admin-toggle-favorite="${escapeHtml(l.id)}" title="Favorit">★</button></div></summary><div class="location-editor"><form data-location-form="${escapeHtml(l.id)}" ${l.__draft?'data-location-draft="true"':''}><div class="section-title">Basis</div><div class="grid two"><div class="field"><label>Name</label><input name="name" type="text" value="${escapeHtml(l.name||'')}" required></div><div class="field"><label>Kategorie</label><input name="category" type="text" list="categorySuggestions" value="${escapeHtml(l.category||'')}" placeholder="Berge, See, Stadt…"></div><div class="field"><label>Land</label><input name="country" type="text" list="countrySuggestions" value="${escapeHtml(l.country||'')}" placeholder="Deutschland, Italien…"></div><div class="field"><label>Region</label><input name="region" type="text" value="${escapeHtml(l.region||'')}" placeholder="Bayern, Südtirol…"></div><div class="field"><label>Gebiet</label><input name="area" type="text" value="${escapeHtml(l.area||'')}" placeholder="Dolomiten, Allgäu…"></div><div class="field"><label>Aktiv</label><select name="active"><option value="true" ${l.active!==false?'selected':''}>Aktiv</option><option value="false" ${l.active===false?'selected':''}>Archiviert</option></select></div></div><div class="section-title">Ort & Links</div><div class="grid two"><div class="field full"><label>Adresse</label><input name="address" type="text" value="${escapeHtml(l.address||'')}"></div><div class="field"><label>Google Maps Link</label><input name="maps_link" type="url" inputmode="url" value="${escapeHtml(l.maps_link||'')}"><div class="maps-tools"><button class="btn" type="button" data-detect-location-from-maps>Infos erkennen</button><span class="maps-status" data-maps-status></span></div></div><div class="field"><label>Treffpunkt</label><input name="meeting_place" type="text" value="${escapeHtml(l.meeting_place||'')}"></div><div class="field full"><label>Bild URL</label><input name="image_url" type="url" inputmode="url" value="${escapeHtml(l.image_url||'')}"></div></div><div class="image-preview" data-location-image-preview style="--preview-image:${l.image_url?`url('${escapeHtml(l.image_url)}')`:''};">${l.image_url?'Bildvorschau':'Keine Bild-URL gesetzt'}</div><div class="section-title">Beschreibung & Tags</div><div class="grid two"><div class="field full"><label>Beschreibung</label><textarea name="description">${escapeHtml(l.description||'')}</textarea></div><div class="field"><label>Tags, kommagetrennt</label><textarea name="tags">${escapeHtml(csv(l.tags))}</textarea></div><div class="field"><label>Jahreszeiten, kommagetrennt</label><textarea name="seasons">${escapeHtml(csv(l.seasons))}</textarea></div></div><div class="sticky-actions"><button class="btn" type="button" data-location-cancel="${escapeHtml(l.id)}">Abbrechen</button><button class="btn primary" type="submit">Location speichern</button></div><div class="danger-zone"><div class="btnbar"><button class="btn danger" type="button" data-location-delete="${escapeHtml(l.id)}">Location löschen</button></div></div></form></div></details>`}
    function collectLocationPayload(form){const d=new FormData(form);return{name:d.get('name')||'Neue Location',country:d.get('country')||null,region:d.get('region')||null,area:d.get('area')||null,category:d.get('category')||null,address:d.get('address')||null,maps_link:d.get('maps_link')||null,meeting_place:d.get('meeting_place')||null,image_url:d.get('image_url')||null,description:d.get('description')||null,tags:parseCsv(d.get('tags')),seasons:parseCsv(d.get('seasons')),active:d.get('active')!=='false',updated_at:new Date().toISOString()}}
    function bindLocationEditors(){locationsList.querySelectorAll('form[data-location-form]').forEach(form=>{form.addEventListener('submit',saveLocationForm);form.addEventListener('input',()=>refreshLocationImagePreview(form))});locationsList.querySelectorAll('[data-detect-location-from-maps]').forEach(b=>b.addEventListener('click',detectLocationFromMaps));locationsList.querySelectorAll('[data-location-delete]').forEach(b=>b.addEventListener('click',deleteLocation));locationsList.querySelectorAll('[data-location-cancel]').forEach(b=>b.addEventListener('click',cancelLocationEdit));locationsList.querySelectorAll('[data-admin-toggle-favorite]').forEach(b=>b.addEventListener('click',toggleLocationFavoriteFromAdmin))}
    function refreshLocationImagePreview(form){const p=form.querySelector('[data-location-image-preview]');if(!p)return;const url=form.elements.image_url?.value||'';setImagePreviewState(p,url)}
    async function saveLocationForm(e){e.preventDefault();clearError();const form=e.currentTarget,id=form.dataset.locationForm,payload=collectLocationPayload(form),isDraft=form.dataset.locationDraft==='true';if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;setStatus(isDraft?'Erstelle Location…':'Speichere Location…');const result=isDraft?await db.from('locations').insert({...payload,id}).select('*').single():await db.from('locations').update(payload).eq('id',id);if(result.error){showError('Location konnte nicht gespeichert werden: '+formatError(result.error));setStatus('Fehler beim Speichern');return}showToast(isDraft?'Location erstellt':'Location gespeichert');await loadLocations();setStatus('Location gespeichert')}
    async function createNewLocation(){clearError();locationSearchInput.value='';countryFilter.value='all';regionFilter.value='all';categoryFilter.value='all';locationFavoritesOnly=false;favoriteLocationsBtn.classList.remove('primary');favoriteLocationsBtn.textContent='☆ Favoriten';const id='location-'+Date.now();const payload={id,name:'Neue Location',country:'Deutschland',region:'',area:'',category:'',address:'',maps_link:'',meeting_place:'',image_url:'',description:'',tags:[],seasons:[],active:true,updated_at:new Date().toISOString(),__draft:true};locations=[payload,...locations.filter(location=>location.id!==id)];currentLocationsById[id]=payload;renderLocations();showToast('Neue Location vorbereitet');const card=locationsList.querySelector(`[data-location-id="${id}"]`);if(card){card.open=true;card.scrollIntoView({behavior:'smooth',block:'center'});const input=card.querySelector('input[name="name"]');if(input)setTimeout(()=>input.focus(),350)}}
    function cancelLocationEdit(e){const form=e.currentTarget.closest('form'),id=form?.dataset.locationForm;if(form?.dataset.locationDraft==='true'){locations=locations.filter(l=>l.id!==id);delete currentLocationsById[id]}renderLocations()}
    async function deleteLocation(e){const id=e.currentTarget.dataset.locationDelete,l=currentLocationsById[id];if(!l)return;if(l.__draft){if(!confirm('Diesen Location-Entwurf verwerfen?'))return;locations=locations.filter(x=>x.id!==id);delete currentLocationsById[id];renderLocations();showToast('Entwurf verworfen');return}if(!confirm(`Location wirklich löschen?\n\n${l.name}`))return;const {error}=await db.from('locations').delete().eq('id',id);if(error){showError('Location konnte nicht gelöscht werden: '+formatError(error));return}showToast('Location gelöscht');await loadLocations()}
    function applyLocationToForm(e){const location=currentLocationsById[e.currentTarget.value];if(!location)return;const form=e.currentTarget.closest('form');if(form.elements.location_name)form.elements.location_name.value=location.name||'';if(form.elements.meeting_place&&!form.elements.meeting_place.value.trim())form.elements.meeting_place.value=location.meeting_place||location.address||'';if(form.elements.meeting_link&&!form.elements.meeting_link.value.trim())form.elements.meeting_link.value=location.maps_link||'';if(form.elements.location_link&&!form.elements.location_link.value.trim())form.elements.location_link.value=location.maps_link||'';if(form.elements.image_url&&!form.elements.image_url.value.trim())form.elements.image_url.value=location.image_url||'';refreshLivePreview(form);showToast('Location übernommen')}

    function extractCoordsFromMapsLink(url){
      const value=String(url||'').trim();
      if(!value)return null;

      const patterns=[
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
        /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/
      ];

      for(const pattern of patterns){
        const match=value.match(pattern);
        if(match){
          if(pattern.source.includes('!2d')){
            return {lat:Number(match[2]),lon:Number(match[1])};
          }
          return {lat:Number(match[1]),lon:Number(match[2])};
        }
      }

      const decoded=decodeURIComponent(value);
      const coordMatch=decoded.match(/(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
      if(coordMatch)return {lat:Number(coordMatch[1]),lon:Number(coordMatch[2])};

      return null;
    }

    function extractStreetWithNumber(address,displayName=''){
      const street =
        address.road ||
        address.pedestrian ||
        address.footway ||
        address.path ||
        address.cycleway ||
        address.residential ||
        address.neighbourhood ||
        '';

      const houseNumber =
        address.house_number ||
        address.housenumber ||
        address['addr:housenumber'] ||
        '';

      if(street && houseNumber){
        return `${street} ${houseNumber}`;
      }

      if(street && displayName){
        const parts=String(displayName).split(',').map(part=>part.trim()).filter(Boolean);
        const streetPart=parts.find(part=>part.toLowerCase().includes(String(street).toLowerCase()));
        if(streetPart){
          const numberMatch=streetPart.match(new RegExp(`${street.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+([0-9]+[a-zA-Z]?(?:\\/[0-9]+[a-zA-Z]?)?)`,'i'));
          if(numberMatch){
            return `${street} ${numberMatch[1]}`;
          }
          const trailingNumber=streetPart.match(/(.+?)\s+([0-9]+[a-zA-Z]?(?:\/[0-9]+[a-zA-Z]?)?)$/);
          if(trailingNumber){
            return streetPart;
          }
        }
      }

      if(displayName){
        const firstPart=String(displayName).split(',').map(part=>part.trim()).filter(Boolean)[0]||'';
        if(firstPart && /\d/.test(firstPart)){
          return firstPart;
        }
      }

      return street;
    }

    function mapAddressToMeta(address,displayName=''){
      const country=address.country||'';
      const region=address.state||address.region||address.province||address.county||'';
      const area=address.city||address.town||address.village||address.municipality||address.hamlet||address.suburb||address.county||'';
      const streetWithNumber=extractStreetWithNumber(address,displayName);
      const postcodeCity=[address.postcode,area].filter(Boolean).join(' ');
      const fullAddress=[streetWithNumber,postcodeCity,region,country].filter(Boolean).join(', ');
      return {country,region,area,address:fullAddress};
    }

    async function reverseGeocodeCoords(coords){
      const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}&zoom=16&addressdetails=1`;
      const response=await fetch(url,{headers:{'Accept':'application/json'}});
      if(!response.ok)throw new Error('Geocoding fehlgeschlagen: '+response.status);
      return await response.json();
    }

    function setMapsStatus(form,message){
      const status=form.querySelector('[data-maps-status]');
      if(status)status.textContent=message||'';
    }

    async function resolveMapsLinkIfNeeded(link,form){
      const value=String(link||'').trim();
      if(!value)return value;

      const isShort=value.includes('maps.app.goo.gl')||value.includes('goo.gl/maps');
      if(!isShort)return value;

      setMapsStatus(form,'Kurzlink wird aufgelöst…');

      const response=await fetch(`${MAPS_RESOLVER_URL}?url=${encodeURIComponent(value)}`);
      const result=await response.json();

      if(!response.ok||result.error){
        throw new Error(result.error||'Kurzlink konnte nicht aufgelöst werden');
      }

      return result.resolvedUrl||value;
    }

    async function detectMetaFromMapsLink(link,form){
      const resolvedLink=await resolveMapsLinkIfNeeded(link,form);
      const coords=extractCoordsFromMapsLink(resolvedLink);
      if(!coords){
        setMapsStatus(form,'Keine Koordinaten gefunden. Der Link wurde gelesen, enthält aber keine eindeutig erkennbaren Koordinaten.');
        return null;
      }

      setMapsStatus(form,'Erkenne Ort…');
      const result=await reverseGeocodeCoords(coords);
      const meta=mapAddressToMeta(result.address||{},result.display_name||'');
      meta.display_name=result.display_name||'';
      meta.lat=coords.lat;
      meta.lon=coords.lon;
      setMapsStatus(form,'Infos erkannt');
      window.setTimeout(()=>setMapsStatus(form,''),2200);
      return meta;
    }

    async function detectLocationFromMaps(event){
      const form=event.currentTarget.closest('form');
      if(!form)return;
      const link=form.elements.maps_link?.value;
      try{
        const meta=await detectMetaFromMapsLink(link,form);
        if(!meta)return;
        if(form.elements.country)form.elements.country.value=meta.country||form.elements.country.value;
        if(form.elements.region)form.elements.region.value=meta.region||form.elements.region.value;
        if(form.elements.area)form.elements.area.value=meta.area||form.elements.area.value;
        if(form.elements.address)form.elements.address.value=meta.address||meta.display_name||form.elements.address.value;
        showToast('Maps-Infos übernommen');
      }catch(error){
        console.error(error);
        setMapsStatus(form,'Konnte Infos nicht erkennen');
        showError('Maps-Infos konnten nicht erkannt werden: '+(error.message||error));
      }
    }

    async function detectShootingLocationFromMaps(event){
      const form=event.currentTarget.closest('form');
      if(!form)return;
      const link=form.elements.location_meta_maps_link?.value||form.elements.location_link?.value||form.elements.meeting_link?.value;
      try{
        const meta=await detectMetaFromMapsLink(link,form);
        if(!meta)return;
        if(form.elements.location_meta_country)form.elements.location_meta_country.value=meta.country||form.elements.location_meta_country.value;
        if(form.elements.location_meta_region)form.elements.location_meta_region.value=meta.region||form.elements.location_meta_region.value;
        if(form.elements.location_meta_area)form.elements.location_meta_area.value=meta.area||form.elements.location_meta_area.value;
        if(form.elements.location_meta_address)form.elements.location_meta_address.value=meta.address||meta.display_name||form.elements.location_meta_address.value;
        if(form.elements.location_meta_meeting_place&&!form.elements.location_meta_meeting_place.value.trim())form.elements.location_meta_meeting_place.value=meta.address||meta.display_name||'';
        if(form.elements.meeting_place&&!form.elements.meeting_place.value.trim())form.elements.meeting_place.value=meta.address||meta.display_name||'';
        showToast('Maps-Infos übernommen');
        refreshFormDirtyState(form);
      }catch(error){
        console.error(error);
        setMapsStatus(form,'Konnte Infos nicht erkennen');
        showError('Maps-Infos konnten nicht erkannt werden: '+(error.message||error));
      }
    }

    function toggleRecurringLocationFields(event){
      const form=event.currentTarget.closest('form');
      const fields=form?.querySelector('[data-recurring-location-fields]');
      if(fields)fields.classList.toggle('open',event.currentTarget.checked);
    }

    async function maybeCreateRecurringLocationFromForm(form,id,payload){
      const checkbox=form.elements.save_as_recurring_location;
      if(!checkbox||!checkbox.checked)return payload;

      const locationPayload=locationPayloadFromShootingForm(form);
      if(!validateImageBeforeSave(locationPayload.image_url,'Bild URL'))throw new Error('INVALID_IMAGE_URL');

      const {data,error}=await db.from('locations').insert(locationPayload).select('*').single();
      if(error)throw error;

      await loadLocations();
      payload.location_id=data.id;
      if(form.elements.location_id)form.elements.location_id.value=data.id;
      showToast('Shooting + wiederkehrende Location gespeichert');
      return payload;
    }

    function openLocationPanel(e){
      const id=e.currentTarget.dataset.openLocationPanel;
      const panel=shootingsEl.querySelector(`[data-location-panel="${id}"]`);
      if(panel)panel.classList.add('open');
    }

    function closeLocationPanel(e){
      const id=e.currentTarget.dataset.closeLocationPanel;
      const panel=shootingsEl.querySelector(`[data-location-panel="${id}"]`);
      if(panel)panel.classList.remove('open');
    }

    function locationPayloadFromShootingForm(form){
      const fd=new FormData(form);
      const mapsLink=fd.get('location_meta_maps_link')||fd.get('location_link')||fd.get('meeting_link')||null;
      return {
        name:fd.get('location_meta_name')||fd.get('location_name')||fd.get('title')||'Neue Location',
        country:fd.get('location_meta_country')||null,
        region:fd.get('location_meta_region')||null,
        area:fd.get('location_meta_area')||null,
        category:fd.get('location_meta_category')||null,
        address:fd.get('location_meta_address')||fd.get('meeting_place')||null,
        maps_link:mapsLink,
        meeting_place:fd.get('location_meta_meeting_place')||fd.get('meeting_place')||null,
        image_url:fd.get('location_meta_image_url')||fd.get('image_url')||null,
        description:fd.get('location_meta_description')||fd.get('subtitle')||null,
        tags:parseCsv(fd.get('location_meta_tags')),
        seasons:parseCsv(fd.get('location_meta_seasons')),
        active:fd.get('location_meta_active')!=='false',
        updated_at:new Date().toISOString()
      };
    }

    async function saveShootingAsLocation(e){
      clearError();
      const button=e.currentTarget;
      const id=button.dataset.saveAsLocation;
      const form=button.closest('form');
      if(!form)return;

      const existingLocationId=form.elements.location_id?.value;
      const payload=locationPayloadFromShootingForm(form);if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;

      button.disabled=true;
      const oldText=button.textContent;
      button.textContent=existingLocationId?'Aktualisiere…':'Speichere…';

      try{
        let locationId=existingLocationId;

        if(existingLocationId){
          const {error}=await db.from('locations').update(payload).eq('id',existingLocationId);
          if(error){showError('Location konnte nicht aktualisiert werden: '+formatError(error));return}
          showToast('Location aktualisiert');
        }else{
          const {data,error}=await db.from('locations').insert(payload).select('*').single();
          if(error){showError('Location konnte nicht gespeichert werden: '+formatError(error));return}
          locationId=data.id;
          if(form.elements.location_id)form.elements.location_id.value=locationId;updateManualOverrideState(form);

          const {error:updateError}=await db.from('shootings').update({location_id:locationId,updated_at:new Date().toISOString()}).eq('id',id);
          if(updateError){showError('Location erstellt, aber Shooting konnte nicht verknüpft werden: '+formatError(updateError));return}

          showToast('Location gespeichert & verknüpft');
        }

        await loadLocations();

        const row=currentRowsById[id]||{};
        currentRowsById[id]={...row,location_id:locationId};
        const index=rows.findIndex(r=>r.id===id);
        if(index>=0)rows[index]={...rows[index],location_id:locationId};

        setFormBaseline(form);
        refreshFormDirtyState(form);

        const panel=form.querySelector(`[data-location-panel="${id}"]`);
        if(panel)panel.classList.remove('open');

        await loadShootings();
        const card=shootingsEl.querySelector(`[data-id="${id}"]`);
        if(card){
          card.open=true;
          card.scrollIntoView({behavior:'smooth',block:'center'});
        }
      }catch(error){
        console.error(error);
        showError('Location konnte nicht gespeichert werden: '+(error.message||error));
      }finally{
        button.disabled=false;
        button.textContent=oldText;
      }
    }


    function updateManualOverrideState(form){
      const details=form?.querySelector('.one-time-location-panel');
      if(!details)return;
      const hasLocation=!!form.elements.location_id?.value;
      const hint=details.querySelector('.one-time-location-title span');
      if(hint)hint.textContent=hasLocation?'Nur öffnen, wenn dieses Shooting von der gewählten Bibliotheks-Location abweicht.':'Optional öffnen, wenn du keine Bibliotheks-Location auswählen möchtest.';
    }

    function bindLocationPickers(){
      shootingsEl.querySelectorAll('[data-location-picker]').forEach(picker=>{
        const form=picker.closest('form');
        const grid=picker.querySelector('[data-location-picker-grid]');
        const search=picker.querySelector('[data-location-picker-search]');
        const country=picker.querySelector('[data-location-picker-country]');
        const category=picker.querySelector('[data-location-picker-category]');
        const hidden=form?.elements.location_id;

        const refresh=()=>{
          grid.innerHTML=renderLocationPickerOptions(search.value,country.value,category.value,hidden?.value||'');
          bindLocationPickerOptions(picker);
        };

        search.addEventListener('input',refresh);
        country.addEventListener('change',refresh);
        category.addEventListener('change',refresh);
        bindLocationPickerOptions(picker);
      });
    }

    
    async function toggleLocationFavorite(id){
      const location=currentLocationsById[id];
      if(!location)return;
      const next=!location.is_favorite;
      const {error}=await db.from('locations').update({is_favorite:next,updated_at:new Date().toISOString()}).eq('id',id);
      if(error){showError('Favorit konnte nicht gespeichert werden: '+formatError(error));return}
      location.is_favorite=next;
      currentLocationsById[id]=location;
      locations=locations.map(item=>item.id===id?{...item,is_favorite:next}:item);
    }

    async function toggleLocationFavoriteFromAdmin(event){
      event.preventDefault();
      event.stopPropagation();
      const id=event.currentTarget.dataset.adminToggleFavorite;
      await toggleLocationFavorite(id);
      renderLocations();
      showToast(currentLocationsById[id]?.is_favorite?'Favorit gesetzt':'Favorit entfernt');
    }

    async function markLocationUsed(id){
      const location=currentLocationsById[id];
      if(!location)return;
      const usage=Number(location.usage_count||0)+1;
      const now=new Date().toISOString();
      location.usage_count=usage;
      location.last_used_at=now;
      currentLocationsById[id]=location;
      locations=locations.map(item=>item.id===id?{...item,usage_count:usage,last_used_at:now}:item);
      await db.from('locations').update({usage_count:usage,last_used_at:now,updated_at:now}).eq('id',id);
    }

function bindLocationPickerOptions(picker){
      picker.querySelectorAll('[data-toggle-location-favorite]').forEach(star=>{
        star.addEventListener('click',async event=>{
          event.preventDefault();
          event.stopPropagation();
          const id=star.dataset.toggleLocationFavorite;
          await toggleLocationFavorite(id);
          const form=picker.closest('form');
          const hidden=form?.elements.location_id;
          const grid=picker.querySelector('[data-location-picker-grid]');
          const search=picker.querySelector('[data-location-picker-search]');
          const country=picker.querySelector('[data-location-picker-country]');
          const category=picker.querySelector('[data-location-picker-category]');
          grid.innerHTML=renderLocationPickerOptions(search.value,country.value,category.value,hidden?.value||'');
          bindLocationPickerOptions(picker);
        });
      });

      picker.querySelectorAll('[data-pick-location]').forEach(button=>{
        button.addEventListener('click',()=>{
          const form=button.closest('form');
          const id=button.dataset.pickLocation||'';
          if(form?.elements.location_id)form.elements.location_id.value=id;updateManualOverrideState(form);
          picker.querySelectorAll('.location-option').forEach(option=>option.classList.toggle('active',option===button));
          const label=picker.querySelector('[data-location-current]');
          const location=currentLocationsById[id];
          if(label)label.textContent=location?'Ausgewählt: '+location.name:'Keine Bibliotheks-Location ausgewählt';
          if(location){
            applyPickedLocationToForm(form,location);
            markLocationUsed(location.id);
          }else{
            refreshLivePreview(form);
            refreshFormDirtyState(form);
          }
        });
      });
    }

    function applyPickedLocationToForm(form,location){
      if(!form||!location)return;
      if(form.elements.location_name)form.elements.location_name.value=location.name||'';
      if(form.elements.meeting_place&&!form.elements.meeting_place.value.trim())form.elements.meeting_place.value=location.meeting_place||location.address||'';
      if(form.elements.meeting_link&&!form.elements.meeting_link.value.trim())form.elements.meeting_link.value=location.maps_link||'';
      if(form.elements.location_link&&!form.elements.location_link.value.trim())form.elements.location_link.value=location.maps_link||'';
      if(form.elements.image_url&&!form.elements.image_url.value.trim())form.elements.image_url.value=location.image_url||'';
      refreshLivePreview(form);
      refreshFormDirtyState(form);
      showToast('Location übernommen');
    }

