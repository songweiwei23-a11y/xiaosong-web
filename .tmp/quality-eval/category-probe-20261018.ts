// 川菜品类计划的真模型探针（只读）：用线上档案当前的数据，按现在的代码拼「账号定位·快速版」提示词，调一次模型。
// 不写库。输出：答案存到 scratchpad；控制台只打印检查结果和定位开头。
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildProfileSummary, businessLines, asText } from '../../lib/profile-summary';
import { buildPositioningPrompt } from '../../lib/positioning-standards';
import { buildQuickOutputSpec } from '../../lib/positioning-sections';
import { readDifyAnswer } from '../../lib/quality-regression';

const OUT_DIR = process.argv[2];
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);

async function main() {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: profiles, error } = await db.from('user_profiles').select('*').limit(200);
  if (error) throw error;
  const profile = (profiles ?? []).find((r) => String(r.id).startsWith('74586841'));
  if (!profile) throw new Error('未找到档案');

  const summary = buildProfileSummary(profile as Record<string, unknown>);
  const lines = businessLines(profile as Record<string, unknown>);
  console.log('经营品类（摘要里的）:', lines.join('、'));
  console.log('摘要里有经营品类那一行:', summary.includes('- 经营品类（每一个都在卖，定位里都要体现）：') ? '是' : '否');

  const prompt = buildPositioningPrompt({
    profileSummary: summary,
    platform: asText(profile.account_platform, ''),
    restrictions: asText(profile.content_restrictions, ''),
    focus: 'full',
    outputSpec: buildQuickOutputSpec(),
  });
  console.log('提示词长度:', prompt.length);

  const base = (env.DIFY_BASE_URL || env.DIFY_API_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${env.DIFY_API_KEY}`, 'Content-Type': 'application/json' };
  // 先看应用名，确认打的是当前的「开物」应用（只读接口）
  const info = await fetch(`${base}/info`, { headers }).then((r) => r.json()).catch(() => ({}));
  console.log('Dify 应用名:', (info as { name?: string }).name ?? '（取不到）');

  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user: 'category-probe-20261018', response_mode: 'streaming', query: prompt,
      inputs: { query: prompt, search_query: '账号定位 快速版 经营品类探针', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为探针，不联网。' },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  const answer = await readDifyAnswer(res);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'answer.md'), answer, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'prompt.md'), prompt, 'utf8');
  console.log('答案长度:', answer.length);

  // 检查：定位开头（前 1500 字）里，每个经营品类是否都原样出现；川菜是否不只以「厨子/师傅」身份出现
  const head = answer.slice(0, 1500);
  for (const c of lines) console.log(`开头含「${c}」:`, head.includes(c) ? '是' : '否');
  const chefOnly = /川菜(厨子|师傅|厨师)/.test(head) && !/川菜[、+＋和/与]|[、+＋和/与]川菜|川菜[，,）)]/.test(head);
  console.log('川菜是否只以厨师身份出现（开头）:', chefOnly ? '是（不通过）' : '否');
  console.log('--- 定位开头 ---');
  console.log(answer.split(/\r?\n/).filter((l) => l.trim()).slice(0, 12).join('\n'));
}

main().catch((e) => { console.error('ERROR', String(e?.message || e).slice(0, 400)); process.exit(1); });
