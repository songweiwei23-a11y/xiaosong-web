// 只读：查最近几条「创作方向」历史，看「秋」是否进了输入、结果里出现的「冬」从哪来。
// 只输出计数和字段名，不输出正文内容。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: hist, error } = await db.from('script_history').select('*').order('created_at', { ascending: false }).limit(200);
if (error) throw error;
const dirs = hist.filter((h) => String(h.task_type ?? '').includes('方向')).slice(0, 5);
console.log('最近创作方向记录数（前5）:', dirs.length, '| 表字段:', Object.keys(hist[0] ?? {}).join(','));
for (const h of dirs) {
  const input = JSON.stringify(h.input_data ?? {});
  const result = String(h.result ?? '');
  const count = (s, ch) => (s.match(new RegExp(ch, 'g')) ?? []).length;
  const keys = Object.keys(h.input_data ?? {});
  console.log('---', String(h.created_at).slice(0, 19), '| 任务:', h.task_type);
  console.log('  输入字段:', keys.join(','));
  console.log('  输入里「秋」次数:', count(input, '秋'), '「冬」次数:', count(input, '冬'));
  for (const k of keys) {
    const v = JSON.stringify(h.input_data[k] ?? '');
    if (/秋|冬/.test(v)) console.log(`  字段 ${k} 含季节字:`, [...new Set(v.match(/[秋冬]\S{0,4}/g) ?? [])].join('、'));
  }
  console.log('  结果长度:', result.length, '| 结果里「秋」:', count(result, '秋'), '「冬」:', count(result, '冬'));
  const winter = [...result.matchAll(/.{0,12}冬.{0,12}/g)].slice(0, 4).map((m) => m[0]);
  console.log('  结果里含「冬」的片段（前4处）:', JSON.stringify(winter));
}
