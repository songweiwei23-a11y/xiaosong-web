/**
 * 交付前的净化（企业商用，2026-10-11 全面检测 + 复测修正）：
 * 1. 去掉内部提示词痕迹与自检块（「校对编辑」「本轮内容落实规则」「节奏自检」「为什么这样写」「未编造」）。
 *    一级标题（# 【本轮…】）只删到下一个标题为止：复测时它把整篇删空，兜底又放回了原文，泄漏原样交付。
 * 2. 绝对化用语与平台敏感词（标准 E1、E2）：最强、最低、保证、100%、加微信、揭秘、内幕。否定语境的行（「不能说最划算」）原样保留。
 * 3. 观众板块去掉「第N计 / 36计」这类内部编号（标准 E7，创作者板块允许）。
 * 审稿优化只做第 1 条：它的原稿要被引用、比对，用语不能动。
 */
import { stripSelfCheck } from './quality-checks';

/** 整行是内部痕迹：出现就整行去掉 */
const LEAK_LINE = /【本轮|本轮目的说明|校对编辑|本轮校对|待校对结果|校对指令|审稿结果里没有材料依据|本轮内容落实规则|本条创作的连续设置|高阶自由对话|交稿前核对|交稿前最后一查|价值点应用自检|创作自检|节奏自检|发布前自检|交稿前自检|自检通过|自检结果|核对清单|数字来源核查|禁忌核查|三有自检|系统指令|未编造|没有编造|无编造|无虚构/;
/** 标题命中的整段去掉（一级标题：到下一个任意标题为止；其余：到同级或更高级标题为止） */
const LEAK_HEADING = /【本轮|本轮内容落实规则|本条创作的连续设置|本轮校对|校对指令|价值点应用自检|交稿前最后一查|高阶自由对话|自检|核对清单|数字来源核查|禁忌核查|三有自检/;

export function stripInternalLeaks(text: string, board: string): string {
  // 审稿的「核对」标题可能是正文的一部分，只去掉明确的内部痕迹，不走通用自检剥离
  const base = board === '审稿优化' ? text : stripSelfCheck(text);
  const keep: string[] = [];
  let skipLevel = 0;
  for (const line of base.split('\n')) {
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) {
      // 一级标题下面的内容不是它的子项（模型常把内部规则放在一级标题下，正文从二级标题开始）
      if (skipLevel && (skipLevel === 1 || h[1].length <= skipLevel)) skipLevel = 0;
      if (!skipLevel && LEAK_HEADING.test(h[2])) { skipLevel = h[1].length; continue; }
    }
    if (skipLevel) continue;
    if (LEAK_LINE.test(line)) continue;
    // 模型自己打的勾：「✅ 没有绝对化承诺」「✅ 无编造」是自检结论，不交付
    if (SELF_CHECK_MARK.test(line)) continue;
    keep.push(line);
  }
  return keep.join('\n').replace(/\n{3,}/g, '\n\n');
}

const SELF_CHECK_MARK = /^\s*[-*]?\s*[✅✔☑]\s*(?:没有|无|未|已|不含|不说)/;

/** 否定或警告语境：这一行在提醒别这么写（「全濮阳福利最高（绝对化用语，违规且假）」「刷量是坑」） */
const NEGATED = /不能|不要|不许|禁止|别说|别写|避免|不承诺|不说|不得|不用|不做|不写|❌|✗|×|反例|错误|误区|不可用|违规|绝对化用语|是坑|踩坑|不合规|举报|容易被/;

