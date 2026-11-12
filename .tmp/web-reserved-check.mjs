// 只读：统计联网额度表的状态分布，看有没有长期停在 reserved 的预占（会占住额度）。
// 只输出计数和时间范围，不输出用户标识、请求内容。密钥只从 .env.local 读取。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: reqs, error: e1 } = await db.from('web_search_requests').select('status, created_at, started_at');
if (e1) throw e1;
const byStatus = {};
for (const r of reqs) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log('web_search_requests 总数:', reqs.length, '按状态:', JSON.stringify(byStatus));

const hourAgo = Date.now() - 3600_000;
const stuck = reqs.filter((r) => r.status === 'reserved');
console.log('停在 reserved 的条数:', stuck.length, stuck.length ? `最早 ${stuck.map((r) => r.created_at).sort()[0]}，超过 1 小时的 ${stuck.filter((r) => new Date(r.created_at).getTime() < hourAgo).length} 条` : '');
const dates = reqs.map((r) => r.created_at).sort();
console.log('创建时间范围:', dates[0], '至', dates[dates.length - 1]);

const { data: periods, error: e2 } = await db.from('web_search_periods').select('used, pending, period_key');
if (e2) throw e2;
const sum = (k) => periods.reduce((n, p) => n + (p[k] ?? 0), 0);
console.log('额度周期数:', periods.length, '| used 合计:', sum('used'), '| pending 合计:', sum('pending'));
const pendingNoRow = periods.filter((p) => p.pending > 0);
console.log('pending>0 的周期数:', pendingNoRow.length, '其中 reserved 行数对得上的:',
  pendingNoRow.filter((p) => reqs.filter((r) => r.status === 'reserved').length >= p.pending).length);
