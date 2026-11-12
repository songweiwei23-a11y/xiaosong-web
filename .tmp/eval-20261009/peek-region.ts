import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
const get=async(q:string)=>(await fetch(`${U}/rest/v1/${q}`,{headers:H})).json();
const id='ac5fc613-c096-4d1d-89b8-6445d28d92bf';
const p=(await get(`user_profiles?select=*&id=eq.${id}`))[0];
const pos=await get(`account_positioning?select=positioning_type,full_content&profile_id=eq.${id}`);
const deal=await get(`deal_reasons?select=store_features&profile_id=eq.${id}`);
const scan=(name:string,text:string)=>{ for (const w of ['阜南','南乐','莘县','濮阳']) { const n=(text.match(new RegExp(w,'g'))||[]).length; if(n) console.log(`${name}：「${w}」${n} 次`); } };
for (const [k,v] of Object.entries(p)) if (typeof v==='string'||Array.isArray(v)) scan('档案.'+k, JSON.stringify(v));
for (const x of pos) scan('定位.'+x.positioning_type, x.full_content||'');
for (const x of deal) scan('成交理由.店铺特色', x.store_features||'');
const six = JSON.stringify(p).match(/六大品类[^"]{0,60}/g); console.log('档案里「六大品类」：', six);
