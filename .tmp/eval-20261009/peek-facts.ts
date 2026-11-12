import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
import { businessLines } from '@/lib/profile-summary';
import * as pf from '@/lib/persona-facts';
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
for (const id of ['ac5fc613-c096-4d1d-89b8-6445d28d92bf']) {
  const p=(await (await fetch(`${U}/rest/v1/user_profiles?select=*&id=eq.${id}`,{headers:H})).json())[0];
  console.log('==', p.profile_name); console.log('businessLines', JSON.stringify(businessLines(p)));
  console.log('product_category', JSON.stringify(p.product_category)); console.log('persona_facts', JSON.stringify(p.persona_facts));
  console.log('team', p.team_structure, '| loc', p.shooting_location, '| region', JSON.stringify(p.target_region));
  console.log('competitive_advantage', String(p.competitive_advantage).slice(0,300));
  console.log('persona-facts exports', Object.keys(pf).join(','));
}
const f=(await (await fetch(`${U}/rest/v1/user_profiles?select=profile_name,product_category,persona_facts&profile_name=eq.${encodeURIComponent('锦园地摊串串一元火锅')}`,{headers:H})).json())[0];
console.log('==', f.profile_name, JSON.stringify(businessLines(f)), JSON.stringify(f.persona_facts));
