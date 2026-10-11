/**
 * 交付前的净化（企业商用，2026-10-11 全面检测）：
 * 1. 去掉内部提示词痕迹与自检块（P1：「作为审稿校对编辑…」「根据本轮校对指令…」「【本轮内容落实规则】」「节奏自检」）
 * 2. 修正断言式用语（P3：「最划算」「必吃」「100%」「保证见效」）与平台敏感词（P4：「揭秘」「加微信」）
 * 否定语境的行（「不能说最划算」「禁止保证见效」）是在提醒别这么写，原样保留。
 */
import { stripSelfCheck } from './quality-checks';

/** 整行是内部痕迹：出现就整行去掉 */
const LEAK_LINE = /校对编辑|本轮校对|待校对结果|校对指令|审稿结果里没有材料依据|本轮内容落实规则|本条创作的连续设置|高阶自由对话|交稿前核对|交稿前最后一查|价值点应用自检|创作自检|节奏自检|发布前自检|交稿前自检|自检通过|自检结果|核对清单|数字来源核查|禁忌核查|三有自检|系统指令/;
/** 标题命中的整段去掉（到下一个同级或更高级标题为止） */
const LEAK_HEADING = /本轮内容落实规则|本条创作的连续设置|本轮校对|校对指令|价值点应用自检|交稿前最后一查|高阶自由对话|自检|核对清单|数字来源核查|禁忌核查|三有自检/;

export function stripInternalLeaks(text: string, board: string): string {
  // 审稿的「核对」标题可能是正文的一部分，只去掉明确的内部痕迹，不走通用自检剥离
  const base = board === '审稿优化' ? text : stripSelfCheck(text);
  const keep: string[] = [];
  let skipLevel = 0;
  for (const line of base.split('\n')) {
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) {
      if (skipLevel && h[1].length <= skipLevel) skipLevel = 0;
      if (!skipLevel && LEAK_HEADING.test(h[2])) { skipLevel = h[1].length; continue; }
    }
    if (skipLevel) continue;
    if (LEAK_LINE.test(line)) continue;
    keep.push(line);
  }
  return keep.join('\n').replace(/\n{3,}/g, '\n\n');
}

const NEGATED = /不能|不要|不许|禁止|别说|别写|避免|不承诺|不说|不得|不用|不做|不写|❌|✗|×|反例|错误|误区|不可用/;
/** 面向观众的文案：断言式用语、站外引流都要改 */
const AD_RULES: Array<[RegExp, string]> = [
  [/全城最|全网最/g, ''],
  // 「最」去掉后保留原意：最划算→划算，最值→值。「最好」不动（「最好在傍晚拍」是拍摄建议）
  [/最(?=正宗|好吃|划算|新鲜|便宜|实惠|省钱|省|值|暖和|低价|划得来)/g, ''],
  [/必吃/g, '值得吃'],
  [/100%(?=好吃|正宗|有效|见效|满意|不坑|稳赚|有效果|成功)/g, '绝大多数'],
  [/保证(?=见效|效果|好吃|正宗|不坑|不踩坑|不吃亏|稳赚|赚钱|涨粉|成交|一定)/g, '力求'],
  [/绝对(?=好吃|正宗|有效|见效|不坑|划算|稳赚)/g, ''],
  // 扫码点单、留电话预约是正常的经营动作，只改「加微信 / 加V」这种站外引流
  [/加微信|加V|加v/g, '关注账号'],
];
/** 平台敏感词：所有非审稿的板块都换，拆解分析也一样（「揭秘」不能出现在任何交付物的标题里） */
const PLATFORM_RULES: Array<[RegExp, string]> = [[/揭秘/g, '拆解']];

/** 直接给观众看、要发布的板块。拆解、知识库、定位、建议类只换平台敏感词：它们引用原话做分析，不能改引文 */
export const VIEWER_FACING_BOARDS = new Set(['脚本生成', '分镜脚本', '标题封面', '开篇钩子', '跨行业二创', '选题策划', '创作方向', '内容规划']);

export function applyAdCompliance(text: string, viewerFacing = true): string {
  const rules = viewerFacing ? [...AD_RULES, ...PLATFORM_RULES] : PLATFORM_RULES;
  return text
    .split('\n')
    .map((line) => (NEGATED.test(line) ? line : rules.reduce((l, [re, to]) => l.replace(re, to), line)))
    .join('\n');
}

/** 交付文本统一走这里（审稿优化另走 stripInternalLeaks：它的原稿要被引用，用语不能动） */
export function sanitizeOutput(text: string, board: string): string {
  return applyAdCompliance(stripInternalLeaks(text, board), VIEWER_FACING_BOARDS.has(board));
}
