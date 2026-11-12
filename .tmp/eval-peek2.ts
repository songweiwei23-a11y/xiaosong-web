import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
const get=async(q:string)=>(await fetch(`${U}/rest/v1/${q}`,{headers:H})).json();
const pid='ac5fc613-c096-4d1d-89b8-6445d28d92bf';
const pos=await get(`account_positioning?select=*&profile_id=eq.${pid}&order=updated_at.desc`); console.log('positioning cols', Object.keys(pos[0]||{}).join(','), '| types', pos.map((p:any)=>p.positioning_type+':'+(p.full_content||'').length).join(' '));
const dr=await get(`deal_reasons?select=*&profile_id=eq.${pid}`); console.log('deal cols', Object.keys(dr[0]||{}).join(','), '| rows', dr.length, '| sample', JSON.stringify(dr[0]).slice(0,300));
const p=(await get(`user_profiles?select=*&id=eq.${pid}`))[0]; console.log('profile filled', Object.entries(p).filter(([k,v])=>v!==null&&v!==''&&!(Array.isArray(v)&&!v.length)).map(([k])=>k).join(','));
