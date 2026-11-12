// 只读：这个档案的定位表记录类型、创作简报（positioning_type=创作简报）是否存在，以及其中「人设与口吻」段的长度和出镜人相关字样。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: profiles } = await db.from('user_profiles').select('id').limit(50);
const pid = profiles.find((p) => String(p.id).startsWith('74586841')).id;
const { data: rows } = await db.from('account_positioning').select('positioning_type,is_active,positioning_name,full_content,created_at,updated_at').eq('profile_id', pid).order('updated_at', { ascending: false });
for (const r of rows ?? []) {
  console.log(`type=${r.positioning_type} active=${r.is_active} name=${String(r.positioning_name ?? '').slice(0, 20)} full=${String(r.full_content ?? '').length} updated=${String(r.updated_at).slice(0, 19)}`);
}
const brief = (rows ?? []).find((r) => r.positioning_type === '创作简报');
if (!brief) {
  console.log('没有创作简报记录');
} else {
  const text = String(brief.full_content ?? '');
  const idx = text.indexOf('人设与口吻');
  console.log('简报里「人设与口吻」位置:', idx, '| 段落前 300 字:', JSON.stringify(text.slice(idx, idx + 300)));
  console.log('简报里出镜相关词次数: 出镜', text.split('出镜').length - 1, '| 我', text.split('我').length - 1, '| 老板', text.split('老板').length - 1, '| 师傅', text.split('师傅').length - 1);
}
