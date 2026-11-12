/**
 * 创作方向（2026-10-02 新板块）。
 *
 * 产品方："很多编导运营本身就很厉害——他们创作已经不是为了拍视频而去拍视频，而是带着目的去拍。
 * 用户只需要告诉 AI 目的，目的做成很多可选项，用户勾选（也能自己写）；AI 基于档案把方向和思路铺开、
 * 最大化，再推荐一个最佳的。用户勾选方向，按老路子跳去选题、脚本等板块继续，系统自动填好。"
 *
 * 输出用「### 方向1：…」，结果下面的勾选列表（lib/creation-items）能直接一条一条认出来。
 */

import { creativeCraftRules } from './creative-craft';

export const DIRECTION_TASK_TYPE = '创作方向';

export interface Choice<T extends string = string> { id: T; label: string; hint: string }

/** 拍视频是为了什么：可多选 */
export const PURPOSES: Choice[] = [
  { id: 'store', label: '引流到店', hint: '让附近的人看完就想来' },
  { id: 'fans', label: '涨粉曝光', hint: '先把播放和关注做起来' },
  { id: 'persona', label: '立人设', hint: '让人记住老板、记住这家店' },
  { id: 'trust', label: '建立信任', hint: '让人放心下单、不怕踩坑' },
  { id: 'new', label: '推新品', hint: '新菜、新服务要让人知道' },
  { id: 'deal', label: '卖团购 / 促销', hint: '直接带来核销和订单' },
  { id: 'festival', label: '节日 / 热点营销', hint: '借节日、本地热点的流量' },
  { id: 'repeat', label: '老客复购', hint: '让来过的人再来、带朋友来' },
  { id: 'price', label: '拉高客单价', hint: '让人愿意点贵的、点套餐' },
  { id: 'offpeak', label: '淡季 / 闲时补客', hint: '把不忙的时段填满' },
  { id: 'private', label: '加微信 / 做私域', hint: '把客人留到自己手里' },
  { id: 'live', label: '直播预热', hint: '给直播间引人' },
  { id: 'brand', label: '口碑 / 品牌形象', hint: '让人觉得这家店靠谱、有档次' },
  { id: 'hire', label: '招人 / 招商加盟', hint: '招员工、找合伙人、谈加盟' },
];

export const FORMATS: Choice[] = [
  { id: 'any', label: '不限', hint: 'AI 按目的挑最合适的' },
  { id: 'talk', label: '口播', hint: '对着镜头说' },
  { id: 'process', label: '晒过程', hint: '后厨、备料、出餐' },
  { id: 'story', label: '剧情 / 段子', hint: '演一个小故事' },
  { id: 'vlog', label: 'Vlog', hint: '记录一天' },
  { id: 'visit', label: '探店 / 采访', hint: '客人视角、街访' },
  { id: 'teach', label: '教知识', hint: '讲门道、讲干货' },
];

export const ON_CAMERA: Choice[] = [
  { id: 'boss', label: '老板愿意出镜', hint: '' },
  { id: 'staff', label: '员工出镜', hint: '' },
  { id: 'none', label: '不想露脸', hint: '' },
  { id: 'any', label: '都行', hint: '' },
];

export const CAPACITY: Choice[] = [
  { id: 'low', label: '一周 1～2 条', hint: '' },
  { id: 'mid', label: '一周 3～5 条', hint: '' },
  { id: 'high', label: '每天都能拍', hint: '' },
];

export const HORIZON: Choice[] = [
  { id: 'now', label: '这周就要见效', hint: '' },
  { id: 'month', label: '一个月内', hint: '' },
  { id: 'long', label: '长期经营', hint: '' },
];

export const COUNT_OPTIONS = [3, 5, 8, 10] as const;
export type DirectionCount = typeof COUNT_OPTIONS[number];

export const DEPTHS: Choice<'quick' | 'full'>[] = [
  { id: 'quick', label: '快速', hint: '每个方向几行：思路、拍什么、为什么' },
  { id: 'full', label: '完整', hint: '再加上选题示例、怎么拍、开头示范、看什么数据' },
];

