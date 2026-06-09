    function newLocationId(){return crypto.randomUUID()}
    function isValidLocationId(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}
    function bumpOsmRequestId(holder,key){
      const id=(Number(holder[key])||0)+1;
      holder[key]=id;
      return id;
    }
    function parseCsv(value){if(Array.isArray(value))return value;return String(value||'').split(',').map(x=>x.trim()).filter(Boolean)}
    function csv(value){return Array.isArray(value)?value.join(', '):(value||'')}
    function locationMeta(l){return [l.country,l.region,l.area].filter(Boolean).join(' · ')}

    function locationTagsForRecord(loc){
      const tags=Array.isArray(loc?.tags)?[...loc.tags]:parseLocationTags(loc?.tags);
      const seasons=Array.isArray(loc?.seasons)?[...loc.seasons]:parseLocationTags(loc?.seasons);
      return [...new Set([...tags,...seasons].map(t=>String(t).trim()).filter(Boolean))];
    }

    function normalizeLocationRecord(loc){
      const tags=locationTagsForRecord(loc);
      const prevTags=Array.isArray(loc?.tags)?loc.tags:parseLocationTags(loc?.tags);
      const hadSeasons=(Array.isArray(loc?.seasons)?loc.seasons:parseLocationTags(loc?.seasons)).length>0;
      const tagsChanged=JSON.stringify([...prevTags].sort())!==JSON.stringify([...tags].sort());
      const needsWrite=!loc?.__draft&&loc?.id&&(hadSeasons||tagsChanged);
      return{...loc,tags,seasons:[],_tagMigrationPending:needsWrite};
    }

    async function migrateLocationTagsIfNeeded(){
      const pending=locations.filter(l=>l._tagMigrationPending);
      if(!pending.length)return;
      let ok=0;
      for(const loc of pending){
        const {error}=await db.from('locations').update({tags:loc.tags,seasons:[],updated_at:new Date().toISOString()}).eq('id',loc.id);
        if(error){console.error(error);continue}
        delete loc._tagMigrationPending;
        ok++;
      }
      if(ok)showToast(`Location-Tags für ${ok} Ort${ok===1?'':'e'} übernommen`);
    }

    async function loadLocations(){
      const {data,error}=await db.from('locations').select('*').order('country',{ascending:true}).order('region',{ascending:true}).order('name',{ascending:true});
      if(error){showError('Locations konnten nicht geladen werden: '+formatError(error));return}
      locations=(data||[]).map(normalizeLocationRecord);
      await migrateLocationTagsIfNeeded();
      currentLocationsById=Object.fromEntries(locations.map(l=>[l.id,l]));
      renderLocationFilters();
      renderLocations();
    }
    function renderLocationFilters(){const fill=(select,values,label)=>{const current=select.value;select.innerHTML=`<option value="all">${label}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current};fill(countryFilter,[...new Set(locations.map(l=>l.country).filter(Boolean))].sort(),'Alle Länder');fill(regionFilter,[...new Set(locations.map(l=>l.region).filter(Boolean))].sort(),'Alle Regionen');fill(categoryFilter,[...new Set(locations.map(l=>l.category).filter(Boolean))].sort(),'Alle Kategorien')}
    function filteredLocations(){const search=locationSearchInput.value.trim().toLowerCase();return locations.filter(l=>{if(l.__draft)return true;const okCountry=countryFilter.value==='all'||l.country===countryFilter.value,okRegion=regionFilter.value==='all'||l.region===regionFilter.value,okCategory=categoryFilter.value==='all'||l.category===categoryFilter.value;const haystack=[l.name,l.country,l.region,l.area,l.category,l.address,l.meeting_place,l.description,...locationTagsForRecord(l)].filter(Boolean).join(' ').toLowerCase();const okFavorite=!locationFavoritesOnly||l.is_favorite;return okCountry&&okRegion&&okCategory&&okFavorite&&(!search||haystack.includes(search))})}
    function renderLocations(){const visible=filteredLocations();locationsList.innerHTML=visible.length?visible.map(renderLocationEditor).join(''):`<div class="card hint location-empty">Keine Location gefunden. Über <strong>+</strong> eine neue Location anlegen.</div>`;bindLocationEditors()}
    const locationPinMaps=new WeakMap();

    function mapsLinkFromCoords(lat,lon){
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
    }

    function parseCoordsFromForm(form){
      const lat=Number(form.elements.capture_lat?.value);
      const lon=Number(form.elements.capture_lon?.value);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
      return {lat,lon};
    }

    function setFormCaptureCoords(form,lat,lon){
      if(form.elements.capture_lat)form.elements.capture_lat.value=String(lat);
      if(form.elements.capture_lon)form.elements.capture_lon.value=String(lon);
      if(form.elements.maps_link)form.elements.maps_link.value=mapsLinkFromCoords(lat,lon);
      updateLocationPinMap(form,lat,lon);
      const panel=form.querySelector('[data-location-pin-panel]');
      if(panel)panel.open=true;
    }

    const LOCATION_CAPTURE_HINT='Kartensuche, Maps-Link oder <strong>📍</strong> — Adresse wird erkannt. Optional einen eigenen <strong>Anzeigenamen</strong> (z. B. „Grüner Hügel am Starnberger See“).';
    const MEETING_CAPTURE_HINT='Gleicher Ablauf wie oben — gilt nur für den <strong>Treffpunkt</strong>, die Location bleibt unverändert.';

    function isWeakLocationLabel(label){
      const s=String(label||'').trim();
      if(!s||s.length<2)return true;
      if(/^\d+[a-zA-Z]?$/.test(s))return true;
      if(looksLikeMapsLink(s))return true;
      return false;
    }

    function suggestLocationLabel(meta={}){
      const address=String(meta?.address||meta?.display_name||'').trim();
      const parts=address.split(',').map(p=>p.trim()).filter(Boolean);
      const street=parts[0]||'';
      const area=String(meta?.area||'').trim();
      const region=String(meta?.region||'').trim();
      if(street&&!isWeakLocationLabel(street))return street;
      if(area&&region&&!isWeakLocationLabel(area))return `${area}, ${region}`;
      if(area&&!isWeakLocationLabel(area))return area;
      const joined=parts.slice(0,2).join(', ').trim();
      if(joined&&!isWeakLocationLabel(joined))return joined;
      return address||'';
    }

    function applySuggestedLocationName(form,meta,{forceWeak=false}={}){
      if(!form||!meta)return;
      const suggested=suggestLocationLabel(meta);
      if(!suggested||isWeakLocationLabel(suggested))return;
      const field=isLibraryLocationForm(form)?form.elements.name:form.elements.location_name;
      if(!field)return;
      const current=String(field.value||'').trim();
      if(!current||forceWeak||isWeakLocationLabel(current))field.value=suggested;
    }

    function isLibraryLocationForm(form){
      return !!form?.dataset?.locationForm;
    }

    function formHasGeoAnchor(form){
      if(!form)return false;
      const coords=parseCoordsFromForm(form)||extractCoordsFromMapsLink(form.elements.maps_link?.value||form.elements.location_link?.value||'');
      return !!coords;
    }

    function readFormRegionArea(form){
      if(isLibraryLocationForm(form)){
        return{
          region:String(form.elements.region?.value||'').trim(),
          area:String(form.elements.area?.value||'').trim()
        };
      }
      return{
        region:String(form.elements.location_meta_region?.value||'').trim(),
        area:String(form.elements.location_meta_area?.value||'').trim()
      };
    }

    function locationGeoManualRequired(form){
      if(!form||formHasGeoAnchor(form))return false;
      const {region,area}=readFormRegionArea(form);
      if(region&&area)return false;
      const label=String(form.elements.name?.value||form.elements.location_name?.value||'').trim();
      const address=String(form.elements.address?.value||form.elements.meeting_place?.value||'').trim();
      return label.length>=2||address.length>=5;
    }

    function syncLocationGeoFieldsVisibility(form){
      const wrap=form?.querySelector('[data-location-geo-manual]');
      if(!wrap)return;
      const show=locationGeoManualRequired(form);
      wrap.classList.toggle('hidden',!show);
      wrap.querySelectorAll('input').forEach(input=>{input.required=show});
    }

    function mapsCoordKey(link){
      const coords=extractCoordsFromMapsLink(link);
      if(!coords)return '';
      return `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    }

    function fillLocationFormFromMeta(form,meta,coords,opts={}){
      const address=meta?.address||meta?.display_name||'';
      const set=(name,val)=>{const el=form.elements[name];if(el!=null&&val!=null&&val!=='')el.value=val};
      if(isLibraryLocationForm(form)){
        if(form.elements.address)form.elements.address.value=address||form.elements.address.value;
        if(opts?.clearMapsName&&form.elements.name&&looksLikeMapsLink(form.elements.name.value))form.elements.name.value='';
        applySuggestedLocationName(form,meta,{forceWeak:!!opts?.forceWeakName});
        set('country',meta?.country);
        set('region',meta?.region);
        set('area',meta?.area);
        if(coords)setFormCaptureCoords(form,coords.lat,coords.lon);
        const metaEl=form.querySelector('[data-location-pin-meta]');
        if(metaEl&&coords)metaEl.textContent=`${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)} — Pin ziehen, wenn der Spot nicht exakt am GPS liegt`;
      }else{
        if(form.elements.meeting_place)form.elements.meeting_place.value=address||form.elements.meeting_place.value;
        if(opts?.clearMapsName&&form.elements.location_name&&looksLikeMapsLink(form.elements.location_name.value))form.elements.location_name.value='';
        applySuggestedLocationName(form,meta,{forceWeak:!!opts?.forceWeakName});
        set('location_meta_country',meta?.country);
        set('location_meta_region',meta?.region);
        set('location_meta_area',meta?.area);
        set('location_meta_address',address);
        if(coords&&form.elements.location_link)form.elements.location_link.value=mapsLinkFromCoords(coords.lat,coords.lon);
        if(typeof syncLocationSetupPanel==='function')syncLocationSetupPanel(form);
      }
      syncLocationGeoFieldsVisibility(form);
      if(opts?.skipImageSuggest!==true)scheduleLocationImageSuggestion(form,meta,null);
    }

    function notePlaceAnchorChanged(form){
      if(!form)return;
      form.dataset.placeAnchorRev=String((Number(form.dataset.placeAnchorRev)||0)+1);
    }

    function canAutoReplaceLocationImage(form){
      if(!form||form.dataset.imageManual==='true'||form.dataset.imageFromLibrary==='true')return false;
      const current=String(locationImageField(form)?.value||'').trim();
      if(!current)return true;
      if(form.dataset.imageSuggested==='true')return true;
      const placeRev=Number(form.dataset.placeAnchorRev)||0;
      const suggestRev=Number(form.dataset.imageSuggestRev)||0;
      return placeRev>suggestRev;
    }

    async function applyGeoToForm(form,lat,lon,opts={}){
      notePlaceAnchorChanged(form);
      if(opts.reverse===false){
        fillLocationFormFromMeta(form,{address:opts.displayAddress||''},{lat,lon},{skipImageSuggest:true});
        scheduleLocationImageSuggestion(form,{address:opts.displayAddress||''},null);
        return;
      }
      try{
        const result=await reverseGeocodeCoords({lat,lon});
        const meta=mapAddressToMeta(result.address||{},result.display_name||'');
        meta.display_name=result.display_name||'';
        fillLocationFormFromMeta(form,meta,{lat,lon},{skipImageSuggest:true,forceWeakName:!!opts?.forceWeakName,clearMapsName:!!opts?.clearMapsName});
        scheduleLocationImageSuggestion(form,meta,result.extratags||null);
      }catch(error){
        console.error(error);
        const fallback={address:opts.displayAddress||'',display_name:opts.displayAddress||''};
        fillLocationFormFromMeta(form,fallback,{lat,lon},{skipImageSuggest:true});
        scheduleLocationImageSuggestion(form,fallback,null);
      }
    }

    async function enrichLocationMetaFromForm(form){
      if(!form)return;
      const link=form.elements.maps_link?.value||form.elements.location_link?.value||'';
      let coords=parseCoordsFromForm(form)||extractCoordsFromMapsLink(link);
      const {region,area}=readFormRegionArea(form);
      if(coords&&(!region||!area)){
        await applyGeoToForm(form,coords.lat,coords.lon,{displayAddress:form.elements.address?.value||form.elements.meeting_place?.value});
        syncLocationGeoFieldsVisibility(form);
        return;
      }
      if(!coords&&looksLikeMapsLink(link)){
        try{
          const meta=await detectMetaFromMapsLink(link,form,isLibraryLocationForm(form)?'library':'location');
          coords=coordsFromMapsInput(link,meta);
          if(meta?.resolved_link){
            const linkEl=isLibraryLocationForm(form)?form.elements.maps_link:form.elements.location_link;
            if(linkEl)linkEl.value=meta.resolved_link;
          }
          if(meta&&coords)fillLocationFormFromMeta(form,meta,coords);
        }catch(error){console.error(error)}
      }
      syncLocationGeoFieldsVisibility(form);
    }

    async function ensureLocationGeoReady(form){
      await enrichLocationMetaFromForm(form);
      if(!locationGeoManualRequired(form))return true;
      const {region,area}=readFormRegionArea(form);
      if(region&&area)return true;
      const address=String(form.elements.address?.value||form.elements.meeting_place?.value||'').trim();
      if(address.length>=8)return true;
      showError('Bitte Standort per 📍, Kartentreffer oder Maps-Link setzen — oder Land, Region und Gebiet (oder eine Adresse) im gelben Hinweisblock.');
      const wrap=form.querySelector('[data-location-geo-manual]');
      if(wrap){wrap.classList.remove('hidden');wrap.scrollIntoView({behavior:'smooth',block:'nearest'})}
      return false;
    }

    function findDuplicateLibraryLocation(payload){
      const key=mapsCoordKey(payload?.maps_link);
      if(key){
        const byCoords=locations.find(loc=>mapsCoordKey(loc.maps_link)===key);
        if(byCoords)return byCoords;
      }
      return findSimilarLibraryLocation(payload);
    }

    function locationUsesSeparateMeeting(loc){
      const meet=String(loc?.meeting_place||'').trim();
      const meetMaps=String(loc?.meeting_maps_link||'').trim();
      const addr=String(loc?.address||'').trim();
      const name=String(loc?.name||'').trim();
      if(meetMaps)return true;
      if(!meet)return false;
      if(addr&&meet.toLowerCase()===addr.toLowerCase())return false;
      if(name&&meet.toLowerCase()===name.toLowerCase())return false;
      return true;
    }

    function meetingLinkField(form){
      return form?.elements?.meeting_maps_link||form?.elements?.meeting_link||null;
    }

    function meetingOsmPanel(form){
      return form?.querySelector('[data-meeting-lib-osm],[data-shooting-meeting-osm]');
    }

    function setFormMeetingCaptureCoords(form,lat,lon){
      if(form?.elements?.meeting_capture_lat)form.elements.meeting_capture_lat.value=String(lat);
      if(form?.elements?.meeting_capture_lon)form.elements.meeting_capture_lon.value=String(lon);
      const linkEl=meetingLinkField(form);
      if(linkEl)linkEl.value=mapsLinkFromCoords(lat,lon);
    }

    function parseMeetingCoordsFromForm(form){
      const lat=Number(form?.elements?.meeting_capture_lat?.value);
      const lon=Number(form?.elements?.meeting_capture_lon?.value);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
      return{lat,lon};
    }

    function applyMeetingMetaToForm(form,meta,coords){
      const address=meta?.address||meta?.display_name||'';
      const label=suggestLocationLabel(meta)||address.split(',')[0]||address;
      if(form?.elements?.meeting_place)form.elements.meeting_place.value=label;
      if(coords)setFormMeetingCaptureCoords(form,coords.lat,coords.lon);
      syncShootingMeetingLibraryState(form);
    }

    async function applyGeoToMeetingForm(form,lat,lon){
      try{
        const result=await reverseGeocodeCoords({lat,lon});
        const meta=mapAddressToMeta(result.address||{},result.display_name||'');
        meta.display_name=result.display_name||'';
        applyMeetingMetaToForm(form,meta,{lat,lon});
        setMapsStatus(form,'Treff erkannt','meeting');
        window.setTimeout(()=>setMapsStatus(form,'','meeting'),2200);
      }catch(error){
        console.error(error);
        setMapsStatus(form,'Treff konnte nicht erkannt werden','meeting');
        throw error;
      }
    }

    async function applyOsmPickToMeetingForm(form,hit){
      if(!form||!hit)return;
      const displayAddr=String(hit.display_name||'').trim();
      const panel=meetingOsmPanel(form);
      if(hit.lat&&hit.lon){
        await applyGeoToMeetingForm(form,Number(hit.lat),Number(hit.lon));
      }else{
        const meta=mapAddressToMeta(hit.address||{},displayAddr);
        applyMeetingMetaToForm(form,meta,null);
      }
      panel?.classList.add('hidden');
      showToast('Treffpunkt übernommen');
      syncShootingMeetingLibraryState(form);
    }

    async function refreshMeetingLibraryOsm(form,term){
      const panel=meetingOsmPanel(form);
      if(!panel)return;
      const q=String(term||'').trim();
      if(q.length<3){panel.classList.add('hidden');panel.innerHTML='';form._meetingOsmResults=[];form._meetingOsmRequest=0;return}
      const requestId=bumpOsmRequestId(form,'_meetingOsmRequest');
      panel.classList.remove('hidden');
      panel.innerHTML='<div class="location-osm-loading">Suche Treffpunkt…</div>';
      try{
        const results=await searchAddressNominatim(q);
        if(requestId!==form._meetingOsmRequest)return;
        form._meetingOsmResults=results;
        panel.innerHTML=`<div class="location-picker-section-title">Kartentreffer · Treff</div>${renderOsmFinderResults(results)}`;
        panel.querySelectorAll('[data-pick-osm]').forEach(btn=>{
          btn.addEventListener('click',async()=>{
            const hit=form._meetingOsmResults?.[Number(btn.dataset.pickOsm)];
            if(!hit)return;
            await applyOsmPickToMeetingForm(form,hit);
          });
        });
      }catch(error){
        if(requestId!==form._meetingOsmRequest)return;
        console.error(error);
        panel.innerHTML='<div class="address-search-empty">Kartensuche fehlgeschlagen</div>';
      }
    }

    async function applyMapsLinkToMeetingForm(form,link){
      const raw=normalizeMapsPaste(link);
      if(!raw||!form)return;
      const linkEl=meetingLinkField(form);
      if(linkEl)linkEl.value=raw;
      if(form.elements.meeting_place&&looksLikeMapsLink(form.elements.meeting_place.value))form.elements.meeting_place.value='';
      setMapsStatus(form,'Link wird gelesen…','meeting');
      try{
        const meta=await detectMetaFromMapsLink(raw,form,'meeting');
        const coords=coordsFromMapsInput(raw,meta);
        if(meta?.resolved_link){
          const linkEl=meetingLinkField(form);
          if(linkEl)linkEl.value=meta.resolved_link;
        }
        if(meta&&coords)applyMeetingMetaToForm(form,meta,coords);
        else if(coords)await applyGeoToMeetingForm(form,coords.lat,coords.lon);
        showToast('Treff aus Maps-Link übernommen');
        syncShootingMeetingLibraryState(form);
      }catch(error){
        console.error(error);
        showError('Maps-Link für Treff konnte nicht gelesen werden: '+(error.message||error));
      }finally{
        setMapsStatus(form,'','meeting');
      }
    }

    function captureGpsToMeetingForm(form){
      if(!navigator.geolocation){
        showError('Standort ist in diesem Browser nicht verfügbar (HTTPS nötig).');
        return;
      }
      const btn=form?.querySelector('[data-capture-gps-meeting]');
      if(btn){btn.classList.add('is-busy');btn.disabled=true}
      setStatus('Treffpunkt wird ermittelt…');
      navigator.geolocation.getCurrentPosition(async pos=>{
        try{
          await applyGeoToMeetingForm(form,pos.coords.latitude,pos.coords.longitude);
          showToast('Treffpunkt per GPS übernommen');
          setStatus('Treffpunkt übernommen');
          syncShootingMeetingLibraryState(form);
        }catch(error){
          console.error(error);
          showError('Treffpunkt konnte nicht übernommen werden.');
        }finally{
          if(btn){btn.classList.remove('is-busy');btn.disabled=false}
        }
      },err=>{
        if(btn){btn.classList.remove('is-busy');btn.disabled=false}
        setStatus('GPS fehlgeschlagen');
        showError('GPS fehlgeschlagen: '+(err.message||'Zugriff verweigert'));
      },{enableHighAccuracy:true,timeout:20000,maximumAge:60000});
    }

    function bindMeetingCapture(form){
      if(!form||form.dataset.meetingCaptureBound==='true')return;
      form.dataset.meetingCaptureBound='true';
      form.querySelector('[data-capture-gps-meeting]')?.addEventListener('click',()=>captureGpsToMeetingForm(form));
      form.querySelector('[data-detect-meeting-from-maps]')?.addEventListener('click',detectMeetingFromMaps);
      const meetInput=form.querySelector('[data-meeting-lib-name]');
      let osmTimer=null;
      const onMeetingInput=()=>{
        const term=meetInput.value.trim();
        if(looksLikeMapsLink(term)){
          clearTimeout(osmTimer);
          osmTimer=setTimeout(()=>applyMapsLinkToMeetingForm(form,term),320);
          return;
        }
        clearTimeout(osmTimer);
        osmTimer=setTimeout(()=>refreshMeetingLibraryOsm(form,term),420);
        syncShootingMeetingLibraryState(form);
      };
      meetInput?.addEventListener('input',onMeetingInput);
      meetingLinkField(form)?.addEventListener('input',()=>syncShootingMeetingLibraryState(form));
      meetingLinkField(form)?.addEventListener('change',()=>syncShootingMeetingLibraryState(form));
    }

    const bindLocationMeetingCapture=bindMeetingCapture;

    function syncShootingMeetingLibraryState(form){
      if(!form?.elements?.location_id)return;
      const btn=form.querySelector('[data-save-meeting-to-library]');
      if(!btn)return;
      const id=form.elements.location_id.value;
      if(!id){btn.classList.add('hidden');return}
      const lib=currentLocationsById[id];
      const place=String(form.elements.meeting_place?.value||'').trim();
      const link=String(meetingLinkField(form)?.value||'').trim();
      const basePlace=String(form.dataset.libraryMeetingPlace??lib?.meeting_place??lib?.address??'').trim();
      const baseLink=String(form.dataset.libraryMeetingLink??lib?.meeting_maps_link??lib?.maps_link??'').trim();
      const differs=place!==basePlace||link!==baseLink;
      btn.classList.toggle('hidden',!differs);
      const panel=form.querySelector('[data-shooting-meeting-panel]');
      if(panel&&(differs||place||link||id))panel.open=true;
    }

    async function saveMeetingToLibraryFromShooting(event){
      const form=event.currentTarget.closest('form');
      const id=form?.elements?.location_id?.value;
      if(!id){showError('Keine Location aus der Bibliothek verknüpft.');return}
      const payload={
        meeting_place:String(form.elements.meeting_place?.value||'').trim()||null,
        meeting_maps_link:String(meetingLinkField(form)?.value||'').trim()||null,
        updated_at:new Date().toISOString()
      };
      setStatus('Treff wird in Location gespeichert…');
      let {error}=await db.from('locations').update(payload).eq('id',id);
      if(error&&/meeting_maps_link/i.test(formatError(error))){
        ({error}=await db.from('locations').update({meeting_place:payload.meeting_place,updated_at:payload.updated_at}).eq('id',id));
      }
      if(error){showError('Treff konnte nicht gespeichert werden: '+formatError(error));return}
      const loc=currentLocationsById[id];
      if(loc){
        loc.meeting_place=payload.meeting_place;
        if(payload.meeting_maps_link!=null)loc.meeting_maps_link=payload.meeting_maps_link;
      }
      form.dataset.libraryMeetingPlace=payload.meeting_place||'';
      form.dataset.libraryMeetingLink=payload.meeting_maps_link||'';
      syncShootingMeetingLibraryState(form);
      setStatus('');
      showToast('Treff in Location gespeichert');
    }

    function knownLocationTags(){
      const base=typeof badgePresets!=='undefined'?badgePresets:[];
      const extra=typeof locationOnlyTagPresets!=='undefined'?locationOnlyTagPresets:['Parkplatz'];
      const fromLib=[...new Set(locations.flatMap(l=>locationTagsForRecord(l)))].filter(Boolean);
      return [...new Set([...base,...extra,...fromLib])].sort((a,b)=>a.localeCompare(b,'de'));
    }

    function parseLocationTags(value){return parseCsv(value)}

    function renderLocationTagPicker(loc){
      const active=locationTagsForRecord(loc);
      return `<div class="location-tag-tools">${renderLocationTagPickerMarkup(active)}</div>`;
    }

    async function applyCoordsToLibraryForm(form,lat,lon,opts={}){
      await applyGeoToForm(form,lat,lon,{...opts,forceWeakName:true});
    }

    function ensureLocationPinMap(form){
      if(typeof L==='undefined')return null;
      const el=form.querySelector('[data-location-pin-map]');
      if(!el)return null;
      if(locationPinMaps.has(form))return locationPinMaps.get(form);
      const map=L.map(el,{scrollWheelZoom:true}).setView([46.74,11.76],13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
      const marker=L.marker([46.74,11.76],{draggable:true}).addTo(map);
      let pinGeoTimer=null;
      marker.on('dragend',()=>{
        const ll=marker.getLatLng();
        setFormCaptureCoords(form,ll.lat,ll.lng);
        const metaEl=form.querySelector('[data-location-pin-meta]');
        if(metaEl)metaEl.textContent=`${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)} — Pin = sichtbarer Spot`;
        clearTimeout(pinGeoTimer);
        pinGeoTimer=setTimeout(()=>applyGeoToForm(form,ll.lat,ll.lng),650);
      });
      const api={map,marker};
      locationPinMaps.set(form,api);
      setTimeout(()=>map.invalidateSize(),280);
      return api;
    }

    function updateLocationPinMap(form,lat,lon){
      const api=ensureLocationPinMap(form);
      if(!api)return;
      api.marker.setLatLng([lat,lon]);
      api.map.setView([lat,lon],15);
    }

    function captureGpsToLocationForm(form){
      if(!navigator.geolocation){
        showError('Standort ist in diesem Browser nicht verfügbar (HTTPS nötig).');
        return;
      }
      const btn=form.querySelector('[data-capture-gps]');
      if(btn){btn.classList.add('is-busy');btn.disabled=true}
      setStatus('Standort wird ermittelt…');
      navigator.geolocation.getCurrentPosition(async pos=>{
        try{
          await applyCoordsToLibraryForm(form,pos.coords.latitude,pos.coords.longitude);
          showToast('Standort übernommen — Pin auf der Karte anpassen');
          setStatus('Standort übernommen');
        }catch(error){
          console.error(error);
          showError('Standort konnte nicht übernommen werden.');
        }finally{
          if(btn){btn.classList.remove('is-busy');btn.disabled=false}
        }
      },err=>{
        if(btn){btn.classList.remove('is-busy');btn.disabled=false}
        setStatus('Standort fehlgeschlagen');
        showError('GPS fehlgeschlagen: '+(err.message||'Zugriff verweigert'));
      },{enableHighAccuracy:true,timeout:20000,maximumAge:60000});
    }

    async function applyMapsLinkToLibraryForm(form,link){
      const raw=String(link||'').trim();
      if(!raw||!form)return;
      const normalized=normalizeMapsPaste(raw);
      if(form.elements.maps_link)form.elements.maps_link.value=normalized;
      setMapsStatus(form,'Link wird gelesen…','library');
      try{
        const meta=await detectMetaFromMapsLink(normalized,form,'library');
        const coords=coordsFromMapsInput(normalized,meta);
        if(meta?.resolved_link&&form.elements.maps_link)form.elements.maps_link.value=meta.resolved_link;
        notePlaceAnchorChanged(form);
        if(form.elements.name&&looksLikeMapsLink(form.elements.name.value))form.elements.name.value='';
        if(meta&&coords)fillLocationFormFromMeta(form,meta,coords,{skipImageSuggest:true,forceWeakName:true,clearMapsName:true});
        else if(coords)await applyCoordsToLibraryForm(form,coords.lat,coords.lon,{clearMapsName:true});
        else{scheduleLocationImageSuggestion(form,meta||readFormRegionArea(form),null);showToast('Aus Maps-Link übernommen');return}
        scheduleLocationImageSuggestion(form,meta||readFormRegionArea(form),null);
        showToast('Aus Maps-Link übernommen');
      }catch(error){
        console.error(error);
        showError('Maps-Link konnte nicht gelesen werden: '+(error.message||error));
      }finally{
        setMapsStatus(form,'','library');
      }
    }

    async function refreshLibraryOsm(form,term){
      const panel=form.querySelector('[data-location-lib-osm]');
      if(!panel)return;
      const q=String(term||'').trim();
      if(q.length<3){panel.classList.add('hidden');panel.innerHTML='';form._libOsmResults=[];form._libOsmRequest=0;return}
      const requestId=bumpOsmRequestId(form,'_libOsmRequest');
      panel.classList.remove('hidden');
      panel.innerHTML='<div class="location-osm-loading">Suche auf der Karte…</div>';
      try{
        const results=await searchAddressNominatim(q);
        if(requestId!==form._libOsmRequest)return;
        form._libOsmResults=results;
        panel.innerHTML=`<div class="location-picker-section-title">Kartentreffer</div>${renderOsmFinderResults(results)}`;
        panel.querySelectorAll('[data-pick-osm]').forEach(btn=>{
          btn.addEventListener('click',async()=>{
            const hit=form._libOsmResults?.[Number(btn.dataset.pickOsm)];
            if(!hit)return;
            await applyOsmPickToForm(form,hit);
          });
        });
      }catch(error){
        if(requestId!==form._libOsmRequest)return;
        console.error(error);
        panel.innerHTML='<div class="address-search-empty">Kartensuche fehlgeschlagen</div>';
      }
    }

    function bindLocationLibraryCapture(form){
      if(form.dataset.libCaptureBound==='true')return;
      form.dataset.libCaptureBound='true';
      bindLocationImageField(form);
      form.querySelector('[data-capture-gps]')?.addEventListener('click',()=>captureGpsToLocationForm(form));
      const nameInput=form.querySelector('[data-location-lib-name]');
      let osmTimer=null;
      let nameImageTimer=null;
      nameInput?.addEventListener('input',()=>{
        const term=nameInput.value.trim();
        if(looksLikeMapsLink(term)){
          clearTimeout(osmTimer);
          osmTimer=setTimeout(()=>applyMapsLinkToLibraryForm(form,term),320);
          return;
        }
        clearTimeout(osmTimer);
        osmTimer=setTimeout(()=>refreshLibraryOsm(form,term),420);
        clearTimeout(nameImageTimer);
        nameImageTimer=setTimeout(()=>{
          if(canAutoReplaceLocationImage(form))scheduleLocationImageSuggestion(form,readFormRegionArea(form),null);
        },900);
      });
      const pinPanel=form.querySelector('[data-location-pin-panel]');
      pinPanel?.addEventListener('toggle',()=>{
        if(!pinPanel.open)return;
        const coords=parseCoordsFromForm(form)||extractCoordsFromMapsLink(form.elements.maps_link?.value||'');
        ensureLocationPinMap(form);
        if(coords)updateLocationPinMap(form,coords.lat,coords.lon);
      });
      const coords=parseCoordsFromForm(form)||extractCoordsFromMapsLink(form.elements.maps_link?.value||'');
      if(coords)updateLocationPinMap(form,coords.lat,coords.lon);
    }

    function renderLocationEditorForm(l){
      const coords=extractCoordsFromMapsLink(l.maps_link||'')||null;
      const lat=coords?.lat??'';
      const lon=coords?.lon??'';
      const pinOpen=!!coords;
      const pinMeta=coords?`${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)} — Pin ziehen, wenn der Spot nicht exakt am GPS liegt`:'Noch kein Standort — 📍 oder Kartentreffer';
      const displayName=l.name&&l.name!=='Neue Location'?l.name:'';
      const separateMeet=locationUsesSeparateMeeting(l);
      const meetCoords=extractCoordsFromMapsLink(l.meeting_maps_link||'')||null;
      const meetLat=meetCoords?.lat??'';
      const meetLon=meetCoords?.lon??'';
      const hasNotes=!!String(l.description||'').trim()||locationTagsForRecord(l).length>0;
      const imageVal=escapeHtml(l.image_url||'');
      return `<form data-location-form="${escapeHtml(l.id)}" ${l.__draft?'data-location-draft="true"':''} class="location-editor-form">
        <div class="section-title">Ort erfassen</div>
        <p class="hint editor-block-hint">${LOCATION_CAPTURE_HINT}</p>
        <div class="field full">
          <label>Anzeigename</label>
          <p class="hint-inline location-name-hint">Optional — in Listen statt der Adresse. Leer lassen = erkannte Straße/Adresse.</p>
          <div class="location-capture-row">
            <input class="location-capture-name" name="name" type="text" value="${escapeHtml(displayName)}" placeholder="z. B. Grüner Hügel am Starnberger See — oder Kartensuche / Maps-Link" data-location-lib-name />
            <button type="button" class="btn location-gps-btn" data-capture-gps title="Aktuellen Standort übernehmen" aria-label="Aktuellen Standort">📍</button>
          </div>
          <input type="hidden" name="capture_lat" value="${lat}" data-capture-lat />
          <input type="hidden" name="capture_lon" value="${lon}" data-capture-lon />
          <div class="location-lib-osm address-search-panel hidden" data-location-lib-osm aria-live="polite"></div>
        </div>
        <div class="location-essentials grid two">
          <div class="field"><label>Kategorie</label><input name="category" type="text" list="categorySuggestions" value="${escapeHtml(l.category||'')}" placeholder="z. B. Berge, See" /></div>
          <div class="field"><label>Status</label><select name="active"><option value="true" ${l.active!==false?'selected':''}>Aktiv</option><option value="false" ${l.active===false?'selected':''}>Archiviert</option></select></div>
        </div>
        <div class="location-image-block">
          <div class="location-image-block-head"><span class="location-essentials-label">Bild</span><span class="hint-inline">Vorschlag nach Ort — URL austauschbar</span></div>
          <div class="field full"><label>Bild URL</label><input name="image_url" type="url" inputmode="url" value="${imageVal}" placeholder="Direkte Bild-URL" /></div>
          <div class="location-image-stack">
              <input type="hidden" name="image_focus" value="${escapeHtml(l.image_focus||'50% 50%')}" data-image-focus-input />
              <div class="image-preview image-preview-pannable" data-location-image-preview data-image-focus="${escapeHtml(l.image_focus||'50% 50%')}" style="--preview-image:${l.image_url?`url('${escapeHtml(l.image_url)}')`:''};--preview-position:${escapeHtml(l.image_focus||'50% 50%')};">${l.image_url?'Ziehen = Ausschnitt · Doppelklick = zentrieren':'Keine Bild-URL gesetzt'}</div>
              <div class="location-image-tools">
                <button type="button" class="btn" data-reset-image-focus>Ausschnitt zentrieren</button>
                <button type="button" class="btn" data-clear-suggested-image>Bild entfernen</button>
              </div>
            </div>
        </div>
        <details class="editor-subpanel location-pin-panel" data-location-pin-panel ${pinOpen?'open':''}>
          <summary class="editor-subpanel-summary"><strong>Spot auf Karte anpassen</strong><span>Pin verschieben</span></summary>
          <div class="editor-subpanel-body">
            <p class="hint-inline">Spot nur in der Nähe sichtbar? Pin auf die Position ziehen.</p>
            <div class="location-pin-map" data-location-pin-map></div>
            <div class="location-pin-meta" data-location-pin-meta">${escapeHtml(pinMeta)}</div>
          </div>
        </details>
        <details class="editor-subpanel" data-location-meeting-panel ${separateMeet?'open':''}>
          <summary class="editor-subpanel-summary">
            <strong>Abweichender Treffpunkt</strong>
            <span>leer = Treff ist die Adresse</span>
          </summary>
          <div class="editor-subpanel-body location-subpanel-fields">
            <p class="hint editor-block-hint">${MEETING_CAPTURE_HINT}</p>
            <div class="field full">
              <label>Treffpunkt</label>
              <div class="location-capture-row">
                <input class="location-capture-name" name="meeting_place" type="text" value="${escapeHtml(l.meeting_place||'')}" placeholder="Treff suchen, Name oder Google-Maps-Link" data-meeting-lib-name />
                <button type="button" class="btn location-gps-btn" data-capture-gps-meeting title="Aktuellen Standort als Treff" aria-label="GPS Treffpunkt">📍</button>
              </div>
              <input type="hidden" name="meeting_capture_lat" value="${meetLat}" data-meeting-capture-lat />
              <input type="hidden" name="meeting_capture_lon" value="${meetLon}" data-meeting-capture-lon />
              <div class="location-lib-osm address-search-panel hidden" data-meeting-lib-osm aria-live="polite"></div>
            </div>
            <div class="field full"><label>Google Maps Link · Treff</label><input name="meeting_maps_link" type="url" inputmode="url" value="${escapeHtml(l.meeting_maps_link||'')}" placeholder="Eigener Maps-Link nur für den Treff" /></div>
            <div class="maps-tools"><button class="btn" type="button" data-detect-meeting-from-maps>Aus Maps-Link erkennen</button><span class="maps-status" data-maps-status="meeting"></span></div>
            <p class="hint-inline">Leer lassen = Treff ist die Location-Adresse oben.</p>
          </div>
        </details>
        <details class="editor-subpanel">
          <summary class="editor-subpanel-summary"><strong>Adresse &amp; Maps-Link</strong><span>optional · Land automatisch</span></summary>
          <div class="editor-subpanel-body location-subpanel-fields">
            <div class="field full"><label>Adresse</label><input name="address" type="text" value="${escapeHtml(l.address||'')}" /></div>
            <div class="field full"><label>Google Maps Link</label><input name="maps_link" type="url" inputmode="url" value="${escapeHtml(l.maps_link||'')}" /></div>
            <div class="maps-tools"><button class="btn" type="button" data-detect-location-from-maps>Aus Maps-Link erkennen</button><span class="maps-status" data-maps-status="library"></span></div>
          </div>
        </details>
        <div class="location-geo-manual hidden" data-location-geo-manual>
          <p class="hint editor-block-hint">Ohne GPS, Kartentreffer oder Maps-Link: <strong>Land</strong>, <strong>Region</strong> und <strong>Gebiet</strong> ergänzen (oder unten eine Adresse eintragen).</p>
          <div class="field full"><label>Land</label><input name="country" type="text" list="countrySuggestions" value="${escapeHtml(l.country||'')}" placeholder="z. B. Deutschland" /></div>
          <div class="grid two">
            <div class="field"><label>Region</label><input name="region" type="text" value="${escapeHtml(l.region||'')}" placeholder="z. B. Bayern" /></div>
            <div class="field"><label>Gebiet</label><input name="area" type="text" value="${escapeHtml(l.area||'')}" placeholder="z. B. Starnberger See" /></div>
          </div>
        </div>
        <details class="editor-subpanel" ${hasNotes?'open':''}>
          <summary class="editor-subpanel-summary"><strong>Notizen &amp; Tags</strong><span>optional</span></summary>
          <div class="editor-subpanel-body location-subpanel-fields">
            <div class="field full"><label>Beschreibung</label><textarea name="description">${escapeHtml(l.description||'')}</textarea></div>
            <div class="field full"><label>Tags</label>${renderLocationTagPicker(l)}</div>
          </div>
        </details>
        <div class="sticky-actions"><button class="btn" type="button" data-location-cancel="${escapeHtml(l.id)}">Abbrechen</button><button class="btn primary" type="submit">Location speichern</button></div>
        <div class="danger-zone"><div class="btnbar"><button class="btn danger" type="button" data-location-delete="${escapeHtml(l.id)}">Location löschen</button></div></div>
      </form>`;
    }

    function renderLocationEditor(l){
      const thumbFocus=String(l.image_focus||'50% 50%').replace(/"/g,'');
      const image=l.image_url?`style="background-image:url('${escapeHtml(l.image_url)}');background-position:${escapeHtml(thumbFocus)};"`:'';
      const tags=locationTagsForRecord(l);
      const titleName=l.name&&l.name!=='Neue Location'?l.name:(l.__draft?'Neue Location':'Ohne Namen');
      return `<details class="spot-card location-card" data-location-id="${escapeHtml(l.id)}" ${l.__draft?'open':''}>
        <summary class="location-summary">
          <div class="location-thumb" ${image}></div>
          <div>
            <div class="location-title">${escapeHtml(titleName)}${l.category?`<span class="location-title-separator">·</span><span class="location-title-category">${escapeHtml(l.category)}</span>`:''}</div>
            <div class="location-meta">${escapeHtml(locationMeta(l)||'Noch nicht kategorisiert')}</div>
            ${tags.length?`<div class="tag-row">${tags.slice(0,6).map(t=>`<span class="tiny-chip">${escapeHtml(t)}</span>`).join('')}</div>`:''}
          </div>
          <div class="location-admin-actions"><button class="location-admin-star ${l.is_favorite?'active':''}" type="button" data-admin-toggle-favorite="${escapeHtml(l.id)}" title="Favorit">★</button></div>
        </summary>
        <div class="location-editor">${renderLocationEditorForm(l)}</div>
      </details>`;
    }

    function countLocationsWithTag(tag,excludeId){
      return locations.filter(loc=>loc.id!==excludeId&&locationTagsForRecord(loc).includes(tag)).length;
    }

    function renderLocationTagPickerMarkup(activeTags){
      const active=[...new Set((activeTags||[]).map(t=>String(t).trim()).filter(Boolean))];
      const known=[...new Set([...knownLocationTags(),...active])];
      return `<div class="badge-picker location-tag-picker">${known.map(t=>`<button type="button" class="badge-chip ${active.includes(t)?'active':''}" data-location-tag="${escapeHtml(t)}">${escapeHtml(t)}${active.includes(t)?'<span class="badge-chip-remove" data-remove-location-tag>x</span>':''}</button>`).join('')}<button type="button" class="badge-chip add-badge" data-add-location-tag aria-label="Tag hinzufügen">+</button></div><textarea name="tags" hidden>${escapeHtml(csv(active))}</textarea>`;
    }

    function rebuildLocationTagPicker(form){
      const tools=form?.querySelector('.location-tag-tools');
      if(!tools||!form.elements.tags)return;
      const active=parseLocationTags(form.elements.tags.value);
      tools.innerHTML=renderLocationTagPickerMarkup(active);
      tools.querySelectorAll('[data-location-tag]').forEach(b=>b.addEventListener('click',toggleLocationTag));
      const addBtn=tools.querySelector('[data-add-location-tag]');
      if(addBtn){
        addBtn.addEventListener('mousedown',e=>e.preventDefault());
        addBtn.addEventListener('click',addCustomLocationTag);
      }
    }

    function refreshLocationTagChips(form){
      const tags=parseLocationTags(form.elements.tags?.value);
      form.querySelectorAll('[data-location-tag]').forEach(chip=>{
        const on=tags.includes(chip.dataset.locationTag);
        chip.classList.toggle('active',on);
        if(on&&!chip.querySelector('[data-remove-location-tag]'))chip.insertAdjacentHTML('beforeend','<span class="badge-chip-remove" data-remove-location-tag>x</span>');
        if(!on)chip.querySelector('[data-remove-location-tag]')?.remove();
      });
      const addBtn=form.querySelector('[data-add-location-tag]');
      tags.forEach(tag=>{
        if(form.querySelector(`[data-location-tag="${CSS.escape(tag)}"]`))return;
        rebuildLocationTagPicker(form);
      });
    }

    async function toggleLocationTag(e){
      const chip=e.currentTarget,form=chip.closest('form'),textarea=form.elements.tags,tags=parseLocationTags(textarea.value),tag=chip.dataset.locationTag;
      if(e.target.closest('[data-remove-location-tag]')){
        e.preventDefault();e.stopPropagation();
        const others=countLocationsWithTag(tag,form.dataset.locationForm);
        if(others&&!confirm(`„${tag}“ wird bei ${others} weiteren Location(s) ebenfalls entfernt. Fortfahren?`))return;
        try{
          if(others)await removeLocationTagGlobally(tag);
          else textarea.value=tags.filter(x=>x!==tag).join(', ');
        }catch(error){
          showError('Tag konnte nicht entfernt werden: '+formatError(error));
          return;
        }
        if(!others)textarea.value=tags.filter(x=>x!==tag).join(', ');
        chip.querySelector('[data-remove-location-tag]')?.remove();
      }else{
        textarea.value=(tags.includes(tag)?tags.filter(x=>x!==tag):[...tags,tag]).join(', ');
        const next=parseLocationTags(textarea.value);
        if(next.includes(tag)&&!chip.querySelector('[data-remove-location-tag]'))chip.insertAdjacentHTML('beforeend','<span class="badge-chip-remove" data-remove-location-tag>x</span>');
      }
      rebuildLocationTagPicker(form);
    }

    function makeAddLocationTagButton(){
      const button=document.createElement('button');
      button.type='button';button.className='badge-chip add-badge';button.dataset.addLocationTag='';button.setAttribute('aria-label','Tag hinzufügen');button.textContent='+';
      button.addEventListener('mousedown',e=>e.preventDefault());
      button.addEventListener('click',addCustomLocationTag);
      return button;
    }

    function commitInlineLocationTag(input){
      const form=input.closest('form'),textarea=form.elements.tags,value=input.value.trim(),wrap=input.closest('.badge-inline');
      if(input.dataset.committed==='true')return;
      input.dataset.committed='true';
      if(!wrap)return;
      if(value){
        const tags=parseLocationTags(textarea.value);
        if(!tags.includes(value)){
          textarea.value=[...tags,value].join(', ');
          rebuildLocationTagPicker(form);
          if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
        }
      }
      wrap.replaceWith(makeAddLocationTagButton());
    }

    function addCustomLocationTag(e){
      const addButton=e.currentTarget,input=document.createElement('input');
      input.className='badge-inline-input';input.type='text';input.placeholder='Tag';
      const wrap=document.createElement('span');
      wrap.className='badge-inline badge-chip';wrap.append(input);
      addButton.replaceWith(wrap);
      input.focus();
      input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitInlineLocationTag(input)}if(event.key==='Escape')wrap.replaceWith(makeAddLocationTagButton())});
      input.addEventListener('blur',()=>commitInlineLocationTag(input));
    }

    function bindLocationEditors(){
      locationsList.querySelectorAll('form[data-location-form]').forEach(form=>{
        form.addEventListener('submit',saveLocationForm);
        form.addEventListener('input',()=>{
          refreshLocationImagePreview(form);
          syncLocationGeoFieldsVisibility(form);
        });
        form.elements.region?.addEventListener('input',()=>syncLocationGeoFieldsVisibility(form));
        form.elements.area?.addEventListener('input',()=>syncLocationGeoFieldsVisibility(form));
        bindLocationLibraryCapture(form);
        bindLocationMeetingCapture(form);
        bindLocationImageField(form);
        bindLocationImagePan(form);
        if(form.dataset.placeAnchorRev==null)form.dataset.placeAnchorRev='0';
        if(form.dataset.imageSuggestRev==null)form.dataset.imageSuggestRev='0';
        form.elements.category?.addEventListener('input',()=>{
          if(!canAutoReplaceLocationImage(form))return;
          scheduleLocationImageSuggestion(form,readFormRegionArea(form),null);
        });
        form.elements.name?.addEventListener('input',()=>{
          clearTimeout(form._nameImageTimer);
          form._nameImageTimer=setTimeout(()=>{
            if(canAutoReplaceLocationImage(form))scheduleLocationImageSuggestion(form,readFormRegionArea(form),null);
          },900);
        });
        syncLocationGeoFieldsVisibility(form);
      });
      locationsList.querySelectorAll('[data-location-tag]').forEach(b=>b.addEventListener('click',toggleLocationTag));
      locationsList.querySelectorAll('[data-add-location-tag]').forEach(b=>b.addEventListener('click',addCustomLocationTag));
      locationsList.querySelectorAll('[data-detect-location-from-maps]').forEach(b=>b.addEventListener('click',detectLocationFromMaps));
      locationsList.querySelectorAll('[data-location-delete]').forEach(b=>b.addEventListener('click',deleteLocation));
      locationsList.querySelectorAll('[data-location-cancel]').forEach(b=>b.addEventListener('click',cancelLocationEdit));
      locationsList.querySelectorAll('[data-admin-toggle-favorite]').forEach(b=>b.addEventListener('click',toggleLocationFavoriteFromAdmin));
    }

    function collectLocationPayload(form){
      const d=new FormData(form);
      const address=String(d.get('address')||'').trim();
      let meeting=String(d.get('meeting_place')||'').trim();
      if(!meeting)meeting=address||null;
      else meeting=meeting||null;
      const customName=String(d.get('name')||'').trim();
      const region=String(d.get('region')||'').trim();
      const area=String(d.get('area')||'').trim();
      const country=String(d.get('country')||'').trim();
      const fallback=suggestLocationLabel({address,region,area,country});
      return{
        name:customName||fallback||'Neue Location',
        country:country||null,
        region:region||null,
        area:area||null,
        category:d.get('category')||null,
        address:address||null,
        maps_link:d.get('maps_link')||null,
        meeting_place:meeting,
        meeting_maps_link:String(d.get('meeting_maps_link')||'').trim()||null,
        image_url:d.get('image_url')||null,
        image_focus:String(d.get('image_focus')||'').trim()||'50% 50%',
        description:d.get('description')||null,
        tags:parseCsv(d.get('tags')),
        active:d.get('active')!=='false',
        updated_at:new Date().toISOString()
      };
    }
    function refreshLocationImagePreview(form){
      const p=form.querySelector('[data-location-image-preview]');
      if(!p)return;
      const url=form.elements.image_url?.value||'';
      const focus=form.elements.image_focus?.value||p.dataset.imageFocus||'50% 50%';
      const urlChanged=!!form.dataset.lastPreviewImageUrl&&form.dataset.lastPreviewImageUrl!==url;
      let nextFocus=focus;
      if(urlChanged){
        nextFocus='50% 50%';
        if(form.elements.image_focus)form.elements.image_focus.value=nextFocus;
      }
      setImagePreviewState(p,url,nextFocus);
      if(form.elements.image_focus&&nextFocus)form.elements.image_focus.value=p.dataset.imageFocus||nextFocus;
      form.dataset.lastPreviewImageUrl=url||'';
    }

    function bindLocationImagePan(form){
      const preview=form?.querySelector('[data-location-image-preview]');
      const focusInput=form?.elements?.image_focus;
      if(!preview||preview.dataset.panBound==='true')return;
      preview.dataset.panBound='true';

      const readFocus=()=>parseImageFocus(focusInput?.value||preview.dataset.imageFocus||'50% 50%');
      const writeFocus=(x,y)=>{
        const pos=formatImageFocus(x,y);
        if(focusInput)focusInput.value=pos;
        applyImageFocusToPreview(preview,pos);
        if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
      };

      let dragging=false,startX=0,startY=0,startFx=50,startFy=50;

      const onDown=e=>{
        if(!preview.classList.contains('is-pannable'))return;
        if(e.button!==undefined&&e.button!==0)return;
        dragging=true;
        const p=e.touches?.[0]||e;
        startX=p.clientX;startY=p.clientY;
        const f=readFocus();
        startFx=f.x;startFy=f.y;
        preview.classList.add('is-panning');
      };
      const onMove=e=>{
        if(!dragging)return;
        const p=e.touches?.[0]||e;
        const rect=preview.getBoundingClientRect();
        if(!rect.width||!rect.height)return;
        const dx=p.clientX-startX;
        const dy=p.clientY-startY;
        writeFocus(startFx-(dx/rect.width)*100,startFy-(dy/rect.height)*100);
        e.preventDefault();
      };
      const onUp=()=>{
        if(!dragging)return;
        dragging=false;
        preview.classList.remove('is-panning');
      };

      preview.addEventListener('mousedown',onDown);
      preview.addEventListener('touchstart',onDown,{passive:false});
      window.addEventListener('mousemove',onMove);
      window.addEventListener('touchmove',onMove,{passive:false});
      window.addEventListener('mouseup',onUp);
      window.addEventListener('touchend',onUp);
      preview.addEventListener('dblclick',()=>writeFocus(50,50));

      form.querySelector('[data-reset-image-focus]')?.addEventListener('click',()=>{
        writeFocus(50,50);
        showToast('Bildauschnitt zentriert');
      });
    }
    async function saveLocationForm(e){
      e.preventDefault();clearError();
      const form=e.currentTarget;
      let id=form.dataset.locationForm;
      const isDraft=form.dataset.locationDraft==='true';
      if(isDraft&&!isValidLocationId(id))id=newLocationId();
      if(!(await ensureLocationGeoReady(form)))return;
      let payload=collectLocationPayload(form);
      if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;
      setStatus(isDraft?'Erstelle Location…':'Speichere Location…');
      let result=isDraft?await db.from('locations').insert({...payload,id}).select('*').single():await db.from('locations').update(payload).eq('id',id);
      if(result.error&&/image_focus/i.test(formatError(result.error))){
        const {image_focus:_,...withoutFocus}=payload;
        payload=withoutFocus;
        result=isDraft?await db.from('locations').insert({...payload,id}).select('*').single():await db.from('locations').update(payload).eq('id',id);
        if(!result.error)showToast('Gespeichert — Bildauschnitt erst nach Migration (docs/migrations/add_location_image_focus.sql)');
      }
      if(result.error&&/meeting_maps_link/i.test(formatError(result.error))){
        const {meeting_maps_link:_,...withoutMeetMaps}=payload;
        payload=withoutMeetMaps;
        result=isDraft?await db.from('locations').insert({...payload,id}).select('*').single():await db.from('locations').update(payload).eq('id',id);
        if(!result.error)showToast('Gespeichert — Treff-Maps-Link erst nach Migration (add_location_meeting_maps_link.sql)');
      }
      if(result.error){showError('Location konnte nicht gespeichert werden: '+formatError(result.error));setStatus('Fehler beim Speichern');return}
      showToast(isDraft?'Location erstellt':'Location gespeichert');
      await loadLocations();
      setStatus('Location gespeichert');
    }
    async function removeLocationTagGlobally(tag){
      const affected=locations.filter(l=>locationTagsForRecord(l).includes(tag));
      for(const loc of affected){
        loc.tags=locationTagsForRecord(loc).filter(t=>t!==tag);
        if(!loc.__draft&&loc.id){
          const {error}=await db.from('locations').update({tags:loc.tags,updated_at:new Date().toISOString()}).eq('id',loc.id);
          if(error)throw error;
        }
        currentLocationsById[loc.id]=loc;
      }
      locationsList.querySelectorAll('form[data-location-form]').forEach(form=>{
        const tags=parseLocationTags(form.elements.tags?.value);
        if(!tags.includes(tag))return;
        form.elements.tags.value=tags.filter(x=>x!==tag).join(', ');
        refreshLocationTagChips(form);
      });
      showToast(`Tag „${tag}“ entfernt`);
    }

    async function createNewLocation(){clearError();locationSearchInput.value='';countryFilter.value='all';regionFilter.value='all';categoryFilter.value='all';locationFavoritesOnly=false;favoriteLocationsBtn.classList.remove('primary');favoriteLocationsBtn.textContent='☆ Favoriten';const id=newLocationId();const payload={id,name:'',country:'',region:'',area:'',category:'',address:'',maps_link:'',meeting_place:'',meeting_maps_link:'',image_url:'',image_focus:'50% 50%',description:'',tags:[],active:true,updated_at:new Date().toISOString(),__draft:true};locations=[payload,...locations.filter(location=>location.id!==id)];currentLocationsById[id]=payload;renderLocations();showToast('Neue Location vorbereitet');const card=locationsList.querySelector(`[data-location-id="${id}"]`);if(card){card.open=true;card.scrollIntoView({behavior:'smooth',block:'center'});const input=card.querySelector('input[name="name"]');if(input)setTimeout(()=>input.focus(),350)}}
    function cancelLocationEdit(e){const form=e.currentTarget.closest('form'),id=form?.dataset.locationForm;if(form?.dataset.locationDraft==='true'){locations=locations.filter(l=>l.id!==id);delete currentLocationsById[id]}renderLocations()}
    async function deleteLocation(e){const id=e.currentTarget.dataset.locationDelete,l=currentLocationsById[id];if(!l)return;if(l.__draft){if(!confirm('Diesen Location-Entwurf verwerfen?'))return;locations=locations.filter(x=>x.id!==id);delete currentLocationsById[id];renderLocations();showToast('Entwurf verworfen');return}if(!confirm(`Location wirklich löschen?\n\n${l.name}`))return;const {error}=await db.from('locations').delete().eq('id',id);if(error){showError('Location konnte nicht gelöscht werden: '+formatError(error));return}showToast('Location gelöscht');await loadLocations()}
    function normalizeLocationNeedle(value){
      return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
    }

    function findSimilarLibraryLocation(row){
      const needles=[row?.location_name,row?.name,row?.meeting_place,row?.address].map(normalizeLocationNeedle).filter(Boolean);
      if(!needles.length||!locations?.length)return null;
      for(const loc of locations){
        const hay=[loc.name,loc.address,loc.meeting_place,loc.area].map(normalizeLocationNeedle).filter(Boolean);
        for(const needle of needles){
          for(const part of hay){
            if(part===needle||part.includes(needle)||needle.includes(part))return loc;
          }
        }
      }
      return null;
    }

    function applyLibraryLocationToShootingForm(form,location){
      if(!form||!location)return;
      if(form.elements.location_id)form.elements.location_id.value=location.id;
      if(form.elements.location_name)form.elements.location_name.value=location.name||'';
      const meetPlace=String(location.meeting_place||location.address||'').trim();
      const meetLink=String(location.meeting_maps_link||'').trim()||String(location.maps_link||'').trim();
      if(form.elements.meeting_place)form.elements.meeting_place.value=meetPlace;
      const linkEl=meetingLinkField(form);
      if(linkEl)linkEl.value=meetLink;
      form.dataset.libraryMeetingPlace=meetPlace;
      form.dataset.libraryMeetingLink=meetLink;
      const meetPanel=form.querySelector('[data-shooting-meeting-panel]');
      if(meetPanel)meetPanel.open=!!location.id||locationUsesSeparateMeeting(location)||!!meetPlace;
      if(form.elements.location_link&&!String(form.elements.location_link.value||'').trim())form.elements.location_link.value=location.maps_link||'';
      if(form.elements.image_url){
        const libImage=String(location.image_url||'').trim();
        if(libImage){
          form.elements.image_url.value=libImage;
          form.dataset.imageFromLibrary='true';
          delete form.dataset.imageSuggested;
        }
      }
      if(form.elements.image_focus)form.elements.image_focus.value=location.image_focus||'50% 50%';
      delete form.dataset.lastPreviewImageUrl;
      const fill=(name,val)=>{const el=form.elements[name];if(el)el.value=val||''};
      fill('location_meta_name',location.name);
      fill('location_meta_country',location.country);
      fill('location_meta_region',location.region);
      fill('location_meta_area',location.area);
      fill('location_meta_category',location.category);
      fill('location_meta_address',location.address);
      fill('location_meta_maps_link',location.maps_link);
      syncLocationGeoFieldsVisibility(form);
      updateManualOverrideState(form);
      refreshLivePreview(form);
      if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form);
      if(typeof syncLocationSetupPanel==='function')syncLocationSetupPanel(form);
      syncShootingMeetingLibraryState(form);
    }

    function syncLocationMetaFromShootingForm(form){
      const fill=(name,value)=>{const el=form.elements[name];if(!el)return;el.value=value||''};
      fill('location_meta_name',form.elements.location_name?.value||form.elements.title?.value);
      fill('location_meta_address',form.elements.meeting_place?.value);
      fill('location_meta_meeting_place',form.elements.meeting_place?.value);
      fill('location_meta_maps_link',form.elements.location_link?.value||form.elements.meeting_link?.value);
      fill('location_meta_image_url',form.elements.image_url?.value);
      const lib=form.elements.location_id?.value?currentLocationsById[form.elements.location_id.value]:null;
      if(lib){
        fill('location_meta_country',lib.country);
        fill('location_meta_region',lib.region);
        fill('location_meta_area',lib.area);
        fill('location_meta_category',lib.category);
      }
    }

    function clearImportLocationOffer(shootingId){
      const row=currentRowsById[shootingId];
      if(!row)return;
      const next={...row,__icsImportLocation:false};
      currentRowsById[shootingId]=next;
      rows=rows.map(r=>r.id===shootingId?next:r);
    }

    function linkDraftShootingToLocation(shootingId,locationId){
      const form=shootingsEl?.querySelector(`form[data-id="${shootingId}"]`);
      const location=currentLocationsById[locationId];
      if(!form||!location)return;
      applyLibraryLocationToShootingForm(form,location);
      const row=currentRowsById[shootingId];
      if(row){
        const next=normalizeRowStatus({...row,location_id:locationId,location_name:location.name||row.location_name,__icsImportLocation:false});
        currentRowsById[shootingId]=next;
        rows=rows.map(r=>r.id===shootingId?next:r);
      }
      refreshFormDirtyState(form);
      updateUnsavedBar();
    }

    async function acceptImportLocationToLibrary(shootingId){
      const form=shootingsEl?.querySelector(`form[data-id="${shootingId}"]`);
      if(!form)return;
      if(!(await ensureLocationGeoReady(form)))return;
      syncLocationMetaFromShootingForm(form);
      const payload=locationPayloadFromShootingForm(form);
      const dup=findDuplicateLibraryLocation(payload);
      if(dup){linkDraftShootingToLocation(shootingId,dup.id);renderAll();showToast(`Bestehende Location „${dup.name}“ verknüpft`);return}
      if(!String(payload.name||'').trim()){
        showError('Bitte zuerst einen Location-Namen eintragen.');
        return;
      }
      if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;
      setStatus('Location wird angelegt…');
      try{
        const {data,error}=await db.from('locations').insert(payload).select('*').single();
        if(error){showError('Location konnte nicht gespeichert werden: '+formatError(error));return}
        await loadLocations();
        linkDraftShootingToLocation(shootingId,data.id);
        renderAll();
        const card=shootingsEl.querySelector(`[data-id="${shootingId}"]`);
        if(card){card.open=true;card.scrollIntoView({behavior:'smooth',block:'center'})}
        showToast(`„${data.name}“ in Bibliothek · Shooting verknüpft`);
        setStatus('Location übernommen');
      }catch(err){
        console.error(err);
        showError('Location konnte nicht übernommen werden.');
      }
    }

    function skipImportLocationOffer(shootingId){
      clearImportLocationOffer(shootingId);
      renderAll();
      showToast('Location bleibt nur in diesem Shooting');
    }

    function bindImportLocationOffers(){
      if(!shootingsEl)return;
      shootingsEl.querySelectorAll('[data-import-location-accept]').forEach(btn=>{
        btn.addEventListener('click',()=>acceptImportLocationToLibrary(btn.dataset.importLocationAccept));
      });
      shootingsEl.querySelectorAll('[data-import-location-link]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          linkDraftShootingToLocation(btn.dataset.importLocationLink,btn.dataset.locationId);
          renderAll();
          showToast('Bibliotheks-Location verknüpft');
        });
      });
      shootingsEl.querySelectorAll('[data-import-location-skip]').forEach(btn=>{
        btn.addEventListener('click',()=>skipImportLocationOffer(btn.dataset.importLocationSkip));
      });
    }

    function applyLocationToForm(e){const location=currentLocationsById[e.currentTarget.value];if(!location)return;const form=e.currentTarget.closest('form');applyLibraryLocationToShootingForm(form,location);showToast('Location übernommen')}

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
      const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}&zoom=16&addressdetails=1&extratags=1`;
      const response=await fetch(url,{headers:{'Accept':'application/json'}});
      if(!response.ok)throw new Error('Geocoding fehlgeschlagen: '+response.status);
      return await response.json();
    }

    const CATEGORY_LOCATION_IMAGES={
      Berge:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
      See:'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80',
      Wald:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80',
      'Aussichtspunkt':'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
      'Passstraße':'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80',
      Dolomiten:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80'
    };

    function locationImageField(form){
      return form?.elements?.image_url||null;
    }

    function refreshFormImagePreview(form){
      if(!form)return;
      if(isLibraryLocationForm(form))refreshLocationImagePreview(form);
      else if(typeof refreshLivePreview==='function')refreshLivePreview(form);
    }

    function bindLocationImageField(form){
      if(!form||form.dataset.locationImageBound==='true')return;
      form.dataset.locationImageBound='true';
      const input=locationImageField(form);
      if(!input)return;
      input.addEventListener('input',()=>{
        const value=String(input.value||'').trim();
        if(value){
          form.dataset.imageManual='true';
          delete form.dataset.imageSuggested;
        }else{
          delete form.dataset.imageManual;
          delete form.dataset.imageSuggested;
          delete form.dataset.imageFromLibrary;
        }
        refreshFormImagePreview(form);
      });
      form.querySelector('[data-clear-suggested-image]')?.addEventListener('click',()=>{
        if(input)input.value='';
        if(form.elements.image_focus)form.elements.image_focus.value='50% 50%';
        delete form.dataset.imageManual;
        delete form.dataset.imageSuggested;
        delete form.dataset.imageFromLibrary;
        delete form.dataset.lastPreviewImageUrl;
        refreshFormImagePreview(form);
        showToast('Bild entfernt');
      });
    }

    function parseWikipediaTag(tag){
      const raw=String(tag||'').trim();
      if(!raw||!raw.includes(':'))return null;
      const idx=raw.indexOf(':');
      return{lang:raw.slice(0,idx)||'de',title:raw.slice(idx+1).replace(/_/g,' ')};
    }

    async function fetchWikipediaLeadImage(title,lang='de'){
      const pageTitle=String(title||'').trim().replace(/\s+/g,'_');
      if(!pageTitle)return null;
      const api=`https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&piprop=thumbnail|original&pithumbsize=1200&format=json&origin=*`;
      try{
        const response=await fetch(api);
        if(!response.ok)return lang==='de'?fetchWikipediaLeadImage(title,'en'):null;
        const data=await response.json();
        const page=Object.values(data?.query?.pages||{})[0];
        if(!page||page.missing)return lang==='de'?fetchWikipediaLeadImage(title,'en'):null;
        return page.original?.source||page.thumbnail?.source||null;
      }catch(error){
        console.error(error);
        return null;
      }
    }

    async function fetchCommonsImage(searchTerm){
      const q=String(searchTerm||'').trim();
      if(q.length<3)return null;
      const api=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&origin=*`;
      try{
        const response=await fetch(api);
        if(!response.ok)return null;
        const data=await response.json();
        const pages=data?.query?.pages||{};
        for(const page of Object.values(pages)){
          const info=page?.imageinfo?.[0];
          const url=info?.thumburl||info?.url;
          if(url&&!/\.svg($|\?)/i.test(url))return url;
        }
      }catch(error){console.error(error)}
      return null;
    }

    function buildLocationImageSearchQuery(form,meta={}){
      const name=String(form?.elements?.name?.value||form?.elements?.location_name?.value||'').trim();
      const region=String(meta?.region||readFormRegionArea(form).region||'').trim();
      const area=String(meta?.area||readFormRegionArea(form).area||'').trim();
      const country=String(meta?.country||form?.elements?.country?.value||'').trim();
      const category=String(form?.elements?.category?.value||'').trim();
      const parts=[name,area,region,category,country].filter(Boolean);
      const unique=[...new Set(parts.map(p=>String(p).trim()).filter(p=>p.length>1))];
      const query=unique.slice(0,4).join(' ');
      if(!query)return '';
      const inAlps=/ital|österreich|austria|südtirol|south tyrol|dolomiten|dolomiti|alps|alpen/i.test(query);
      return inAlps?`${query} landscape`:`${query} landscape mountains`;
    }

    function categoryFallbackImage(category){
      const key=String(category||'').trim();
      if(!key)return null;
      if(CATEGORY_LOCATION_IMAGES[key])return CATEGORY_LOCATION_IMAGES[key];
      const lower=key.toLowerCase();
      if(/berg|alm|joch|pass|spitze|gipfel/.test(lower))return CATEGORY_LOCATION_IMAGES.Berge;
      if(/see|lake|lago/.test(lower))return CATEGORY_LOCATION_IMAGES.See;
      if(/wald|forest|wood/.test(lower))return CATEGORY_LOCATION_IMAGES.Wald;
      return null;
    }

    async function resolveLocationImageUrl(form,meta={},osmExtratags=null){
      if(!canAutoReplaceLocationImage(form))return null;
      const input=locationImageField(form);
      if(!input)return null;

      const wiki=parseWikipediaTag(osmExtratags?.wikipedia);
      if(wiki?.title){
        const fromWiki=await fetchWikipediaLeadImage(wiki.title,wiki.lang);
        if(fromWiki)return fromWiki;
      }

      const query=buildLocationImageSearchQuery(form,meta);
      if(query){
        const fromCommons=await fetchCommonsImage(query);
        if(fromCommons)return fromCommons;
      }

      return categoryFallbackImage(form?.elements?.category?.value)||categoryFallbackImage(meta?.area);
    }

    function applySuggestedImageToForm(form,url,{silent=false}={}){
      const input=locationImageField(form);
      if(!url||!input||!canAutoReplaceLocationImage(form))return false;
      input.value=url;
      form.dataset.imageSuggested='true';
      form.dataset.imageSuggestRev=form.dataset.placeAnchorRev||'0';
      if(form.elements.image_focus)form.elements.image_focus.value='50% 50%';
      delete form.dataset.lastPreviewImageUrl;
      if(form.elements.location_meta_image_url&&!String(form.elements.location_meta_image_url.value||'').trim()){
        form.elements.location_meta_image_url.value=url;
      }
      refreshFormImagePreview(form);
      if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
      if(!silent)showToast('Bildvorschlag gesetzt — bei Bedarf URL ersetzen');
      return true;
    }

    function scheduleLocationImageSuggestion(form,meta={},osmExtratags=null){
      if(!form)return;
      clearTimeout(form._imageSuggestTimer);
      form._imageSuggestTimer=setTimeout(async()=>{
        try{
          const url=await resolveLocationImageUrl(form,meta,osmExtratags);
          if(url)applySuggestedImageToForm(form,url);
        }catch(error){console.error(error)}
      },700);
    }

    window.bindLocationImageField=bindLocationImageField;
    window.scheduleLocationImageSuggestion=scheduleLocationImageSuggestion;
    window.canAutoReplaceLocationImage=canAutoReplaceLocationImage;
    window.readFormRegionArea=readFormRegionArea;

    function setMapsStatus(form,message,kind=''){
      const status=kind
        ?form.querySelector(`[data-maps-status="${kind}"]`)
        :form.querySelector('[data-maps-status]');
      if(status)status.textContent=message||'';
    }

    function normalizeMapsPaste(value){
      const v=String(value||'').trim();
      if(!v)return v;
      if(/^(share\.google|maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(v))return `https://${v}`;
      return v;
    }

    function looksLikeMapsLink(value){
      const v=normalizeMapsPaste(value);
      return /google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps|share\.google\//i.test(v);
    }

    function coordsFromMapsInput(link,meta){
      const resolved=meta?.resolved_link||normalizeMapsPaste(link);
      return extractCoordsFromMapsLink(resolved)||(meta?.lat!=null&&meta?.lon!=null?{lat:meta.lat,lon:meta.lon}:null);
    }

    /** Nur reine Verwaltungs-Orte ohne eigenen Spot-Namen — Bahnhof/See/Berg etc. bleiben erlaubt. */
    function isGenericOnlyLocationName(name){
      const n=normalizeLocationNeedle(name);
      if(!n||n.length<3)return true;
      const exact=new Set(['standesamt','rathaus','amt','notar','registry office','town hall']);
      if(exact.has(n))return true;
      if(/^(standesamt|notar|amt)(\s|$)/.test(n)&&n.length<32&&!/\b(see|alm|berg|pass|bahnhof|flughafen|hotel|park|platz|brücke|tal|joch|spitze|wildsee|dolomiten)\b/.test(n))return true;
      return false;
    }

    async function searchAddressNominatim(query){
      const q=String(query||'').trim();
      if(q.length<3)return [];
      const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&extratags=1&q=${encodeURIComponent(q)}`;
      const response=await fetch(url,{headers:{'Accept':'application/json'}});
      if(!response.ok)throw new Error('Adresssuche fehlgeschlagen: '+response.status);
      return await response.json();
    }

    function shouldAutoSaveLocationToLibrary(payload,form){
      if(String(payload?.location_id||'').trim())return false;
      if(form?.elements?.skip_library_autosave?.checked)return false;
      const name=String(payload?.location_name||'').trim();
      if(name.length<4)return false;
      if(isGenericOnlyLocationName(name))return false;
      const hasMaps=!!String(payload?.location_link||'').trim();
      const hasAddress=!!String(payload?.meeting_place||'').trim();
      if(!hasMaps&&!hasAddress)return false;
      if(typeof findSimilarLibraryLocation==='function'&&findSimilarLibraryLocation(payload))return false;
      return true;
    }

    async function applyOsmPickToForm(form,hit){
      if(!form||!hit)return;
      const displayAddr=String(hit.display_name||'').trim();
      if(form.elements.location_id)form.elements.location_id.value='';
      if(isLibraryLocationForm(form)){
        if(form.elements.address)form.elements.address.value=displayAddr;
        const nameField=form.elements.name;
        if(nameField&&(isWeakLocationLabel(nameField.value)||!String(nameField.value||'').trim()))nameField.value='';
      }else{
        if(form.elements.meeting_place)form.elements.meeting_place.value=displayAddr;
        const nameField=form.elements.location_name;
        if(nameField&&(isWeakLocationLabel(nameField.value)||!String(nameField.value||'').trim()))nameField.value='';
        const setup=form.querySelector('[data-location-setup]');
        if(setup)setup.open=true;
      }
      if(hit.lat&&hit.lon){
        await applyGeoToForm(form,Number(hit.lat),Number(hit.lon),{displayAddress:displayAddr,forceWeakName:true});
      }else{
        notePlaceAnchorChanged(form);
        const meta=mapAddressToMeta(hit.address||{},displayAddr);
        fillLocationFormFromMeta(form,meta,null,{skipImageSuggest:true,forceWeakName:true});
        scheduleLocationImageSuggestion(form,meta,hit.extratags||null);
        syncLocationGeoFieldsVisibility(form);
      }
      if(!isLibraryLocationForm(form)){
        const finder=form.querySelector('[data-location-finder]');
        const osmSlot=finder?.querySelector('[data-osm-results]');
        if(osmSlot){osmSlot.innerHTML='';finder._osmResults=[]}
        refreshLivePreview(form);
        refreshFormDirtyState(form);
        if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form);
        showToast('Übernommen — wird beim Speichern zur Bibliothek hinzugefügt');
      }else{
        const panel=form.querySelector('[data-location-lib-osm]');
        panel?.classList.add('hidden');
        showToast('Kartentreffer übernommen');
      }
    }

    function renderOsmFinderResults(results){
      if(!results?.length){
        return `<div class="location-picker-empty">Kein Kartentreffer — unten Maps-Link nutzen oder Namen anpassen.</div>`;
      }
      return results.map((item,index)=>{
        const title=String(item.name||'').trim()||String(item.display_name||'').split(',')[0].trim();
        const meta=String(item.display_name||'');
        return `<button class="location-option location-option-osm" type="button" data-pick-osm="${index}">
          <div class="location-option-thumb location-option-thumb-osm">📍</div>
          <div><div class="location-option-title">${escapeHtml(title)}</div><div class="location-option-meta">${escapeHtml(meta)}</div></div>
        </button>`;
      }).join('');
    }

    async function applyMapsLinkFromFinder(form,rawLink){
      const finder=form?.querySelector('[data-location-finder]');
      const slot=finder?.querySelector('[data-osm-results]');
      const link=String(rawLink||'').trim();
      if(!link||!form)return;
      if(slot)slot.innerHTML=`<div class="location-picker-section-title">Google Maps</div><div class="location-osm-loading">Link wird erkannt…</div>`;
      try{
        if(form.elements.location_id)form.elements.location_id.value='';
        const normalized=normalizeMapsPaste(link);
        if(form.elements.location_link)form.elements.location_link.value=normalized;
        const meta=await detectMetaFromMapsLink(normalized,form,'location');
        if(!meta){
          if(slot)slot.innerHTML=`<div class="location-picker-empty">Koordinaten im Link nicht gefunden — unten unter „Adresse &amp; Maps“ erneut versuchen.</div>`;
          syncLocationSetupPanel(form);
          return;
        }
        if(meta.resolved_link&&form.elements.location_link)form.elements.location_link.value=meta.resolved_link;
        const coords=coordsFromMapsInput(normalized,meta);
        notePlaceAnchorChanged(form);
        fillLocationFormFromMeta(form,meta,coords,{skipImageSuggest:true,forceWeakName:true,clearMapsName:true});
        scheduleLocationImageSuggestion(form,meta,null);
        syncLocationSetupPanel(form);
        refreshLivePreview(form);
        refreshFormDirtyState(form);
        if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form);
        const short=String(form.elements.location_name?.value||form.elements.name?.value||'').trim()||'Location aus Maps';
        if(slot)slot.innerHTML=`<div class="location-picker-section-title">Google Maps</div><div class="location-picker-empty">„${escapeHtml(short)}“ übernommen — Name und Adresse unten anpassbar.</div>`;
        showToast('Aus Maps-Link übernommen');
      }catch(error){
        console.error(error);
        if(slot)slot.innerHTML=`<div class="location-picker-empty">Maps-Link konnte nicht gelesen werden.</div>`;
        showError('Maps-Link konnte nicht gelesen werden: '+(error.message||error));
      }
    }

    async function refreshLocationFinderOsm(form){
      const finder=form?.querySelector('[data-location-finder]');
      const slot=finder?.querySelector('[data-osm-results]');
      if(!finder||!slot)return;
      const input=finder.querySelector('[data-location-finder-input]');
      const term=String(input?.value||'').trim();
      const hidden=form.elements.location_id?.value;
      if(looksLikeMapsLink(term)){
        await applyMapsLinkFromFinder(form,term);
        return;
      }
      if(hidden||term.length<3){
        slot.innerHTML='';
        finder._osmResults=[];
        finder._osmRequest=0;
        return;
      }
      const country=finder.querySelector('[data-location-finder-country]')?.value||'all';
      const category=finder.querySelector('[data-location-finder-category]')?.value||'all';
      const libCount=typeof countLibraryFinderMatches==='function'
        ?countLibraryFinderMatches(term,country,category)
        :0;
      if(libCount>0){
        slot.innerHTML='';
        finder._osmResults=[];
        finder._osmRequest=0;
        return;
      }
      const requestId=bumpOsmRequestId(finder,'_osmRequest');
      slot.innerHTML=`<div class="location-picker-section-title">Auf der Karte (OpenStreetMap)</div><div class="location-osm-loading">Suche…</div>`;
      try{
        const results=await searchAddressNominatim(term);
        if(requestId!==finder._osmRequest)return;
        finder._osmResults=results;
        slot.innerHTML=`<div class="location-picker-section-title">Auf der Karte (OpenStreetMap)</div>${renderOsmFinderResults(results)}`;
        syncLocationSetupPanel(form);
      }catch(error){
        if(requestId!==finder._osmRequest)return;
        console.error(error);
        slot.innerHTML=`<div class="location-picker-section-title">Auf der Karte</div><div class="location-picker-empty">Kartensuche fehlgeschlagen</div>`;
      }
    }

    function syncLocationSetupPanel(form){
      const setup=form?.querySelector('[data-location-setup]');
      if(!setup)return;
      const hasLib=!!form.elements.location_id?.value;
      const term=String(form.elements.location_name?.value||'').trim();
      const hasDetail=!!String(form.elements.location_link?.value||'').trim()||!!String(form.elements.meeting_place?.value||'').trim();
      const show=!hasLib&&(term.length>=3||hasDetail);
      setup.classList.toggle('hidden',!show);
      if(show&&(term.length>=3||hasDetail))setup.open=true;
    }

    window.refreshLocationFinderOsm=refreshLocationFinderOsm;
    window.applyOsmPickToForm=applyOsmPickToForm;
    window.applyMapsLinkFromFinder=applyMapsLinkFromFinder;
    window.looksLikeMapsLink=looksLikeMapsLink;
    window.syncLocationSetupPanel=syncLocationSetupPanel;
    window.syncLocationGeoFieldsVisibility=syncLocationGeoFieldsVisibility;
    window.fillLocationFormFromMeta=fillLocationFormFromMeta;
    window.LOCATION_CAPTURE_HINT=LOCATION_CAPTURE_HINT;

    async function detectPlaceFromMaps(event){
      const kind=event.currentTarget.dataset.detectPlace||'location';
      const form=event.currentTarget.closest('form');
      if(!form)return;
      const linkKey=kind==='meeting'?'meeting_link':'location_link';
      const link=form.elements[linkKey]?.value;
      try{
        const meta=await detectMetaFromMapsLink(link,form,kind);
        if(!meta)return;
        const resolved=meta.resolved_link||normalizeMapsPaste(link);
        if(kind==='location'){
          if(form.elements.location_link)form.elements.location_link.value=resolved;
          const coords=coordsFromMapsInput(link,meta);
          fillLocationFormFromMeta(form,meta,coords);
        }else{
          if(form.elements.meeting_place)form.elements.meeting_place.value=meta.address||meta.display_name||form.elements.meeting_place.value;
          const meetLinkEl=meetingLinkField(form);
          if(meetLinkEl)meetLinkEl.value=resolved;
          syncShootingMeetingLibraryState(form);
        }
        showToast('Maps-Infos übernommen — Adresse kannst du noch anpassen');
        refreshLivePreview(form);
        refreshFormDirtyState(form);
        if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form);
        if(typeof syncLocationSetupPanel==='function')syncLocationSetupPanel(form);
      }catch(error){
        console.error(error);
        setMapsStatus(form,'Konnte Infos nicht erkennen',kind);
        showError('Maps-Infos konnten nicht erkannt werden: '+(error.message||error));
      }
    }

    function bindPlaceMapsBlocks(form){
      if(!form||form.dataset.placeMapsBound==='true')return;
      form.dataset.placeMapsBound='true';
      form.querySelectorAll('[data-detect-place]').forEach(btn=>btn.addEventListener('click',detectPlaceFromMaps));
    }

    window.bindPlaceMapsBlocks=bindPlaceMapsBlocks;
    window.detectPlaceFromMaps=detectPlaceFromMaps;

    async function resolveMapsLinkIfNeeded(link,form,kind=''){
      let value=normalizeMapsPaste(link);
      if(!value)return value;
      if(extractCoordsFromMapsLink(value))return value;
      if(!looksLikeMapsLink(value))return value;

      setMapsStatus(form,/share\.google/i.test(value)?'Google-Share-Link wird aufgelöst…':'Kurzlink wird aufgelöst…',kind);

      const response=await fetch(`${MAPS_RESOLVER_URL}?url=${encodeURIComponent(value)}`);
      const result=await response.json();

      if(!response.ok||result.error){
        const hint=/share\.google/i.test(value)?' (Share-Link: Maps-Worker neu deployen — siehe workers/maps-resolver/)':'';
        throw new Error((result.error||'Maps-Link konnte nicht aufgelöst werden')+hint);
      }

      return normalizeMapsPaste(result.resolvedUrl||value);
    }

    async function detectMetaFromMapsLink(link,form,kind=''){
      const resolvedLink=await resolveMapsLinkIfNeeded(link,form,kind);
      const coords=extractCoordsFromMapsLink(resolvedLink);
      if(!coords){
        setMapsStatus(form,'Keine Koordinaten gefunden. Der Link wurde gelesen, enthält aber keine eindeutig erkennbaren Koordinaten.',kind);
        return null;
      }

      setMapsStatus(form,'Erkenne Ort…',kind);
      const result=await reverseGeocodeCoords(coords);
      const meta=mapAddressToMeta(result.address||{},result.display_name||'');
      meta.display_name=result.display_name||'';
      meta.lat=coords.lat;
      meta.lon=coords.lon;
      meta.resolved_link=resolvedLink;
      setMapsStatus(form,'Infos erkannt',kind);
      window.setTimeout(()=>setMapsStatus(form,'',kind),2200);
      return meta;
    }

    async function detectLocationFromMaps(event){
      const form=event.currentTarget.closest('form');
      if(!form)return;
      const link=form.elements.maps_link?.value;
      try{
        const meta=await detectMetaFromMapsLink(link,form,'library');
        if(!meta)return;
        notePlaceAnchorChanged(form);
        if(meta.resolved_link&&form.elements.maps_link)form.elements.maps_link.value=meta.resolved_link;
        const coords=coordsFromMapsInput(link,meta);
        fillLocationFormFromMeta(form,meta,coords,{skipImageSuggest:true,forceWeakName:true});
        scheduleLocationImageSuggestion(form,meta,null);
        showToast('Maps-Infos übernommen');
      }catch(error){
        console.error(error);
        setMapsStatus(form,'Konnte Infos nicht erkennen','library');
        showError('Maps-Infos konnten nicht erkannt werden: '+(error.message||error));
      }
    }

    async function detectMeetingFromMaps(event){
      const form=event.currentTarget.closest('form');
      if(!form)return;
      const link=String(meetingLinkField(form)?.value||'').trim();
      if(!link){
        showError('Bitte zuerst einen Maps-Link für den Treff eintragen.');
        return;
      }
      await applyMapsLinkToMeetingForm(form,link);
      syncShootingMeetingLibraryState(form);
    }

    async function captureGpsToShootingForm(form){
      if(!navigator.geolocation){
        showError('Standort ist in diesem Browser nicht verfügbar (HTTPS nötig).');
        return;
      }
      const btn=form?.querySelector('[data-capture-gps-shooting]');
      if(btn){btn.classList.add('is-busy');btn.disabled=true}
      setStatus('Standort wird ermittelt…');
      navigator.geolocation.getCurrentPosition(async pos=>{
        try{
          if(form.elements.location_id)form.elements.location_id.value='';
          await applyGeoToForm(form,pos.coords.latitude,pos.coords.longitude);
          if(typeof syncLocationSetupPanel==='function')syncLocationSetupPanel(form);
          if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form);
          refreshLivePreview(form);
          refreshFormDirtyState(form);
          showToast('Standort übernommen');
          setStatus('Standort übernommen');
        }catch(error){
          console.error(error);
          showError('Standort konnte nicht übernommen werden.');
        }finally{
          if(btn){btn.classList.remove('is-busy');btn.disabled=false}
        }
      },err=>{
        if(btn){btn.classList.remove('is-busy');btn.disabled=false}
        showError('GPS fehlgeschlagen: '+(err.message||'Zugriff verweigert'));
      },{enableHighAccuracy:true,timeout:20000,maximumAge:60000});
    }

    window.captureGpsToShootingForm=captureGpsToShootingForm;
    window.captureGpsToLocationForm=captureGpsToLocationForm;

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

    async function maybeAutoAddLocationToLibrary(form,id,payload){
      if(!shouldAutoSaveLocationToLibrary(payload,form))return payload;
      await enrichLocationMetaFromForm(form);
      syncLocationMetaFromShootingForm(form);
      const locationPayload=locationPayloadFromShootingForm(form);
      const dup=findDuplicateLibraryLocation(locationPayload);
      if(dup){
        payload.location_id=dup.id;
        if(form.elements.location_id)form.elements.location_id.value=dup.id;
        showToast(`Bestehende Location „${dup.name}“ verknüpft`);
        return payload;
      }
      if(!validateImageBeforeSave(locationPayload.image_url,'Bild URL'))throw new Error('INVALID_IMAGE_URL');
      const {data,error}=await db.from('locations').insert(locationPayload).select('*').single();
      if(error)throw error;
      await loadLocations();
      payload.location_id=data.id;
      if(form.elements.location_id)form.elements.location_id.value=data.id;
      showToast(`„${data.name}“ zur Location-Bibliothek hinzugefügt`);
      return payload;
    }

    window.maybeAutoAddLocationToLibrary=maybeAutoAddLocationToLibrary;

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
      const customName=String(fd.get('location_meta_name')||fd.get('location_name')||'').trim();
      const address=String(fd.get('location_meta_address')||fd.get('meeting_place')||'').trim();
      const region=String(fd.get('location_meta_region')||'').trim();
      const area=String(fd.get('location_meta_area')||'').trim();
      const country=String(fd.get('location_meta_country')||'').trim();
      const fallback=suggestLocationLabel({address,region,area,country});
      return {
        name:customName||fallback||fd.get('title')||'Neue Location',
        country:country||null,
        region:region||null,
        area:area||null,
        category:fd.get('location_meta_category')||null,
        address:fd.get('location_meta_address')||fd.get('meeting_place')||null,
        maps_link:mapsLink,
        meeting_place:fd.get('location_meta_meeting_place')||fd.get('meeting_place')||null,
        meeting_maps_link:fd.get('meeting_link')||null,
        image_url:fd.get('location_meta_image_url')||fd.get('image_url')||null,
        description:fd.get('location_meta_description')||fd.get('subtitle')||null,
        tags:parseCsv(fd.get('location_meta_tags')),
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
      await enrichLocationMetaFromForm(form);
      syncLocationMetaFromShootingForm(form);
      const payload=locationPayloadFromShootingForm(form);
      if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;

      button.disabled=true;
      const oldText=button.textContent;
      button.textContent=existingLocationId?'Aktualisiere…':'Speichere…';

      try{
        let locationId=existingLocationId;

        if(!existingLocationId){
          const dup=findDuplicateLibraryLocation(payload);
          if(dup){
            locationId=dup.id;
            if(form.elements.location_id)form.elements.location_id.value=dup.id;
            const {error:updateError}=await db.from('shootings').update({location_id:dup.id,updated_at:new Date().toISOString()}).eq('id',id);
            if(updateError){showError('Location verknüpft, aber Shooting-Update fehlgeschlagen: '+formatError(updateError));return}
            await loadLocations();
            showToast(`Bestehende Location „${dup.name}“ verknüpft`);
            setFormBaseline(form);
            refreshFormDirtyState(form);
            return;
          }
        }

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

        const isDraft=form.dataset.draft==='true';
        if(isDraft){
          renderAll();
          const card=shootingsEl.querySelector(`[data-id="${id}"]`);
          if(card){card.open=true;card.scrollIntoView({behavior:'smooth',block:'center'})}
        }else{
          await loadShootings({skipConfirm:true,skipRestore:true});
          const card=shootingsEl.querySelector(`[data-id="${id}"]`);
          if(card){
            card.open=true;
            card.scrollIntoView({behavior:'smooth',block:'center'});
          }
        }
      }catch(error){
        console.error(error);
        showError('Location konnte nicht gespeichert werden: '+(error.message||error));
      }finally{
        button.disabled=false;
        button.textContent=oldText;
      }
    }

    window.findSimilarLibraryLocation=findSimilarLibraryLocation;
    window.bindImportLocationOffers=bindImportLocationOffers;


    function updateManualOverrideState(form){
      if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form);
    }

    window.updateManualOverrideState=updateManualOverrideState;
    window.bindMeetingCapture=bindMeetingCapture;
    window.syncShootingMeetingLibraryState=syncShootingMeetingLibraryState;
    window.saveMeetingToLibraryFromShooting=saveMeetingToLibraryFromShooting;
    window.MEETING_CAPTURE_HINT=MEETING_CAPTURE_HINT;

    
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

    function applyPickedLocationToForm(form,location){
      if(!form||!location)return;
      applyLibraryLocationToShootingForm(form,location);
      refreshLivePreview(form);
      refreshFormDirtyState(form);
      if(typeof refreshLocationFinderUI==='function')refreshLocationFinderUI(form);
      showToast('Location übernommen');
    }

