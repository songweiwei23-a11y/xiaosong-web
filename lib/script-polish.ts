/**
 * 脚本打磨（2026-11-01 产品方定）：初稿 → 体检 → 只改被点名的句子 → 复检，最多两轮，只升不降。
 *
 * 为什么不是再写一遍：一次生成要同时守事实、按选题结构走、有落点、还要像本人说话，提示词九成是「不能编」，
 * 出来的台词稳妥但像讲解稿（口吻合格约 40%）；往生成提示词里补口吻要求，三次都没用。
 * 窄任务比宽任务稳：体检只管找问题、点名到原句，润色只管改这几句，其余一字不动。
 *
 * 体检两层：
 * 1. 确定性（不调模型）：新冒出来的具体细节、营销腔、口播和分镜对不上、结尾动作和目的对不上、讲解味的句子、口播里的占位。
 * 2. 一次结构化审稿：按好脚本的 9 条逐条看，第一条就是对照选题卡和结构公式，逐个节点查有没有落成片子里的事。
 *
 * 采用规则：新版的问题分数更低、又没有新增具体细节，才换上；否则保留上一版。
 */
import { noiseReport } from './noise-check';
import { extractPlainCopy } from './script-copy';
import { createRateLimiter } from './rate-limit';

/** 每人每天最多打磨几条脚本（每条最多 5 次模型调用） */
export const scriptPolishLimited = createRateLimiter(24 * 3600_000, 40);
/**
 * 线上开关：默认关，环境变量 SCRIPT_POLISH=1 才开（2026-11-01）。
 * 打磨第二版评估器口吻 4→11/24，产品方盲评却 6 对里 5 对选旧版（旧版口语化、有代入感、画面感、细腻感情；
 * 打磨编了场景、把具体信息改虚、加了套话）。对齐他的标准之前不在线上跑。
 */
export const SCRIPT_POLISH_ENABLED = process.env.SCRIPT_POLISH === '1';
export const POLISH_MAX_ROUNDS = 2;

export interface PolishContext {
  /** 这条脚本承接的选题卡（打法、内容推进、关键画面、开篇钩子、结尾），没有时是用户输入的主题 */
  topicCard: string;
  /** 内容树和这一计 / 这一类脚本的结构公式 */
  structure: string;
  purpose: string;
  /** 人设事实卡、档案关键事实、能用的数字 */
  facts: string;
  /** 本人说过的话（前采要点、访谈、真实情况）：只学说话的样子 */
  voice: string;
}

export interface ScriptIssue {
  rule: string;
  level: '必须改' | '建议改';
  quote: string;
  problem: string;
  fix: string;
}

/** 从一段文字里取「开头标记」到下一个结束标记之间的内容 */
function between(text: string, start: RegExp, end: RegExp, max: number): string {
  const m = text.match(start);
  if (!m || m.index === undefined) return '';
  const rest = text.slice(m.index + m[0].length);
  const e = rest.search(end);
  return (e >= 0 ? rest.slice(0, e) : rest).trim().slice(0, max);
}

