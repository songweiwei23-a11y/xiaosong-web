// 真实模型探针（不扣用户次数）：线上今天两次真实的「带去生成选题」，按新的带入方式各出 5 条，看是否守住原方向、目的，承接内容
import fs from 'node:fs';
import { creationScript } from '@/lib/creation-flow';
import { topicReference, continuationRules, carriedIntent, intentBlock } from '@/lib/creation-continuation';
import { creationSettingsBlock } from '@/lib/creation-settings';

const env: Record<string, string> = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
const sb = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const rows = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/script_history?select=input_data,created_at&task_type=eq.${encodeURIComponent('选题策划')}&created_at=gte.2026-10-05T14:00:00Z&order=created_at.desc&limit=5`, { headers: sb })).json();
const fromReview = rows.find((r: any) => r.input_data?.sourceFrom === '审稿优化').input_data;
const fromDirection = rows.find((r: any) => r.input_data?.sourceFrom === '创作方向').input_data;

async function ask(query: string, search: string): Promise<string> {
  const r = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST', headers: { Authorization: `Bearer ${env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: { query, search_query: search, conversation_history: '', dealReasons: '' }, query, response_mode: 'streaming', user: 'probe-topic-anchor' }),
    signal: AbortSignal.timeout(240_000),
  });
  let answer = ''; const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.startsWith('data: ')) continue; try { const d = JSON.parse(line.slice(6)); if (d.event === 'message') answer += d.answer || ''; if (d.event === 'error') console.log('ERR', d.message); } catch {} } }
  return answer;
}

function build(kind: 'script' | 'direction', from: string, ref: string, intent: string, roleBlock: string, settings: any): string {
  let q = `【工作任务】生成5条选题\n\n【这批选题从带来的内容出发】🚨 最重要，压过下面所有设置\n`;
  if (kind === 'script') {
    q += `下面是编导从「${from}」带过来的一条脚本。5 条选题每一条都必须直接取材于这条脚本里的具体人物、事件、场景、细节、对话或观点，同时守住原方向的思路和目的，比如：\n- 同一件事换一个角度、换一个人的视角讲\n- 把其中一个细节、一句对话放大成一条\n- 拆成前因、经过、后续，做成系列\n- 把里面的观点或做法单独拿出来讲透\n不许只沿用大方向、系列名或账号定位，另编和这条脚本无关的新故事；也不要通用的行业选题。\n`;
  } else {
    q += `下面是编导从「${from}」带过来的内容（方向 / 方案 / 思路）。5 条选题每一条都必须按它的方向、核心思路和目的来设计：是这个方向下面能拍的具体一期，拍法照它写的来。\n- 它里面列的选题示例编导手上已经有了：5 条里不能有和示例是同一件事的（换个说法、换个数字也算同一件事），要出示例之外的新的一期，但不能跑出这个方向\n- 它写了目的，每条选题的目的就从这里面选，不出别的目的\n- 原文里的 X、XX、【待确认】是还没定的数，标题和内容里不能写成具体数字，保留占位或换成不用数字的说法\n不许借这个方向的名头，出和它的核心思路无关的选题；也不要通用的行业选题。\n`;
  }
  q += `下面的配比、打法、爆款元素都在这个范围里用。\n\n${intent}\n${ref}${continuationRules('topic')}\n\n${roleBlock}\n`;
  q += `【创新要求】\n- 追求新颖角度\n- 💡 新角度在带来的内容范围里找，不另外去追热点、时事\n\n`;
  q += `【输出格式要求】\n## 选题X：[标题]\n\n**承接**：这条取自带来内容里的哪一处（引原文一句，或点名那个细节、那条思路）\n\n**0️⃣ 视频目的**\n流量型 / 人设型 / 变现型，只写一个\n\n**3️⃣ 内容方向及目的**\n- 核心内容方向：一句话\n\n每条选题控制在150字以内\n🔗 交稿前逐条检查：这条能在带来的内容里找到出处吗？找不到就换成找得到的\n`;
  return q + creationSettingsBlock(settings);
}
const show = (label: string, a: string) => { console.log(`\n===== ${label}（${a.length} 字）`); for (const l of a.split('\n')) if (/^#{1,3}\s*选题|承接|^(?:流量型|人设型|变现型)|视频目的/.test(l.trim())) console.log(l.trim().slice(0, 160)); };

// A. 创作方向 → 生成选题
{
  const dir = fromDirection.sourceReference as string;
  const handed = { sourceContent: dir, originContent: dir };
  const intent = carriedIntent(handed);
  console.log('A 认出的目的：', intent.roles.join('、'), '｜思路：', intent.idea.slice(0, 40));
  const roleBlock = intent.roles.length >= 2 ? `【这批选题的目的】按配比：${intent.roles.map((r, i) => `${r} ${i === 0 ? 3 : 2} 条`).join('、')}` : `【这批选题的目的】全部是${intent.roles[0]}`;
  show('A 创作方向 → 选题', await ask(build('direction', '创作方向', topicReference(handed), intentBlock(intent), roleBlock, fromDirection.creationSettings), fromDirection.keywords));
}
if (process.env.ONLY_A) process.exit(0);
// B. 审稿优化 → 生成选题（方向保留在设置里）
{
  const old: string = fromReview.sourceReference;
  const curStart = old.indexOf('【当前版本】');
  const origin = old.slice(old.indexOf('\n') + 1, curStart).trim();
  const report = old.slice(curStart + '【当前版本】'.length).trim();
  const handed = { sourceContent: report, originContent: origin, settings: { workingScript: creationScript('review', report) } };
  const intent = carriedIntent(handed);
  console.log('\nB 认出的目的：', intent.roles.join('、'));
  const roleBlock = `【这批选题的目的】按配比：${intent.roles.map((r, i) => `${r} ${i === 0 ? 3 : 2} 条`).join('、')}`;
  show('B 审稿优化 → 选题', await ask(build('script', '审稿优化', topicReference(handed), intentBlock(intent), roleBlock, fromReview.creationSettings), fromReview.keywords));
}
