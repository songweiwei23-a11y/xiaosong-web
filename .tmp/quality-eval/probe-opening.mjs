// 只读：看最近一条「开篇钩子」记录的输入字段、创作设置、参考内容里是否带了目的/方向/出镜人，以及输出的人称。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('script_history').select('task_type,input_data,result,created_at').eq('task_type', '开篇钩子').order('created_at', { ascending: false }).limit(3);
for (const h of data) {
  const inp = h.input_data ?? {};
  console.log('---', String(h.created_at).slice(0, 19), '输入字段:', Object.keys(inp).join(','));
  const cs = inp.creationSettings ?? {};
  console.log('  creationSettings 字段:', Object.entries(cs).map(([k, v]) => `${k}${typeof v === 'string' ? '(' + v.length + ')' : ''}`).join(' | '));
  console.log('  topic:', JSON.stringify(String(inp.topic ?? '').slice(0, 80)));
  console.log('  referenceContent 长度:', String(inp.referenceContent ?? '').length, '| originContent 长度:', String(inp.originContent ?? '').length);
  const ref = String(inp.referenceContent ?? '');
  for (const w of ['出镜', '老板', '师傅', '第一人称', '我', '目的', '流量型', '变现型', '人设型', '内容方向', '方向']) {
    const n = ref.split(w).length - 1;
    if (n) console.log(`    参考内容含「${w}」${n}次`);
  }
  const out = String(h.result ?? '');
  const quote = [...out.matchAll(/^>\s*(.+)$/gm)].map((m) => m[1]).slice(0, 3);
  console.log('  输出长度:', out.length, '| 开头原话样例:', JSON.stringify(quote.map((q) => q.slice(0, 60))));
  console.log('  输出里「我」次数:', out.split('我').length - 1, '| 「他/她/老板」次数:', (out.match(/他|她|老板/g) ?? []).length);
}
