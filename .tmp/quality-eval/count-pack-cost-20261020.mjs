// 只读：次数包定价依据——最近生成记录的模型成本（Dify total_price）与每用户每月生成次数。不写库。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
const { data, error } = await db
  .from('usage_events')
  .select('user_id, feature, detail, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(5000);
if (error) throw error;

const byFeature = {};
const perUserMonth = {};
const currencies = {};
for (const row of data ?? []) {
  const price = Number(row.detail?.total_price);
  const cur = row.detail?.currency ?? 'unknown';
  currencies[cur] = (currencies[cur] ?? 0) + 1;
  if (Number.isFinite(price)) {
    (byFeature[row.feature] ??= []).push(price);
  }
  const month = String(row.created_at).slice(0, 7);
  const key = `${row.user_id}|${month}`;
  perUserMonth[key] = (perUserMonth[key] ?? 0) + 1;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const featureStats = Object.fromEntries(
  Object.entries(byFeature).map(([f, xs]) => [f, { n: xs.length, median: median(xs), mean: mean(xs) }])
);
const monthCounts = Object.values(perUserMonth).sort((a, b) => a - b);
const pct = (p) => (monthCounts.length ? monthCounts[Math.min(monthCounts.length - 1, Math.floor(monthCounts.length * p))] : null);

console.log(JSON.stringify({
  sampleEvents: data?.length ?? 0,
  currencies,
  featureCost: featureStats,
  userMonths: monthCounts.length,
  perUserMonthCreations: { p50: pct(0.5), p75: pct(0.75), p90: pct(0.9), max: monthCounts.at(-1) ?? null },
}, null, 2));
