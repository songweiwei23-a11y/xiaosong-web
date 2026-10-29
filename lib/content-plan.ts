/**
 * 当月内容规划（2026-10-09 产品方新板块）：
 * "勾选上一个月多少条，然后策划内容配比——只规划内容类型、方向、目的，不做具体选题；
 *  勾选完成跳转到创作方向或者选题、脚本，实现闭环。"
 *
 * 流程：上个月发了多少 → 这个月发几条 → 按配比把条数分到几个内容方向（每个方向标明目的、类型、条数）→
 * 结果里勾方向，用「继续创作」带去创作方向 / 选题 / 脚本（components/workspace/CreationLinks）。
 *
 * 输出格式是定死的：每个方向一段「### 方向N：…」，下面是「视频目的 / 内容类型 / 内容方向 / 本月条数」——
 * lib/creation-items 靠「方向N」认出可勾选的条目，lib/creation-settings 的 settingsFromText 靠这几个标签
 * 把目的、类型、方向、条数带到下一页，下一页自动选好。
 */
import { CONTENT_ROLE_LIST, type ContentRole } from './content-roles';
import { directionStandard } from './direction-standard';
import { hasContentSeries } from './content-series';
import { formatMix, mixToCounts, type ResolvedMix } from './content-mix';
import type { Work } from './works';
import { tacticMixRule } from './tactic-mix';
import { REALITY_RULE, PRODUCT_HERO_RULE } from './sharp-rules';

export const CONTENT_PLAN_TASK_TYPE = '内容规划';

/** 内容类型怎么选：内容规划和创作方向共用。形式（36 计或四大脚本）不决定目的，目的由人货场、三有和爆款元素决定 */
export const CONTENT_TYPE_RULE = '先在「出发点」里定好内容（流量：人货场、三有、爆款元素；变现：人货场和要突出的成交理由），再从 36 计或四大脚本的结构里选一个形式把它拍出来，哪种目的都能用。形式不决定出发点';

/** 上个月发了多少条（勾一个区间；代表值用来推荐这个月的条数） */
export const LAST_MONTH_OPTIONS = [
  { id: '0', label: '没发', value: 0 },
  { id: '1-4', label: '1–4 条', value: 3 },
  { id: '5-8', label: '5–8 条', value: 6 },
  { id: '9-12', label: '9–12 条', value: 10 },
  { id: '13-20', label: '13–20 条', value: 16 },
  { id: '21+', label: '20 条以上', value: 24 },
] as const;
export type LastMonthId = typeof LAST_MONTH_OPTIONS[number]['id'];

export const MONTH_COUNT_OPTIONS = [4, 8, 12, 16, 20, 30] as const;

/** 这个月主攻什么（选填） */
export const PLAN_FOCUS = [
  { id: 'fans', label: '涨粉曝光', hint: '先让更多人刷到、记住' },
  { id: 'store', label: '引流到店', hint: '让附近的人来店里' },
  { id: 'deal', label: '带咨询成交', hint: '多来问价、下单' },
  { id: 'persona', label: '立人设', hint: '让人记住老板是谁' },
] as const;

/**
 * 按上个月的量推荐这个月发几条：稳着来，一次最多加一档——
 * 上个月没发或发得少的，先定一个能坚持的量（一周两条），比一下子定 30 条做不到更有用
 */
export function suggestMonthCount(last: LastMonthId | ''): number {
  const v = LAST_MONTH_OPTIONS.find((o) => o.id === last)?.value;
  if (v === undefined || v <= 3) return 8;
  if (v <= 6) return 8;
  if (v <= 10) return 12;
  if (v <= 16) return 16;
  return 20;
}

/** 系统里记录的上个月已发布作品（按发布日期算自然月；没录发布时间的不算） */
export function lastMonthPublished(works: Pick<Work, 'published_at' | 'shoot_status'>[], now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return works.filter((w) => {
    if (w.shoot_status !== 'published' || !w.published_at) return false;
    const t = new Date(w.published_at).getTime();
    return t >= start && t < end;
  }).length;
}

export const monthLabel = (d = new Date()) => `${d.getFullYear()}年${d.getMonth() + 1}月`;

export interface ContentPlanInput {
  lastMonth: LastMonthId | '';
  /** 系统里记录的上个月发布条数（没有记录为 null） */
  recordedLastMonth: number | null;
  count: number;
  focus: string[];
  events: string;
  notes: string;
  resolved: ResolvedMix;
  /** 四大脚本占人设型、变现型内容类型的比例（0–100，步长 10；0 = 全用 36 计）。lib/tactic-mix */
  scriptsShare?: number;
  profileSummary?: string;
  contextBlock?: string;
  industry?: string;
  today?: Date;
}

