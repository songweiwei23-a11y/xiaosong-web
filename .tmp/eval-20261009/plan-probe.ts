// 当月内容规划：真实模型探针（直接调「开物」，不扣用户次数）
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2'); }
const { askDify } = await import('@/lib/dify-task');
const { buildContentPlanPrompt, checkPlan } = await import('@/lib/content-plan');
const { resolveMix } = await import('@/lib/content-mix');
const { buildProfileSummary } = await import('@/lib/profile-summary');
const { profileFactsBlock, factGuardTail, userDonts } = await import('@/lib/fact-guard');
const { unsupportedFacts } = await import('@/lib/quality-checks');
const { splitCreationItems } = await import('@/lib/creation-items');
const { buildSearchQuery } = await import('@/lib/search-query');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const r = await fetch(`${U}/rest/v1/user_profiles?select=*&profile_name=ilike.*${encodeURIComponent('万客隆')}*`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
const profile = (await r.json())[0];
const resolved = resolveMix(profile, null, '');
const notes = '不想拍成甩卖降价那种';
const query = buildContentPlanPrompt({ lastMonth: '1-4', recordedLastMonth: null, count: 12, focus: ['store'], events: '国庆后客流少，月底想上一批新中式沙发', notes, resolved, profileSummary: buildProfileSummary(profile) })
  + profileFactsBlock(profile) + factGuardTail(userDonts([notes]));
const t = Date.now();
const res = await askDify(query, 'kaiwu-eval-plan-probe', buildSearchQuery('内容规划', { taskType: '内容规划' }, query), { signal: AbortSignal.timeout(420_000) });
const text = res.ok ? res.text : `失败：${res.message}`;
const out = 'docs/开物修复前后对比_20261009/内容规划探针.md';
fs.writeFileSync(out, `> 用时 ${Math.round((Date.now() - t) / 1000)} 秒，${text.length} 字\n\n${text}`);
console.log('用时', Math.round((Date.now() - t) / 1000), '秒', text.length, '字');
console.log('核对', JSON.stringify(checkPlan(text, resolved, 12)));
console.log('可勾选', splitCreationItems(text).items.map((i) => `${i.kind}:${i.label}`).join(' | '));
console.log('事实提醒', JSON.stringify(unsupportedFacts(text, query)));
