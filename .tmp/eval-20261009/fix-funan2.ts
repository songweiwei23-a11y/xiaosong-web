import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const PID='ac5fc613-c096-4d1d-89b8-6445d28d92bf';
const rows=await (await fetch(`${U}/rest/v1/account_positioning?select=id,positioning_type,full_content,strategy_summary&profile_id=eq.${PID}`,{headers:H})).json();
let n=0; for(const x of rows){ const body:any={}; for(const k of ['full_content','strategy_summary']) if(typeof x[k]==='string'&&/南乐县、人|南乐县、(?=[^一-龥山濮])/.test(x[k])){ body[k]=x[k].replace(/南乐县、人/g,'南乐人'); n+=(x[k].match(/南乐县、人/g)||[]).length; }
  if(Object.keys(body).length){ const r=await fetch(`${U}/rest/v1/account_positioning?id=eq.${x.id}`,{method:'PATCH',headers:H,body:JSON.stringify(body)}); console.log(x.positioning_type, r.status); } }
console.log('修正「南乐县、人」', n, '处');
const all=JSON.stringify(await (await fetch(`${U}/rest/v1/account_positioning?select=full_content&profile_id=eq.${PID}`,{headers:H})).json());
console.log('剩余怪写法：', (all.match(/南乐县、[^山濮一-龥]|南乐县、人/g)||[]).length);
