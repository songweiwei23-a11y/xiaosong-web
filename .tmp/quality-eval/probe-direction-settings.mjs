// 只读：看最近一条创作方向的设置字段名与是否为「显式创作上下文」（决定路由是否跳过历史记忆）。不输出正文。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('script_history').select('input_data,created_at').eq('task_type', '创作方向').order('created_at', { ascending: false }).limit(1);
const input = data[0].input_data;
const cs = input.creationSettings ?? {};
console.log('最近一条创作方向：', String(data[0].created_at).slice(0, 19));
console.log('creationSettings 字段:', Object.entries(cs).map(([k, v]) => `${k}=${Array.isArray(v) ? 'arr' : typeof v}${typeof v === 'string' ? '(' + v.length + ')' : ''}`).join(' | '));
console.log('creationSettings 含「秋」的字段:', Object.keys(cs).filter((k) => JSON.stringify(cs[k] ?? '').includes('秋')).join(',') || '无');
console.log('ideas 长度:', String(input.ideas ?? '').length, '| customGoal 长度:', String(input.customGoal ?? '').length, '| purposes:', JSON.stringify(input.purposes ?? []));
const explicit = Boolean(cs.focusContent || cs.workingScript || (cs.userIntent && (cs.topic || cs.direction)));
console.log('是否显式创作上下文（为真则路由跳过历史记忆）:', explicit);