export function buildContentPlanPrompt(p: ContentPlanInput): string {
  const today = p.today ?? new Date();
  // 内容定位已经定好系列的号：每个方向要归到一个系列上（2026-10-29，原来规划完全不看系列，方向凭空来）
  const series = hasContentSeries(p.contextBlock);
  const seriesField = series ? `- **所属系列**：能对上上面「内容定位（系列）」里的一个系列就写系列名；对不上写「系列外」并一句话说明为什么它更适合这个号。只是标注，不是必填\n` : '';
  const month = monthLabel(today);
  const counts = mixToCounts(p.resolved.mix, p.count);
  const countLine = CONTENT_ROLE_LIST.filter((r) => counts[r] > 0).map((r) => `${r} ${counts[r]} 条`).join('、');
  const last = LAST_MONTH_OPTIONS.find((o) => o.id === p.lastMonth);
  const focus = p.focus.map((id) => PLAN_FOCUS.find((f) => f.id === id)?.label).filter(Boolean).join('、');
  const parts: string[] = [];
  parts.push(`【工作任务】给这个账号做 ${month} 的内容规划：这个月一共发 ${p.count} 条，把条数分到几个内容方向上。只规划内容类型、方向和目的，**不出具体选题、不写标题、不写脚本**——具体选题用户勾选方向后去「选题策划」再出。`);
  parts.push(`今天是 ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日。`);
  if (p.profileSummary) parts.push(`## 这个账号\n${p.profileSummary}`);
  else if (p.industry) parts.push(`## 这个账号\n还没有建档，用户说自己是做：${p.industry}`);
  if (p.contextBlock) parts.push(p.contextBlock);
  parts.push(`## 上个月和这个月
- 上个月发了：${last ? last.label : '用户没选'}${p.recordedLastMonth !== null ? `（系统里记录的已发布作品 ${p.recordedLastMonth} 条）` : ''}
- 这个月计划发：**${p.count} 条**（一周约 ${Math.max(1, Math.round(p.count / 4))} 条）${focus ? `\n- 这个月主攻：${focus}` : ''}${p.events.trim() ? `\n- 这个月的安排和节点（用户原话）：${p.events.trim()}` : ''}${p.notes.trim() ? `\n- 其他要求（用户原话）：${p.notes.trim()}` : ''}
上个月发得少、这个月一下子加很多的，在思路里提醒一句怎么保证发得出来（比如先攒素材、一次拍几条），不要改条数。`);
  parts.push(`## 📊 内容配比（硬性要求）
这 ${p.count} 条按：**${countLine}**（配比 ${formatMix(p.resolved.mix)}，${p.resolved.label}）。
- 每个方向只担一个目的；同一目的可以分成几个方向
- 所有方向的「本月条数」加起来必须正好 ${p.count} 条，每种目的的条数也必须和上面对上`);
  parts.push(`## 📤 输出格式（标题和字段名原样保留）

# ${month}内容规划（共 ${p.count} 条）

## 📌 这个月的思路
三到五行：上个月的情况（有作品数据就按数据说哪类好、哪类差；没有就直说没有数据）、这个月主攻什么、配比为什么这样分。

## 📊 配比一览
| 目的 | 条数 | 主要用什么类型 |
三行，流量型 / 人设型 / 变现型。三行各写这一类方向的出发点和条数：流量写主要配哪些爆款元素、看点是什么；变现写要突出的成交理由；人设写要让人记住这个人的哪一点。目的只决定条数，不决定形式。

## 🧭 内容方向（勾选想做的方向，带去创作方向、选题或脚本接着做）

### 方向1：[方向名，10 个字左右：一类看得见的内容（一件东西、一个人或一件事），不是一条选题、一个议题或问题，也不能只是一个拍摄地点]
- **视频目的**：流量型 / 人设型 / 变现型 选一个
- **职能**：拉新、立人设、转化、留存里选一个，一句话说明这一类内容在账号里干什么
- **出发点**：按目的写（标准见下面「好方向的标准」）——
  · 流量型写「围绕：人、货、场里的哪一个｜三有：有用、有趣、有共鸣写一个词，观众看完得到什么｜爆款元素：哪一个，让观众看到什么（选反差就写清两边是哪两样货、哪两类人或哪两个时代）｜看点：陌生人凭什么停下」
  · 变现型写「成交理由：……｜主角：在卖的哪样东西，观众看完凭什么觉得它好」（不写成穿法、搭法这类技巧）
  · 人设型写「人：让人记住这个人的哪一点，靠哪件真事撑着」
${seriesField}- **内容方向**：一两句话，这一类拍什么——镜头里出现的具体的货、人、事或场景，落在这个号真有的人、货、场上（不写具体哪一期、不写标题，也不定拍法——拍法在选题层定）
- **本月条数**：N 条
- **为什么**：一两句，这个号做这一类凭什么做得成（它在卖的货、出镜的人、能用的场、团队条件），以及为什么能达到这个目的；不写放到哪个号都成立的话（如「刚起号需要曝光」），也不写「裤子是门店在卖的品类」这种只报档案的话。不写注意事项（「需核实」「不预设」「只呈现这一次」这些留给选题层）
- **看什么数据**：按这个方向的职能选两三个具体指标，不照抄别的方向：拉新看完播、停留时长和评论里的共鸣词；立人设看主页访问和关注增长；转化看私信咨询和到店人数；留存看收藏、复看和回访评论。不写「播放量高就行」
- **节奏**：放在第几周

（方向一共 15～20 个，按上面的格式依次写 方向2、方向3……一直写到 15～20 个。同一目的可以按不同题材拆成几个方向；本月条数为 0 的方向是备选，节奏写「备选，本月先不拍」）

## 🗓 四周节奏
| 周 | 发几条 | 来自哪几个方向 |
每周的条数加起来等于 ${p.count}。

## ⚠️ 这个月先别做的
两三条，说清为什么（结合档案里的禁忌、资源和上个月的数据）。`);
  // 好方向标准（2026-10-29 瘦身）：出发点方法、主题来源、元素、红线、搭配对照、36 计计名收成一份，见 lib/direction-standard
  parts.push(directionStandard({ profileSummary: p.profileSummary, contextBlock: p.contextBlock }));
  parts.push(`## 要求
- 方向数 ${Math.min(15, p.count)}～${Math.min(20, p.count)} 个，各方向的「本月条数」加起来正好是 ${p.count} 条，每个方向至少 1 条；少于下限不算完成。每个方向只写一类内容，不要把几类合成一个方向
- **先多后选，挑最好的**：心里先拟比要求多一半的候选方向（候选不输出），按上面的标准挑最好的 ${Math.min(15, p.count)}～${Math.min(20, p.count)} 个，再用「交稿前对照」查整批搭配
- 方向之间要真的不一样：不能只换拍摄地点、只换一件货，也不能把同一个问题换个生活处境（时间紧、家人、朋友、第一次）再问一遍
- ${REALITY_RULE}
- ${PRODUCT_HERO_RULE}
- 方向名写的是"一类内容"（例如「装修避坑知识」），不是一条选题（例如「买沙发前一定要问的三个问题」）
- 方向要落在这个号真实在卖的品类、真实的团队和拍摄条件上；档案里没有的经营事实（价格、活动、客户故事、数据）不写成真事
- 没有作品数据就不编"上个月哪类数据好"；不写"完播率低于多少就换"这类合格线，改成和自己前几条比
- 用户说过不要做的，任何方向都不能违背`);
  return parts.join('\n\n');
}

