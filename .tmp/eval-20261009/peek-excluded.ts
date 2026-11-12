import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
import { readTabooSettings, findExcludedMentions } from '@/lib/taboos';
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
const p=(await (await fetch(`${U}/rest/v1/user_profiles?select=profile_name,taboo_settings,content_restrictions,target_region&id=eq.ac5fc613-c096-4d1d-89b8-6445d28d92bf`,{headers:H})).json())[0];
const s=readTabooSettings(p.taboo_settings);
console.log('排除项：', JSON.stringify(s.excluded, null, 0));
console.log('地区字段：', JSON.stringify(p.target_region));
for (const t of ['你给客人讲讲怎么挑','时间充足不着急','拿手机拍','选家具的问题']) console.log(t, '→', JSON.stringify(findExcludedMentions(t, s.excluded, p.profile_name).map((h:any)=>h.needle)));
