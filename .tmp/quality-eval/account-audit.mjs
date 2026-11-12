// 只读：账号全面体检的数据部分。输出字段摘要，不输出 ID、用户标识和完整长文。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const short = (v, n = 90) => { if (v === null || v === undefined || v === '') return '（空）'; const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + `…(共${s.length}字)` : s; };

const { data: profiles } = await db.from('user_profiles').select('*');
const row = profiles.find((r) => String(r.id).startsWith('74586841'));
if (!row) throw new Error('找不到账号');
const uid = row.user_id;
const pid = row.id;

console.log('== 一、档案字段 ==');
const fields = ['profile_name', 'account_platform', 'account_track', 'account_stage', 'fans_level', 'target_gender', 'target_age', 'target_region', 'target_occupation', 'target_pain_points', 'target_needs', 'target_interests', 'content_style', 'content_format', 'content_tone', 'content_themes', 'content_value', 'unique_selling_point', 'content_restrictions', 'competitive_advantage', 'competitive_weakness', 'unique_resources', 'team_structure', 'equipment', 'shooting_location', 'editing_capability', 'video_duration', 'budget_per_video', 'monetization_model', 'product_category', 'price_range', 'conversion_path', 'conversion_barriers', 'avoid_content', 'persona_facts', 'taboo_settings', 'content_mix', 'interview_highlights', 'account_status'];
for (const f of fields) console.log(`${f}: ${short(row[f])}`);
const iv = row.interview_notes;
console.log(`interview_notes: ${iv ? '有，' + String(iv).length + '字' : '（空）'}`);

console.log('\n== 二、定位与简报（account_positioning） ==');
const { data: pos } = await db.from('account_positioning').select('positioning_type,is_active,positioning_name,full_content,strategy_summary,positioning_description,created_at,updated_at').eq('profile_id', pid).order('updated_at', { ascending: false });
for (const p of pos ?? []) console.log(`[${p.positioning_type}] 启用=${p.is_active} 名称=${short(p.positioning_name, 40)} 全文=${String(p.full_content ?? '').length}字 摘要=${String(p.strategy_summary ?? '').length}字 更新=${String(p.updated_at).slice(0, 16)}`);

console.log('\n== 三、成交理由（deal_reasons） ==');
const { data: deals, error: dErr } = await db.from('deal_reasons').select('*').eq('user_id', uid).limit(50);
if (dErr) console.log('读取失败：' + dErr.message); else console.log(`条数: ${deals?.length ?? 0}`, deals?.[0] ? '字段: ' + Object.keys(deals[0]).join(',') : '');
for (const d of (deals ?? []).slice(0, 20)) console.log('  -', short(d.reason ?? d.title ?? d.content ?? JSON.stringify(d).slice(0, 80), 70), d.is_active !== undefined ? `启用=${d.is_active}` : '');

console.log('\n== 四、生成记录（script_history，按板块计数） ==');
const { data: hist } = await db.from('script_history').select('task_type,created_at,result').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000);
const byType = {};
for (const h of hist ?? []) byType[h.task_type] = (byType[h.task_type] ?? 0) + 1;
console.log(Object.entries(byType).map(([k, v]) => `${k}:${v}`).join('  '));
console.log(`最近一条: ${hist?.[0] ? String(hist[0].created_at).slice(0, 16) + ' ' + hist[0].task_type : '（无）'}；空结果条数: ${(hist ?? []).filter((h) => !String(h.result ?? '').trim()).length}`);

console.log('\n== 五、作品与用量 ==');
const { data: works } = await db.from('works').select('id,title,created_at,stage_status,profile_id').eq('user_id', uid).limit(200);
const myWorks = (works ?? []).filter((w) => w.profile_id === pid);
console.log(`作品总数: ${works?.length ?? 0}，属于本账号: ${myWorks.length}`);
const { data: quotas } = await db.from('user_quotas').select('*').eq('user_id', uid).limit(1);
console.log('user_quotas:', quotas?.[0] ? Object.keys(quotas[0]).join(',') : '（无）');
