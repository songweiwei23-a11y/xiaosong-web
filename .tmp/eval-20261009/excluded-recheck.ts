import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
import { readTabooSettings } from '@/lib/taboos';
import { findExcludedMentions } from '@/lib/interview-exclusions';
const U=process.env.NEXT_PUBLIC_SUPABASE_URL!, H={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
const p=(await (await fetch(`${U}/rest/v1/user_profiles?select=profile_name,taboo_settings&id=eq.ac5fc613-c096-4d1d-89b8-6445d28d92bf`,{headers:H})).json())[0];
const ex=readTabooSettings(p.taboo_settings).excluded;
let total=0; for (const f of fs.readdirSync('docs/开物全板块实测_20261009/原始输出').filter(f=>f.endsWith('.md'))) { const t=fs.readFileSync('docs/开物全板块实测_20261009/原始输出/'+f,'utf8'); const h=findExcludedMentions(t, ex, p.profile_name); total+=h.length; if(h.length) console.log(f, h.map(x=>x.needle).join('、')); }
console.log('16 份结果里「提到排除信息」共', total, '条');