/** 从构造好的脚本提示词（lib/script-design、lib/boards/script-query 的格式）里取打磨要用的几块 */
export function polishContextFromPrompt(query: string): PolishContext {
  const topicCard = between(query, /【当前版本】\n/, /\n【(?:本条创作|承接已有|本条内容当前)|\n## 原始想法/, 3500)
    || between(query, /## 用户本轮要求\n/, /\n## (?!选题)/, 3500)
    || (query.match(/- 主题：([^\n]+)/)?.[1] ?? '');
  const tree = between(query, /## 本条的内容树[^\n]*\n/, /\n## /, 600);
  const tactic = between(query, /## 🎬 本条用的拍法[^\n]*\n/, /\n## /, 1500)
    || between(query, /## 用户明确选择的脚本方法\n/, /\n## /, 1500)
    || between(query, /## 📐 脚本结构[^\n]*\n/, /\n## /, 1500);
  const purpose = query.match(/- 目的：(流量型|人设型|变现型)/)?.[1]
    ?? query.match(/视频目的[^\n]*\n?\s*(流量型|人设型|变现型)/)?.[1]
    ?? query.match(/这条视频的目的：(流量型|人设型|变现型)/)?.[1] ?? '';
  const card = between(query, /### 🪪 人设事实卡[^\n]*\n/, /\n这是编导确认过的事实|\n### /, 1200);
  const keyFacts = between(query, /【档案关键事实[^\n]*\n/, /\n\n|\n【/, 800);
  const numbers = between(query, /## 🔢 本次能用的具体数字[^\n]*\n/, /\n\n|\n## |\n【/, 300);
  const facts = [card && `人设事实卡：\n${card}`, keyFacts && `档案关键事实：\n${keyFacts}`, numbers && `能用的数字：${numbers}`].filter(Boolean).join('\n\n');
  const voice = query.split('\n')
    .filter((l) => /前采要点|访谈要点|真实情况|口头禅|原话/.test(l) && /[：:]/.test(l) && !/不|别|禁/.test(l.slice(0, 6)))
    .map((l) => l.replace(/^\s*-\s*/, '').replace(/\*\*/g, '').trim())
    .slice(0, 4).join('\n');
  return { topicCard, structure: [tree, tactic].filter(Boolean).join('\n\n'), purpose, facts, voice };
}

const HYPE = /匠心|用心|精心|秉承|致力于|倾力打造|深耕|沉淀|赋能|焕新/;
const LECTURE = /代表|意味着|也就是说|因此|从而|综上|总的来说|由此可见|首先.{0,20}其次|第一[，、,].{0,40}第二[，、,]/;
const CTA_OF: Record<string, RegExp> = {
  流量型: /关注|评论|留言|说说/,
  人设型: /关注|主页/,
  变现型: /私信|到店|来店|进店|预约|留资|电话|地址|团购|咨询/,
};

const norm = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, '');

/** 第 3 步分镜里的台词行 */
function storyboardLines(text: string): string[] {
  const start = text.search(/^\s*#{1,4}\s*第\s*3\s*步/m);
  if (start < 0) return [];
  const end = text.slice(start).search(/^\s*#{1,4}\s*第\s*4\s*步/m);
  const part = end > 0 ? text.slice(start, start + end) : text.slice(start);
  return [...part.matchAll(/台词[^：:\n]{0,6}[：:]\s*([^\n]+)/g)].map((m) => m[1]);
}

export interface LocalReport {
  issues: ScriptIssue[];
  /** 新冒出来的具体细节（比对键），采用新版时不许多出来 */
  novel: Set<string>;
}

/** 不调模型的体检 */
export function localScriptIssues(text: string, ctx: PolishContext, known: string): LocalReport {
  const issues: ScriptIssue[] = [];
  const novel = noiseReport(text, [known]).novel;
  for (const s of novel.slice(0, 4)) issues.push({ rule: '真实', level: '必须改', quote: s.text, problem: '资料里找不到这个具体细节', fix: '删掉，或换成不依赖它的说法；确实要数字就写【待确认：…】' });
  const spoken = extractPlainCopy(text).split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of spoken.filter((l) => HYPE.test(l)).slice(0, 2)) issues.push({ rule: '像本人', level: '必须改', quote: l, problem: '营销腔', fix: '换成老板平时会说的话' });
  for (const l of spoken.filter((l) => LECTURE.test(l)).slice(0, 3)) issues.push({ rule: '像本人', level: '建议改', quote: l, problem: '像讲解稿，不像当面说话', fix: '改成对着眼前这个人、指着眼前的东西说' });
  const board = storyboardLines(text).map(norm).join('|');
  if (board) for (const l of spoken.filter((l) => norm(l).length >= 6 && !board.includes(norm(l))).slice(0, 2)) issues.push({ rule: '能拍', level: '建议改', quote: l, problem: '口播这句在分镜台词里找不到', fix: '分镜台词和口播保持逐字一致' });
  const tail = spoken.slice(-2).join(' ');
  if (ctx.purpose && CTA_OF[ctx.purpose] && tail && !CTA_OF[ctx.purpose].test(tail)) issues.push({ rule: '结尾动作', level: '必须改', quote: spoken.at(-1) ?? '', problem: `结尾没有${ctx.purpose}对应的那个动作`, fix: ctx.purpose === '流量型' ? '只给关注或评论里的一个' : ctx.purpose === '人设型' ? '只给关注或看主页里的一个' : '只给私信、到店、留资里的一个' });
  if (ctx.purpose === '流量型' && /私信|到店|来店|进店|预约|团购/.test(tail)) issues.push({ rule: '结尾动作', level: '必须改', quote: spoken.at(-1) ?? '', problem: '流量型结尾带了成交动作', fix: '只给关注或评论' });
  const holes = spoken.filter((l) => /【(?:待确认|换成|示例)/.test(l)).length;
  if (spoken.length && holes / spoken.length > 0.3) issues.push({ rule: '能拍', level: '建议改', quote: '', problem: `口播 ${spoken.length} 句里 ${holes} 句是占位，台词被掏空了`, fix: '常识和行业里大家都知道的照常写；只有这家店自己的事实（价格、经历、做法、顾客原话）缺了才占位' });
  return { issues, novel: new Set(novel.map((s) => s.key)) };
}

const RULES = `A 结构落地：对照【选题卡】和【结构公式】，公式的每个节点、选题卡里写的内容推进和关键画面，是不是都变成了片子里真实发生的事（手上做了什么、眼前出现了什么、拿出了什么），顺序对不对。缺了哪个节点、哪个关键画面没落到台词和镜头上，点名。
B 开头：第一句就是看点，路人一听就懂；选题卡定了开篇钩子或开头原句的，用的是不是它；开头许的东西后面兑现了没有。
C 中段有事：推进靠的是事和证据，不是一句接一句讲道理。要讲知识的，是不是放进了一个当面对一个人讲的场景里（对着来店的这位客人、对着手上这样东西）。
D 像本人：口播是不是出镜人本人当面跟一个人说话：大白话，说手上的、眼前的。点名最不像的几句（像讲解稿、像旁白、像念稿、像广告）。
E 落点：行动指令前的最后一句，是不是落在看得见的东西上（刚做完的动作、眼前的结果、观众下一步具体怎么做），而不是收成一句道理。
F 结尾动作：只有一个，和目的对得上（流量型：关注或评论；人设型：关注或看主页；变现型：私信、到店、留资里的一个）。
G 真实：档案和选题卡里没有的数字、经历、顾客原话、经营承诺，有没有写成真事。
H 主角和现实：变现、对比类，变的是这家卖的东西或手艺；有没有一个小改变推出大结论、一次反应推成普遍道理。
I 能拍：一个人一部手机拍得出来；第 2 步口播和第 3 步分镜台词一字不差（一个镜头里放几句口播是正常的，只查字有没有不一样）。`;

/** 结构化审稿的提示词：按 9 条逐条看，问题点名到原句，输出 JSON */
export function buildScriptReviewPrompt(text: string, ctx: PolishContext, local: ScriptIssue[]): string {
  return `【高阶自由对话】【任务：脚本体检】你是带过几百个实体店账号的编导主管。下面这条脚本要交给出镜人去拍，先按 9 条标准逐条体检，找出真正影响质量的问题，每个问题都要点名到原稿里的一句话。只体检，不重写。

【这条的目的】${ctx.purpose || '未写明，按选题卡判断'}

【选题卡（脚本要把它的思路和设计完整落地）】
${ctx.topicCard || '（没有选题卡）'}

【结构公式】
${ctx.structure || '（没有指定结构）'}

【档案事实（只有这些能当真事写）】
${ctx.facts || '（没有）'}

【9 条标准】
${RULES}

${local.length ? `【程序先查出的线索（要核实，不一定都对）】\n${local.map((i) => `- ${i.rule}｜${i.problem}${i.quote ? `｜「${i.quote.slice(0, 60)}」` : ''}`).join('\n')}\n\n` : ''}【待体检的脚本】
${text}

【输出】只输出一个 JSON 代码块，不要别的文字：
\`\`\`json
{"issues": [{"rule": "A", "level": "必须改", "quote": "原稿里有问题的那一句，逐字照抄", "problem": "一句话：哪里不对", "fix": "一句话：往哪个方向改（不写成品句）"}]}
\`\`\`
要求：
- 只列真正影响质量的，最多 10 条；同一句只列一次。没有问题就输出 {"issues": []}。
- D 这一条一定要单独看：从第 2 步口播里挑出最不像本人当面说话的 2–3 句（像讲解稿、像旁白、像念稿、在讲道理的），各列一条，不要因为别的问题多就省掉。口播通篇都像聊天才可以不列。
- level：不改就不能拍、或明显违背选题设计的写「必须改」，其余写「建议改」。
- fix 只写往哪个方向改，不写示范句；不替顾客、受访者、路人设想他们会说什么、有什么反应、结果怎样。
- JSON 字符串里不要用英文双引号，引原句里的引号一律写成「」。
- quote 必须是原稿里真实存在的一句（第 2 步口播里的优先）；结构缺节点没有对应原句时，quote 写缺口前面那一句。`;
}

/**
 * 修补字符串里没转义的英文双引号（2026-11-01 实测：模型引原句时把「"你早上只有五分钟"」原样写进 JSON，整段解析不了，体检白做）。
 * 前一个非空白字符是 { [ , : 或后一个非空白字符是 : , } ] 的，才是 JSON 结构用的引号；其余换成「」。
 */
export function repairJsonQuotes(s: string): string {
  const chars = [...s];
  const prev = (i: number) => { for (let j = i - 1; j >= 0; j--) if (!/\s/.test(chars[j])) return chars[j]; return ''; };
  const next = (i: number) => { for (let j = i + 1; j < chars.length; j++) if (!/\s/.test(chars[j])) return chars[j]; return ''; };
  let open = true;
  return chars.map((c, i) => {
    if (c !== '"' || chars[i - 1] === '\\') return c;
    if ('{[,:'.includes(prev(i)) || ':,}]'.includes(next(i))) return c;
    const r = open ? '「' : '」';
    open = !open;
    return r;
  }).join('');
}

function jsonBlock(raw: string): unknown {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (m ? m[1] : raw).trim();
  try { return JSON.parse(body); } catch { /* 先修补没转义的引号 */ }
  try { return JSON.parse(repairJsonQuotes(body)); } catch { /* 往下找第一个完整的 JSON */ }
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  for (let end = body.length; end > start; end--) {
    try { return JSON.parse(body.slice(start, end)); } catch { /* 继续缩 */ }
  }
  return null;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function parseReviewIssues(raw: string | null): ScriptIssue[] | null {
  if (!raw) return null;
  const data = jsonBlock(raw) as { issues?: unknown } | null;
  const list = Array.isArray(data) ? data : Array.isArray(data?.issues) ? data!.issues : null;
  if (!list) return null;
  return (list as Record<string, unknown>[]).filter((x) => x && typeof x === 'object').map((x) => ({
    rule: str(x.rule).slice(0, 4) || '?',
    level: str(x.level) === '建议改' ? '建议改' : '必须改',
    quote: str(x.quote),
    problem: str(x.problem),
    fix: str(x.fix),
  } as ScriptIssue)).filter((i) => i.problem).slice(0, 10);
}

/** 定点润色的提示词：只改点名的句子，输出替换对 */
export function buildScriptPolishPrompt(text: string, ctx: PolishContext, issues: ScriptIssue[]): string {
  return `【高阶自由对话】【任务：脚本定点修改】下面这条脚本体检出了几处问题。**只改这几处**，其余内容一个字都不要动。

【这条的目的】${ctx.purpose || '按选题卡'}

【选题卡（缺的节点、关键画面按它补）】
${ctx.topicCard || '（没有选题卡）'}

【结构公式】
${ctx.structure || '（没有指定结构）'}

【档案事实（只有这些能当真事写）】
${ctx.facts || '（没有）'}
${ctx.voice ? `\n【出镜人自己说过的话（只学他说话的样子：用词、句子长短、语气，不搬里面的事）】\n${ctx.voice}\n` : ''}
【要改的几处】
${issues.map((i, n) => `${n + 1}. [${i.rule}·${i.level}] ${i.quote ? `「${i.quote}」` : '（没有对应原句）'}：${i.problem}。方向：${i.fix}`).join('\n')}

【怎么改】
- 改后的台词是出镜人本人当面对一个人说的话：大白话，说手上在做的、眼前看得到的东西。
- 结构缺了节点或关键画面：在点名的那一句里把它补成一两句真实发生的事，事件按选题卡写，不另编情节。
- 不新增档案和选题卡里没有的数字、经历、顾客原话、经营承诺；缺这些事实时用不依赖它的说法。
- 不编出镜人的经历和顾客的规律（「我这几年看下来」「来的客人都……」「很多妈妈跟我说」都不行），档案里没写的就不写。
- 不替顾客、受访者、路人写他们的反应、回答和结果（「他在想了」「顾客点点头」「那就按这个剪」都不行）。结构要的真实反应、现场结果是现场拍的，写成「（按现场真实反应）」这样的占位，不编。
- 上面「方向」只是提示往哪改，不要照抄里面的话。
- 口播（第 2 步）和分镜台词（第 3 步）里的同一句话，按同一个改法一起改；一句一行的口播不要并成一行。

【原稿】
${text}

【输出】只输出一个 JSON 代码块，不要别的文字。每一项是一处替换：from 是原稿里要换掉的那一句（逐字照抄，一整句），to 是换上去的话：
\`\`\`json
[{"from": "原稿里的一句", "to": "改好的话"}]
\`\`\`
JSON 字符串里不要用英文双引号，句子里的引号一律写成「」。`;
}

/**
 * 经历、顾客规律的句式（2026-11-01 盲评后加）：润色写出「我这4年看下来，秋天来补货的妈妈和夏天不一样」，
 * 数字在档案里有，新细节检测拦不住，可整句是编出来的经历和顾客规律。原句没有、新句才有的，这一处替换不用。
 */
export const EXPERIENCE_CLAIM = /我(?:这|干了|做了|开了|拍了|剪了|教了)?.{0,4}(?:年|些年)(?:看下来|下来|里|来)|(?:来的|进店的|找我的)(?:客人|顾客|妈妈|家长|车主|学员)(?:都|基本|大多|一般|多半)|(?:很多|不少|好多|大部分)(?:客人|顾客|妈妈|家长|车主|学员)(?:都|跟我说|会说|来了就)|(?:客人|顾客)(?:常|总|经常|老)(?:说|问)|我见过(?:太多|很多|不少)/;

export function parseReplacements(raw: string | null): { from: string; to: string }[] {
  if (!raw) return [];
  const data = jsonBlock(raw);
  const list = Array.isArray(data) ? data : Array.isArray((data as { replacements?: unknown })?.replacements) ? (data as { replacements: unknown[] }).replacements : [];
  return (list as Record<string, unknown>[]).map((x) => ({ from: str(x?.from), to: str(x?.to) }))
    .filter((r) => r.from.length >= 2 && r.to && r.from !== r.to)
    .filter((r) => !(EXPERIENCE_CLAIM.test(r.to) && !EXPERIENCE_CLAIM.test(r.from)));
}

/**
 * 原句的宽松匹配：标点、空白可以不一样（口播和分镜里同一句的标点常常不同）。
 * 句末的标点连带吃掉（不吃换行）：新句自己带标点，原来句末的「？」「。」留着就成了「？？」「。。」
 */
function looseRegex(sentence: string): RegExp | null {
  const chars = [...sentence.replace(/[\s\p{P}\p{S}]+$/u, '')];
  if (chars.length < 2) return null;
  const parts = chars.map((c, i) => {
    if (/[\s\p{P}\p{S}]/u.test(c)) return '[\\s\\p{P}\\p{S}]*';
    const lit = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return i === chars.length - 1 ? lit : `${lit}[\\s\\p{P}\\p{S}]*?`;
  });
  try { return new RegExp(`${parts.join('')}[\\p{P}\\p{S}]*`, 'gu'); } catch { return null; }
}

/** 把替换对用到全文：每一处出现都换（口播和分镜一起换）；返回换了几处 */
export function applyReplacements(text: string, pairs: { from: string; to: string }[]): { text: string; applied: number } {
  let out = text;
  let applied = 0;
  for (const { from, to } of pairs) {
    // 宽松匹配一遍扫完：逐字相同的和标点不同的（分镜里常写「,」口播写「，」）都换到；
    // 只扫一遍，换上去的新句不会再被扫到（新句是在原句后面补内容时，扫两遍会补两次）
    const re = looseRegex(from);
    const next = re ? out.replace(re, to) : out.split(from).join(to);
    if (next !== out) { out = next; applied++; }
  }
  return { text: out, applied };
}

/** 问题分数：必须改 3 分，建议改 1 分；新冒出来的具体细节每个 3 分 */
export function issueScore(issues: ScriptIssue[], local: LocalReport): number {
  const llm = issues.reduce((s, i) => s + (i.level === '必须改' ? 3 : 1), 0);
  return llm + local.novel.size * 3;
}

/** 新版多出了原来没有的具体细节（润色借机编了东西） */
export function addsFabrication(before: LocalReport, after: LocalReport): string[] {
  return [...after.novel].filter((k) => !before.novel.has(k));
}

export interface PolishRound { round: number; issues: number; replacements: number; applied: number; scoreBefore: number; scoreAfter: number | null; accepted: boolean; reason: string }
/** reviewFailed：第一次体检没出结果（模型没回、或回的不是 JSON），和「体检过了、没有问题」分开记 */
export interface PolishResult { text: string; changed: boolean; calls: number; rounds: PolishRound[]; firstIssues: ScriptIssue[]; reviewFailed: boolean }

/**
 * 打磨一条脚本。ask 调一次模型，失败返回 null（不打断交付，失败就保留当前稿）。
 * known 是已知素材（档案、用户原话、选题），用来判断有没有新编的具体细节。
 */
export async function polishScript(p: {
  draft: string; query: string; known: string;
  ask: (prompt: string) => Promise<string | null>;
  maxRounds?: number; onStatus?: (message: string) => void;
  /** 重试前等多久（毫秒）：线路限流时马上重试多半还是失败；测试里传 0 */
  retryDelayMs?: number;
}): Promise<PolishResult> {
  const ctx = polishContextFromPrompt(p.query);
  const maxRounds = p.maxRounds ?? POLISH_MAX_ROUNDS;
  let calls = 0;
  const rounds: PolishRound[] = [];
  const again = async (q: string) => { if (p.retryDelayMs) await new Promise((r) => setTimeout(r, p.retryDelayMs)); return p.ask(q); };
  let cur = p.draft;
  let curLocal = localScriptIssues(cur, ctx, p.known);

  p.onStatus?.('正在体检这条脚本：结构、开头、口吻、落点逐条看');
  // 体检没出结果（多半是线路限流，模型返回空）就再试一次：体检拿不到，整条打磨就跳过了
  const reviewPrompt = buildScriptReviewPrompt(cur, ctx, curLocal.issues);
  calls++;
  let issues = parseReviewIssues(await p.ask(reviewPrompt));
  if (issues === null) { calls++; issues = parseReviewIssues(await again(reviewPrompt)); }
  if (issues === null) return { text: cur, changed: false, calls, rounds, firstIssues: [], reviewFailed: true };
  const firstIssues = issues;
  // 体检没挑出问题、程序也没查出新细节：原稿交付
  if (!issues.length && !curLocal.novel.size) return { text: cur, changed: false, calls, rounds, firstIssues, reviewFailed: false };
  // 程序查出的新细节，体检没点到的也要改
  const merge = (llm: ScriptIssue[], local: LocalReport, localIssues: ScriptIssue[]) => {
    const quoted = new Set(llm.map((i) => norm(i.quote)));
    return [...llm, ...localIssues.filter((i) => i.rule === '真实' && local.novel.size && !quoted.has(norm(i.quote)))];
  };
  let todo = merge(issues, curLocal, curLocal.issues);

  /*
   * 复检是「核对」，不是重新体检（2026-11-01 对照后改）：原来复检重新挑一遍毛病，模型每次总能挑出五六条新的，
   * 点名的问题改好了分数也降不下来，12 份里 5 份卡在「复检没有变好」。现在只核两件事：
   * 点名的几处改好了没有；被替换的那几句有没有引入新问题。改好过半、没引入新的「必须改」、没新编细节，才采用。
   */
  for (let round = 1; round <= maxRounds && todo.length; round++) {
    p.onStatus?.(`第 ${round} 轮打磨：改 ${todo.length} 处`);
    const polishPrompt = buildScriptPolishPrompt(cur, ctx, todo);
    calls++;
    let pairs = parseReplacements(await p.ask(polishPrompt));
    if (!pairs.length) { calls++; pairs = parseReplacements(await again(polishPrompt)); }
    const { text: cand, applied } = applyReplacements(cur, pairs);
    const log: PolishRound = { round, issues: todo.length, replacements: pairs.length, applied, scoreBefore: todo.length, scoreAfter: null, accepted: false, reason: '' };
    rounds.push(log);
    if (!applied) { log.reason = '没有可用的替换'; break; }
    const candLocal = localScriptIssues(cand, ctx, p.known);
    const added = addsFabrication(curLocal, candLocal);
    if (added.length) { log.reason = `新冒出了具体细节：${added.slice(0, 3).join('、')}`; break; }

    p.onStatus?.(`第 ${round} 轮复检`);
    const verifyPrompt = buildScriptVerifyPrompt(cand, ctx, todo, pairs);
    calls++;
    let verdict = parseVerify(await p.ask(verifyPrompt), todo.length);
    if (!verdict) { calls++; verdict = parseVerify(await again(verifyPrompt), todo.length); }
    if (!verdict) { log.reason = '复检没出结果'; break; }
    const left = verdict.unresolved.map((i) => todo[i]).filter(Boolean);
    log.scoreAfter = left.length + verdict.added.length;
    const resolved = todo.length - left.length;
    if (resolved * 2 < todo.length) { log.reason = `点名的 ${todo.length} 处只改好了 ${resolved} 处`; break; }
    /*
     * 改坏的那几句退回原句，改好的照样留（2026-11-01 第二轮对照后改）：原来一轮里只要有一句引入了「必须改」的新问题，
     * 整轮作废，5 句改好 4 句也全退回。退回的就是原稿里的句子，不用再复检。
     */
    const badNew = verdict.added.filter((i) => i.level === '必须改');
    const isBad = (r: { to: string }) => badNew.some((i) => i.quote && (norm(r.to).includes(norm(i.quote)) || norm(i.quote).includes(norm(r.to))));
    const keep = pairs.filter((r) => !isBad(r));
    let next = cand;
    let nextLocal = candLocal;
    if (keep.length < pairs.length) {
      if (!keep.length) { log.reason = `换上去的句子都引入了新问题：${badNew[0]?.problem.slice(0, 40) ?? ''}`; break; }
      const partial = applyReplacements(cur, keep);
      if (!partial.applied) { log.reason = '退回改坏的句子后没剩可用的替换'; break; }
      next = partial.text;
      nextLocal = localScriptIssues(next, ctx, p.known);
    } else if (badNew.length) {
      // 认不出是哪一句改坏的：稳妥起见整轮不采用
      log.reason = `改的时候引入了新问题：${badNew[0].problem.slice(0, 40)}`;
      break;
    }
    log.accepted = true;
    log.reason = `改好 ${resolved}/${todo.length} 处，采用${keep.length < pairs.length ? `（${pairs.length - keep.length} 句改坏了，退回原句）` : ''}`;
    cur = next; curLocal = nextLocal;
    todo = merge([...left, ...verdict.added.filter((i) => !badNew.includes(i))], curLocal, curLocal.issues);
  }
  return { text: cur, changed: cur !== p.draft, calls, rounds, firstIssues, reviewFailed: false };
}

/** 复检：逐条核点名的几处改好了没有，只看被替换的句子有没有引入新问题 */
export function buildScriptVerifyPrompt(text: string, ctx: PolishContext, issues: ScriptIssue[], pairs: { from: string; to: string }[]): string {
  return `【高阶自由对话】【任务：脚本修改复检】下面这条脚本按体检意见改过几句。你只做两件事：
1. 逐条核对【体检点名的问题】在改后的稿子里改好了没有；
2. 只看【这次换上去的句子】，有没有引入新问题（编了档案和选题卡里没有的数字、经历、顾客原话或反应；不像本人说话；破坏了选题设计的结构）。
不重新体检全文，没被改的句子不评。

【这条的目的】${ctx.purpose || '按选题卡'}

【选题卡】
${ctx.topicCard || '（没有选题卡）'}

【档案事实（只有这些能当真事写）】
${ctx.facts || '（没有）'}

【体检点名的问题】
${issues.map((i, n) => `${n + 1}. [${i.rule}] ${i.quote ? `「${i.quote}」` : ''}：${i.problem}`).join('\n')}

【这次换上去的句子】
${pairs.map((r, n) => `${n + 1}. 原句「${r.from}」→ 新句「${r.to}」`).join('\n')}

【改后的稿子】
${text}

【输出】只输出一个 JSON 代码块：
\`\`\`json
{"unresolved": [没改好的问题编号], "added": [{"rule": "D", "level": "必须改", "quote": "新句里有问题的那一句", "problem": "一句话：哪里不对", "fix": "一句话：往哪改"}]}
\`\`\`
都改好、也没引入新问题，就输出 {"unresolved": [], "added": []}。added 只放真正影响质量的，fix 只写方向，不写示范句。JSON 字符串里不要用英文双引号，引号一律写成「」。`;
}

export function parseVerify(raw: string | null, count: number): { unresolved: number[]; added: ScriptIssue[] } | null {
  if (!raw) return null;
  const data = jsonBlock(raw) as { unresolved?: unknown; added?: unknown } | null;
  if (!data || typeof data !== 'object' || !Array.isArray(data.unresolved)) return null;
  const unresolved = (data.unresolved as unknown[]).map((x) => Number(x) - 1).filter((i) => Number.isInteger(i) && i >= 0 && i < count);
  const added = parseReviewIssues(JSON.stringify({ issues: Array.isArray(data.added) ? data.added : [] })) ?? [];
  return { unresolved: [...new Set(unresolved)], added };
}