export interface DirectionInput {
  purposes: string[];
  customGoal?: string;
  ideas?: string;
  formats: string[];
  onCamera?: string;
  capacity?: string;
  horizon?: string;
  count: DirectionCount;
  depth: 'quick' | 'full';
  /** 账号档案摘要（lib/profile-summary）；没有档案时为空，用 industry */
  profileSummary?: string;
  /** 创作上下文（按 'direction' 清单切的：简报、成交理由、禁忌） */
  contextBlock?: string;
  /** 没档案时手填的"我是做什么的" */
  industry?: string;
  /** 内容配比（lib/content-mix 的 mixPromptBlock，按方向个数换成条数）。有它就要求每个方向标明是哪种视频 */
  mixBlock?: string;
  /**
   * 别的板块带过来、要在它上面继续拓展的方向（2026-10-06）。
   * 线上：自由对话里勾了「国庆后的县城消费观察」带过来拓展，原来只当「已有的想法」一并参考，
   * 要求里还写着「方向之间目的不同、思路不同」——出来 5 个和国庆消费对比无关的泛方向
   */
  expand?: { from: string; content: string; intent?: string };
}

const labels = (list: Choice[], ids: string[]) => ids.map((id) => list.find((c) => c.id === id)?.label).filter(Boolean).join('、');
const label = (list: Choice[], id?: string) => (id ? list.find((c) => c.id === id)?.label : undefined);

/** 至少要有一个目的：勾的或者自己写的 */
export function hasGoal(i: Pick<DirectionInput, 'purposes' | 'customGoal'>): boolean {
  return i.purposes.length > 0 || Boolean(i.customGoal?.trim());
}

