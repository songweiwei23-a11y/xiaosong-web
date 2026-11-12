import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
const get=async(q:string)=>(await fetch(`${U}/rest/v1/${q}`,{headers:H})).json();
const ps=await get('user_profiles?select=*&order=updated_at.desc&limit=20');
for(const p of ps) console.log(p.id.slice(0,8), p.profile_name, '|', JSON.stringify(p.account_track), '|', p.account_stage, '|', Object.keys(p).length+'列');
const pos=await get('account_positioning?select=*&order=updated_at.desc&limit=12');
for(const p of pos) console.log('POS', (p.profile_id||'').slice(0,8), p.positioning_type, p.positioning_name);
const dr=await get('deal_reasons?select=profile_id&limit=50'); console.log('deal_reasons profiles', [...new Set(dr.map((x:any)=>(x.profile_id||'').slice(0,8)))].join(','));

