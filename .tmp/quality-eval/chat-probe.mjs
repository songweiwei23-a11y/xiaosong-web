// 只读：自由对话的存储结构与记录数量（不输出内容）。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const t of ['chat_conversations', 'chat_messages', 'conversation_messages']) {
  const { data, error, count } = await db.from(t).select('*', { count: 'exact' }).limit(1);
  if (error) { console.log(t, '不存在或无权限:', error.message.slice(0, 80)); continue; }
  console.log(t, '行数:', count, '字段:', data[0] ? Object.keys(data[0]).join(',') : '（空）');
}
