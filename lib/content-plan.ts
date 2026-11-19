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
import { KEPT_RULES_1021, tacticIndex1021 } from './tool-first-1021';
import { tacticsBlockedBy } from './creative-routes';
import { planRouteRule, routeAllocationRule, routeOptions, unverifiedPlanOutcome } from './script-route';
import { routeCounts, SCRIPT_STRUCTURE_NAMES } from './tactic-mix';
import { VIRAL_ELEMENTS } from './viral-elements';

export const CONTENT_PLAN_TASK_TYPE = '内容规划';

/** 视频目的和内容类型各自分配，以用户的排期设置为准。 */
export const CONTENT_TYPE_PURPOSE_RULE = '任何脚本结构配上爆款元素都可以服务大流量。各个方向根据账号目标和真实素材分别选择看点。';
export const CONTENT_TYPE_RULE = `按本轮选择的四大脚本与36计比例规划。${CONTENT_TYPE_PURPOSE_RULE}`;

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
  /** 36 计与四大脚本的比例（0 = 全用 36 计，100 = 全用四大脚本），见 lib/tactic-mix；手选了打法时不用它 */
  scriptsShare?: number;
  /** 自己手选的打法（选项 key，见 lib/script-route）：有它就只用选中的，不按比例 */
  pickedRoutes?: string[];
}

function monthSlots(counts: Record<ContentRole, number>, count: number, scripts: number) {
  const roles = CONTENT_ROLE_LIST.map(role => {
    const exact = counts[role] * scripts / count;
    return { role, four: Math.floor(exact), remainder: exact % 1 };
  }).sort((a, b) => b.remainder - a.remainder);
  const left = scripts - roles.reduce((sum, r) => sum + r.four, 0);
  const slots = roles.flatMap(({ role, four }, i) => {
    const n = four + Number(i < left);
    return [{ role, family: '四大脚本', n }, { role, family: '36计', n: counts[role] - n }].filter(slot => slot.n > 0);
  });
  while (slots.length < Math.min(count, 15)) {
    const largest = slots.reduce((a, b) => a.n >= b.n ? a : b);
    const n = Math.floor(largest.n / 2);
    largest.n -= n;
    slots.push({ ...largest, n });
  }
  return slots;
}

