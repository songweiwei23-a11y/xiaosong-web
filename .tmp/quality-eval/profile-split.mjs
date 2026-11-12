// 只读：同一用户下的各档案，以及生成记录按档案拆分的数量与抽样关键词（不输出内容）。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: profiles } = await db.from('user_profiles').select('id,user_id,profile_name,created_at');
const me = profiles.find((r) => String(r.id).startsWith('74586841'));
const sameUser = profiles.filter((p) => p.user_id === me.user_id);
console.log('同一用户的档案数:', sameUser.length);
for (const p of sameUser) console.log(' -', String(p.id).slice(0, 8), '名称长度', String(p.profile_name ?? '').length, '创建', String(p.created_at).slice(0, 10), p.id === me.id ? '（本账号）' : '');

const { data: hist } = await db.from('script_history').select('task_type,input_data,result,created_at').eq('user_id', me.user_id).order('created_at', { ascending: false }).limit(3000);
const byProfile = {};
for (const h of hist ?? []) {
  const pid = String(h.input_data?.profileId ?? h.input_data?.profile_id ?? '（未记录）').slice(0, 8);
  byProfile[pid] = (byProfile[pid] ?? 0) + 1;
}
console.log('生成记录按档案拆分:', JSON.stringify(byProfile));
const mine = (hist ?? []).filter((h) => String(h.input_data?.profileId ?? h.input_data?.profile_id ?? '').startsWith('74586841')).length;
console.log('本账号自己的记录:', mine, '/ 总计', (hist ?? []).length);
const kw = /劳务|濮阳|工地|装修|保证安排|全程无忧/;
const otherHits = (hist ?? []).filter((h) => kw.test(String(h.result ?? ''))).map((h) => ({ t: h.task_type, at: String(h.created_at).slice(0, 10), pid: String(h.input_data?.profileId ?? h.input_data?.profile_id ?? '未记录').slice(0, 8) }));
const byKey = {};
for (const o of otherHits) byKey[o.pid + ' ' + o.t] = (byKey[o.pid + ' ' + o.t] ?? 0) + 1;
console.log('含「劳务/濮阳/工地/装修」的记录（按档案+板块）:', JSON.stringify(byKey));
