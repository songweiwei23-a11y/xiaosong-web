/**
 * 标题后处理（2026-10-25）：模型写出的「别只…」「XX，怎么…」这类万能模板标题，我们自己识别出来，
 * 只让模型重写这一条，别的一字不动（精准小改）。和 lib/fact-fix-chunks 同一个做法：
 * 改完不符合标准就保留原样，绝不为了改而改坏别的。
 */

import { findUnrealisticSentences } from './reality-check';

/** 万能模板：命中任何一条就要改。与 lib/sharp-rules 的 TITLE_CRAFT 禁用列表保持一致 */
export const TEMPLATE_TITLE_PATTERNS: RegExp[] = [/别只/, /你知道.{0,10}吗/, /，怎么/, /原来[，,]/, /\d+\s*个(?:技巧|方法|小tips)/i];

/** 标题最多多少字（与 TITLE_CRAFT 的「不超过 20 个字」一致） */
export const TITLE_MAX_CHARS = 20;

/**
 * 身材评价：标题不拿身材开玩笑、不做身材优劣判断（产品规则：身材不是笑点）。
 * 修改时命中这些词的新标题不采用，宁可保留原样。
 */
export const BODY_JUDGE_PATTERN = /显胖|显壮|显瘦|勒肚子|肚子|肥|胖|壮/;

export function isTemplateTitle(title: string): boolean {
  return TEMPLATE_TITLE_PATTERNS.some((re) => re.test(title));
}

/**
 * 这一行是不是标题，是的话返回标题文字。认两种写法：
 * 创作方向的「★标题」（可以有 **标题**：前缀），标题板块的「### 1. 标题」。
 */