export interface PlanDirection { title: string; role: ContentRole | null; count: number }

/** 解析结果里的方向：标题、目的、本月条数 */
export function parsePlanDirections(text: string): PlanDirection[] {
  const blocks = text.split(/\n(?=#{2,4}\s*方向\s*\d+)/).filter((b) => /^#{2,4}\s*方向\s*\d+/.test(b.trim()));
  return blocks.map((b) => {
    const clean = b.replace(/\*\*/g, '');
    const title = clean.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
    const roleLine = clean.match(/视频目的\s*[：:]\s*([^\n]+)/)?.[1] ?? '';
    const role = CONTENT_ROLE_LIST.find((r) => roleLine.includes(r)) ?? null;
    const count = Number(clean.match(/本月条数\s*[：:]\s*(\d+)/)?.[1] ?? 0);
    return { title, role, count };
  });
}

/** 核对：条数加起来对不对、每种目的对不对 */
export function checkPlan(text: string, resolved: ResolvedMix, total: number) {
  const dirs = parsePlanDirections(text);
  const want = mixToCounts(resolved.mix, total);
  const got = Object.fromEntries(CONTENT_ROLE_LIST.map((r) => [r, 0])) as Record<ContentRole, number>;
  for (const d of dirs) if (d.role) got[d.role] += d.count;
  const sum = dirs.reduce((a, d) => a + d.count, 0);
  const ok = dirs.length > 0 && sum === total && CONTENT_ROLE_LIST.every((r) => got[r] === want[r]);
  const fmt = (c: Record<ContentRole, number>) => CONTENT_ROLE_LIST.map((r) => `${r.replace('型', '')} ${c[r]}`).join(' / ');
  return { ok, counted: dirs.length > 0, directions: dirs.length, sum, summary: fmt(got), expected: fmt(want) };
}