/** 让同一会话专心策划每个已分配的名额，由程序生成条数、周表及汇总。 */
export function monthlyRepairPlan(total: number, mix: ResolvedMix['mix'], share: number, picked: string[], query: string) {
  const counts = mixToCounts(mix, total);
  const slots = monthSlots(counts, total, routeCounts(total, share).scripts);
  const allowed = routeOptions().filter(o => !picked.length || picked.includes(o.key));
  while (slots.length < 15) slots.push({ ...slots[slots.length % Math.min(total, 15)], n: 0 });
  slots.sort((a, b) => Number(!a.n) - Number(!b.n) || Number(b.family === '四大脚本') - Number(a.family === '四大脚本'));
  const options = slots.map(s => allowed.filter(o => picked.length || (o.school === 'four') === (s.family === '四大脚本')));
  const slotLabel = (i: number) => [i + 1, slots[i].role, picked.length ? '手选' : slots[i].family, slots[i].n + '条'].join(' ');
  const catalog = [...new Set(options.flat().map(o => o.title))].join('、');
  const elements = VIRAL_ELEMENTS.map(e => e.name);
  const prompt = [
    '请在本会话校正上一次月度内容规划。输出一个 JSON 对象。条数、周表与 Markdown 由程序根据以下固定排期生成。',
    '沿用用户的行业、素材、目标和禁忌。每行独立策划一类可延展的内容。具体拍什么证据、观众为什么关心，要和所选打法一致。不要替尚未开始的采访写答案或把假设写成经营事实。优先让各方向的人、问题、看点和取材方式各有区别。',
    '每个名额给一张方向卡，形如 {"slot":1,"title":"议题范围","route":"晒过程·事件体验","element":"成本","hook":"观众会关心的具体问题和取证办法","scope":"围绕什么人和问题，可以从哪找素材","why":"和用户目标或资源的联系"}。slot 填名额序号。route 写此名额所属派别的完整结构名或计名。每行 element 只填 ' + elements.join('、') + ' 中的一个。每行都写具体的 hook，包括人设与变现方向。',
    '方向要足以延展多条选题。用户没提供的经营结果、人物经历和时间数字留待取材。把可能发生的情况写成要调查的问题。',
    '顶层还要有 strategy（一段简洁的本月思路），avoid（结合用户约束的两三条建议，字符串数组）。不要输出其他文字。',
    '可选完整名称：' + catalog, slots.map((_, i) => slotLabel(i)).join('\n'),
    '用户的档案、目标和本月条件：\n' + query.split('## 📊 内容配比（硬性要求）')[0],
    '本次仅返回 {"strategy":"…","avoid":["…"],"cards":[…]}，共 ' + slots.length + ' 张卡。title、hook、scope、why 各用一句短句，每个字段控制在40字内。直接用给定的英文字段名，按名额顺序填写。',
  ].join('\n\n');
  const plain = (v: unknown) => typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim() : '';
  type Card = { slot: number; title: string; route: string; element: string; hook: string; scope: string; why: string };
  const accepted = new Map<number, Card>();
  let strategy = '';
  let avoid: string[] = [];
  function render(raw: string): string | null {
    try {
      const data = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      if (!Array.isArray(data.cards)) return null;
      strategy ||= plain(data.strategy);
      if (!avoid.length && Array.isArray(data.avoid)) avoid = data.avoid.map(plain).filter(Boolean);
      const titles = new Set([...accepted.values()].map(c => c.title));
      for (const c of data.cards) {
        const id = Number(c?.slot);
        if (!Number.isInteger(id) || !options[id - 1] || accepted.has(id)) continue;
        const label = plain(c.route).replace(/^(?:四大脚本|36\s*计)\s*[·：:]\s*/, '');
        const route = options[id - 1].find(o => o.title === label || (o.school === 'tactic' && o.key === 'tactic:' + label));
        if (!route || !elements.includes(c.element) || !plain(c.title) || titles.has(plain(c.title)) || !plain(c.scope) || !plain(c.why) || plain(c.hook).length < 6) continue;
        if (unverifiedPlanOutcome([c.title, c.hook, c.scope, c.why].join('\n'), query)) continue;
        accepted.set(id, { ...c, slot: id, title: plain(c.title), route: route.title });
        titles.add(plain(c.title));
      }
      if (accepted.size !== slots.length || !strategy || !avoid.length) return null;
      const byRole = new Map<ContentRole, Set<string>>();
      const weeks: number[][] = [[], [], [], []];
      const cards: string[] = [];
      let turn = 0;
      for (const [i, s] of slots.entries()) {
        const c = accepted.get(i + 1)!;
        const route = options[i].find(o => o.title === c.route)!;
        const assigned: string[] = [];
        for (let j = 0; j < s.n; ++j) {
          const week = turn++ % weeks.length;
          weeks[week].push(i + 1);
          assigned.push('第' + (week + 1) + '周');
        }
        if (s.n) {
          const names = byRole.get(s.role) ?? new Set<string>();
          names.add(route.title);
          byRole.set(s.role, names);
        }
        const type = (route.school === 'four' ? '四大脚本·' : '36计·') + route.title;
        cards.push(['### 方向' + (i + 1) + '：' + plain(c.title), '- **视频目的**：' + s.role, '- **内容类型**：' + type,
          '- **内容方向**：' + plain(c.scope), '- **爆款元素**：' + c.element + '｜' + plain(c.hook),
          '- **本月条数**：' + s.n + ' 条', '- **为什么**：' + plain(c.why), '- **节奏**：' + (assigned.join('、') || '备选，本月先不拍')].join('\n'));
      }
      const month = query.match(/\d{4}年\d{1,2}月/)?.[0] ?? '本月';
      return ['# ' + month + '内容规划（共 ' + total + ' 条）', '## 📌 这个月的思路\n' + strategy,
        ['## 📊 配比一览', '| 目的 | 条数 | 主要用什么类型 |', '|---|---:|---|', ...CONTENT_ROLE_LIST.map(r => '| ' + r + ' | ' + counts[r] + ' | ' + ([...(byRole.get(r) ?? [])].join('、') || '—') + ' |')].join('\n'),
        '## 🧭 内容方向', ...cards, ['## 🗓 四周节奏', '| 周 | 发几条 | 来自哪些方向 |', '|---|---:|---|', ...weeks.map((nums, i) => '| 第' + (i + 1) + '周 | ' + nums.length + ' | ' + (nums.map(n => '方向' + n).join('、') || '—') + ' |')].join('\n'),
        '## 这个月先别做的\n' + avoid.map(v => '- ' + v).join('\n')].join('\n\n');
    } catch { return null; }
  }
  function remainingPrompt() {
    const missing = slots.map((_, i) => i).filter(i => !accepted.has(i + 1));
    return [prompt, '仅补充这些缺失名额。每张卡按该行列出的一个完整打法名重新策划内容。返回相同 JSON 格式。其他卡已保留。', ...missing.map(i => slotLabel(i) + '，可选：' + options[i].map(o => o.title).join('、')),
      '已采用的方向：' + [...accepted.values()].map(c => c.title).join('、')].join('\n');
  }
  return { prompt, render, remainingPrompt };
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
  parts.push(routeAllocationRule(p.count, p.scriptsShare, true, p.pickedRoutes));
  if (!p.pickedRoutes?.length) {
    const { scripts } = routeCounts(p.count, p.scriptsShare);
    // 先分出台数，模型负责每张卡的内容。两个维度的四舍五入不能分别丢掉尾数。
    const slots = monthSlots(counts, p.count, scripts);
    parts.push('本月排期表。每一行对应一张方向卡，按行填写目的、派别、本月条数并独立策划，之后的备选统一填0条。\n' +
      slots.map((s, i) => `方向${i + 1}　${s.role}　${s.family}　${s.n}条`).join('\n'));
  }
  if (!p.pickedRoutes?.length && p.scriptsShare !== 100) parts.push(tacticIndex1021({ exclude: tacticsBlockedBy(p.contextBlock), namesOnly: true }));
  parts.push(`## 📤 输出格式（标题和字段名原样保留）

# ${month}内容规划（共 ${p.count} 条）

## 📌 这个月的思路
三到五行：上个月的情况（有作品数据就按数据说哪类好、哪类差；没有就直说没有数据）、这个月主攻什么、配比为什么这样分。

## 📊 配比一览
| 目的 | 条数 | 主要用什么类型 |
三行，流量型 / 人设型 / 变现型。表格按排期中实际使用的类型汇总。流量型也可以用四大脚本结合爆款元素。

## 🧭 内容方向（勾选想做的方向，带去创作方向、选题或脚本接着做）

### 方向1：[方向名，10 个字左右，说的是一类内容，不是一条选题]
- **视频目的**：流量型 / 人设型 / 变现型 选一个
- **内容类型**：${planRouteRule({ share: p.scriptsShare, picked: p.pickedRoutes })} 写成「四大脚本·结构名」或「36计·第N计 计名」。四大脚本的结构名只能从这些里选，一字不差：${SCRIPT_STRUCTURE_NAMES.join('、')}
- **内容方向**：一两句话说清一类值得调查的生意问题、涉及的人与可取材的范围。每条的采访安排、镜头顺序、标题和结论留到选题阶段。
- **爆款元素**：一个元素名及观众会看到的具体内容
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
- 两派都能做流量型。按本次打法整数配额安排，采用36计的方向分散到适合的拍法。
- ${KEPT_RULES_1021}
- 方向名和内容方向写的是"一类内容"（例如「装修避坑知识」），不是一条选题（例如「买沙发前一定要问的三个问题」）
- 内容类型给出策划参考。每个方向要能容纳多种素材和表达，让下一步逐条决定选题切口和拍法。
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