export function titleOfLine(line: string): string | null {
  const star = line.match(/★\s*(.+?)\s*$/);
  if (star) return star[1].replace(/\*+$/, '').trim() || null;
  const heading = line.match(/^###\s*\d+\.\s*(.+?)\s*$/);
  if (heading) return heading[1].trim() || null;
  // 选题的标题行：「## 选题3：标题」（2026-10-26 起也纳入模板检查和去重）
  const topic = line.match(/^##\s*选题\s*\d+\s*[：:]\s*(.+?)\s*$/);
  if (topic) return topic[1].replace(/\*\*/g, '').trim() || null;
  return null;
}

/** 全文里有没有重复的标题（第二次及以后出现的） */
export function hasDuplicateTitle(text: string): boolean {
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    const title = titleOfLine(line);
    if (!title) continue;
    const key = title.replace(/\s+/g, '');
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** 找出全文里命中万能模板的标题，去重 */
export function findTemplateTitles(text: string): string[] {
  const found = new Set<string>();
  for (const line of text.split('\n')) {
    const title = titleOfLine(line);
    if (title && isTemplateTitle(title)) found.add(title);
  }
  return [...found];
}

/** 只让模型重写这一条标题；只输出一行新标题，不带序号、★ 和解释 */
export function repairTitlePrompt(title: string, context: string): string {
  return `只重写下面这一条短视频标题，只输出新标题一行，不要序号、★、引号和解释。

要求：
- 讲的还是同一件事、同一个人群，保留原来的具体东西（人、物、数字、地点）
- 要有一个反差、冲突或悬念，观众第一眼就知道为什么跟他有关
- 不超过 ${TITLE_MAX_CHARS} 个字，只有一个主句，不用分号连句子
- 不用「别只…」「XX，怎么…」「你知道吗」「原来…」「N 个技巧」这类万能模板
- 不拿身材开玩笑，不写「显瘦」「显胖」「显壮」「勒肚子」这类身材评价，只说衣服和穿法

原标题：${title}
${context ? `\n这条内容的背景（只用来保持方向一致）：${context}` : ''}`;
}

/** 模型的回答能不能采用：一行、不超标、不再是模板、和原标题不同 */
export function acceptRepair(original: string, answer: string | null): string | null {
  if (!answer) return null;
  const clean = answer.trim().replace(/^[★\s"“「]+/, '').replace(/[\s"”」]+$/, '');
  if (!clean || clean.includes('\n')) return null;
  if (clean.length > TITLE_MAX_CHARS) return null;
  if (isTemplateTitle(clean)) return null;
  if (BODY_JUDGE_PATTERN.test(clean)) return null;
  if (clean === original) return null;
  return clean;
}

/** 把一条标题在全文里换掉（所有出现的地方都换），别的字一个不动 */
export function replaceTitle(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

/**
 * 页面用：把正文交给服务端的后处理（app/api/polish-titles）。失败或没有模板标题时原样返回，
 * 绝不因为后处理出错而丢掉已经生成好的内容。
 */
export async function polishTitlesRemote(text: string, context = ''): Promise<string> {
  // 有标题就交给服务端：二次润色要读一遍全部标题，不只是找模板（2026-10-27）
  if (!hasAnyTitle(text) && !findTemplateTitles(text).length && !findUnrealisticSentences(text).length && !hasDuplicateTitle(text)) return text;
  try {
    const res = await fetch('/api/polish-titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context }),
    });
    if (!res.ok) return text;
    const data = (await res.json()) as { text?: unknown };
    return typeof data.text === 'string' && data.text.trim() ? data.text : text;
  } catch {
    return text;
  }
}

/** 有没有标题（有就要过一遍二次润色） */
export function hasAnyTitle(text: string): boolean {
  return text.split('\n').some((line) => titleOfLine(line) !== null);
}

/** 全文的标题，按出现的顺序，去重 */
export function allTitles(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const title = titleOfLine(line);
    if (title && !out.includes(title)) out.push(title);
  }
  return out;
}

/**
 * 标题的机械毛病（2026-10-27）：占位符、年龄段挂在标题前、超字数、一句话用分号连两个主句。
 * 这些不用读也能认出来，规则先认；读不顺、硬拼这类要读，交给模型（smoothTitlesPrompt）。
 * 注意只认范围写法（25—30岁），单个年龄（31岁还在上学）是这个人的事实，不算标签。
 */
export function titleFlaws(title: string): string[] {
  const flaws: string[] = [];
  if (/X元|XX|某某|几元|【换成你的|(?<![A-Za-z])X(?![A-Za-z])/.test(title)) flaws.push('占位符');
  if (/\d{2}\s*[—\-~–到]\s*\d{2}\s*岁/.test(title)) flaws.push('年龄段');
  if (title.length > TITLE_MAX_CHARS) flaws.push('超字数');
  if (/[；;]/.test(title)) flaws.push('分号连句');
  return flaws;
}

/**
 * 二次润色的提示词：一次把全部标题交给模型，只改读不顺、看不出在说什么、标签化的那几条。
 * 回答是「原标题 => 新标题」一行一条；都不用改就只回「无需修改」。
 */
/** 爆款元素名（与 lib/viral-elements 一致） */
const ELEMENT_NAMES = ['头牌', '怀旧', '反差', '最差', '荷尔蒙', '奇葩', '人群', '成本'];

/**
 * 每个标题分到的爆款元素（2026-10-27）：从正文「1️⃣ 爆款元素」那一栏取，按标题对上。
 * 二次润色要靠它判断「光看标题认不认得出这个元素」。
 */
export function titleElementsOf(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const block of text.split(/\n(?=## 选题\d+)/)) {
    if (!/^## 选题\d+/.test(block)) continue;
    const title = (block.split('\n')[0] || '').replace(/^## 选题\d+[：:]\s*/, '').replace(/\*\*/g, '').trim();
    const section = block.match(/爆款元素\*\*\s*\n([\s\S]*?)\n\s*\*\*2/);
    if (!title || !section) continue;
    // 元素行有的带粗体（- **头牌**：），有的不带（- 头牌：），两种都认
    const names = [...section[1].matchAll(/^- (?:\*\*)?(头牌|怀旧|反差|最差|荷尔蒙|奇葩|人群|成本)(?:\*\*)?\s*[：:]/gm)].map((m) => m[1]);
    if (names.length) out[title] = names;
  }
  return out;
}

/**
 * 判断读不顺的标题。只看读不顺，不看元素：元素是否在标题里看得见，由选题的生成规则保证；
 * 这里判断元素会误伤通顺的标题，把好的改坏（2026-10-27 实测）。
 */
export function judgeTitlesPrompt(titles: string[], context = ''): string {
  return `下面是一批短视频选题的标题。请只找出「读不顺」的标题，标准很严，只看下面三种：
- 两个不相干的名词硬拼在一起，读起来不通（比如「压箱底的裤子，像怕被评价的人」）
- 比喻或搭配说不通
- 读完不知道在说什么

通顺、看得懂的标题，哪怕你觉得还能写得更好，都不算读不顺。
只输出读不顺的标题编号，用逗号隔开，比如：2,5
一条都没有就只输出：无

${context ? `这批内容的背景（只用来保持方向一致）：${context}\n\n` : ''}标题：
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
}

/**
 * 模型有时会把思考过程一起吐出来（<think>…</think>）：先去掉，免得里面的数字和箭头被当成答案。
 * 没有闭合的思考段，整段丢掉，只留闭合之后的内容。
 */
export function stripThinking(answer: string): string {
  const closed = answer.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const open = closed.search(/<think>/i);
  return open >= 0 ? closed.slice(0, open) : closed;
}

/** 解析判断的回答：返回读不顺的标题编号（从 1 开始），认不出的数字忽略 */
export function parseJudgeAnswer(answer: string | null, count: number): number[] {
  if (!answer) return [];
  const body = stripThinking(answer);
  if (/^\s*无\s*$/.test(body)) return [];
  const nums = new Set<number>();
  for (const m of body.matchAll(/\d+/g)) {
    const n = Number(m[0]);
    if (n >= 1 && n <= count) nums.add(n);
  }
  return [...nums].sort((a, b) => a - b);
}

/**
 * 改顺的提示词：只给要改的那几条（读不顺的，或有机械毛病的），每条只改有毛病的那一小段。
 * 回答是「原标题 => 新标题」一行一条。
 */
export function rewriteTitlesPrompt(titles: string[], context = '', elements: Record<string, string[]> = {}): string {
  const list = titles.map((t, i) => {
    const flaws = titleFlaws(t);
    const el = elements[t];
    const tags = [flaws.length ? `有毛病：${flaws.join('、')}` : '', el?.length ? `元素：${el.join('、')}，标题里要光看就认得出` : ''].filter(Boolean);
    return `${i + 1}. ${t}${tags.length ? `  [${tags.join('；')}]` : ''}`;
  });
  return `下面几条短视频标题需要改顺。每条只改读不顺、标了毛病、或认不出元素的那一小段，其余保留。

规则：
- 原标题讲的事、人群和赛道词（比如大码、宝妈、学生，或衣服、外套、沙发、锅这类，按这个号的行业来）必须保留，身份词不能删
- 标了［元素：…］的，改后光看标题就要认得出这个元素（用它的句式写，比如「怀旧」就写旧的、当年的感觉），不能只在正文里出现
- 年龄段标签（如「25—30岁宝妈」）去掉年龄，身份词留着，人群写进处境和事情里
- 占位符（X、某某、几元、XX）换成具体的东西
- 比喻或硬拼的毛病：把那个比喻去掉，改成具体的事和冲突，不是加一两个字。例：「压箱底的裤子，像怕被评价的人」→「压箱底的裤子，这次敢穿出门吗」
- 改后不超过 ${TITLE_MAX_CHARS} 个字，只有一个主句，不用分号，不拿身材开玩笑，不用「别只…」「XX，怎么…」「你知道吗」「原来…」「N 个技巧」这类模板
- 其余的（没有毛病的部分）尽量保留，改动越小越好

输出格式（严格按这个，每条一行，「原标题」照抄上面的，不要标记、不要其它文字，不能漏掉箭头）：
原标题 => 新标题

${context ? `这批内容的背景（只用来保持方向一致）：${context}\n\n` : ''}标题：
${list.join('\n')}`;
}

/** 解析二次润色的回答：「原标题 => 新标题」，一行一条；认不出的行忽略 */
export function parseSmoothAnswer(answer: string | null): Array<{ from: string; to: string }> {
  if (!answer) return [];
  const pairs: Array<{ from: string; to: string }> = [];
  for (const raw of stripThinking(answer).split('\n')) {
    const line = raw.replace(/^\s*(?:\d+[.、)）]\s*|[-*]\s*)/, '').trim();
    const i = line.indexOf('=>');
    if (i < 0) continue;
    const from = line.slice(0, i).replace(/^[★\s"“「]+|[\s"”」]+$/g, '');
    const to = line.slice(i + 2).trim().replace(/^[\s"“「]+|[\s"”」]+$/g, '');
    if (from && to) pairs.push({ from, to });
  }
  return pairs;
}

/**
 * 新标题能不能采用：一行、不超标、没有毛病、不是模板、不拿身材说事、不和别的标题重复、和原来不同。
 * 不合格就保留原标题，宁可不改也不改坏。
 */
export function acceptSmooth(original: string, answer: string, others: string[]): string | null {
  const clean = answer.replace(/^[★\s"“「]+/, '').replace(/[\s"”」]+$/, '').replace(/\*\*/g, '').trim();
  if (!clean || clean.includes('\n') || clean === original) return null;
  if (titleFlaws(clean).length) return null;
  if (isTemplateTitle(clean)) return null;
  if (BODY_JUDGE_PATTERN.test(clean)) return null;
  const key = clean.replace(/\s+/g, '');
  if (others.some((t) => t.replace(/\s+/g, '') === key)) return null;
  // 改动太大就不是润色，是换了一个标题：至少四成的字要和原来一样（按最长公共子序列算）
  if (charSimilarity(original, clean) < 0.4) return null;
  return clean;
}

/** 要改的标题里，和模型写出的原标题最像的那一条；差太远就不认（返回 null） */
export function closestFlagged(said: string, flagged: string[]): string | null {
  let best: string | null = null;
  let score = 0;
  for (const t of flagged) {
    const s = charSimilarity(said, t);
    if (s > score) {
      score = s;
      best = t;
    }
  }
  return score >= 0.6 ? best : null;
}

/** 两段话的字符相似度：最长公共子序列占较长那段的比例 */
export function charSimilarity(a: string, b: string): number {
  const x = [...a.replace(/\s+/g, '')];
  const y = [...b.replace(/\s+/g, '')];
  if (!x.length || !y.length) return 0;
  let prev = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array<number>(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[y.length] / Math.max(x.length, y.length);
}

/** 只改标题所在的那一行，行里别的字不动（正文里出现同样的字不误伤） */
export function replaceTitleLine(text: string, from: string, to: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (titleOfLine(line) !== from) return line;
      return line.includes(from) ? line.replace(from, to) : line.replace(/\*\*/g, '').replace(from, to);
    })
    .join('\n');
}

/**
 * 二次润色（2026-10-27）：模板标题修过以后，再让模型把全文标题读一遍，只改生硬的那几条。
 * 模型改了不在列表里的标题、改得不合格的，都不采用。一次调用，不逐条调。
 */
export async function polishSmooth(
  text: string,
  ask: (prompt: string) => Promise<string | null>,
  context = '',
): Promise<TitlePolishResult> {
  const titles = allTitles(text);
  if (!titles.length) return { text, tried: 0, accepted: 0 };
  // 第一步：读不顺的标题由模型点出来；机械毛病（占位符、年龄段、超字数、分号）由规则认
  const elements = titleElementsOf(text);
  const judged = parseJudgeAnswer(await ask(judgeTitlesPrompt(titles, context)), titles.length).map((i) => titles[i - 1]);
  const flagged = titles.filter((t) => titleFlaws(t).length > 0 || judged.includes(t));
  if (!flagged.length) return { text, tried: 0, accepted: 0 };
  // 第二步：只把要改的那几条交给模型，改动越小越好
  const answer = await ask(rewriteTitlesPrompt(flagged, context, elements));
  let pairs = parseSmoothAnswer(answer);
  // 模型没写「原标题 =>」，只给了新标题：要改的条数一样多，就按顺序一一对上
  if (!pairs.length && answer) {
    const lines = stripThinking(answer)
      .split('\n')
      .map((l) => l.replace(/^\s*(?:\d+[.、)）]\s*|[-*]\s*)/, '').trim())
      .filter((l) => l && !l.includes('=>'));
    if (lines.length === flagged.length) pairs = flagged.map((from, i) => ({ from, to: lines[i] }));
  }
  const now = [...titles];
  let out = text;
  let tried = 0;
  let accepted = 0;
  for (const { from: said, to } of pairs) {
    // 只有要改的那几条能动：模型原样写回的最好；稍微改了写法（比如少个标点）的，就对到最像的那一条要改的标题上
    const from = flagged.includes(said) ? said : closestFlagged(said, flagged);
    if (!from) continue;
    const at = now.indexOf(from);
    if (at < 0) continue;
    tried++;
    const next = acceptSmooth(from, to, now.filter((_, i) => i !== at));
    if (!next) continue;
    out = replaceTitleLine(out, from, next);
    now[at] = next;
    accepted++;
  }
  return { text: out, tried, accepted };
}

export interface TitlePolishResult {
  text: string;
  tried: number;
  accepted: number;
}

/**
 * ask：把修改提示词发给模型，返回一行回答；失败返回 null。
 * 每条模板标题单独改，互不影响；采用不了的那条原样保留。
 */
export async function polishTitles(
  text: string,
  ask: (prompt: string) => Promise<string | null>,
  context = '',
): Promise<TitlePolishResult> {
  let out = text;
  let tried = 0;
  let accepted = 0;
  for (const title of findTemplateTitles(text)) {
    tried++;
    const next = acceptRepair(title, await ask(repairTitlePrompt(title, context)));
    if (!next) continue;
    out = replaceTitle(out, title, next);
    accepted++;
  }
  return { text: out, tried, accepted };
}
