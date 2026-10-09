/**
 * 每次生成都带上的「事实护栏」（2026-10-09 全板块实测后加，服务端统一拼在提示词里）。
 *
 * 实测 16 个板块里 11 个把设想写成了真事：编客户故事（「前两天来了对小夫妻」）、替老板定经营做法
 * （「报价就是底价不还价」「厂家直供省三层代理」）、编数字和效果基准（「90% 的人」「完播率低于 40% 就换」），
 * 还把档案事实换了说法（「六大品类」= 六种风格，被写成沙发茶几床；「合伙人 15 年行业经验」被写成「15 年老店」）。
 * 各板块的规则夹在两三万字提示词中间，模型写到后面就忘了——所以这里两件事都放到服务端：
 *   1. 档案关键事实原话（profileFactsBlock）：品类、谁干了几年，原话给到，不让模型自己理解
 *   2. 交稿前最后一查（factGuardTail）：拼在整条提示词最末尾，只说「别把设想写成真事」和用户说过不要的
 */
import { businessLines } from './profile-summary';

type Profile = Record<string, unknown> | null | undefined;
const str = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join('、') : typeof v === 'string' ? v : '').trim();

/** 档案里最容易被换说法的几项，原话给出 */
export function profileFactsBlock(profile: Profile): string {
  if (!profile) return '';
  const lines: string[] = [];
  const sells = businessLines(profile);
  if (sells.length) lines.push(`- 在卖的品类（共 ${sells.length} 样）：${sells.join('、')}。说「${sells.length} 大品类」「全品类」时指的就是这几样，不能换成别的东西`);
  for (const [key, label] of [['competitive_advantage', '竞争优势原话'], ['unique_selling_point', '核心卖点原话'], ['team_structure', '团队']] as const) {
    const v = str(profile[key]);
    if (v) lines.push(`- ${label}：「${v.slice(0, 240)}」`);
  }
  if (!lines.length) return '';
  return `\n\n【档案关键事实（原话照用，不换说法、不扩写）】\n${lines.join('\n')}\n- 谁干了几年、店开了几年，按原话分清是谁的：合伙人的年限不能安到出镜人身上，从业年限也不能说成店龄（「15 年行业经验」≠「15 年老店」）`;
}

/** 用户原话里明确说不要的（「不想拍成甩卖、降价」「不做卖课」），下游每个板块都不能违背 */
export function userDonts(texts: Array<string | undefined | null>): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    for (const m of (t || '').matchAll(/(?:不想|不要|不做|不打算|不能|别|不愿意)(?:拍成|做成|搞成|弄成|显得|变成)?[^，。；！？\n]{2,20}/g)) {
      const s = m[0].replace(/[，,]$/, '').trim();
      if (!/不要编|不能编|不要虚构|不编造/.test(s)) out.add(s);
    }
  }
  return [...out].slice(0, 6);
}

/** 拼在整条提示词最后：只说这一件事，模型写完前能记住 */
export function factGuardTail(donts: string[] = []): string {
  return `\n\n【交稿前最后一查：别把设想写成真事】
- 客户故事：没给你的真实客户经历，就不写「前两天 / 上周 / 今天来了一对……」「这个客人我认识他 X 年」。需要案例的地方写【换成你接待的真实客户：……】
- 经营做法：进货渠道（厂家直供、省了几层代理）、价格政策（不还价、底价、比网上便宜、能让价）、售后承诺（包换、入户不满意帮调），档案没写的就不写，留【换成你店里的真实做法】
- 数字：没有出处的比例（「90% 的人」「十个有九个」）、预算分配比例、价格，一律写 X 或【待确认】；不给「没有数字就说××」这种兜底数
- 效果基准：不写「完播率低于 40% 就换」「每周 X 单 = 跑通」这类合格线，改成「和你自己前几条的数据比」
- 档案事实用原话（见【档案关键事实】），不换说法${donts.length ? `\n- 用户原话里说了不要的，所有内容（包括建议、选题、台词）都不能违背，也不能变相暗示：${donts.map((d) => `「${d}」`).join('')}` : ''}`;
}
