// 万客隆档案：门店在南乐（产品方 2026-10-09 确认）。把档案、成交理由、定位/简报里的「阜南」改成「南乐」，先备份原文
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2'); }
const U = process.env.NEXT_PUBLIC_SUPABASE_URL!, H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const get = async (q: string) => (await fetch(`${U}/rest/v1/${q}`, { headers: H })).json();
const patch = async (table: string, id: string, body: object) => { const r = await fetch(`${U}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${table} ${id} ${r.status} ${await r.text()}`); };
const PID = 'ac5fc613-c096-4d1d-89b8-6445d28d92bf';

function fix(s: string): string {
  return s
    .replace(/阜南[、\/]南乐县?[、\/]?/g, '南乐县、').replace(/阜南\/南乐/g, '南乐')
    .replace(/阜南本地及周边[（(]南乐县、/g, '南乐本地及周边（')
    .replace(/阜南/g, '南乐')
    .replace(/南乐、南乐县/g, '南乐县').replace(/南乐县、、/g, '南乐县、').replace(/南乐\/南乐/g, '南乐');
}
const deep = (v: unknown): unknown => typeof v === 'string' ? fix(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v;

const backup: Record<string, unknown> = {};
const profile = (await get(`user_profiles?select=*&id=eq.${PID}`))[0];
const pChanges: Record<string, unknown> = {};
for (const [k, v] of Object.entries(profile)) { const s = JSON.stringify(v); if (s && s.includes('阜南')) { pChanges[k] = deep(v); } }
backup.profile = Object.fromEntries(Object.keys(pChanges).map((k) => [k, profile[k]]));
const positions = await get(`account_positioning?select=*&profile_id=eq.${PID}`);
const deals = await get(`deal_reasons?select=*&profile_id=eq.${PID}`);
backup.positioning = positions.filter((x: any) => JSON.stringify(x).includes('阜南'));
backup.deal = deals.filter((x: any) => JSON.stringify(x).includes('阜南'));
const file = `docs/开物修复前后对比_20261009/阜南改南乐_原文备份.json`;
fs.mkdirSync('docs/开物修复前后对比_20261009', { recursive: true });
fs.writeFileSync(file, JSON.stringify(backup, null, 2));
console.log('原文已备份：', file);

if (Object.keys(pChanges).length) { await patch('user_profiles', PID, pChanges); console.log('档案改了：', Object.keys(pChanges).join(',')); }
for (const x of backup.positioning as any[]) {
  const body: Record<string, unknown> = {};
  for (const k of ['positioning_name', 'positioning_description', 'core_value', 'differentiation', 'target_user_profile', 'content_direction', 'monetization_path', 'seven_day_plan', 'success_criteria', 'full_content', 'strategy_summary']) if (typeof x[k] === 'string' && x[k].includes('阜南')) body[k] = fix(x[k]);
  await patch('account_positioning', x.id, body); console.log(`定位 ${x.positioning_type} 改了：`, Object.keys(body).join(','));
}
for (const x of backup.deal as any[]) {
  const body: Record<string, unknown> = {};
  for (const k of ['store_name', 'store_type', 'store_features', 'target_customer', 'analysis_result']) if (typeof x[k] === 'string' && x[k].includes('阜南')) body[k] = fix(x[k]);
  await patch('deal_reasons', x.id, body); console.log('成交理由改了：', Object.keys(body).join(','));
}
// 回读核对
const left = JSON.stringify([await get(`user_profiles?select=*&id=eq.${PID}`), await get(`account_positioning?select=*&profile_id=eq.${PID}`), await get(`deal_reasons?select=*&profile_id=eq.${PID}`)]);
console.log('回读：剩余「阜南」', (left.match(/阜南/g) || []).length, '处；「南乐」', (left.match(/南乐/g) || []).length, '处；「南乐县、、」', (left.match(/南乐县、、/g) || []).length);
for (const m of [...left.matchAll(/.{0,10}南乐.{0,10}/g)].slice(0, 12)) console.log('   ', m[0].replace(/\\n/g, ' '));