export function buildDirectionPrompt(i: DirectionInput): string {
  const goal = [labels(PURPOSES, i.purposes), i.customGoal?.trim()].filter(Boolean).join('；');
  const formats = i.formats.filter((f) => f !== 'any');
  const conditions = [
    formats.length ? `- 想用的形式：${labels(FORMATS, formats)}（按用户选定的形式执行；只有用户明确允许其他形式时才增加候选）` : '- 形式不限：按目的挑最合适的',
    label(ON_CAMERA, i.onCamera) ? `- 出镜：${label(ON_CAMERA, i.onCamera)}` : '',
    label(CAPACITY, i.capacity) ? `- 产能：${label(CAPACITY, i.capacity)}——方向要拍得过来` : '',
    label(HORIZON, i.horizon) ? `- 时间：${label(HORIZON, i.horizon)}` : '',
  ].filter(Boolean).join('\n');

  const full = i.depth === 'full';
  // 配比要求每个方向标明是哪种视频，代码才数得出来（lib/content-mix 的 countRoles 认「视频目的」这一行）
  const roleField = i.mixBlock?.trim() ? `- **视频目的**：流量型 / 人设型 / 变现型，只写一个\n` : '';
  const fields = roleField + (full
    ? `- **对应目的**：这个方向主要服务上面哪个目的
- **为什么能达到目的**：说清楚因果，结合这个账号的实际情况
- **核心思路**：一两句话，别人一听就懂
- **可拍的选题示例**：3 个，每个一行，写成能直接拍的题目
- **怎么拍**：形式、谁出镜、在哪拍、需要准备什么（只用档案里有的资源）
- **开头示范**：第一句话逐字写出来
- **看什么数据**：拍完看哪个数字判断这个方向行不行
- **难度**：低 / 中 / 高，一句话说投入`
    : `- **对应目的**：……
- **核心思路**：一两句话
- **拍什么**：两三个具体例子
- **为什么能达到目的**：一句话`);
  const mix = i.mixBlock?.trim()
    ? `\n${i.mixBlock.trim()}\n- 他勾的目的明显只指向一种（比如只勾了「卖团购」），以他勾的目的为准，在开头那段说一句为什么没按配比分\n`
    : '';

  const target = i.profileSummary?.trim()
    ? `## 这个账号的档案（方向必须落在它身上）\n${i.profileSummary.trim()}`
    : `## 这个账号\n${i.industry?.trim() ? `做的是：${i.industry.trim()}` : '用户还没建账号档案，也没说做什么：按最常见的实体店举例，并提醒他建好档案再做一次会准得多'}`;

  const ex = i.expand?.content.trim() ? i.expand : undefined;
  const head = ex
    ? `【任务：在编导带来的方向上继续拓展】你是带过上百个实体店账号的编导兼运营。
这次不是从零出方向：编导在「${ex.from}」里已经选定了下面这个方向，要你守住它原来的主题、目的和核心角度，往下拓展成 ${i.count} 个更细、能直接开拍的方向，再推荐一个最好的。

## 要拓展的这个方向（最重要：${i.count} 个方向都从它长出来）
${ex.intent?.trim() ? `${ex.intent.trim()}\n` : ''}${ex.content.trim()}

## 他的目的
${goal ? `按上面这个方向原本的目的来；他这次另外勾的：${goal}——在不偏离这个方向的前提下兼顾` : '按上面这个方向原本的目的来（它为什么能起量、要达到什么，原文里写着）'}`
    : `【任务：创作方向】你是带过上百个实体店账号的编导兼运营。用户不是为了拍视频而拍视频，而是带着目的来的。
根据他的目的和这个账号的情况，把能达到目的的创作方向和思路尽量铺开，再推荐一个最好的。

## 他的目的
${goal}`;
  const opening = ex
    ? '先用两三句话说：这个方向的核心是什么（主题、目的、为什么能起量），这个账号做它的最大优势和最大短板是什么。'
    : '先用两三句话说：他的目的拆开是哪几件事、这个账号做这件事的最大优势和最大短板是什么。';
  const differ = ex
    ? `- ${i.count} 个方向都必须守住上面那个方向的主题、目的和核心角度——是它的不同切口、不同拍法、不同出镜方式，彼此要拉开；不许另起和它主题无关的方向，也不能只是把它换个说法
- 它原文里已经列的子方向、选题示例，编导手上已经有了：可以往深里做，但不要原样照抄`
    : `- ${i.count} 个方向要真的不一样：全部服务用户原定目的，在子议题、对象、材料、思路或拍法上拉开，不能只是换个说法；用户只给一个目的就不增加其他目的，多目的按用户明确要求兼顾`;

  return `${head}
${i.ideas?.trim() ? `\n## 他自己已经有的想法（要认真对待：好的就展开成方向，不靠谱的直说哪里不行、怎么改）\n${i.ideas.trim()}\n` : ''}
## 条件
${conditions}

${target}
${i.contextBlock?.trim() ? `\n${i.contextBlock.trim()}\n` : ''}${mix}
## 输出格式（Markdown，严格按这个结构）
${opening}

然后出 ${i.count} 个方向，每个都用这个样子，方向之间用 --- 隔开：

### 方向1：一个让人一看就懂的名字
${fields}

（方向2、方向3……同样格式，编号连续）

最后一段：
### 我推荐先做：方向N「名字」
- **为什么是它**：结合他的目的、这个账号的资源和时间要求说清楚
- **第一周怎么开始**：3 步，每步一句，能直接照着做
- **其他方向什么时候做**：哪几个适合接着做、哪个先放一放

## 要求
${differ}
- 每个方向都必须是**这个账号拍得出来的**：看档案里的行业、在卖的品类、团队、设备、场地；档案里没有的资源不要安排
- 方向要具体到这个账号：写这家店真的会发生的事、真的在卖的东西，不要写成放之四海皆准的套话
- **不要替他编经历和数字**：档案里没有的人生经历、事件写成「【换成你的：……】」给个参考方向；没有的人数、金额、播放量写成 X
- 不说"揭秘"，不用绝对化用语，不诋毁同行
- 大白话，不要"赋能""打造""矩阵"这类词
${creativeCraftRules({ intent: ex?.intent || i.customGoal, selected: ex?.content, source: i.ideas, context: i.contextBlock })}`;
}
