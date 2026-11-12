// 只读：修复前线上最近一条「开篇钩子」输出里的旁观者口吻与第一人称次数（与评测口径一致）。只输出计数。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('script_history').select('result,created_at').eq('task_type', '开篇钩子').order('created_at', { ascending: false }).limit(1);
const body = String(data[0].result ?? '');
const outsider = [...body.matchAll(/这家老板|这个老板|这个师傅|老板干了|老板早就|老板说|他们店|这家地摊老板/g)].map((m) => m[0]);
console.log('基线记录时间:', String(data[0].created_at).slice(0, 19), '| 旁观者口吻:', outsider.length, outsider.join('、'), '| 第一人称「我」:', (body.match(/我/g) ?? []).length);
