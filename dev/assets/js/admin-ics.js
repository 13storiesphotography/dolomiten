    function unfoldIcsLines(text){
      const normalized=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
      const raw=normalized.split('\n');
      const lines=[];
      raw.forEach(line=>{
        if((line.startsWith(' ')||line.startsWith('\t'))&&lines.length)lines[lines.length-1]+=line.slice(1);
        else lines.push(line);
      });
      return lines;
    }

    function parseIcsPropParams(keyPart){
      const params={};
      keyPart.split(';').slice(1).forEach(part=>{
        const eq=part.indexOf('=');
        if(eq<0)return;
        params[part.slice(0,eq).toUpperCase()]=part.slice(eq+1);
      });
      return params;
    }

    function parseIcsDateValue(value,params={}){
      const raw=String(value||'').trim();
      const isDateOnly=params.VALUE==='DATE'||(/^\d{8}$/.test(raw)&&!raw.includes('T'));
      if(isDateOnly){
        const m=raw.match(/^(\d{4})(\d{2})(\d{2})/);
        if(!m)return null;
        return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
      }
      const m=raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?/);
      if(!m)return null;
      const y=Number(m[1]),mo=Number(m[2])-1,d=Number(m[3]),h=Number(m[4]),mi=Number(m[5]);
      if(m[7]==='Z'||params.TZID==='UTC')return new Date(Date.UTC(y,mo,d,h,mi));
      return new Date(y,mo,d,h,mi);
    }

    function normalizeIcsEvent(block){
      const start=block.dtstart?parseIcsDateValue(block.dtstart.val,block.dtstart.params):null;
      if(!start||!Number.isFinite(start.getTime()))return null;
      const end=block.dtend?parseIcsDateValue(block.dtend.val,block.dtend.params):null;
      const allDay=block.dtstart?.params?.VALUE==='DATE'||/^\d{8}$/.test(String(block.dtstart?.val||''));
      const uid=String(block.uid||'').trim()||`ics-${start.getTime()}-${String(block.summary||'').slice(0,24)}`;
      return{
        uid,
        title:String(block.summary||'Termin').trim()||'Termin',
        location:String(block.location||'').trim(),
        description:String(block.description||'').trim(),
        startsAt:start.toISOString(),
        endsAt:end&&Number.isFinite(end.getTime())?end.toISOString():null,
        allDay
      };
    }

    function parseIcsFile(text){
      const lines=unfoldIcsLines(text);
      const blocks=[];
      let cur=null;
      lines.forEach(line=>{
        const trimmed=line.trim();
        if(trimmed==='BEGIN:VEVENT')cur={};
        else if(trimmed==='END:VEVENT'){
          if(cur)blocks.push(cur);
          cur=null;
        }else if(cur){
          const idx=trimmed.indexOf(':');
          if(idx<0)return;
          const keyPart=trimmed.slice(0,idx);
          const val=trimmed.slice(idx+1);
          const key=keyPart.split(';')[0].toUpperCase();
          const params=parseIcsPropParams(keyPart);
          if(key==='DTSTART')cur.dtstart={val,params};
          else if(key==='DTEND')cur.dtend={val,params};
          else if(key==='SUMMARY')cur.summary=val;
          else if(key==='LOCATION')cur.location=val;
          else if(key==='DESCRIPTION')cur.description=val.replace(/\\n/g,'\n').replace(/\\,/g,',');
          else if(key==='UID')cur.uid=val;
        }
      });
      return blocks.map(normalizeIcsEvent).filter(Boolean).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
    }
