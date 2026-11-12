// 只读：看档案、定位、简报里有没有季节字，以及它们在提示词里的位置。只输出字段名和次数。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const count = (s, ch) => (String(s ?? '').match(new RegExp(ch, 'g')) ?? []).length;

const { data: profiles } = await db.from('user_profiles').select('*');
const row = profiles.find((r) => String(r.id).startsWith('74586841'));
if (!row) throw new Error('找不到档案');
console.log('档案字段含季节字（次数 秋/冬）:');
for (const [k, v] of Object.entries(row)) {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
  const a = count(s, '秋'), w = count(s, '冬');
  if (a || w) console.log(`  ${k}: 秋${a} 冬${w}`);
}

const { data: pos } = await db.from('account_positioning').select('*').eq('profile_id', row.id);
for (const p of pos ?? []) {
  const s = JSON.stringify(p);
  console.log(`定位 ${String(p.positioning_name ?? '').slice(0, 0)}active=${p.is_active} 秋${count(s, '秋')} 冬${count(s, '冬')}`);
}

// 创作简报：列出可能存放简报的表，只看有没有季节字
for (const t of ['creative_briefs', 'creative_brief', 'profile_briefs', 'creation_briefs']) {
  const { data, error } = await db.from(t).select('*').limit(50);
  if (error) { console.log(`表 ${t}: 不存在或无权限`); continue; }
  const rel = (data ?? []).filter((r) => JSON.stringify(r).includes(row.id) || r.profile_id === row.id);
  for (const r of rel) console.log(`表 ${t} 字段 ${Object.keys(r).join(',')} 秋${count(JSON.stringify(r), '秋')} 冬${count(JSON.stringify(r), '冬')}`);
  if (!rel.length) console.log(`表 ${t}: 存在，但没有这个档案的行`);
}
