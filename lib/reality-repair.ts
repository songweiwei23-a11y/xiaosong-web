/**
 * 生成后的现实修复（2026-10-28，开物系统接管）。
 *
 * 结果出来以后，先扫描，再修：
 * 1. 正则（lib/reality-check）：「收腰就能换风格」「穿法有多牛」「一位客户说舒服，就说明所有人」这类写法。
 * 2. 模型审阅：正则抓不到的语义问题——一个小细节、一个动作、一句话、或者一次具体的现场反应，
 *    被推成整件事、整个人、所有人都成立的结论（比如「换个靠垫，客厅就像换了一套」）。
 *    只采用稿子里原样出现的句子，不让模型自己另写一句来改。
 * 修的时候只改扫到的那一句（polishSentences），别的一字不动；改完不合格就保留原句。
 *
 * 规则来源：lib/sharp-rules 的 REALITY_RULE。选题、标题、脚本、分镜、方向、定位、创作简报都带着它写，这里是写完以后的兜底。
 * 服务端（app/api/dify/stream）和每晚回归共用这一份，线上采用的和测出来的是同一套修法。
 */
import { createRateLimiter } from './rate-limit';
import { findUnrealisticSentences, polishSentences, type RealityPolishResult } from './reality-check';

/** 每人每天能做几次现实修复（只在真的要改时才计数） */
export const realityRepairLimited = createRateLimiter(24 * 3600_000, 60);

/**
 * 哪些板块的产出要过现实修复。拆解是分析别人的视频，自由对话是闲聊，
 * 审稿的问题清单会引用原稿里的话（原稿写错了才要指出来），这三类不改。
 * 标题封面不在这里修：标题有自己的后处理（/api/polish-titles，里面就有现实检查），这里再查一遍是重复的。
 */
export function needsRealityRepair(taskType: string | undefined): boolean {
  return !!taskType && !/拆解|自由对话|审稿|标题/.test(taskType);
}

/** 模型审阅的提示词：只找语义上的「小变量推大结论」，只列原句，不改写 */
export function overreachReviewPrompt(text: string, context: string): string {
  return `下面是一段${context || '创作'}的稿子。请只找一种毛病：把一个小细节、一个动作、一句话、一件东西的一处，或者某一次具体的现场反应，推成整件事、整个人、整家店或者所有人都成立的结论。
例子：「换个靠垫，客厅就像换了一套」「穿法一改，人就像换了个人」「一位客户说舒服，就说明挑沙发都要试靠垫」。
只列出有这种毛病的原句，逐字照抄，一行一句，最多 5 句。没有就只回答「无」。不要解释，不要改写。

稿子：
${text}`;
}

/** 解析审阅的回答：只认稿子里原样出现的句子（避免模型自己编一句去改），去掉序号和引号 */
export function parseOverreachAnswer(answer: string | null, text: string): string[] {
  if (!answer) return [];
  const out: string[] = [];
  for (const raw of answer.split('\n')) {
    const line = raw.replace(/^[\s\-*\d.、）)]+/, '').replace(/^[「"“]|[」"”]$/g, '').trim();
    if (line.length < 4 || /^无\b|^没有/.test(line)) continue;
    if (text.includes(line) && !out.includes(line)) out.push(line);
  }
  return out.slice(0, 5);
}

/**
 * 扫一遍（正则 + 模型审阅），有问题的句子才修；没有就原样返回。
 * allowRepair：真的要改之前再问一次（限流计数只在这里发生，正常稿子不占额度）。
 */
export async function repairReality(
  text: string,
  ask: (prompt: string) => Promise<string | null>,
  context: string,
  allowRepair: () => boolean = () => true,
): Promise<RealityPolishResult> {
  const judged = parseOverreachAnswer(await ask(overreachReviewPrompt(text, context)), text);
  const sentences = [...new Set([...findUnrealisticSentences(text), ...judged])];
  if (!sentences.length) return { text, tried: 0, accepted: 0 };
  if (!allowRepair()) return { text, tried: 0, accepted: 0 };
  return polishSentences(text, sentences, ask, context);
}
