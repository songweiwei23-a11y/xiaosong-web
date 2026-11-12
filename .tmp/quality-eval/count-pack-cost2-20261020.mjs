// 只读：次数包定价依据——creation_completion_evidence.usage_metadata 里的真实模型成本。不写库。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await db
  .from('creation_completion_evidence')
  .select('feature, usage_metadata')
  .limit(3000);
if (error) throw error;

const rows = data ?? [];
const withPrice = rows.filter((r) => Number.isFinite(Number(r.usage_metadata?.total_price)));
const withTokens = rows.filter((r) => Number.isFinite(Number(r.usage_metadata?.total_tokens)));
const currencies = {};
for (const r of rows) {
  const c = r.usage_metadata?.currency ?? 'unknown';
  currencies[c] = (currencies[c] ?? 0) + 1;
}
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const byFeature = {};
for (const r of withPrice) (byFeature[r.feature] ??= []).push(Number(r.usage_metadata.total_price));
const tokensByFeature = {};
for (const r of withTokens) (tokensByFeature[r.feature] ??= []).push(Number(r.usage_metadata.total_tokens));
const summary = (obj) => Object.fromEntries(Object.entries(obj).map(([f, xs]) => [f, { n: xs.length, median: median(xs), max: Math.max(...xs) }]));

console.log(JSON.stringify({
  rows: rows.length,
  withPrice: withPrice.length,
  withTokens: withTokens.length,
  currencies,
  priceByFeature: summary(byFeature),
  tokensByFeature: summary(tokensByFeature),
  sampleUsage: rows[0]?.usage_metadata ?? null,
}, null, 2));
