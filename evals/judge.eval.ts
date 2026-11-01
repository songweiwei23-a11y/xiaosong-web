// 方法论评审（2026-11-01）：按 evals/rubrics.ts 的标准卡，逐条判一份选题或脚本，要求每条引用原文作证据。
// 先在校准表的 20 份上跑，和产品方的判断比一致率；对得上才拿它去验收整批稿子。
// 评审走线上 Dify 应用（产品方 11-01 选定），所以会带着线上的系统提示词和知识库检索；提示词里明确只按标准卡判。
//
// 环境变量：JUDGE=1、JUDGE_ITEMS（条目 json：[{no, board, summary, text}]，校准表的对应表就是）、JUDGE_OUT（输出目录）、
//          JUDGE_CONCURRENCY（默认 4）
// 用法：npx vitest run --config vitest.eval.config.ts evals/judge.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { askDify } from '@/lib/dify-task';
import { RUBRICS, type RubricBoard } from './rubrics';
import { topicSections } from './materials';
import { buildProfileSummary } from '@/lib/profile-summary';
import { EVAL_INDUSTRIES } from './fixtures/profiles';

const ROOT = 'E:/小宋/腾讯云生产版同步_20260918';
for (const line of fs.readFileSync(`${ROOT}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

/**
 * topic：脚本对应的那条选题（判「按选题的结构写事件」用）；没给时按 code、run 去评测目录取第一条。
 * summary、text 没给时按 code 取测评档案、按 file（评测目录下的相对路径）读稿子。
 */
type Item = { no: number; board: RubricBoard; summary?: string; text?: string; file?: string; topic?: string; code?: string; run?: string };

function filled(item: Item): Item & { summary: string; text: string } {
  const ind = EVAL_INDUSTRIES.find((x) => x.code === item.code);
  const summary = item.summary ?? (ind ? buildProfileSummary(ind.profile as never) + (ind.interviewNotes ? `\n\n访谈要点：${ind.interviewNotes}` : '') : '');
  const text = item.text ?? (item.file ? fs.readFileSync(`${RUNS}/${item.file}`, 'utf8') : '');
  return { ...item, summary, text };
}

const RUNS = `${ROOT}/evals/runs`;
function topicOfItem(item: Item): string {
  if (item.topic || item.board !== '脚本' || !item.code) return item.topic ?? '';
  for (const run of [item.run, 'baseline-s1']) {
    const p = `${RUNS}/${run}/${item.code}/09-选题.out.md`;
    if (run && fs.existsSync(p)) return topicSections(fs.readFileSync(p, 'utf8'))[0]?.body ?? '';
  }
  return '';
}
export type Verdict = '合格' | '不合格' | '说不清';
export type JudgeResult = {
  /** 选题：路人的话复述 */
  restate?: string;
  /** 脚本：选题结构每一步对到脚本里的事；结尾让人记住的那句 */
  events?: string;
  ending?: string;
  criteria: { id: string; verdict: Verdict; evidence: string; reason: string }[];
  overall: '合格' | '不合格'; score: number; reason: string;
};

export function judgePrompt(item: Item): string {
  const rubric = RUBRICS[item.board];
  const cards = rubric.map((c) => [`### ${c.id} ${c.name}`, `判什么：${c.question}`, `合格：${c.pass}`, `不合格：${c.fail}`, ...(c.note ? [`注意：${c.note}`] : [])].join('\n')).join('\n\n');
  const example = rubric.map((c) => `{"id":"${c.id}","verdict":"合格|不合格|说不清","evidence":"引用原文一句","reason":"一句话"}`).join(',');
  const topic = topicOfItem(item);
  // 先逼它做两件具体的事，再判：选题先用路人的话复述；脚本先把选题结构的每一步对到脚本里的事，再摘结尾那句
  const steps = item.board === '选题'
    ? '"restate":"用一个不在这个行业的路人的话，复述这条选题讲什么、他为什么想看（不许用行业词）；复述不出来就写「复述不出来」",'
    : '"events":"选题定的结构每一步 → 脚本里对应的那件事（引原文）；没写到的写「无」，档案和选题里都没有、是编出来的写「编」","ending":"结尾让人记住的那一句（引原文）；只有「评论区说说」这类套话写「无」",';
  return `【任务：按标准卡验收一份${item.board}】
你是短视频编导的验收员，职责是挑毛病，不是鼓励。只按下面的标准卡判断，不用你写稿时的其他规则，也不要改写稿子。

## 这个账号的档案（判断「只有这家店拍得出来」「拍得出来」「是不是真事」的依据）
${item.summary}
${topic ? `\n## 这条脚本要写的选题（判断「按选题的结构写事件」的依据）\n${topic}\n` : ''}
## 要验收的${item.board}
<<<
${item.text}
>>>

## 标准卡
${cards}

## 怎么判
- 默认不合格：只有找得到原文证据、完全符合「合格」那一段的描述，才判合格。结构标签、小标题都在，不等于合格；要看内容本身。
- 每条标准判「合格」「不合格」或「说不清」。拿不准就判「说不清」，不要往好里判。
- 每条都引用稿子里的一句原文作证据（40 字以内）；判不合格时引用出问题的那一句。没有可引用的写「无」。引用里原有的双引号改成「」。
- 档案和选题里都没有、稿子却写成真事的经历、客户故事、身世、数字，算编造：选题判「拍得出来」不合格，脚本判「像本人说的话」不合格。
- 整体：任何一条不合格，整体就是不合格；四条都合格才是合格。
- 分数 1–5：5 = 可以直接拍、会有效果；3 = 能用，但平淡或要改；1 = 不能用。
- 只输出下面这个 JSON，不要输出任何别的文字：
{${steps}"criteria":[${example}],"overall":"合格|不合格","score":3,"reason":"一句话"}`;
}

/**
 * 模型引用原文时会把原文里的英文双引号原样带进字符串（"evidence": "看到"还剩"就做减法"），JSON 就坏了。
 * 输出是一行一个字段，按行把值里面的双引号换成「」再解析。
 */
function repairQuotes(json: string): string {
  return json.split('\n').map((line) => {
    const m = line.match(/^(\s*"[a-z]+"\s*:\s*")(.*)("\s*,?\s*)$/);
    if (!m) return line;
    let n = 0;
    return m[1] + m[2].replace(/(?<!\\)"/g, () => (n++ % 2 === 0 ? '「' : '」')) + m[3];
  }).join('\n');
}

export function parseJudge(raw: string, board: RubricBoard): JudgeResult | null {
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  const body = raw.slice(a, b + 1);
  let j: JudgeResult;
  try {
    j = JSON.parse(body) as JudgeResult;
  } catch {
    try { j = JSON.parse(repairQuotes(body)) as JudgeResult; } catch { return null; }
  }
  try {
    const ids = RUBRICS[board].map((c) => c.id);
    if (!Array.isArray(j.criteria) || !ids.every((id) => j.criteria.some((c) => c.id === id))) return null;
    return j;
  } catch {
    return null;
  }
}

it('方法论评审', async () => {
  if (!process.env.JUDGE) return;
  const items = (JSON.parse(fs.readFileSync(process.env.JUDGE_ITEMS!, 'utf8')) as Item[]).map(filled);
  const out = process.env.JUDGE_OUT!;
  fs.mkdirSync(out, { recursive: true });
  const concurrency = Math.max(1, Number(process.env.JUDGE_CONCURRENCY ?? 4));
  let failures = 0;
  let halted = false;

  const runOne = async (item: Item) => {
    const file = `${out}/${item.no}.json`;
    if (fs.existsSync(file) || halted) return;
    // 之前解析失败存下来的原始输出，先用现在的解析再试一次，能用就不再调模型
    for (const f of fs.readdirSync(out).filter((x) => x.startsWith(`${item.no}.fail-`)).sort()) {
      const raw = fs.readFileSync(`${out}/${f}`, 'utf8');
      const parsed = parseJudge(raw, item.board);
      if (parsed) {
        fs.writeFileSync(file, JSON.stringify({ no: item.no, board: item.board, ms: 0, ...parsed, raw, from: f }, null, 2), 'utf8');
        console.log(`#${item.no} ${item.board} ${parsed.overall} ${parsed.score} | ${parsed.criteria.map((c) => `${c.id}:${c.verdict}`).join(' ')}（用存下的 ${f}）`);
        return;
      }
    }
    const prompt = judgePrompt(item);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const t0 = Date.now();
      const res = await askDify(prompt, `judge-${item.no}`, `${item.board} 验收 标准 爆款元素 钩子 结构`);
      const parsed = res.ok ? parseJudge(res.text, item.board) : null;
      if (res.ok && parsed) {
        failures = 0;
        fs.writeFileSync(file, JSON.stringify({ no: item.no, board: item.board, ms: Date.now() - t0, ...parsed, raw: res.text }, null, 2), 'utf8');
        console.log(`#${item.no} ${item.board} ${parsed.overall} ${parsed.score} | ${parsed.criteria.map((c) => `${c.id}:${c.verdict}`).join(' ')}`);
        return;
      }
      console.log(`#${item.no} 第 ${attempt} 次失败：${res.ok ? '输出不是要求的 JSON' : res.message}`);
      if (res.ok) fs.writeFileSync(`${out}/${item.no}.fail-${attempt}.txt`, res.text, 'utf8');
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
    failures += 1;
    if (failures >= 3) halted = true; // 连续失败多半是余额或服务问题，停下来看原因
  };

  const queue = [...items];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length && !halted) await runOne(queue.shift()!);
  }));
  console.log(halted ? '连续失败，已停止' : `done ${fs.readdirSync(out).filter((f) => f.endsWith('.json')).length} / ${items.length}`);
});
