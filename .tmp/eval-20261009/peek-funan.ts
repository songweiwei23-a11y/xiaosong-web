import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
const get=async(q:string)=>(await fetch(`${U}/rest/v1/${q}`,{headers:H})).json();
const id='ac5fc613-c096-4d1d-89b8-6445d28d92bf';
const ctx=(name:string,t:string)=>{ const seen=new Set<string>(); for(const m of t.matchAll(/.{0,12}阜南.{0,12}/g)){ const s=m[0].replace(/\s+/g,' '); if(!seen.has(s)){seen.add(s);} } console.log(`== ${name}（${seen.size} 种写法）`); [...seen].slice(0,12).forEach(s=>console.log('   '+s)); };
const p=(await get(`user_profiles?select=*&id=eq.${id}`))[0];
for (const [k,v] of Object.entries(p)) { const s=typeof v==='string'?v:JSON.stringify(v); if(s&&s.includes('阜南')) ctx('档案.'+k,s); }
for (const x of await get(`account_positioning?select=id,positioning_type,full_content,strategy_summary,positioning_description&profile_id=eq.${id}`)) ctx(`定位.${x.positioning_type}.${x.id.slice(0,6)}`, JSON.stringify(x));
for (const x of await get(`deal_reasons?select=*&profile_id=eq.${id}`)) ctx('成交理由', JSON.stringify(x));
