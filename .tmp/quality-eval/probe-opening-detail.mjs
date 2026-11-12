// 只读：最近一条「开篇钩子」的创作设置（目的、方向、出镜、人员、用户想法）和参考内容的关键段落，以及对应档案的出镜人事实。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('script_history').select('input_data,created_at').eq('task_type', '开篇钩子').order('created_at', { ascending: false }).limit(1);
const inp = data[0].input_data;
const cs = inp.creationSettings ?? {};
console.log('profileId 前缀:', String(inp.profileId ?? '').slice(0, 8));
for (const k of ['purpose', 'purposeText', 'direction', 'personnel', 'audience', 'userIntent', 'scene', 'style', 'tactic']) {
  if (cs[k] !== undefined) console.log(`cs.${k}:`, JSON.stringify(String(cs[k]).slice(0, 160)));
}
console.log('cs.focusContent 前 200 字:', JSON.stringify(String(cs.focusContent ?? '').slice(0, 200)));
console.log('cs.notes 前 120 字:', JSON.stringify(String(cs.notes ?? '').slice(0, 120)));
const ref = String(inp.referenceContent ?? '');
console.log('--- referenceContent 含关键词的行:');
for (const line of ref.split('\n')) {
  if (/出镜|目的|方向|老板|师傅|人设|口吻|第一人称|我/.test(line)) console.log('  ', line.slice(0, 160));
}
const { data: prof } = await db.from('user_profiles').select('id,persona_facts,content_style,target_gender').eq('id', inp.profileId).maybeSingle();
console.log('--- 档案人设事实卡(persona_facts):', prof?.persona_facts == null ? '空' : JSON.stringify(prof.persona_facts).slice(0, 300));
console.log('档案 content_style:', JSON.stringify(prof?.content_style ?? null));
const { data: brief } = await db.from('creative_briefs_v1').select('*').limit(1).maybeSingle?.() ?? {};
