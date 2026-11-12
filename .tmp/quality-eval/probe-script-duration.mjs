// 只读：最近的「脚本生成」记录，看用户有没有指定时长、正文口播大致多长（按中文字数估算，不输出内容）。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('script_history').select('input_data,result,created_at').eq('task_type', '脚本生成').order('created_at', { ascending: false }).limit(12);
const cjk = (s) => (String(s).match(/[一-鿿]/g) ?? []).length;
for (const h of data) {
  const inp = h.input_data ?? {};
  const cs = inp.creationSettings ?? {};
  const dur = cs.duration ?? inp.duration ?? '(未指定)';
  // 口播估算：「台词」「口播」「纯文字文案」等行里的汉字
  const lines = String(h.result ?? '').split('\n');
  const spoken = lines.filter((l) => /台词|口播|^>\s|^\s*[-*]?\s*"/.test(l) && !/^#/.test(l)).join('');
  console.log(String(h.created_at).slice(0, 16), '| 指定时长:', String(dur), '| 结果总汉字:', cjk(h.result), '| 台词约汉字:', cjk(spoken));
}
