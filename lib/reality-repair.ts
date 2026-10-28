/**
 * 生成后的现实修复（2026-10-28，开物系统接管）。
 *
 * 结果出来以后先扫描：只认正则（lib/reality-check）能精确认出的写法，比如「收腰就能换风格」
 * 「穿法有多牛」「一位客户说舒服，就说明所有人」。扫到才修，只改那一句（polishSentences），别的一字不动；
 * 改完不合格就保留原句。
 *
 * 原先还有一步「模型审阅」，让模型去找正则抓不到的语义问题。2026-10-28 对照回归的原稿和交付稿发现它弊大于利，已去掉：
 * - 把正常的钩子、元素句式当成毛病（「客户刚坐下就说：这沙发不太对」被改成「客户先坐下试一试」）；
 * - 改完反而造出了小变量推大结论（「变化只来自扣子和袖口」被改成「只换了扣子和袖口，整件的感觉就不一样了」）。
 * 正则抓不到的语义问题交给提示词里的 REALITY_RULE（lib/sharp-rules），回归的原稿表明它管得住。
 *
 * 服务端（app/api/dify/stream）和每晚回归共用这一份，线上采用的和测出来的是同一套修法。
 */
import { createRateLimiter } from './rate-limit';
import { findUnrealisticSentences, polishSentences, type RealityPolishResult } from './reality-check';

/** 每人每天能做几次句子修复（现实修复和年限修复共用，只在真的要改时才计数） */
export const sentenceRepairLimited = createRateLimiter(24 * 3600_000, 60);

/**
 * 哪些板块的产出要过句子修复（现实修复、年限修复共用这一个闸门）。拆解是分析别人的视频，自由对话是闲聊，
 * 审稿的问题清单会引用原稿里的话（原稿写错了才要指出来），这三类不改。
 * 标题封面不在这里修：标题有自己的后处理（/api/polish-titles，里面就有现实检查），这里再查一遍是重复的。
 */
export function needsSentenceRepair(taskType: string | undefined): boolean {
  return !!taskType && !/拆解|自由对话|审稿|标题/.test(taskType);
}

/**
 * 扫一遍正则，有问题的句子才修；没有就原样返回，不调用模型。
 * allowRepair：真的要改之前再问一次（限流计数只在这里发生，正常稿子不占额度）。
 */
export async function repairReality(
  text: string,
  ask: (prompt: string) => Promise<string | null>,
  context: string,
  allowRepair: () => boolean = () => true,
): Promise<RealityPolishResult> {
  const sentences = findUnrealisticSentences(text);
  if (!sentences.length) return { text, tried: 0, accepted: 0 };
  if (!allowRepair()) return { text, tried: 0, accepted: 0 };
  return polishSentences(text, sentences, ask, context);
}
