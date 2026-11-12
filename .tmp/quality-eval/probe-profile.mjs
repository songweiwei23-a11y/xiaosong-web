// 只读：确认测试要用的档案字段是否齐全。只输出字段名、是否为空、长度，不输出档案内容和 ID。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await db.from('user_profiles').select('*').limit(50);
if (error) throw error;
console.log('档案行数（前50）:', data.length);
for (const row of data) {
  const summary = Object.entries(row).map(([k, v]) => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return `${k}=空`;
    if (typeof v === 'string') return `${k}=str(${v.length})`;
    if (Array.isArray(v)) return `${k}=arr(${v.length})`;
    if (typeof v === 'object') return `${k}=obj(${Object.keys(v).length})`;
    return `${k}=${typeof v}`;
  });
  console.log('---', row.profile_name ? `名称长度${row.profile_name.length}` : '无名称');
  console.log(summary.join(' | '));
}
const { data: pos, error: e2 } = await db.from('account_positioning').select('*').limit(5);
console.log('account_positioning 行数:', e2 ? `错误 ${e2.message}` : pos.length, pos[0] ? '字段: ' + Object.keys(pos[0]).join(',') : '');
