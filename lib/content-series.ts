/**
 * 内容定位的系列、商业定位的成交路径（2026-10-29）：下游要的是定位里的几节，不是原文开头。
 *
 * 原来 lib/creator-context 只取原文前 N 字：内容定位的系列（第 4726 字起）、选题来源、前 30 条节奏全被截掉，
 * 商业定位的成交路径也可能在截断之外。下游只能凭方向原文自己编。这里按标题取出真正用得上的几节。
 */

/** 注入下游提示词时的标题：内容规划、创作方向、选题都认它，用来判断这个号有没有内容定位的系列 */
export const CONTENT_SERIES_HEADING = '## 🧭 内容定位（系列）';

/** 内容定位要取的几节（标题的开头能对上就算），按在原文里的顺序 */
const SERIES_SECTIONS = [/^##\s*内容系列/, /^##\s*选题来源/, /^##\s*前\s*30\s*条节奏/];

/** 商业定位要取的几节：脚本的结尾要对上成交路径，主推产品是它要卖的东西 */
const BUSINESS_SECTIONS = [/^##\s*成交路径/, /^##\s*主推产品/];

/**
 * 按标题取节：每一节从标题到下一个一级或二级标题为止（三级标题「### 系列一」属于它），不在半句话上截断。
 * 取不到任何一节（老格式的定位）就退回原文开头 maxChars 字，不让下游空着。
 */
function sectionsOf(text: string, wanted: RegExp[], maxChars: number): string {
  const src = (text ?? '').trim();
  if (!src) return '';
  const lines = src.split('\n');
  const picked: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^##\s/.test(lines[i]) || !wanted.some((re) => re.test(lines[i]))) continue;
    let end = i + 1;
    while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end++;
    picked.push(lines.slice(i, end).join('\n').trimEnd());
    i = end - 1;
  }
  const body = picked.length ? picked.join('\n\n') : src;
  return body.length > maxChars ? `${body.slice(0, maxChars)}\n…（已截断）` : body;
}

/** 内容定位里的系列相关几节（最多 6000 字） */
export function contentSeriesOf(text: string, maxChars = 6000): string {
  return sectionsOf(text, SERIES_SECTIONS, maxChars);
}

/** 商业定位里的成交路径和主推产品（最多 1500 字） */
export function businessRouteOf(text: string, maxChars = 1500): string {
  return sectionsOf(text, BUSINESS_SECTIONS, maxChars);
}

/** 注入的上下文里有没有内容定位的系列（有就要求下游归位，没有就不要求） */
export function hasContentSeries(contextBlock: string | null | undefined): boolean {
  return !!contextBlock && contextBlock.includes(CONTENT_SERIES_HEADING);
}

/**
 * 下游统一的系列规则（选题、创作方向共用）：系列只是参考，不是限制（2026-10-29 产品方定）。
 * 系列是内容定位想好的一套路子，账号可以按它来，也可以写得比它更好；为了归位而改掉更好的内容，就是错的。
 */
export const SERIES_ASSIGNMENT_RULE = `- **系列是参考，不是框子**：内容定位里有一套系列（上面「内容定位（系列）」一节），可以参考它的受众、出发点和元素来想。但它不限制创作：只要一条内容更好、更贴这个号的用户，就直接写，不为了对上某个系列去改它。能对上的，标「所属系列：系列名」；对不上的，标「所属系列：系列外」并用一句话说明它为什么更适合这个号。这一栏只是标注，不算问题，也不是必填`;