/** 绝对化用语（标准 E1）：所有交付板块都改。「最好」不动：「最好在傍晚拍」是拍摄建议，judge 也不计 */
const AD_RULES: Array<[RegExp, string]> = [
  [/全(?:城|网|濮阳|南乐|县|市|省|区)最/g, ''],
  // 「数据最好的是…」「最好的情况」是描述性的最高级（标准 E1 按字面算），改成「较好」；
  // 「最好拍」「最好在傍晚拍」「最好找本地的」是拍摄或操作建议，不动
  [/最好(?=的)/g, '较好'],
  [/最强/g, '很强'],
  // 「当年最火的X」是怀旧句式的说法，也是广告法绝对化用语（2026-10-28 回归：大码选题原样交付了「最火」）
  [/最火/g, '很火'],
  [/最高/g, '较高'],
  // 「最」去掉后保留原意：最划算→划算，最值→值，最低价→低价
  [/最(?=正宗|好吃|划算|新鲜|便宜|实惠|省钱|省|值|暖和|低价|低|划得来|专业|靠谱|优惠)/g, ''],
  [/必吃/g, '值得吃'],
  [/必去/g, '值得去'],
  [/第一家/g, '一家'],
  [/顶级/g, '优质'],
  [/零添加/g, '注重原料'],
  [/纯天然/g, '天然'],
  [/稳赚/g, '有望赚'],
  [/极致(?=的|好吃|美味|口感|体验|划算|性价比|服务|品质)/g, ''],
  [/100%(?=好吃|正宗|有效|见效|满意|不坑|稳赚|有效果|成功|匹配|精准|适合|命中|对口|一致|符合|转化)/g, '绝大多数'],
  // 与 judge 的豁免一致：「保证画面稳定」「保证金」是拍摄或业务词，不是承诺
  [/保证(?!画面|稳定|推进|焦点|拍摄|音|金|期限)/g, '力求'],
  [/绝对(?!化)/g, ''],
  // 扫码点单是正常的经营动作；「扫码关注 / 扫码加 / 扫码领」才是站外引流（标准 E2）
  [/加微信|加V|加v/g, '关注账号'],
  [/扫码(?=关注|加|领|进群)/g, ''],
  [/留电话/g, '来店咨询'],
];

/** 平台敏感词：所有非审稿的板块都换，拆解分析也一样（「揭秘」「内幕」不能出现在任何交付物的标题或口播里） */
const PLATFORM_RULES: Array<[RegExp, string]> = [
  [/内幕(?=揭秘|拆解)/g, ''],
  [/揭秘/g, '拆解'],
  [/内幕/g, ''],
];

/** 观众板块的内部编号（标准 E7）：起号36计、第23计。创作者板块允许 */
const NUMBER_RULES: Array<[RegExp, string]> = [
  [/起号\s*36\s*计/g, ''],
  [/第\s*\d+\s*计[·・ ]*/g, ''],
  [/36\s*计[·・ ]*/g, ''],
  [/[·・]\s*(?=[】\]）)])/g, ''],
  [/[·・]{2,}/g, '·'],
];

/** 直接给观众看、要发布的板块：除了绝对化用语和平台词，还要去掉内部编号 */
export const VIEWER_FACING_BOARDS = new Set(['脚本生成', '分镜脚本', '标题封面', '开篇钩子', '跨行业二创', '选题策划', '创作方向', '内容规划']);

/**
 * 逐行替换。否定语境的行（「不能说最划算」）整行跳过，只对绝对化用语和平台词成立；
 * 内部编号不是断言，哪怕同一行写着「错误示范」也要去掉（2026-10-11 复测：选题里的「36计」因此没去掉）。
 */
/** 这一行是否在否定或警告语境里（给别的模块复用：这类行是在提醒，不是交付事实） */
export function isNegatedLine(line: string): boolean {
  return NEGATED.test(line);
}

function applyRules(text: string, rules: Array<[RegExp, string]>, honourNegation = true): string {
  return text
    .split('\n')
    .map((line) => (honourNegation && NEGATED.test(line) ? line : rules.reduce((l, [re, to]) => l.replace(re, to), line)))
    .join('\n');
}

export function applyAdCompliance(text: string): string {
  return applyRules(text, [...AD_RULES, ...PLATFORM_RULES]);
}

/** 交付文本统一走这里（审稿优化另走 stripInternalLeaks：它的原稿要被引用，用语不能动） */
export function sanitizeOutput(text: string, board: string): string {
  const ruled = applyAdCompliance(stripInternalLeaks(text, board));
  return VIEWER_FACING_BOARDS.has(board) ? applyRules(ruled, NUMBER_RULES, false) : ruled;
}
