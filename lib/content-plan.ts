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
import { formatMix, mixToCounts, type ResolvedMix } from './content-mix';
import type { Work } from './works';

export const CONTENT_PLAN_TASK_TYPE = '内容规划';

/** 内容类型怎么选：内容规划和创作方向共用，流量里不许出现教知识 */
export const CONTENT_TYPE_RULE = '按小黄的脚本结构选一个。流量型用反向操作、冷知识、借势、地域差异、街头采访这类公式；人设型用个人成就、贵人相助、世俗偏见（观点类归人设型）；变现型用案例引入、痛点型、推荐型、晒过程。教知识不是流量，只放变现型';

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
  profileSummary?: string;
  contextBlock?: string;
  industry?: string;
  today?: Date;
}

export function buildContentPlanPrompt(p: ContentPlanInput): string {
  const today = p.today ?? new Date();
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
三行，流量型 / 人设型 / 变现型。**流量型那一行只写流量打法**（反向操作、冷知识、借势、地域差异、街头采访、整蛊等），不写教知识、行业干货、避坑；教知识只放变现型那一行。

## 🧭 内容方向（勾选想做的方向，带去创作方向、选题或脚本接着做）

### 方向1：[方向名，10 个字左右，说的是一类内容，不是一条选题]
- **视频目的**：流量型 / 人设型 / 变现型 选一个
- **内容类型**：${CONTENT_TYPE_RULE}
- **内容方向**：一两句话说清这一类拍什么范围、从哪类素材取材（不写具体哪一期、不写标题）
- **本月条数**：N 条
- **为什么**：一两句，和这个号的档案、数据或这个月的节点挂上
- **节奏**：放在第几周

（方向一共 15～20 个，按上面的格式依次写 方向2、方向3……一直写到 15～20 个。同一目的可以按不同题材拆成几个方向；本月条数为 0 的方向是备选，节奏写「备选，本月先不拍」）

## 🗓 四周节奏
| 周 | 发几条 | 来自哪几个方向 |
每周的条数加起来等于 ${p.count}。

## ⚠️ 这个月先别做的
两三条，说清为什么（结合档案里的禁忌、资源和上个月的数据）。`);
  parts.push(`## 要求
- 方向必须写满 15～20 个，少于 15 个不算完成；每个方向只写一类内容，不要把几类合成一个方向
- 流量型方向的内容类型只能是流量打法（反向操作、冷知识、借势、地域差异、街头采访、整蛊、反认知）；教知识、行业干货、避坑一律归变现型，不许出现在流量型里
- 方向名和内容方向写的是"一类内容"（例如「装修避坑知识」），不是一条选题（例如「买沙发前一定要问的三个问题」）
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
