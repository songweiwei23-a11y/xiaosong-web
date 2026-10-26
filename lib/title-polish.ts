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
  return null;
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
  if (!findTemplateTitles(text).length && !findUnrealisticSentences(text).length) return text;
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
