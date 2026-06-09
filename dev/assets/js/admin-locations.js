    function newLocationId(){return crypto.randomUUID()}
    function isValidLocationId(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}
    const LOCATION_OPTIONAL_DB_COLUMNS=['display_name','image_focus','meeting_maps_link'];
    const GEO_LABEL_TO_DE={
      germany:'Deutschland',austria:'Österreich',switzerland:'Schweiz',italy:'Italien',france:'Frankreich',
      bavaria:'Bayern',hesse:'Hessen','lower saxony':'Niedersachsen','mecklenburg-western pomerania':'Mecklenburg-Vorpommern',
      'north rhine-westphalia':'Nordrhein-Westfalen','rhineland-palatinate':'Rheinland-Pfalz',saxony:'Sachsen',
      'saxony-anhalt':'Sachsen-Anhalt',thuringia:'Thüringen',tyrol:'Tirol','upper austria':'Oberösterreich',
      'lower austria':'Niederösterreich',styria:'Steiermark',carinthia:'Kärnten',vienna:'Wien',grisons:'Graubünden',
      valais:'Wallis','trentino-alto adige':'Trentino-Südtirol','trentino-south tyrol':'Trentino-Südtirol',
      'south tyrol':'Südtirol',veneto:'Venetien',lombardy:'Lombardei',piedmont:'Piemont','aosta valley':'Aostatal',
      'friuli-venezia giulia':'Friaul-Julisch Venetien'
    };
    const NOMINATIM_FETCH_HEADERS={'Accept':'application/json','Accept-Language':'de,de-DE;q=0.9'};
    function normalizeGeoLabel(value){
      const raw=String(value||'').trim();
      if(!raw)return null;
      return GEO_LABEL_TO_DE[raw.toLowerCase()]||raw;
    }
    function normalizeAddressGeoLabels(address){
      const parts=String(address||'').split(',').map(part=>part.trim()).filter(Boolean);
      if(!parts.length)return trimOrNull(address);
      return parts.map(part=>normalizeGeoLabel(part)||part).join(', ')||null;
    }
    function normalizeLocationGeoFields(loc){
      const country=normalizeGeoLabel(loc?.country);
      const region=normalizeGeoLabel(loc?.region);
      const area=normalizeGeoLabel(loc?.area);
      const address=normalizeAddressGeoLabels(loc?.address);
      const changed=[['country',loc?.country,country],['region',loc?.region,region],['area',loc?.area,area],['address',loc?.address,address]]
        .some(([,before,after])=>String(before??'').trim()!==String(after??'').trim());
      return{country,region,area,address,_geoChanged:changed};
    }
    const LOCATION_IMAGE_FOCUS_CACHE_KEY='dolomiten.admin.locationImageFocus.v1';
    const LOCATION_DISPLAY_NAME_CACHE_KEY='dolomiten.admin.locationDisplayName.v1';
    let categoryDeleteInFlight=null;
    let categoryDeleteDialogResolve=null;

    function initCategoryDeleteDialog(){
      if(initCategoryDeleteDialog.bound)return;
      initCategoryDeleteDialog.bound=true;
      const dialog=$('categoryDeleteDialog');
      const cancelBtn=$('categoryDeleteCancel');
      const confirmBtn=$('categoryDeleteConfirm');
      if(!dialog||!cancelBtn||!confirmBtn)return;
      cancelBtn.addEventListener('click',()=>closeCategoryDeleteDialog(false));
      confirmBtn.addEventListener('click',()=>closeCategoryDeleteDialog(true));
      dialog.addEventListener('click',event=>{
        if(event.target===dialog)closeCategoryDeleteDialog(false);
      });
      document.addEventListener('keydown',event=>{
        if(event.key!=='Escape'||dialog.classList.contains('hidden'))return;
        event.preventDefault();
        closeCategoryDeleteDialog(false);
      });
    }

    function closeCategoryDeleteDialog(result=false){
      const dialog=$('categoryDeleteDialog');
      if(dialog){
        dialog.classList.add('hidden');
        dialog.setAttribute('aria-hidden','true');
      }
      const resolver=categoryDeleteDialogResolve;
      categoryDeleteDialogResolve=null;
      if(resolver)resolver(!!result);
    }

    function askCategoryDeleteConfirmation({title,message,confirmLabel,confirmDanger=true}){
      initCategoryDeleteDialog();
      return new Promise(resolve=>{
        const dialog=$('categoryDeleteDialog');
        const titleEl=$('categoryDeleteTitle');
        const bodyEl=$('categoryDeleteBody');
        const confirmBtn=$('categoryDeleteConfirm');
        if(!dialog||!titleEl||!bodyEl||!confirmBtn){
          resolve(window.confirm(`${title}\n\n${message}`));
          return;
        }
        if(categoryDeleteDialogResolve){
          resolve(false);
          return;
        }
        categoryDeleteDialogResolve=resolve;
        titleEl.textContent=title;
        bodyEl.textContent=message;
        confirmBtn.textContent=confirmLabel;
        confirmBtn.classList.toggle('danger',!!confirmDanger);
        confirmBtn.classList.toggle('primary',!confirmDanger);
        dialog.classList.remove('hidden');
        dialog.setAttribute('aria-hidden','false');
        $('categoryDeleteCancel')?.focus();
      });
    }

    function resetLocationDirtyTracking(){
      [...dirtyForms].forEach(key=>{
        if(isLocationDirtyKey(key))dirtyForms.delete(key);
      });
      updateUnsavedBar();
    }
    function readDisplayNameCache(){
      try{return JSON.parse(localStorage.getItem(LOCATION_DISPLAY_NAME_CACHE_KEY)||'{}')||{}}catch{return {}}
    }
    function writeDisplayNameCache(id,displayName){
      if(!id)return;
      try{
        const cache=readDisplayNameCache();
        const value=String(displayName||'').trim();
        if(!value)delete cache[id];
        else cache[id]=value;
        localStorage.setItem(LOCATION_DISPLAY_NAME_CACHE_KEY,JSON.stringify(cache));
      }catch{}
    }
    function resolveLocationDisplayName(loc){
      const fromDb=String(loc?.display_name||'').trim();
      if(fromDb)return fromDb;
      return String(readDisplayNameCache()[loc?.id]||'').trim();
    }
    const imageDimensionCache=new Map();
    const LOCATION_THUMB_CENTER_BLEND=0.38;
    const LOCATION_THUMB_ZOOM=1.22;
    function ensureImageDimensions(url){
      const src=String(url||'').trim();
      if(!src)return Promise.resolve(null);
      if(imageDimensionCache.has(src))return Promise.resolve(imageDimensionCache.get(src));
      return new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>{
          const dim={w:img.naturalWidth,h:img.naturalHeight};
          if(dim.w&&dim.h)imageDimensionCache.set(src,dim);
          resolve(dim.w&&dim.h?dim:null);
        };
        img.onerror=()=>resolve(null);
        img.src=src.replaceAll("'","%27");
      });
    }
    function focusBoundsForCover(cw,ch,iw,ih){
      if(!cw||!ch||!iw||!ih)return{minX:0,maxX:100,minY:0,maxY:100};
      const scale=Math.max(cw/iw,ch/ih);
      const dw=iw*scale;
      const dh=ih*scale;
      const minX=dw<=cw?50:(cw/2/dw)*100;
      const maxX=dw<=cw?50:100-minX;
      const minY=dh<=ch?50:(ch/2/dh)*100;
      const maxY=dh<=ch?50:100-minY;
      return{minX,maxX,minY,maxY};
    }
    function readImageFocusCache(){
      try{return JSON.parse(localStorage.getItem(LOCATION_IMAGE_FOCUS_CACHE_KEY)||'{}')||{}}catch{return {}}
    }
    function writeImageFocusCache(id,focus){
      if(!id)return;
      try{
        const cache=readImageFocusCache();
        const value=String(focus||'').trim();
        if(!value||value==='50% 50%')delete cache[id];
        else cache[id]=value;
        localStorage.setItem(LOCATION_IMAGE_FOCUS_CACHE_KEY,JSON.stringify(cache));
      }catch{}
    }
    function resolveLocationImageFocus(loc){
      const cached=String(readImageFocusCache()[loc?.id]||'').trim();
      const fromDb=String(loc?.image_focus||'').trim();
      if(cached&&cached!=='50% 50%'&&(!fromDb||fromDb==='50% 50%'))return cached;
      if(fromDb)return fromDb;
      return cached||'50% 50%';
    }
    function findLocationThumbForForm(form){
      const id=String(form?.dataset?.locationForm||'').trim();
      if(id){
        const scoped=locationsList?.querySelector(`[data-location-id="${id}"] .location-thumb`);
        if(scoped)return scoped;
      }
      return form?.closest('[data-location-id]')?.querySelector('.location-thumb')||null;
    }
    function clearLocationThumbStyles(thumb){
      if(!thumb)return;
      thumb.style.removeProperty('--thumb-image');
      thumb.style.removeProperty('--thumb-position');
      thumb.style.backgroundImage='';
      thumb.style.backgroundPosition='';
      thumb.style.backgroundSize='';
    }
    function applyLocationThumbEl(thumb,url,focus){
      if(!thumb)return;
      const src=String(url||'').trim();
      const pos=String(focus||'50% 50%').trim();
      if(src){
        const safe=src.replaceAll("'","%27");
        thumb.style.setProperty('--thumb-image',`url('${safe}')`);
        thumb.style.setProperty('--thumb-position',pos);
        thumb.style.backgroundImage=`url('${safe}')`;
        thumb.style.backgroundSize='cover';
        thumb.style.backgroundPosition=pos;
        thumb.style.backgroundRepeat='no-repeat';
      }else{
        clearLocationThumbStyles(thumb);
      }
    }
    function applyLocationThumbFromPreviewCrop(thumb,url,focus){
      if(!thumb)return;
      const src=String(url||'').trim();
      if(!src){
        clearLocationThumbStyles(thumb);
        return;
      }
      const pos=String(focus||'50% 50%').trim();
      const {x:fx,y:fy}=parseImageFocus(pos);
      const blend=LOCATION_THUMB_CENTER_BLEND;
      const aimFX=fx*(1-blend)+50*blend;
      const aimFY=fy*(1-blend)+50*blend;
      const aimPos=formatImageFocus(aimFX,aimFY);
      const safe=src.replaceAll("'","%27");
      const tw=thumb.clientWidth||58;
      const th=thumb.clientHeight||58;
      const dims=imageDimensionCache.get(src);
      thumb.style.setProperty('--thumb-image',`url('${safe}')`);
      thumb.style.backgroundImage=`url('${safe}')`;
      thumb.style.backgroundRepeat='no-repeat';
      if(dims?.w&&dims?.h&&tw&&th){
        const coverMin=Math.max(tw/dims.w,th/dims.h);
        const thumbScale=coverMin*LOCATION_THUMB_ZOOM;
        const bgW=dims.w*thumbScale;
        const bgH=dims.h*thumbScale;
        const offsetX=(tw-bgW)*(aimFX/100);
        const offsetY=(th-bgH)*(aimFY/100);
        thumb.style.backgroundSize=`${bgW}px ${bgH}px`;
        thumb.style.backgroundPosition=`${offsetX}px ${offsetY}px`;
        thumb.style.setProperty('--thumb-position',aimPos);
      }else{
        thumb.style.backgroundSize='cover';
        thumb.style.backgroundPosition=aimPos;
        thumb.style.setProperty('--thumb-position',aimPos);
      }
    }
    function refreshLocationSummaryThumb(form,focus){
      const thumb=findLocationThumbForForm(form);
      if(!thumb)return;
      const preview=form?.querySelector('[data-location-image-preview]');
      const url=String(form.elements.image_url?.value||'').trim();
      const pos=String(focus||preview?.dataset?.imageFocus||form.elements.image_focus?.value||'50% 50%').trim();
      const paint=()=>applyLocationThumbFromPreviewCrop(thumb,url,pos);
      if(url&&!imageDimensionCache.has(url)){
        ensureImageDimensions(url).then(paint);
      }else{
        paint();
      }
    }
    function reapplyAllLocationThumbs(){
      locationsList?.querySelectorAll('[data-location-id]').forEach(card=>{
        const id=String(card.dataset.locationId||'').trim();
        const loc=currentLocationsById[id];
        const thumb=card.querySelector('.location-thumb');
        if(!thumb||!loc)return;
        const form=card.querySelector('form[data-location-form]');
        if(form?.elements?.image_url){
          syncLocationImageFocusFromPreview(form);
          const url=String(form.elements.image_url.value||'').trim()||String(loc.image_url||'').trim();
          const pos=String(form.elements.image_focus?.value||'').trim()||resolveLocationImageFocus(loc);
          applyLocationThumbFromPreviewCrop(thumb,url,pos);
          return;
        }
        const url=String(loc.image_url||'').trim();
        const focus=resolveLocationImageFocus(loc);
        applyLocationThumbFromPreviewCrop(thumb,url,focus);
      });
    }
    window.resolveLocationImageFocus=resolveLocationImageFocus;
    function trimOrNull(value){
      const s=String(value??'').trim();
      return s||null;
    }
    function locationCorePayload(raw){
      const geo=normalizeLocationGeoFields(raw);
      return{
        name:String(raw.name||'').trim()||'Neue Location',
        country:trimOrNull(geo.country),
        region:trimOrNull(geo.region),
        area:trimOrNull(geo.area),
        category:trimOrNull(raw.category),
        address:trimOrNull(geo.address),
        maps_link:trimOrNull(raw.maps_link),
        meeting_place:trimOrNull(raw.meeting_place),
        image_url:trimOrNull(raw.image_url),
        display_name:trimOrNull(raw.display_name),
        description:trimOrNull(raw.description),
        tags:Array.isArray(raw.tags)?raw.tags:[],
        active:raw.active!==false,
        updated_at:raw.updated_at||new Date().toISOString()
      };
    }
    function locationOptionalExtras(raw){
      const extras={};
      const meetMaps=trimOrNull(raw.meeting_maps_link);
      if(meetMaps)extras.meeting_maps_link=meetMaps;
      if(trimOrNull(raw.image_url)){
        extras.image_focus=String(raw.image_focus||'').trim()||'50% 50%';
      }
      return extras;
    }
    function buildLocationSavePayload(raw){
      return{...locationCorePayload(raw),...locationOptionalExtras(raw)};
    }
    function isUnknownColumnError(error,column){
      if(!error)return false;
      const hay=formatError(error);
      return new RegExp(`['"]?${column}['"]?`,'i').test(hay)||(error.code==='PGRST204'&&hay.toLowerCase().includes(String(column).toLowerCase()));
    }
    function isDuplicateKeyError(error){
      if(!error)return false;
      return error.code==='23505'||/duplicate key/i.test(formatError(error));
    }
    async function persistLocationRecord({id,isDraft,rawPayload}){
      let attempt=buildLocationSavePayload(rawPayload);
      const stripped=[];
      for(let i=0;i<=LOCATION_OPTIONAL_DB_COLUMNS.length;i++){
        if(isDraft){
          let {error}=await db.from('locations').insert({...attempt,id}).select('id').maybeSingle();
          if(error&&isDuplicateKeyError(error)){
            ({error}=await db.from('locations').update(attempt).eq('id',id));
          }
          if(!error)return {id,strippedOptional:stripped};
          const col=LOCATION_OPTIONAL_DB_COLUMNS.find(k=>k in attempt&&isUnknownColumnError(error,k));
          if(!col)return {error};
          stripped.push(col);
          const {[col]:_,...rest}=attempt;
          attempt=rest;
          continue;
        }
        const {error}=await db.from('locations').update(attempt).eq('id',id);
        if(!error)return {id,strippedOptional:stripped};
        const col=LOCATION_OPTIONAL_DB_COLUMNS.find(k=>k in attempt&&isUnknownColumnError(error,k));
        if(!col)return {error};
        stripped.push(col);
        const {[col]:_,...rest}=attempt;
        attempt=rest;
      }
      return {error:{message:'Location konnte nach dem Entfernen optionaler Felder nicht gespeichert werden.'}};
    }
    function bumpOsmRequestId(holder,key){
      const id=(Number(holder[key])||0)+1;
      holder[key]=id;
      return id;
    }
    function locationDisplayName(loc){
      const custom=resolveLocationDisplayName(loc);
      if(custom)return custom;
      return String(loc?.name||'').trim();
    }
    function scrollLocationCardToTop(card){
      const isDraft=card?.dataset?.locationDraft==='true';
      const anchor=isDraft
        ?(card?.querySelector('[data-location-lib-name]')||card?.querySelector('.location-editor-form > .section-title')||card?.querySelector('.location-editor-form'))
        :(card?.querySelector('.location-summary')||card?.querySelector('.location-editor-form > .section-title')||card?.querySelector('.location-editor-form'));
      if(!anchor)return;
      const topBar=document.querySelector('.top');
      const topOffset=(topBar?Math.ceil(topBar.getBoundingClientRect().height):0)+8;
      const mobile=window.matchMedia('(max-width:740px)').matches;
      const targetY=anchor.getBoundingClientRect().top+window.scrollY-topOffset;
      window.scrollTo({top:Math.max(0,targetY),behavior:mobile?'auto':'smooth'});
    }
    function openNewLocationDraftCard(card){
      if(!card)return;
      const editor=card.querySelector(':scope>.location-editor');
      if(editor){
        editor.hidden=false;
        editor.removeAttribute('hidden');
      }
      const input=card.querySelector('[data-location-lib-name]');
      const mobile=window.matchMedia('(max-width:740px)').matches;
      const focusName=()=>{
        if(!input)return;
        scrollLocationCardToTop(card);
        if(mobile){
          setTimeout(()=>input.focus(),140);
        }else{
          setTimeout(()=>input.focus({preventScroll:true}),300);
        }
      };
      requestAnimationFrame(()=>requestAnimationFrame(focusName));
    }
    function dedupeOsmResults(results){
      const seen=new Set();
      return (results||[]).filter(item=>{
        const key=[item?.osm_type,item?.osm_id].filter(Boolean).join(':')||
          `${Number(item?.lat).toFixed(5)},${Number(item?.lon).toFixed(5)}:${String(item?.name||'').trim().toLowerCase()}`;
        if(seen.has(key))return false;
        seen.add(key);
        return true;
      });
    }
    function isHouseNumberOnly(value){
      return /^\d{1,4}[a-zA-Z]?(?:\/\d{1,4}[a-zA-Z]?)?$/.test(String(value||'').trim());
    }
    function isLikelyStreetPart(value){
      const s=String(value||'').trim();
      if(!s||s.length<2||isHouseNumberOnly(s)||/^\d{4,}$/.test(s))return false;
      return /^[A-Za-zÀ-ÿÄÖÜäöüß][A-Za-zÀ-ÿÄÖÜäöüß0-9.\- ']*$/i.test(s);
    }
    function parseStreetQuery(query){
      const q=String(query||'').trim();
      if(!q)return{street:'',houseNumber:''};
      const endMatch=q.match(/^(.+?)\s+(\d{1,4}[a-zA-Z]?(?:\/\d{1,4}[a-zA-Z]?)?)$/);
      if(endMatch&&!isHouseNumberOnly(endMatch[1])){
        return{street:endMatch[1].trim(),houseNumber:endMatch[2].trim()};
      }
      return{street:q,houseNumber:''};
    }
    function normalizeStreetToken(value){
      return String(value||'').toLowerCase().replace(/[^a-z0-9äöüß]/gi,'');
    }
    function streetsRoughlyMatch(a,b){
      const na=normalizeStreetToken(a);
      const nb=normalizeStreetToken(b);
      if(!na||!nb||na.length<3||nb.length<3)return false;
      return na===nb||na.includes(nb)||nb.includes(na);
    }
    function labelHasHouseNumber(label){
      return /\s\d{1,4}[a-zA-Z]?(?:\/\d{1,4}[a-zA-Z]?)?$/.test(String(label||'').trim());
    }
    function mergeSearchHouseNumber(baseName,hit,searchQuery=''){
      const base=String(baseName||'').trim();
      if(!base||labelHasHouseNumber(base))return base;
      const {street,houseNumber}=parseStreetQuery(searchQuery);
      if(!houseNumber)return base;
      const hitStreet=hit?.address?.road||hit?.name||base;
      if(streetsRoughlyMatch(street,hitStreet)||streetsRoughlyMatch(street,base)){
        return `${base} ${houseNumber}`;
      }
      return base;
    }
    function currentOsmSearchTerm(form){
      if(!form)return '';
      if(isLibraryLocationForm(form)){
        return String(form.querySelector('[data-location-lib-name]')?.value||'').trim();
      }
      const finderInput=form.querySelector('[data-location-finder-input]');
      return String(finderInput?.value||form.elements.location_name?.value||form.elements.meeting_place?.value||'').trim();
    }
    function osmOfficialName(hit,searchQuery=''){
      const displayAddr=String(hit?.display_name||'').trim();
      const fromStreet=extractStreetWithNumber(hit?.address||{},displayAddr);
      let base='';
      if(fromStreet&&!isWeakLocationLabel(fromStreet))base=fromStreet;
      else{
        const named=String(hit?.name||'').trim();
        if(named&&!isWeakLocationLabel(named))base=named;
        else{
          const fromDisplay=displayAddr.split(',')[0]?.trim()||'';
          if(fromDisplay&&!isWeakLocationLabel(fromDisplay))base=fromDisplay;
          else base=fromStreet||named||fromDisplay;
        }
      }
      return mergeSearchHouseNumber(base,hit,searchQuery);
    }
    function metaFromOsmHit(hit,searchQuery=''){
      const displayAddr=String(hit?.display_name||'').trim();
      const meta=mapAddressToMeta(hit?.address||{},displayAddr);
      meta.official_name=osmOfficialName(hit,searchQuery);
      if(meta.official_name){
        const addrParts=String(meta.address||'').split(',').map(part=>part.trim()).filter(Boolean);
        if(addrParts.length)addrParts[0]=meta.official_name;
        meta.address=addrParts.length?addrParts.join(', '):meta.official_name;
      }
      meta.display_name=displayAddr;
      return meta;
    }
    function parseCsv(value){if(Array.isArray(value))return value;return String(value||'').split(',').map(x=>x.trim()).filter(Boolean)}
    function csv(value){return Array.isArray(value)?value.join(', '):(value||'')}
    function locationMeta(l){
      const geo=[l.country,l.region,l.area].filter(Boolean).join(' · ');
      const category=String(l.category||'').trim();
      if(category&&geo)return `${category} · ${geo}`;
      return category||geo||'';
    }

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
      const needsTagWrite=!loc?.__draft&&loc?.id&&(hadSeasons||tagsChanged);
      const geo=normalizeLocationGeoFields(loc);
      const needsGeoWrite=!loc?.__draft&&loc?.id&&geo._geoChanged;
      const image_focus=resolveLocationImageFocus(loc);
      const display_name=resolveLocationDisplayName(loc)||null;
      return{...loc,tags,seasons:[],country:geo.country,region:geo.region,area:geo.area,address:geo.address,image_focus,display_name,_tagMigrationPending:needsTagWrite,_geoMigrationPending:needsGeoWrite};
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

    async function migrateLocationGeoIfNeeded(){
      const pending=locations.filter(l=>l._geoMigrationPending);
      if(!pending.length)return;
      let ok=0;
      for(const loc of pending){
        const {error}=await db.from('locations').update({
          country:trimOrNull(loc.country),
          region:trimOrNull(loc.region),
          area:trimOrNull(loc.area),
          address:trimOrNull(loc.address),
          updated_at:new Date().toISOString()
        }).eq('id',loc.id);
        if(error){console.error(error);continue}
        delete loc._geoMigrationPending;
        ok++;
      }
      if(ok)showToast(`Regionen/Länder für ${ok} Ort${ok===1?'':'e'} auf Deutsch vereinheitlicht`);
    }

    function locationIsActive(loc){return loc?.active!==false}

    function locationVisibleInPicker(loc,allowId=''){
      if(!loc)return false;
      if(locationIsActive(loc))return true;
      return !!allowId&&String(loc.id)===String(allowId);
    }

    function shootingsUsingLocationFromRows(id){
      return (rows||[]).filter(row=>String(row.location_id||'')===String(id));
    }

    function locationShootingUsageCount(locOrId){
      const id=typeof locOrId==='object'?locOrId?.id:locOrId;
      const loc=typeof locOrId==='object'?locOrId:currentLocationsById[id];
      const cached=Number(loc?.shooting_usage_count);
      if(Number.isFinite(cached)&&cached>0)return cached;
      return shootingsUsingLocationFromRows(id).length;
    }

    async function fetchShootingsUsingLocation(id){
      const {data,error}=await db.from('shootings').select('id,title,project_name,date_label').eq('location_id',id).order('date_label',{ascending:false});
      if(error)throw error;
      return data||[];
    }

    function formatShootingUsageList(shootings,max=5){
      if(!shootings?.length)return '';
      const lines=shootings.slice(0,max).map(s=>{
        const title=String(s.title||s.id||'Shooting').trim();
        const project=String(s.project_name||'').trim();
        return `• ${title}${project?` (${project})`:''}`;
      });
      const more=shootings.length>max?`… und ${shootings.length-max} weitere`:'';
      return [...lines,more].filter(Boolean).join('\n');
    }

    async function hydrateLocationShootingUsage(){
      const {data,error}=await db.from('shootings').select('location_id').not('location_id','is',null);
      if(error){console.error(error);return}
      const counts={};
      for(const row of data||[]){
        const id=String(row.location_id||'').trim();
        if(id)counts[id]=(counts[id]||0)+1;
      }
      locations=locations.map(loc=>({...loc,shooting_usage_count:counts[loc.id]||0}));
      currentLocationsById=Object.fromEntries(locations.map(l=>[l.id,l]));
    }

    const LOCATION_SORT_STORAGE_KEY='dolomiten.locations.sort.v1';
    const LOCATION_SORT_OPTIONS=[
      {id:'updated_desc',label:'Zuletzt bearbeitet'},
      {id:'created_desc',label:'Zuletzt angelegt'},
      {id:'name_asc',label:'Name A–Z'},
      {id:'name_desc',label:'Name Z–A'},
      {id:'last_used',label:'Zuletzt in Shooting verwendet'},
      {id:'usage',label:'Häufig verwendet'},
    ];

    function normalizeLocationSort(value){
      const allowed=LOCATION_SORT_OPTIONS.map(option=>option.id);
      return allowed.includes(value)?value:'updated_desc';
    }

    function readStoredLocationSort(){
      try{return normalizeLocationSort(localStorage.getItem(LOCATION_SORT_STORAGE_KEY))}catch{return 'updated_desc'}
    }

    function writeStoredLocationSort(value){
      try{localStorage.setItem(LOCATION_SORT_STORAGE_KEY,normalizeLocationSort(value))}catch{}
    }

    let locationSortKey=readStoredLocationSort();

    function locationSortName(loc){
      return String(loc?.display_name||loc?.name||'').trim();
    }

    function locationNameCompare(a,b,desc=false){
      const cmp=locationSortName(a).localeCompare(locationSortName(b),'de',{sensitivity:'base'});
      return desc?-cmp:cmp;
    }

    function compareLocations(a,b,sortKey=locationSortKey){
      const key=normalizeLocationSort(sortKey);
      let cmp=0;
      switch(key){
        case 'updated_desc':
          cmp=new Date(b.updated_at||0)-new Date(a.updated_at||0);
          break;
        case 'created_desc':
          cmp=new Date(b.created_at||0)-new Date(a.created_at||0);
          break;
        case 'name_asc':
          return locationNameCompare(a,b);
        case 'name_desc':
          return locationNameCompare(a,b,true);
        case 'last_used':{
          const aTime=a.last_used_at?new Date(a.last_used_at).getTime():0;
          const bTime=b.last_used_at?new Date(b.last_used_at).getTime():0;
          cmp=bTime-aTime;
          break;
        }
        case 'usage':{
          cmp=Number(b.usage_count||0)-Number(a.usage_count||0);
          break;
        }
        default:
          cmp=0;
      }
      if(cmp)return cmp;
      return locationNameCompare(a,b)||String(a.id||'').localeCompare(String(b.id||''));
    }

    const LOCATION_GROUP_STORAGE_KEY='dolomiten.locations.group.v1';
    const LOCATION_GROUP_OPEN_STORAGE_KEY='dolomiten.locations.groups.open.v1';
    const LOCATION_GROUP_EMPTY_SENTINEL='__none__';
    const LOCATION_GROUP_OPTIONS=[
      {id:'none',label:'Keine Gruppierung'},
      {id:'country',label:'Nach Land'},
      {id:'region',label:'Nach Region'},
      {id:'category',label:'Nach Kategorie'},
    ];

    function normalizeLocationGroup(value){
      const allowed=LOCATION_GROUP_OPTIONS.map(option=>option.id);
      return allowed.includes(value)?value:'none';
    }

    function readStoredLocationGroup(){
      try{return normalizeLocationGroup(localStorage.getItem(LOCATION_GROUP_STORAGE_KEY))}catch{return 'none'}
    }

    function writeStoredLocationGroup(value){
      try{localStorage.setItem(LOCATION_GROUP_STORAGE_KEY,normalizeLocationGroup(value))}catch{}
    }

    let locationGroupKey=readStoredLocationGroup();

    function readLocationGroupOpenState(){
      try{return JSON.parse(localStorage.getItem(LOCATION_GROUP_OPEN_STORAGE_KEY)||'{}')||{}}catch{return {}}
    }

    function writeLocationGroupOpenState(state){
      try{localStorage.setItem(LOCATION_GROUP_OPEN_STORAGE_KEY,JSON.stringify(state||{}))}catch{}
    }

    function isLocationGroupOpen(key){
      const state=readLocationGroupOpenState();
      if(state[key]===false)return false;
      return true;
    }

    function setLocationGroupOpen(key,open){
      const state=readLocationGroupOpenState();
      state[key]=!!open;
      writeLocationGroupOpenState(state);
    }

    function sortSavedLocations(items){
      const favorites=[...items.filter(loc=>loc.is_favorite)].sort(compareLocations);
      const others=[...items.filter(loc=>!loc.is_favorite)].sort(compareLocations);
      return [...favorites,...others];
    }

    function locationGroupMeta(loc,groupKey=locationGroupKey){
      const mode=normalizeLocationGroup(groupKey);
      if(mode==='country'){
        const value=String(loc.country||'').trim();
        return{
          key:value?`country:${value.toLowerCase()}`:`country:${LOCATION_GROUP_EMPTY_SENTINEL}`,
          label:value||'Ohne Land',
          isEmpty:!value,
        };
      }
      if(mode==='region'){
        const country=String(loc.country||'').trim();
        const region=String(loc.region||'').trim();
        if(!region){
          return{key:`region:${LOCATION_GROUP_EMPTY_SENTINEL}`,label:'Ohne Region',isEmpty:true};
        }
        return{
          key:`region:${country.toLowerCase()}|${region.toLowerCase()}`,
          label:country?`${region} · ${country}`:region,
          isEmpty:false,
        };
      }
      if(mode==='category'){
        const value=String(loc.category||'').trim();
        return{
          key:value?`category:${value.toLowerCase()}`:`category:${LOCATION_GROUP_EMPTY_SENTINEL}`,
          label:value||'Ohne Kategorie',
          isEmpty:!value,
        };
      }
      return null;
    }

    function groupedFilteredLocations(){
      const visible=filteredLocations();
      const drafts=visible.filter(loc=>loc.__draft);
      const saved=visible.filter(loc=>!loc.__draft);
      const mode=normalizeLocationGroup(locationGroupKey);
      if(mode==='none'){
        return{drafts,saved:sortSavedLocations(saved),groups:null};
      }
      const lookup=new Map();
      for(const loc of saved){
        const meta=locationGroupMeta(loc,mode);
        if(!lookup.has(meta.key)){
          lookup.set(meta.key,{key:meta.key,label:meta.label,isEmpty:meta.isEmpty,items:[]});
        }
        lookup.get(meta.key).items.push(loc);
      }
      const groups=[...lookup.values()]
        .sort((a,b)=>{
          if(a.isEmpty!==b.isEmpty)return a.isEmpty?1:-1;
          return a.label.localeCompare(b.label,'de',{sensitivity:'base'});
        })
        .map(group=>({...group,items:sortSavedLocations(group.items)}));
      return{drafts,groups,saved:null};
    }

    function renderLocationGroupSection(group){
      const count=group.items.length;
      const countLabel=`${count} Location${count===1?'':'s'}`;
      const open=isLocationGroupOpen(group.key);
      return `<details class="location-group-section" ${open?'open':''} data-location-group-key="${escapeHtml(group.key)}"><summary class="location-group-summary"><span class="location-group-title">${escapeHtml(group.label)}</span><span class="location-group-count">(${countLabel})</span><span class="location-group-chevron" aria-hidden="true"></span></summary><div class="location-group-items">${group.items.map(renderLocationEditor).join('')}</div></details>`;
    }

    function bindLocationGroupSections(){
      locationsList.querySelectorAll('details.location-group-section').forEach(section=>{
        section.addEventListener('toggle',event=>{
          if(event.target!==section)return;
          setLocationGroupOpen(section.dataset.locationGroupKey,section.open);
        });
      });
    }

    function locationListViewSuffix(){
      const sort=LOCATION_SORT_OPTIONS.find(option=>option.id===normalizeLocationSort(locationSortKey));
      const group=LOCATION_GROUP_OPTIONS.find(option=>option.id===normalizeLocationGroup(locationGroupKey));
      const parts=[];
      if(group&&group.id!=='none')parts.push(group.label);
      if(sort)parts.push(sort.label);
      return parts.join(' · ');
    }
    window.locationListViewSuffix=locationListViewSuffix;

    function syncLocationSortSelect(){
      if(!locationSortSelect)return;
      if(!locationSortSelect.options.length){
        locationSortSelect.innerHTML=LOCATION_SORT_OPTIONS.map(option=>`<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join('');
      }
      locationSortSelect.value=normalizeLocationSort(locationSortKey);
    }

    function setLocationSort(sortKey){
      if(!confirmUnsavedLocationRefresh())return;
      locationSortKey=normalizeLocationSort(sortKey);
      writeStoredLocationSort(locationSortKey);
      syncLocationSortSelect();
      renderLocations();
      if(typeof refreshAppStatus==='function')refreshAppStatus();
    }
    window.setLocationSort=setLocationSort;

    function syncLocationGroupSelect(){
      if(!locationGroupSelect)return;
      if(!locationGroupSelect.options.length){
        locationGroupSelect.innerHTML=LOCATION_GROUP_OPTIONS.map(option=>`<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join('');
      }
      locationGroupSelect.value=normalizeLocationGroup(locationGroupKey);
    }

    function setLocationGroup(groupKey){
      if(!confirmUnsavedLocationRefresh())return;
      locationGroupKey=normalizeLocationGroup(groupKey);
      writeStoredLocationGroup(locationGroupKey);
      syncLocationGroupSelect();
      renderLocations();
      if(typeof refreshAppStatus==='function')refreshAppStatus();
    }
    window.setLocationGroup=setLocationGroup;

    async function loadLocations(){
      const {data,error}=await db.from('locations').select('*').order('updated_at',{ascending:false});
      if(error){showError('Locations konnten nicht geladen werden: '+formatError(error));return}
      locations=(data||[]).map(normalizeLocationRecord);
      await migrateLocationTagsIfNeeded();
      await migrateLocationGeoIfNeeded();
      await hydrateLocationShootingUsage();
      renderLocationFilters();
      syncLocationSortSelect();
      syncLocationGroupSelect();
      renderLocations();
      if(currentView==='locations'&&typeof refreshAppStatus==='function')refreshAppStatus();
    }
    function renderLocationFilters(){const fill=(select,values,label)=>{const current=select.value;select.innerHTML=`<option value="all">${label}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current};fill(countryFilter,[...new Set(locations.map(l=>l.country).filter(Boolean))].sort(),'Alle Länder');fill(regionFilter,[...new Set(locations.map(l=>l.region).filter(Boolean))].sort(),'Alle Regionen');fill(categoryFilter,[...new Set(locations.map(l=>l.category).filter(Boolean))].sort(),'Alle Kategorien')}
    function syncLocationFavoritesFilterBtn(){
      if(!favoriteLocationsBtn)return;
      favoriteLocationsBtn.classList.toggle('primary',locationFavoritesOnly);
      favoriteLocationsBtn.setAttribute('aria-pressed',locationFavoritesOnly?'true':'false');
      favoriteLocationsBtn.innerHTML=`<span class="location-toolbar-fav-icon" aria-hidden="true">${renderFavoriteStarIcon(locationFavoritesOnly)}</span><span class="location-toolbar-fav-label">Favoriten</span>`;
    }
    function filteredLocations(){const search=locationSearchInput.value.trim().toLowerCase();return locations.filter(l=>{if(l.__draft)return true;const okCountry=countryFilter.value==='all'||l.country===countryFilter.value,okRegion=regionFilter.value==='all'||l.region===regionFilter.value,okCategory=categoryFilter.value==='all'||l.category===categoryFilter.value;const haystack=[l.name,l.display_name,l.country,l.region,l.area,l.category,l.address,l.meeting_place,l.description,...locationTagsForRecord(l)].filter(Boolean).join(' ').toLowerCase();const okFavorite=!locationFavoritesOnly||l.is_favorite;return okCountry&&okRegion&&okCategory&&okFavorite&&(!search||haystack.includes(search))})}
    function renderLocations(){
      const {drafts,groups,saved}=groupedFilteredLocations();
      let html='';
      if(drafts.length)html+=drafts.map(renderLocationEditor).join('');
      if(groups?.length)html+=groups.map(renderLocationGroupSection).join('');
      else if(saved?.length)html+=saved.map(renderLocationEditor).join('');
      locationsList.innerHTML=html||`<div class="card hint location-empty">Keine Location gefunden. Über <strong>+</strong> eine neue Location anlegen.</div>`;
      bindLocationEditors();
      bindLocationGroupSections();
      if(currentView==='locations'&&typeof refreshAppStatus==='function')refreshAppStatus();
    }
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
      const panel=form.querySelector('[data-location-pin-panel]');
      if(panel?.open)updateLocationPinMap(form,lat,lon);
    }

    const LOCATION_CAPTURE_HINT='Suchen, Maps-Link oder <strong>📍</strong>.';
    const LOCATION_NAME_PLACEHOLDER='Ort suchen oder Link einfügen';
    const MEETING_CAPTURE_HINT='Gleicher Ablauf wie oben — gilt nur für den <strong>Treffpunkt</strong>, die Location bleibt unverändert.';

    function isWeakLocationLabel(label){
      const s=String(label||'').trim();
      if(!s||s.length<2)return true;
      if(/^\d+[a-zA-Z]?$/.test(s))return true;
      if(/^(St|B|A|L|K)\s*\d{1,4}[a-zA-Z]?$/i.test(s))return true;
      if(/^(Staatsstraße|Bundesstraße|Autobahn|Landesstraße|Kreisstraße)\s*\d+/i.test(s))return true;
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
        if(form.elements.address)form.elements.address.value=meta?.address||address||form.elements.address.value;
        if(opts?.clearMapsName&&form.elements.name&&looksLikeMapsLink(form.elements.name.value))form.elements.name.value='';
        const official=String(meta?.official_name||'').trim();
        if(official&&(opts?.setOfficialName||opts?.forceWeakName||isWeakLocationLabel(form.elements.name?.value))){
          form.elements.name.value=official;
        }else if(!opts?.skipSuggestedName){
          applySuggestedLocationName(form,meta,{forceWeak:!!opts?.forceWeakName});
        }
        set('country',meta?.country);
        set('region',meta?.region);
        set('area',meta?.area);
        if(coords)setFormCaptureCoords(form,coords.lat,coords.lon);
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

    function cancelLocationImageSuggestion(form){
      if(!form)return;
      clearTimeout(form._imageSuggestTimer);
      form._imageSuggestTimer=null;
    }

    function markLocationImageManual(form){
      if(!form)return;
      const value=String(locationImageField(form)?.value||'').trim();
      if(!value)return;
      form.dataset.imageManual='true';
      delete form.dataset.imageSuggested;
      cancelLocationImageSuggestion(form);
    }

    function canAutoReplaceLocationImage(form){
      if(!form||form.dataset.imageManual==='true'||form.dataset.imageFromLibrary==='true')return false;
      const current=String(locationImageField(form)?.value||'').trim();
      if(!current)return true;
      if(form.dataset.imageSuggested!=='true')return false;
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
        meta.official_name=osmOfficialName({name:result.name,display_name:result.display_name,address:result.address});
        fillLocationFormFromMeta(form,meta,{lat,lon},{skipImageSuggest:true,forceWeakName:!!opts?.forceWeakName,clearMapsName:!!opts?.clearMapsName,setOfficialName:!!opts?.setOfficialName});
        maybeApplyOsmCategorySuggestion(form,result);
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
        setMapsStatus(form,'Treffpunkt erkannt','meeting');
        window.setTimeout(()=>setMapsStatus(form,'','meeting'),2200);
      }catch(error){
        console.error(error);
        setMapsStatus(form,'Treffpunkt konnte nicht erkannt werden','meeting');
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
        panel.innerHTML=`<div class="location-picker-section-title">Kartentreffer · Treffpunkt</div>${renderOsmFinderResults(results,q)}`;
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
        showToast('Treffpunkt aus Maps-Link übernommen');
        syncShootingMeetingLibraryState(form);
      }catch(error){
        console.error(error);
        showError('Maps-Link für Treffpunkt konnte nicht gelesen werden: '+(error.message||error));
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
      form.querySelectorAll('[data-meeting-lib-osm],[data-shooting-meeting-osm]').forEach(panel=>{
        if(panel.dataset.osmDelegated==='true')return;
        panel.dataset.osmDelegated='true';
        panel.addEventListener('click',async event=>{
          const btn=event.target.closest('[data-pick-osm]');
          if(!btn)return;
          const hit=form._meetingOsmResults?.[Number(btn.dataset.pickOsm)];
          if(hit)await applyOsmPickToMeetingForm(form,hit);
        });
      });
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
      setStatus('Treffpunkt wird in Location gespeichert…');
      let {error}=await db.from('locations').update(payload).eq('id',id);
      if(error&&/meeting_maps_link/i.test(formatError(error))){
        ({error}=await db.from('locations').update({meeting_place:payload.meeting_place,updated_at:payload.updated_at}).eq('id',id));
      }
      if(error){showError('Treffpunkt konnte nicht gespeichert werden: '+formatError(error));return}
      const loc=currentLocationsById[id];
      if(loc){
        loc.meeting_place=payload.meeting_place;
        if(payload.meeting_maps_link!=null)loc.meeting_maps_link=payload.meeting_maps_link;
      }
      form.dataset.libraryMeetingPlace=payload.meeting_place||'';
      form.dataset.libraryMeetingLink=payload.meeting_maps_link||'';
      syncShootingMeetingLibraryState(form);
      setStatus('');
      showToast('Treffpunkt in Location gespeichert');
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
        const results=dedupeOsmResults(await searchAddressNominatim(q));
        if(requestId!==form._libOsmRequest)return;
        form._libOsmResults=results;
        panel.innerHTML=`<div class="location-picker-section-title">Kartentreffer</div>${renderOsmFinderResults(results,q)}`;
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
      const osmPanel=form.querySelector('[data-location-lib-osm]');
      if(osmPanel&&!osmPanel.dataset.osmDelegated){
        osmPanel.dataset.osmDelegated='true';
        osmPanel.addEventListener('click',async event=>{
          const btn=event.target.closest('[data-pick-osm]');
          if(!btn)return;
          const hit=form._libOsmResults?.[Number(btn.dataset.pickOsm)];
          if(hit)await applyOsmPickToForm(form,hit);
        });
      }
      const nameInput=form.querySelector('[data-location-lib-name]');
      let osmTimer=null;
      nameInput?.addEventListener('input',()=>{
        const term=nameInput.value.trim();
        if(looksLikeMapsLink(term)){
          clearTimeout(osmTimer);
          osmTimer=setTimeout(()=>applyMapsLinkToLibraryForm(form,term),320);
          return;
        }
        clearTimeout(osmTimer);
        osmTimer=setTimeout(()=>refreshLibraryOsm(form,term),420);
      });
      const pinPanel=form.querySelector('[data-location-pin-panel]');
      if(pinPanel){
        pinPanel.open=false;
        pinPanel.classList.add('is-collapsed');
        pinPanel.addEventListener('toggle',()=>{
          pinPanel.classList.toggle('is-collapsed',!pinPanel.open);
          if(!pinPanel.open)return;
          const coords=parseCoordsFromForm(form)||extractCoordsFromMapsLink(form.elements.maps_link?.value||'');
          ensureLocationPinMap(form);
          if(coords)updateLocationPinMap(form,coords.lat,coords.lon);
          else{
            const api=locationPinMaps.get(form);
            if(api)setTimeout(()=>api.map.invalidateSize(),280);
          }
        });
      }
    }

    function renderLocationEditorForm(l){
      const coords=extractCoordsFromMapsLink(l.maps_link||'')||null;
      const lat=coords?.lat??'';
      const lon=coords?.lon??'';
      const officialName=l.name&&l.name!=='Neue Location'?l.name:'';
      const customDisplay=String(l.display_name||'').trim();
      const separateMeet=locationUsesSeparateMeeting(l);
      const meetCoords=extractCoordsFromMapsLink(l.meeting_maps_link||'')||null;
      const meetLat=meetCoords?.lat??'';
      const meetLon=meetCoords?.lon??'';
      const hasNotes=!!String(l.description||'').trim();
      const hasImage=!!String(l.image_url||'').trim();
      const imageVal=escapeHtml(l.image_url||'');
      return `<form data-location-form="${escapeHtml(l.id)}" ${l.__draft?'data-location-draft="true"':''} class="location-editor-form" novalidate>
        <div class="location-editor-head">${l.__draft?`<div class="dirty-badge location-form-dirty-badge">Entwurf</div>`:''}<div class="section-title">Ort erfassen</div></div>
        <div class="field full">
          <label>Name</label>
          <div class="location-capture-row">
            <input class="location-capture-name" name="name" type="text" value="${escapeHtml(officialName)}" placeholder="${LOCATION_NAME_PLACEHOLDER}" data-location-lib-name autocomplete="off" />
            <button type="button" class="btn location-gps-btn" data-capture-gps title="Aktuellen Standort übernehmen" aria-label="Aktuellen Standort">📍</button>
          </div>
          <input type="hidden" name="capture_lat" value="${lat}" data-capture-lat />
          <input type="hidden" name="capture_lon" value="${lon}" data-capture-lon />
          <div class="location-lib-osm address-search-panel hidden" data-location-lib-osm aria-live="polite"></div>
        </div>
        <div class="field full">
          <label>Anzeigename</label>
          <input name="display_name" type="text" value="${escapeHtml(customDisplay)}" placeholder="Eigener Name (optional)" />
        </div>
        <div class="field full"><label>Adresse</label><input name="address" type="text" value="${escapeHtml(l.address||'')}" /></div>
        <div class="field full"><label>Google Maps Link</label><input name="maps_link" type="text" inputmode="url" value="${escapeHtml(l.maps_link||'')}" /></div>
        <div class="field full"><label>Kategorie</label>${renderLocationCategoryPicker(l)}</div>
        <input type="hidden" name="active" value="${l.active===false?'false':'true'}" />
        <details class="editor-subpanel location-image-panel" ${hasImage?'open':''}>
          <summary class="editor-subpanel-summary"><strong>Bild</strong><span>optional</span></summary>
          <div class="editor-subpanel-body location-subpanel-fields">
            <div class="field full"><label>Bild URL</label><input name="image_url" type="text" inputmode="url" value="${imageVal}" placeholder="Direkte Bild-URL" /></div>
            <div class="location-image-stack">
              <input type="hidden" name="image_focus" value="${escapeHtml(l.image_focus||'50% 50%')}" data-image-focus-input />
              <div class="location-image-preview-wrap">
                <div class="image-preview image-preview-pannable" data-location-image-preview data-image-focus="${escapeHtml(l.image_focus||'50% 50%')}" style="--preview-image:${l.image_url?`url('${escapeHtml(l.image_url)}')`:''};--preview-position:${escapeHtml(l.image_focus||'50% 50%')};">${l.image_url?'Ziehen = Ausschnitt · Doppelklick = zentrieren':'Keine Bild-URL gesetzt'}</div>
                <div class="location-image-tools location-image-tools-overlay" aria-label="Bildwerkzeuge">
                  <button type="button" class="btn location-image-tool-btn" data-reset-image-focus title="Ausschnitt zentrieren" aria-label="Ausschnitt zentrieren">${typeof renderAdminIcon==='function'?renderAdminIcon('crosshair-center','location-image-tool-icon admin-icon'):''}</button>
                  <button type="button" class="btn location-image-tool-btn" data-clear-suggested-image title="Bild entfernen" aria-label="Bild entfernen">${typeof renderAdminIcon==='function'?renderAdminIcon('trash','location-image-tool-icon admin-icon'):''}</button>
                </div>
              </div>
            </div>
          </div>
        </details>
        <details class="editor-subpanel location-pin-panel is-collapsed" data-location-pin-panel>
          <summary class="editor-subpanel-summary"><strong>Spot auf Karte anpassen</strong><span>Pin verschieben</span></summary>
          <div class="editor-subpanel-body">
            <p class="hint-inline">Spot nur in der Nähe sichtbar? Pin auf die Position ziehen.</p>
            <div class="location-pin-map" data-location-pin-map></div>
          </div>
        </details>
        <details class="editor-subpanel" data-location-meeting-panel ${separateMeet?'open':''}>
          <summary class="editor-subpanel-summary">
            <strong>Abweichender Treffpunkt</strong>
            <span>optional</span>
          </summary>
          <div class="editor-subpanel-body location-subpanel-fields">
            <p class="hint editor-block-hint">${MEETING_CAPTURE_HINT}</p>
            <div class="field full">
              <label>Treffpunkt</label>
              <div class="location-capture-row">
                <input class="location-capture-name" name="meeting_place" type="text" value="${escapeHtml(l.meeting_place||'')}" placeholder="Treffpunkt suchen, Name oder Google-Maps-Link" data-meeting-lib-name />
                <button type="button" class="btn location-gps-btn" data-capture-gps-meeting title="Aktuellen Standort als Treffpunkt" aria-label="GPS Treffpunkt">📍</button>
              </div>
              <input type="hidden" name="meeting_capture_lat" value="${meetLat}" data-meeting-capture-lat />
              <input type="hidden" name="meeting_capture_lon" value="${meetLon}" data-meeting-capture-lon />
              <div class="location-lib-osm address-search-panel hidden" data-meeting-lib-osm aria-live="polite"></div>
            </div>
            <div class="field full"><label>Google Maps Link · Treffpunkt</label><input name="meeting_maps_link" type="text" inputmode="url" value="${escapeHtml(l.meeting_maps_link||'')}" placeholder="Eigener Maps-Link nur für den Treffpunkt" /></div>
          </div>
        </details>
        <div class="location-geo-manual hidden" data-location-geo-manual>
          <p class="hint editor-block-hint">Ohne GPS, Kartentreffer oder Maps-Link: <strong>Land</strong>, <strong>Region</strong> und <strong>Gebiet</strong> ergänzen (oder oben Adresse eintragen).</p>
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
        <div class="sticky-actions"><button class="btn" type="button" data-location-cancel="${escapeHtml(l.id)}">Abbrechen</button><button class="btn primary form-save-btn" type="submit">Location speichern</button></div>
        <div class="form-meta-row location-form-meta"><div class="save-state" data-save-state>${l.__draft?'Entwurf':'Gespeichert'}</div></div>
        ${renderLocationDangerZone(l)}
      </form>`;
    }

    function renderLocationDangerZone(l){
      if(l.__draft)return '';
      const usageCount=locationShootingUsageCount(l);
      const used=usageCount>0;
      const archived=l.active===false;
      let hint='';
      let buttons='';
      if(used){
        hint=`<p class="danger-zone-hint">In <strong>${usageCount}</strong> Shooting${usageCount===1?'':'s'} verknüpft — nur archivierbar, nicht löschbar. Bestehende Shootings behalten die Verknüpfung.</p>`;
        buttons=archived
          ?`<button class="btn" type="button" data-location-reactivate="${escapeHtml(l.id)}">Reaktivieren</button>`
          :`<button class="btn" type="button" data-location-archive="${escapeHtml(l.id)}">Archivieren</button>`;
      }else if(archived){
        hint='<p class="danger-zone-hint">Archiviert — erscheint nicht in der Shooting-Auswahl.</p>';
        buttons=`<button class="btn" type="button" data-location-reactivate="${escapeHtml(l.id)}">Reaktivieren</button><button class="btn danger" type="button" data-location-delete="${escapeHtml(l.id)}">Location löschen</button>`;
      }else{
        buttons=`<button class="btn danger" type="button" data-location-delete="${escapeHtml(l.id)}">Location löschen</button>`;
      }
      return `<div class="danger-zone">${hint}<div class="btnbar">${buttons}</div></div>`;
    }

    function renderLocationEditor(l){
      const isDraft=!!l.__draft;
      const titleName=locationDisplayName(l)||(isDraft?'Neue Location':'Ohne Namen');
      const archived=!isDraft&&l.active===false;
      const summary=isDraft?'':`<summary class="location-summary">
          <div class="location-thumb" data-location-thumb="${escapeHtml(l.id)}"></div>
          <div>
            <div class="location-title">${escapeHtml(titleName)}${archived?'<span class="location-title-separator">·</span><span class="location-archived-badge">Archiv</span>':''}${l.category?`<span class="location-title-category-group"><span class="location-title-separator">·</span><span class="location-title-category">${escapeHtml(l.category)}</span></span>`:''}</div>
            <div class="location-meta">${escapeHtml(locationMeta(l)||'Noch nicht kategorisiert')}</div>
            <div class="dirty-badge">Nicht gespeichert</div>
          </div>
          <div class="location-admin-actions"><button class="location-admin-star ${l.is_favorite?'active':''}" type="button" data-admin-toggle-favorite="${escapeHtml(l.id)}" title="Favorit" aria-label="Favorit">${renderFavoriteStarIcon(!!l.is_favorite)}</button></div>
        </summary>`;
      const cardShell=isDraft?'div':'details';
      const cardAttrs=isDraft
        ?`class="spot-card location-card location-card-draft" data-location-id="${escapeHtml(l.id)}" data-location-draft="true"`
        :`class="spot-card location-card" data-location-id="${escapeHtml(l.id)}"`;
      const editorHidden=isDraft?'':' hidden';
      return `<${cardShell} ${cardAttrs}>
        ${summary}
        <div class="location-editor"${editorHidden}>${renderLocationEditorForm(l)}</div>
      </${cardShell}>`;
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
        rebuildLocationTagPicker(form);
        if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
        return;
      }
      cancelLocationImageSuggestion(form);
      textarea.value=(tags.includes(tag)?tags.filter(x=>x!==tag):[...tags,tag]).join(', ');
      rebuildLocationTagPicker(form);
      if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
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
        cancelLocationImageSuggestion(form);
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

    function locationCategoryPresetsList(){
      return typeof locationCategoryPresets!=='undefined'?locationCategoryPresets:[];
    }

    function isLocationCategoryPreset(category){
      const key=String(category||'').trim().toLowerCase();
      return key!==''&&locationCategoryPresetsList().some(p=>String(p||'').trim().toLowerCase()===key);
    }

    function knownLocationCategories(){
      const presets=locationCategoryPresetsList();
      const fromLib=[...new Set(locations.map(l=>String(l.category||'').trim()).filter(Boolean))];
      return [...new Set([...presets,...fromLib])].sort((a,b)=>a.localeCompare(b,'de'));
    }

    function locationCategoryMatches(value,category){
      const left=String(value||'').trim().toLowerCase();
      const right=String(category||'').trim().toLowerCase();
      return left!==''&&left===right;
    }

    function locationRecordLabel(loc){
      return locationDisplayName(loc)||String(loc?.name||'').trim()||'(ohne Name)';
    }

    function syncLocationCategoryInMemory(form,category){
      const id=form?.dataset?.locationForm;
      if(!id)return;
      const value=String(category??form.elements.category?.value??'').trim();
      const loc=locations.find(item=>item.id===id);
      if(loc)loc.category=value||'';
      if(currentLocationsById[id])currentLocationsById[id].category=value||'';
    }

    function updateLocationSummaryCategory(form){
      const card=form?.closest('[data-location-id]');
      if(!card||card.dataset.locationDraft==='true')return;
      const category=String(form.elements.category?.value||'').trim();
      const title=card.querySelector('.location-title');
      if(title){
        title.querySelector('.location-title-category-group')?.remove();
        if(category){
          title.insertAdjacentHTML('beforeend',`<span class="location-title-category-group"><span class="location-title-separator">·</span><span class="location-title-category">${escapeHtml(category)}</span></span>`);
        }
      }
      const meta=card.querySelector('.location-meta');
      if(meta){
        const loc={
          category,
          country:form.elements.country?.value,
          region:form.elements.region?.value,
          area:form.elements.area?.value,
          address:form.elements.address?.value,
        };
        meta.textContent=locationMeta(loc)||'Noch nicht kategorisiert';
      }
      syncLocationCategoryInMemory(form,category);
    }

    function collectImmediateCategoryUsage(category){
      const cat=String(category||'').trim();
      if(!cat)return [];
      const seen=new Set();
      const names=[];

      function bump(id,label){
        const key=id?`id:${id}`:`name:${String(label||'').trim().toLowerCase()}`;
        if(seen.has(key))return;
        seen.add(key);
        names.push(String(label||'').trim()||'(ohne Name)');
      }

      locations.forEach(loc=>{
        if(loc.__draft||!locationCategoryMatches(loc.category,cat))return;
        bump(loc.id,locationRecordLabel(loc));
      });

      locationsList?.querySelectorAll('form[data-location-form]').forEach(form=>{
        if(form.dataset.locationDraft==='true')return;
        const value=String(form.elements.category?.value||'').trim();
        if(!locationCategoryMatches(value,cat))return;
        bump(form.dataset.locationForm,form.elements.display_name?.value||form.elements.name?.value);
      });

      locationsList?.querySelectorAll('[data-location-id]:not([data-location-draft="true"])').forEach(card=>{
        const titleCategory=card.querySelector('.location-title-category');
        if(titleCategory&&locationCategoryMatches(titleCategory.textContent,cat)){
          bump(card.dataset.locationId,String(card.querySelector('.location-title')?.textContent||'').split('·')[0].trim());
          return;
        }
        const meta=String(card.querySelector('.location-meta')?.textContent||'').trim();
        const metaKey=cat.toLowerCase();
        if(meta.toLowerCase()===metaKey||meta.toLowerCase().startsWith(`${metaKey} ·`)){
          bump(card.dataset.locationId,String(card.querySelector('.location-title')?.textContent||'').split('·')[0].trim());
        }
      });

      return names;
    }

    async function collectCategoryUsageFromDb(category){
      const cat=String(category||'').trim();
      if(!cat)return {total:0,names:[]};
      if(!db)throw new Error('Keine Datenbankverbindung — Kategorie-Verwendung kann nicht geprüft werden.');
      const seenIds=new Set();
      const names=[];

      function bump(id,label){
        if(id&&seenIds.has(id))return;
        if(id)seenIds.add(id);
        names.push(String(label||'').trim()||'(ohne Name)');
      }

      const {data,error}=await db.from('locations').select('id,category,name,display_name');
      if(error)throw error;
      (data||[]).forEach(row=>{
        if(!locationCategoryMatches(row.category,cat))return;
        bump(row.id,row.display_name||row.name);
      });

      return {total:names.length,names};
    }

    async function collectCategoryUsage(category){
      const immediate=collectImmediateCategoryUsage(category);
      const dbUsage=await collectCategoryUsageFromDb(category);
      const names=[...new Set([...immediate,...dbUsage.names])];
      return {total:names.length,names};
    }

    async function countCategoryUsage(category){
      const {total}=await collectCategoryUsage(category);
      return total;
    }

    function rebuildAllLocationCategoryPickers(){
      locationsList?.querySelectorAll('form[data-location-form]').forEach(form=>rebuildLocationCategoryPicker(form));
    }

    async function deleteLocationCategoryFromPicker(category){
      const cat=String(category||'').trim();
      if(!cat)return false;
      if(categoryDeleteInFlight){
        showToast('Kategorie-Löschung läuft bereits…');
        return false;
      }
      categoryDeleteInFlight=cat;
      try{
        const immediateNames=collectImmediateCategoryUsage(cat);
        let dbNames=[];
        try{
          const dbUsage=await collectCategoryUsageFromDb(cat);
          dbNames=dbUsage.names;
        }catch(error){
          console.error(error);
          if(!immediateNames.length){
            showError('Kategorie-Verwendung konnte nicht aus der Datenbank gelesen werden: '+formatError(error));
            return false;
          }
        }
        const effectiveNames=[...new Set([...immediateNames,...dbNames])];
        const effectiveTotal=effectiveNames.length;
        const examples=effectiveNames.slice(0,4).join(', ');
        const more=effectiveNames.length>4?` (+${effectiveNames.length-4} weitere)`: '';
        if(effectiveTotal===0&&isLocationCategoryPreset(cat)){
          alert(`Kategorie „${cat}“ ist eine Voreinstellung und derzeit bei keiner Location vergeben.\n\nEs gibt nichts zu löschen.`);
          return false;
        }
        if(effectiveTotal>0){
          const ok=await askCategoryDeleteConfirmation({
            title:'Kategorie wirklich überall entfernen?',
            message:`„${cat}“ ist bei ${effectiveTotal} Location(s) vergeben${examples?`: ${examples}${more}`:''}.\n\nDie Kategorie wird bei allen betroffenen Locations in der Datenbank entfernt. Abbrechen lässt alles unverändert.`,
            confirmLabel:`Bei ${effectiveTotal} Location(s) entfernen`,
            confirmDanger:true,
          });
          if(!ok)return false;
          await removeLocationCategoryGlobally(cat);
          resetLocationDirtyTracking();
          await loadLocations();
          showToast(`Kategorie „${cat}“ bei ${effectiveTotal} Location(s) in der Datenbank entfernt`);
          return true;
        }
        const ok=await askCategoryDeleteConfirmation({
          title:'Kategorie nur aus Entwürfen entfernen?',
          message:`„${cat}“ ist bei keiner gespeicherten Location vergeben.\n\nNur aus offenen Entwürfen entfernen?`,
          confirmLabel:'Aus Entwürfen entfernen',
          confirmDanger:false,
        });
        if(!ok)return false;
        locationsList?.querySelectorAll('form[data-location-form][data-location-draft="true"]').forEach(form=>{
          if(!locationCategoryMatches(form.elements.category?.value,cat))return;
          form.elements.category.value='';
          delete form.dataset.categorySuggested;
          rebuildLocationCategoryPicker(form);
        });
        showToast(`Kategorie „${cat}“ nur aus Entwürfen entfernt`);
        return true;
      }catch(error){
        showError('Kategorie konnte nicht gelöscht werden: '+formatError(error));
        return false;
      }finally{
        categoryDeleteInFlight=null;
      }
    }

    function renderLocationCategoryPickerMarkup(activeCategory='',suggested=''){
      const active=String(activeCategory||'').trim();
      const known=[...new Set([...knownLocationCategories(),...(active?[active]:[])])];
      return `<div class="location-category-tools"><div class="badge-picker location-category-picker">${known.map(c=>{
        const on=active===c;
        const isSuggested=on&&suggested&&suggested===c;
        return `<button type="button" class="badge-chip ${on?'active':''} ${isSuggested?'is-suggested':''}" data-location-category="${escapeHtml(c)}">${escapeHtml(c)}<span class="badge-chip-remove" data-remove-location-category>x</span></button>`;
      }).join('')}<button type="button" class="badge-chip add-badge" data-add-location-category aria-label="Eigene Kategorie">+</button></div><input type="hidden" name="category" value="${escapeHtml(active)}" /></div>`;
    }

    function renderLocationCategoryPicker(loc){
      return renderLocationCategoryPickerMarkup(loc?.category||'');
    }

    async function handleRemoveLocationCategoryChip(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const chip=e.currentTarget.closest('[data-location-category]');
      const form=chip?.closest('form');
      const cat=chip?.dataset.locationCategory;
      if(!cat||!form)return;
      const deleted=await deleteLocationCategoryFromPicker(cat);
      if(deleted&&form.dataset.locationDraft==='true'&&typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
    }

    function bindLocationCategoryPicker(form){
      const tools=form?.querySelector('.location-category-tools');
      if(!tools)return;
      tools.querySelectorAll('[data-remove-location-category]').forEach(btn=>{
        btn.addEventListener('click',handleRemoveLocationCategoryChip,{capture:true});
      });
      tools.querySelectorAll('[data-location-category]').forEach(b=>b.addEventListener('click',toggleLocationCategory));
      const addBtn=tools.querySelector('[data-add-location-category]');
      if(addBtn){
        addBtn.addEventListener('mousedown',e=>e.preventDefault());
        addBtn.addEventListener('click',addCustomLocationCategory);
      }
    }

    function rebuildLocationCategoryPicker(form){
      const tools=form?.querySelector('.location-category-tools');
      if(!tools||!form.elements.category)return;
      const active=String(form.elements.category.value||'').trim();
      const suggested=String(form.dataset.categorySuggested||'').trim();
      tools.outerHTML=renderLocationCategoryPickerMarkup(active,suggested);
      bindLocationCategoryPicker(form);
    }

    function setLocationCategoryOnForm(form,category,{suggested=false,clearSuggested=false}={}){
      if(!form?.elements?.category)return;
      cancelLocationImageSuggestion(form);
      const value=String(category||'').trim();
      form.elements.category.value=value;
      if(clearSuggested)delete form.dataset.categorySuggested;
      else if(suggested&&value)form.dataset.categorySuggested=value;
      else if(!suggested)delete form.dataset.categorySuggested;
      rebuildLocationCategoryPicker(form);
      updateLocationSummaryCategory(form);
    }

    async function toggleLocationCategory(e){
      if(e.target.closest('[data-remove-location-category]'))return;
      const chip=e.currentTarget,form=chip.closest('form'),input=form?.elements?.category;
      if(!input)return;
      const cat=chip.dataset.locationCategory;
      const current=String(input.value||'').trim();
      cancelLocationImageSuggestion(form);
      input.value=current===cat?'':cat;
      delete form.dataset.categorySuggested;
      rebuildLocationCategoryPicker(form);
      updateLocationSummaryCategory(form);
      if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
    }

    function makeAddLocationCategoryButton(){
      const button=document.createElement('button');
      button.type='button';
      button.className='badge-chip add-badge';
      button.dataset.addLocationCategory='';
      button.setAttribute('aria-label','Eigene Kategorie');
      button.textContent='+';
      button.addEventListener('mousedown',e=>e.preventDefault());
      button.addEventListener('click',addCustomLocationCategory);
      return button;
    }

    function commitInlineLocationCategory(input){
      const form=input.closest('form'),value=String(input.value||'').trim(),wrap=input.closest('.badge-inline');
      if(input.dataset.committed==='true')return;
      input.dataset.committed='true';
      if(!wrap)return;
      if(value)setLocationCategoryOnForm(form,value);
      wrap.replaceWith(makeAddLocationCategoryButton());
      if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
    }

    function addCustomLocationCategory(e){
      const addButton=e.currentTarget,input=document.createElement('input');
      input.className='badge-inline-input';input.type='text';input.placeholder='Kategorie';
      const wrap=document.createElement('span');
      wrap.className='badge-inline badge-chip';wrap.append(input);
      addButton.replaceWith(wrap);
      input.focus();
      input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitInlineLocationCategory(input)}if(event.key==='Escape')wrap.replaceWith(makeAddLocationCategoryButton())});
      input.addEventListener('blur',()=>commitInlineLocationCategory(input));
    }

    function suggestCategoryFromOsm(osmHit={}){
      const type=String(osmHit.type||'').toLowerCase();
      const klass=String(osmHit.class||'').toLowerCase();
      const category=String(osmHit.category||'').toLowerCase();
      const name=String(osmHit.name||osmHit.display_name||'').toLowerCase();
      const extra=osmHit.extratags||{};
      const extraBits=[...Object.entries(extra).map(([k,v])=>`${k}=${v}`),...Object.values(osmHit.address||{})].join(' ').toLowerCase();
      const hay=`${type} ${klass} ${category} ${name} ${extraBits}`;

      if(/water=lake|natural=water|reservoir|\blake\b|\blago\b|\blac\b|\bsee\b|stausee|speicher|teich|weiher/.test(hay)||type==='lake'||type==='reservoir'||type==='water')return 'See';
      if(/natural=peak|mountain_pass|mountain_range|\bpeak\b|\bpass\b|berg|spitze|joch|gipfel|alm\b|dolomit/.test(hay)||type==='peak'||type==='pass')return /dolomit|dolomiti|südtirol|south.?tyrol/.test(hay)?'Dolomiten':'Berge';
      if(/tourism=viewpoint|viewpoint|aussicht/.test(hay)||type==='viewpoint')return 'Aussichtspunkt';
      if(/mountain_pass|passstraße|highway=.*pass/.test(hay))return 'Passstraße';
      if(/natural=wood|natural=forest|landuse=forest|\bforest\b|\bwald\b/.test(hay))return 'Wald';
      if(/natural=grassland|landuse=meadow|meadow|\bwiese\b/.test(hay))return 'Wiese';
      if(/tourism=hotel|building=hotel|amenity=hotel|\bhotel\b/.test(hay))return 'Hotel';
      if(/place=city|place=town|\bstadt\b/.test(hay))return 'Stadt';
      if(/place=village|hamlet|\bdorf\b/.test(hay))return 'Dorf';
      if(/historic=|altstadt|old town/.test(hay))return 'Altstadt';
      if(/museum|gallery|studio|indoor/.test(hay))return 'Indoor';
      if(/highway=|route=/.test(hay)&&/road|straße/.test(hay))return 'Roadtrip';
      return null;
    }

    function applySuggestedCategoryToForm(form,category){
      if(!form||!category||!isLibraryLocationForm(form))return false;
      const current=String(form.elements.category?.value||'').trim();
      if(current)return false;
      setLocationCategoryOnForm(form,category,{suggested:true});
      showToast(`Kategorie-Vorschlag: ${category}`);
      if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
      return true;
    }

    function maybeApplyOsmCategorySuggestion(form,osmHit){
      if(!form||!isLibraryLocationForm(form))return;
      const suggested=suggestCategoryFromOsm(osmHit);
      if(suggested)applySuggestedCategoryToForm(form,suggested);
    }

    function bindLocationEditors(){
      locationsList.querySelectorAll('form[data-location-form]').forEach(form=>{
        setFormBaseline(form);
        if(form.dataset.locationDraft==='true')setFormDirty(form,true);
        else if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
        form.addEventListener('submit',saveLocationForm);
        const syncLocationFormState=()=>{
          refreshLocationImagePreview(form);
          syncLocationGeoFieldsVisibility(form);
          refreshFormDirtyState(form);
        };
        form.addEventListener('input',syncLocationFormState);
        form.addEventListener('change',syncLocationFormState);
        form.elements.region?.addEventListener('input',()=>syncLocationGeoFieldsVisibility(form));
        form.elements.area?.addEventListener('input',()=>syncLocationGeoFieldsVisibility(form));
        bindLocationLibraryCapture(form);
        bindLocationMeetingCapture(form);
        bindLocationImageField(form);
        bindLocationImagePan(form);
        refreshLocationImagePreview(form);
        if(form.dataset.placeAnchorRev==null)form.dataset.placeAnchorRev='0';
        if(form.dataset.imageSuggestRev==null)form.dataset.imageSuggestRev='0';
        bindLocationCategoryPicker(form);
        syncLocationGeoFieldsVisibility(form);
      });
      locationsList.querySelectorAll('[data-location-tag]').forEach(b=>b.addEventListener('click',toggleLocationTag));
      locationsList.querySelectorAll('[data-add-location-tag]').forEach(b=>b.addEventListener('click',addCustomLocationTag));
      locationsList.querySelectorAll('[data-detect-location-from-maps]').forEach(b=>b.addEventListener('click',detectLocationFromMaps));
      locationsList.querySelectorAll('[data-location-delete]').forEach(b=>b.addEventListener('click',deleteLocation));
      locationsList.querySelectorAll('[data-location-archive]').forEach(b=>b.addEventListener('click',archiveLocation));
      locationsList.querySelectorAll('[data-location-reactivate]').forEach(b=>b.addEventListener('click',reactivateLocation));
      locationsList.querySelectorAll('[data-location-cancel]').forEach(b=>b.addEventListener('click',cancelLocationEdit));
      locationsList.querySelectorAll('[data-admin-toggle-favorite]').forEach(b=>b.addEventListener('click',toggleLocationFavoriteFromAdmin));
      locationsList.querySelectorAll('.location-card-draft').forEach(card=>{
        const editor=card.querySelector(':scope>.location-editor');
        if(editor){
          editor.hidden=false;
          editor.removeAttribute('hidden');
        }
      });
      locationsList.querySelectorAll('details.location-card').forEach(card=>{
        const editor=card.querySelector(':scope>.location-editor');
        if(editor)editor.hidden=!card.open;
        if(card.dataset.thumbToggleBound==='true')return;
        card.dataset.thumbToggleBound='true';
        card.addEventListener('toggle',()=>{
          if(editor)editor.hidden=!card.open;
          if(!card.open)return;
          requestAnimationFrame(()=>reapplyAllLocationThumbs());
        });
      });
      reapplyAllLocationThumbs();
    }

    function syncLocationImageFocusFromPreview(form){
      const preview=form?.querySelector('[data-location-image-preview]');
      const focusInput=form?.elements?.image_focus;
      if(!preview||!focusInput)return;
      const fromInput=String(focusInput.value||'').trim();
      const fromPreview=String(preview.dataset.imageFocus||'').trim();
      const focus=fromPreview||fromInput||'50% 50%';
      focusInput.value=focus;
      if(fromPreview&&fromPreview!==fromInput)applyImageFocusToPreview(preview,focus);
    }

    function collectLocationPayload(form){
      syncLocationImageFocusFromPreview(form);
      const d=new FormData(form);
      const address=String(d.get('address')||'').trim();
      let meeting=String(d.get('meeting_place')||'').trim();
      if(!meeting)meeting=address||null;
      else meeting=meeting||null;
      const customName=String(d.get('name')||'').trim();
      const displayName=String(d.get('display_name')||'').trim();
      const region=String(d.get('region')||'').trim();
      const area=String(d.get('area')||'').trim();
      const country=String(d.get('country')||'').trim();
      const fallback=suggestLocationLabel({address,region,area,country});
      return{
        name:customName||fallback||'Neue Location',
        display_name:displayName||null,
        country:country||null,
        region:region||null,
        area:area||null,
        category:d.get('category')||null,
        address:address||null,
        maps_link:d.get('maps_link')||null,
        meeting_place:meeting,
        meeting_maps_link:String(d.get('meeting_maps_link')||'').trim()||null,
        image_url:d.get('image_url')||null,
        image_focus:String(form.elements.image_focus?.value||d.get('image_focus')||'').trim()||'50% 50%',
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
      let focus=String(form.elements.image_focus?.value||'').trim()||String(p.dataset.imageFocus||'').trim()||'50% 50%';
      const urlChanged=!!form.dataset.lastPreviewImageUrl&&form.dataset.lastPreviewImageUrl!==url;
      if(urlChanged){
        focus='50% 50%';
        if(form.elements.image_focus)form.elements.image_focus.value=focus;
      }
      setImagePreviewState(p,url,focus);
      if(form.elements.image_focus)form.elements.image_focus.value=String(p.dataset.imageFocus||focus).trim()||focus;
      if(url)ensureImageDimensions(url);
      refreshLocationSummaryThumb(form,form.elements.image_focus?.value||focus);
      form.dataset.lastPreviewImageUrl=url||'';
    }

    function bindLocationImagePan(form){
      const preview=form?.querySelector('[data-location-image-preview]');
      const focusInput=form?.elements?.image_focus;
      if(!preview||preview.dataset.panBound==='true')return;
      preview.dataset.panBound='true';
      preview.style.touchAction='none';
      const preloadUrl=String(form.elements.image_url?.value||'').trim();
      if(preloadUrl)ensureImageDimensions(preloadUrl);

      const readFocus=()=>parseImageFocus(focusInput?.value||preview.dataset.imageFocus||'50% 50%');
      const writeFocus=(x,y,bounds)=>{
        let fx=x,fy=y;
        if(bounds){
          fx=Math.max(bounds.minX,Math.min(bounds.maxX,x));
          fy=Math.max(bounds.minY,Math.min(bounds.maxY,y));
        }else{
          fx=Math.max(0,Math.min(100,x));
          fy=Math.max(0,Math.min(100,y));
        }
        const pos=formatImageFocus(fx,fy);
        if(focusInput)focusInput.value=pos;
        applyImageFocusToPreview(preview,pos);
        refreshLocationSummaryThumb(form,pos);
        writeImageFocusCache(form.dataset.locationForm,pos);
        if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
      };

      let dragging=false,startX=0,startY=0,startFx=50,startFy=50;

      const onPointerDown=e=>{
        if(!preview.classList.contains('is-pannable'))return;
        if(e.button!==0)return;
        dragging=true;
        preview.setPointerCapture(e.pointerId);
        startX=e.clientX;
        startY=e.clientY;
        const f=readFocus();
        startFx=f.x;
        startFy=f.y;
        preview.classList.add('is-panning');
      };
      const onPointerMove=e=>{
        if(!dragging)return;
        const rect=preview.getBoundingClientRect();
        if(!rect.width||!rect.height)return;
        const dx=e.clientX-startX;
        const dy=e.clientY-startY;
        const url=String(form.elements.image_url?.value||'').trim();
        const dims=url?imageDimensionCache.get(url):null;
        if(dims){
          const scale=Math.max(rect.width/dims.w,rect.height/dims.h);
          const dw=dims.w*scale;
          const dh=dims.h*scale;
          const bounds=focusBoundsForCover(rect.width,rect.height,dims.w,dims.h);
          writeFocus(startFx-(dx/dw)*100,startFy-(dy/dh)*100,bounds);
        }else{
          writeFocus(startFx-(dx/rect.width)*100,startFy-(dy/rect.height)*100);
        }
        e.preventDefault();
      };
      const endPan=e=>{
        if(!dragging)return;
        dragging=false;
        preview.classList.remove('is-panning');
        try{preview.releasePointerCapture(e.pointerId)}catch{}
      };

      preview.addEventListener('pointerdown',onPointerDown);
      preview.addEventListener('pointermove',onPointerMove);
      preview.addEventListener('pointerup',endPan);
      preview.addEventListener('pointercancel',endPan);
      preview.addEventListener('lostpointercapture',()=>{
        dragging=false;
        preview.classList.remove('is-panning');
      });
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
      if(isDraft&&!isValidLocationId(id)){
        id=newLocationId();
        form.dataset.locationForm=id;
      }
      if(!(await ensureLocationGeoReady(form)))return;
      const payload=collectLocationPayload(form);
      if(!validateImageBeforeSave(payload.image_url,'Bild URL'))return;
      setStatus(isDraft?'Erstelle Location…':'Speichere Location…');
      const result=await persistLocationRecord({id,isDraft,rawPayload:payload});
      if(result.error){
        showError('Location konnte nicht gespeichert werden: '+formatError(result.error));
        setStatus('Fehler beim Speichern');
        return;
      }
      const stripped=result.strippedOptional||[];
      writeDisplayNameCache(id,payload.display_name);
      if(payload.image_url&&payload.image_focus){
        writeImageFocusCache(id,payload.image_focus);
      }else{
        writeImageFocusCache(id,null);
      }
      if(stripped.includes('display_name')){
        showError('Anzeigename konnte nicht in Supabase gespeichert werden — Spalte display_name fehlt. Bitte Migration docs/migrations/add_location_display_name.sql ausführen. Der Name wurde lokal gemerkt und bleibt in diesem Browser sichtbar.');
        showToast('Location gespeichert (Anzeigename nur lokal)');
      }else if(stripped.includes('image_focus')){
        showToast('Gespeichert — Bildauschnitt lokal gemerkt. Für dauerhafte Speicherung Migration add_location_image_focus.sql in Supabase ausführen.');
      }else if(stripped.length){
        showToast('Gespeichert — fehlende DB-Spalten: '+stripped.join(', '));
      }else{
        showToast(isDraft?'Location erstellt':'Location gespeichert');
      }
      setFormBaseline(form);
      setFormDirty(form,false);
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

    async function removeLocationCategoryGlobally(category){
      const cat=String(category||'').trim();
      const now=new Date().toISOString();
      const idsToClear=new Set();
      locations.forEach(loc=>{
        if(!locationCategoryMatches(loc.category,cat))return;
        loc.category='';
        loc.updated_at=now;
        if(loc.id){
          currentLocationsById[loc.id]=loc;
          idsToClear.add(loc.id);
        }
      });
      const {data,error}=await db.from('locations').select('id,category');
      if(error)throw error;
      (data||[]).forEach(row=>{
        if(!locationCategoryMatches(row.category,cat)||!row.id)return;
        idsToClear.add(row.id);
      });
      for(const id of idsToClear){
        const {error:updateError}=await db.from('locations').update({category:'',updated_at:now}).eq('id',id);
        if(updateError)throw updateError;
      }
      locationsList.querySelectorAll('form[data-location-form]').forEach(form=>{
        if(!locationCategoryMatches(form.elements.category?.value,cat))return;
        form.elements.category.value='';
        delete form.dataset.categorySuggested;
        rebuildLocationCategoryPicker(form);
        updateLocationSummaryCategory(form);
        if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
      });
      renderLocationFilters();
    }

    async function createNewLocation(){clearError();if(!confirmUnsavedLocationRefresh())return;locationSearchInput.value='';countryFilter.value='all';regionFilter.value='all';categoryFilter.value='all';locationFavoritesOnly=false;syncLocationFavoritesFilterBtn();const id=newLocationId();const payload={id,name:'',display_name:'',country:'',region:'',area:'',category:'',address:'',maps_link:'',meeting_place:'',meeting_maps_link:'',image_url:'',image_focus:'50% 50%',description:'',tags:[],active:true,updated_at:new Date().toISOString(),__draft:true};locations=[payload,...locations.filter(location=>location.id!==id)];currentLocationsById[id]=payload;renderLocations();showToast('Neue Location vorbereitet');openNewLocationDraftCard(locationsList.querySelector(`[data-location-id="${id}"]`))}
    function cancelLocationEdit(e){
      const form=e.currentTarget.closest('form'),id=form?.dataset.locationForm;
      if(!form||!id)return;
      const isDraft=form.dataset.locationDraft==='true';
      const key=dirtyFormKey(form);
      if(isDraft){
        if(!confirm('Neue Location verwerfen?'))return;
        locations=locations.filter(l=>l.id!==id);
        delete currentLocationsById[id];
        if(key)dirtyForms.delete(key);
        updateUnsavedBar();
        renderLocations();
        showToast('Entwurf verworfen');
        return;
      }
      if(key&&dirtyForms.has(key)&&!confirm('Änderungen an dieser Location verwerfen?'))return;
      if(key)dirtyForms.delete(key);
      updateUnsavedBar();
      const wasOpen=form.closest('details.location-card')?.open;
      renderLocations();
      if(wasOpen){
        const card=locationsList.querySelector(`details.location-card[data-location-id="${CSS.escape(id)}"]`);
        if(card)card.open=true;
      }
      showToast('Änderungen verworfert');
    }
    async function setLocationActiveState(id,active){
      const now=new Date().toISOString();
      const {error}=await db.from('locations').update({active:active!==false,updated_at:now}).eq('id',id);
      if(error)throw error;
      const loc=currentLocationsById[id];
      if(loc){
        loc.active=active!==false;
        loc.updated_at=now;
        currentLocationsById[id]=loc;
        locations=locations.map(item=>item.id===id?{...item,active:active!==false,updated_at:now}:item);
      }
    }

    async function archiveLocation(e){
      const id=e.currentTarget.dataset.locationArchive;
      const loc=currentLocationsById[id];
      if(!loc)return;
      let shootings=[];
      try{shootings=await fetchShootingsUsingLocation(id)}catch(error){
        showError('Shooting-Verknüpfungen konnten nicht geprüft werden: '+formatError(error));
        return;
      }
      const list=formatShootingUsageList(shootings);
      const usageLine=shootings.length?`\n\nVerknüpft mit ${shootings.length} Shooting${shootings.length===1?'':'s'}:${list?`\n${list}`:''}`:'';
      if(!confirm(`Location „${loc.name||'Ohne Namen'}“ archivieren?${usageLine}\n\nSie erscheint danach nicht mehr in der Shooting-Auswahl.`))return;
      try{
        await setLocationActiveState(id,false);
        await loadLocations();
        showToast('Location archiviert');
      }catch(error){
        showError('Archivieren fehlgeschlagen: '+formatError(error));
      }
    }

    async function reactivateLocation(e){
      const id=e.currentTarget.dataset.locationReactivate;
      const loc=currentLocationsById[id];
      if(!loc)return;
      if(!confirm(`Location „${loc.name||'Ohne Namen'}“ reaktivieren?\n\nSie erscheint wieder in der Shooting-Auswahl.`))return;
      try{
        await setLocationActiveState(id,true);
        await loadLocations();
        showToast('Location reaktiviert');
      }catch(error){
        showError('Reaktivieren fehlgeschlagen: '+formatError(error));
      }
    }

    async function deleteLocation(e){
      const id=e.currentTarget.dataset.locationDelete;
      const l=currentLocationsById[id];
      if(!l)return;
      if(l.__draft){
        if(!confirm('Diesen Location-Entwurf verwerfen?'))return;
        locations=locations.filter(x=>x.id!==id);
        delete currentLocationsById[id];
        renderLocations();
        showToast('Entwurf verworfen');
        return;
      }
      let shootings=[];
      try{shootings=await fetchShootingsUsingLocation(id)}catch(error){
        showError('Shooting-Verknüpfungen konnten nicht geprüft werden: '+formatError(error));
        return;
      }
      if(shootings.length){
        const list=formatShootingUsageList(shootings);
        showError(`Diese Location wird in ${shootings.length} Shooting${shootings.length===1?'':'s'} verwendet und kann nicht gelöscht werden.${list?`\n\n${list}`:''}\n\nBitte stattdessen archivieren.`);
        return;
      }
      if(!confirm(`Location wirklich löschen?\n\n${l.name||'Ohne Namen'}\n\nUnwiderruflich — nur möglich, solange keine Shootings verknüpft sind.`))return;
      const {error}=await db.from('locations').delete().eq('id',id);
      if(error){showError('Location konnte nicht gelöscht werden: '+formatError(error));return}
      showToast('Location gelöscht');
      await loadLocations();
    }
    function normalizeLocationNeedle(value){
      return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
    }

    function findSimilarLibraryLocation(row){
      const needles=[row?.location_name,row?.name,row?.meeting_place,row?.address].map(normalizeLocationNeedle).filter(Boolean);
      if(!needles.length||!locations?.length)return null;
      for(const loc of locations){
        if(!locationIsActive(loc))continue;
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
      if(form.elements.location_name)form.elements.location_name.value=locationDisplayName(location)||location.name||'';
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

    function mapsCoordPair(lat,lon){
      const la=Number(lat),lo=Number(lon);
      if(!Number.isFinite(la)||!Number.isFinite(lo))return null;
      if(Math.abs(la)>90||Math.abs(lo)>180)return null;
      return {lat:la,lon:lo};
    }

    function extractPlaceNameFromMapsLink(url){
      const value=String(url||'').trim();
      if(!value)return '';
      try{
        const decoded=decodeURIComponent(value);
        const match=decoded.match(/\/maps\/place\/([^/@?]+)/i)||decoded.match(/\/place\/([^/@?]+)/i);
        if(!match)return '';
        const name=String(match[1]||'').replace(/\+/g,' ').trim();
        return name&&!isWeakLocationLabel(name)?name:'';
      }catch(_){
        return '';
      }
    }

    function extractCoordsFromMapsLink(url){
      const value=String(url||'').trim();
      if(!value)return null;

      // Google place links often embed a viewport @ pair and a precise POI !3d/!4d pair — prefer the pin.
      const precise3d=value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      if(precise3d){
        const coords=mapsCoordPair(precise3d[1],precise3d[2]);
        if(coords)return coords;
      }
      const precise2d=value.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
      if(precise2d){
        const coords=mapsCoordPair(precise2d[2],precise2d[1]);
        if(coords)return coords;
      }

      const patterns=[
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/
      ];

      for(const pattern of patterns){
        const match=value.match(pattern);
        if(match){
          const coords=mapsCoordPair(match[1],match[2]);
          if(coords)return coords;
        }
      }

      const decoded=decodeURIComponent(value);
      const coordMatch=decoded.match(/(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
      if(coordMatch)return mapsCoordPair(coordMatch[1],coordMatch[2]);

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
        '';

      const houseNumber =
        address.house_number ||
        address.housenumber ||
        address['addr:housenumber'] ||
        '';

      if(street && houseNumber){
        return `${street} ${houseNumber}`;
      }

      const parts=String(displayName||'').split(',').map(part=>part.trim()).filter(Boolean);
      const firstPart=parts[0]||'';
      const inlineNumber=firstPart.match(/^(.+?)\s+(\d{1,4}[a-zA-Z]?(?:\/\d{1,4}[a-zA-Z]?)?)$/);
      if(inlineNumber&&!isWeakLocationLabel(inlineNumber[1])){
        return `${inlineNumber[1]} ${inlineNumber[2]}`;
      }
      if(parts.length>=2&&isHouseNumberOnly(parts[0])&&isLikelyStreetPart(parts[1])){
        return `${parts[1]} ${parts[0]}`;
      }
      if(street&&parts.length&&isHouseNumberOnly(parts[0])){
        return `${street} ${parts[0]}`;
      }

      if(street && displayName){
        const streetPart=parts.find(part=>part.toLowerCase().includes(String(street).toLowerCase()));
        if(streetPart){
          const numberMatch=streetPart.match(new RegExp(`${street.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+([0-9]+[a-zA-Z]?(?:\\/[0-9]+[a-zA-Z]?)?)`,'i'));
          if(numberMatch){
            return `${street} ${numberMatch[1]}`;
          }
          if(/\d/.test(streetPart))return streetPart;
        }
        for(const part of parts.slice(1,5)){
          if(part.toLowerCase().includes(street.toLowerCase())&&/\d/.test(part))return part;
          if(/^[A-Za-zÀ-ÿÄÖÜäöüß.\- ]+\s+\d+[a-zA-Z]?/.test(part))return part;
        }
      }

      for(const part of parts){
        if(isWeakLocationLabel(part))continue;
        if(/\d/.test(part)&&(!street||part.toLowerCase().includes(street.toLowerCase())))return part;
      }

      return street;
    }

    function mapAddressToMeta(address,displayName=''){
      const country=normalizeGeoLabel(address.country||'');
      const region=normalizeGeoLabel(address.state||address.region||address.province||address.county||'');
      const area=address.city||address.town||address.village||address.municipality||address.hamlet||address.suburb||address.county||'';
      const streetWithNumber=extractStreetWithNumber(address,displayName);
      const postcodeCity=[address.postcode,area].filter(Boolean).join(' ');
      const fullAddress=normalizeAddressGeoLabels([streetWithNumber,postcodeCity,region,country].filter(Boolean).join(', '));
      return {country,region,area,address:fullAddress||''};
    }

    async function reverseGeocodeCoords(coords){
      const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}&zoom=16&addressdetails=1&extratags=1`;
      const response=await fetch(url,{headers:NOMINATIM_FETCH_HEADERS});
      if(!response.ok)throw new Error('Geocoding fehlgeschlagen: '+response.status);
      return await response.json();
    }

    const WATERCOLOR_SAMPLE_IMAGES={
      default:'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
      See:'https://images.unsplash.com/photo-1574169208507-84376144848b?auto=format&fit=crop&w=1600&q=80',
      Berge:'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      Wald:'https://images.unsplash.com/photo-1752316226118-d7ece2fe4607?auto=format&fit=crop&w=1600&q=80',
      Wiese:'https://images.unsplash.com/photo-1752316226118-d7ece2fe4607?auto=format&fit=crop&w=1600&q=80',
      Stadt:'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      'Aussichtspunkt':'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      'Passstraße':'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      Dolomiten:'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      Altstadt:'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      Dorf:'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      Hotel:'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
      Indoor:'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
      Schloss:'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      Roadtrip:'https://images.unsplash.com/photo-1740516367938-ad29a1bc6ed1?auto=format&fit=crop&w=1600&q=80',
      Park:'https://images.unsplash.com/photo-1752316226118-d7ece2fe4607?auto=format&fit=crop&w=1600&q=80'
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
      if(String(input.value||'').trim()&&!form.dataset.imageSuggested)markLocationImageManual(form);
      input.addEventListener('input',()=>{
        const value=String(input.value||'').trim();
        if(value){
          markLocationImageManual(form);
        }else{
          cancelLocationImageSuggestion(form);
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

    function normalizePlaceTitle(value){
      return String(value||'').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/\s*\([^)]*\)\s*/g,' ')
        .replace(/[._,'’`"]/g,' ')
        .replace(/\s+/g,' ')
        .trim();
    }

    function placeTitlesMatch(expected,actual){
      const wanted=normalizePlaceTitle(expected);
      const found=normalizePlaceTitle(actual);
      if(!wanted||!found||wanted.length<3)return false;
      if(wanted===found)return true;
      return found.startsWith(`${wanted} `)||wanted.startsWith(`${found} `);
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

    async function fetchWikipediaLeadImageIfExact(title,lang='de'){
      const wanted=String(title||'').trim();
      if(!wanted||wanted.length<3)return null;
      const pageTitle=wanted.replace(/\s+/g,'_');
      const api=`https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&piprop=thumbnail|original&pithumbsize=1200&format=json&origin=*`;
      try{
        const response=await fetch(api);
        if(!response.ok)return lang==='de'?fetchWikipediaLeadImageIfExact(title,'en'):null;
        const data=await response.json();
        const page=Object.values(data?.query?.pages||{})[0];
        if(!page||page.missing)return lang==='de'?fetchWikipediaLeadImageIfExact(title,'en'):null;
        if(!placeTitlesMatch(wanted,page.title))return null;
        return page.original?.source||page.thumbnail?.source||null;
      }catch(error){
        console.error(error);
        return null;
      }
    }

    function inferImageCategoryLabel(form,meta={}){
      const category=String(form?.elements?.category?.value||'').trim();
      if(category)return category;
      return suggestCategoryFromOsm({
        name:String(form?.elements?.name?.value||form?.elements?.location_name?.value||meta?.official_name||''),
        display_name:meta?.display_name||'',
        type:meta?.osm_type||'',
        class:meta?.osm_class||'',
        category:meta?.osm_category||'',
        extratags:meta?.osm_extratags||{}
      })||'';
    }

    function watercolorSampleImage(category){
      const key=String(category||'').trim();
      if(key&&WATERCOLOR_SAMPLE_IMAGES[key])return WATERCOLOR_SAMPLE_IMAGES[key];
      const lower=key.toLowerCase();
      if(/berg|alm|joch|pass|spitze|gipfel|dolomit/.test(lower))return WATERCOLOR_SAMPLE_IMAGES.Berge;
      if(/\bsee\b|lake|lago|teich|weiher|stausee/.test(lower))return WATERCOLOR_SAMPLE_IMAGES.See;
      if(/wald|forest|wood/.test(lower))return WATERCOLOR_SAMPLE_IMAGES.Wald;
      if(/wiese|meadow|grass/.test(lower))return WATERCOLOR_SAMPLE_IMAGES.Wiese;
      if(/stadt|city|dorf|altstadt|hotel|schloss|indoor/.test(lower))return WATERCOLOR_SAMPLE_IMAGES.Stadt;
      return WATERCOLOR_SAMPLE_IMAGES.default;
    }

    async function fetchTrustedLocationPhoto(form,meta={},osmExtratags=null){
      const placeName=String(form?.elements?.name?.value||form?.elements?.location_name?.value||meta?.official_name||'').trim();
      if(!placeName||placeName.length<3)return null;
      const wiki=parseWikipediaTag(osmExtratags?.wikipedia);
      if(wiki?.title&&placeTitlesMatch(placeName,wiki.title)){
        const fromTagged=await fetchWikipediaLeadImage(wiki.title,wiki.lang||'de');
        if(fromTagged)return fromTagged;
      }
      return await fetchWikipediaLeadImageIfExact(placeName,'de');
    }

    async function resolveLocationImageUrl(form,meta={},osmExtratags=null){
      if(!canAutoReplaceLocationImage(form))return null;
      const input=locationImageField(form);
      if(!input)return null;
      const extratags=osmExtratags||meta?.osm_extratags||null;
      const trusted=await fetchTrustedLocationPhoto(form,meta,extratags);
      if(trusted)return {url:trusted,trusted:true};
      return {url:watercolorSampleImage(inferImageCategoryLabel(form,meta)),trusted:false};
    }

    function applySuggestedImageToForm(form,url,{silent=false,trusted=false}={}){
      const input=locationImageField(form);
      if(!url||!input||!canAutoReplaceLocationImage(form))return false;
      input.value=url;
      delete form.dataset.imageManual;
      form.dataset.imageSuggested='true';
      form.dataset.imageSuggestKind=trusted?'photo':'watercolor';
      form.dataset.imageSuggestRev=form.dataset.placeAnchorRev||'0';
      if(form.elements.image_focus)form.elements.image_focus.value='50% 50%';
      delete form.dataset.lastPreviewImageUrl;
      if(form.elements.location_meta_image_url&&!String(form.elements.location_meta_image_url.value||'').trim()){
        form.elements.location_meta_image_url.value=url;
      }
      refreshFormImagePreview(form);
      if(typeof refreshFormDirtyState==='function')refreshFormDirtyState(form);
      if(!silent){
        showToast(trusted
          ?'Ortsbild übernommen — bei Bedarf ersetzen'
          :'Aquarell-Vorschlag gesetzt — eigenes Bild eintragen');
      }
      return true;
    }

    function scheduleLocationImageSuggestion(form,meta={},osmExtratags=null){
      if(!form||!formHasGeoAnchor(form)||!canAutoReplaceLocationImage(form))return;
      const extratags=osmExtratags||meta?.osm_extratags||null;
      const anchorRev=String(form.dataset.placeAnchorRev||'0');
      cancelLocationImageSuggestion(form);
      form._imageSuggestTimer=setTimeout(async()=>{
        try{
          if(String(form.dataset.placeAnchorRev||'0')!==anchorRev)return;
          if(!canAutoReplaceLocationImage(form))return;
          const suggestion=await resolveLocationImageUrl(form,meta,extratags);
          if(suggestion?.url)applySuggestedImageToForm(form,suggestion.url,{trusted:!!suggestion.trusted});
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
      const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&extratags=1&q=${encodeURIComponent(q)}`;
      const response=await fetch(url,{headers:NOMINATIM_FETCH_HEADERS});
      if(!response.ok)throw new Error('Adresssuche fehlgeschlagen: '+response.status);
      return dedupeOsmResults(await response.json());
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
      const meta=metaFromOsmHit(hit,currentOsmSearchTerm(form));
      const coords=hit.lat!=null&&hit.lon!=null?{lat:Number(hit.lat),lon:Number(hit.lon)}:null;
      if(form.elements.location_id)form.elements.location_id.value='';
      if(!isLibraryLocationForm(form)){
        if(form.elements.meeting_place)form.elements.meeting_place.value=meta.address||meta.display_name||'';
        const nameField=form.elements.location_name;
        if(nameField&&(isWeakLocationLabel(nameField.value)||!String(nameField.value||'').trim()))nameField.value='';
        const setup=form.querySelector('[data-location-setup]');
        if(setup)setup.open=true;
      }
      notePlaceAnchorChanged(form);
      fillLocationFormFromMeta(form,meta,coords,{skipImageSuggest:true,setOfficialName:true,clearMapsName:true});
      if(isLibraryLocationForm(form))maybeApplyOsmCategorySuggestion(form,hit);
      if(coords){
        const link=mapsLinkFromCoords(coords.lat,coords.lon);
        if(isLibraryLocationForm(form)&&form.elements.maps_link)form.elements.maps_link.value=link;
        else if(form.elements.location_link)form.elements.location_link.value=link;
        setFormCaptureCoords(form,coords.lat,coords.lon);
        ensureLocationPinMap(form);
        updateLocationPinMap(form,coords.lat,coords.lon);
      }
      scheduleLocationImageSuggestion(form,meta,hit.extratags||null);
      syncLocationGeoFieldsVisibility(form);
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

    function renderOsmFinderResults(results,searchQuery=''){
      if(!results?.length){
        return `<div class="location-picker-empty">Kein Kartentreffer — unten Maps-Link nutzen oder Namen anpassen.</div>`;
      }
      const items=results.map((item,index)=>{
        const title=osmOfficialName(item,searchQuery);
        const meta=String(item.display_name||'');
        return `<button class="location-option location-option-osm" type="button" data-pick-osm="${index}">
          <div class="location-option-thumb location-option-thumb-osm">📍</div>
          <div><div class="location-option-title">${escapeHtml(title)}</div><div class="location-option-meta">${escapeHtml(meta)}</div></div>
        </button>`;
      }).join('');
      return `<div class="location-osm-results">${items}</div>`;
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
      const currentId=form?.elements?.location_id?.value||'';
      const libCount=typeof countLibraryFinderMatches==='function'
        ?countLibraryFinderMatches(term,country,category,currentId)
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
        slot.innerHTML=`<div class="location-picker-section-title">Auf der Karte (OpenStreetMap)</div>${renderOsmFinderResults(results,term)}`;
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
    window.locationDisplayName=locationDisplayName;

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
      const placeName=extractPlaceNameFromMapsLink(resolvedLink);
      const osmName=osmOfficialName({name:result.name,display_name:result.display_name,address:result.address});
      meta.official_name=placeName||osmName;
      meta.display_name=result.display_name||'';
      meta.lat=coords.lat;
      meta.lon=coords.lon;
      meta.resolved_link=resolvedLink;
      meta.osm_extratags=result.extratags||null;
      meta.osm_type=result.type||'';
      meta.osm_class=result.class||'';
      meta.osm_category=result.category||'';
      if(form&&isLibraryLocationForm(form))maybeApplyOsmCategorySuggestion(form,result);
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
        showError('Bitte zuerst einen Maps-Link für den Treffpunkt eintragen.');
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

    window.syncLocationFavoritesFilterBtn=syncLocationFavoritesFilterBtn;
    window.locationIsActive=locationIsActive;
    window.locationVisibleInPicker=locationVisibleInPicker;
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

