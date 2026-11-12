// 只读：测试档案的人设事实卡（persona_facts）有没有值、有哪些键、年限类字段是否齐。不输出具体内容以外的值之外的信息。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('user_profiles').select('id,persona_facts,taboo_settings,competitive_advantage').limit(50);
const row = data.find((r) => String(r.id).startsWith('74586841'));
console.log('persona_facts:', row.persona_facts === null ? '空(null)' : JSON.stringify(row.persona_facts));
console.log('taboo_settings:', row.taboo_settings === null ? '空(null)' : JSON.stringify(row.taboo_settings));
