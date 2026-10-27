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
import { REALITY_RULE } from './sharp-rules';

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

export const DIRECTION_COUNT_MIN = 10;
export const DIRECTION_COUNT_MAX = 40;
export const DEFAULT_DIRECTION_COUNT = 20;

export function clampDirectionCount(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DIRECTION_COUNT;
  return Math.min(DIRECTION_COUNT_MAX, Math.max(DIRECTION_COUNT_MIN, Math.round(n)));
}

export const DEPTHS: Choice<'quick' | 'full'>[] = [
  { id: 'quick', label: '快速', hint: '每个方向几行：思路、第一秒、标题、为什么' },
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
  count: number;
  depth: 'quick' | 'full';
  /** 账号档案摘要（lib/profile-summary）；没有档案时为空，用 industry */
  profileSummary?: string;
  /** 创作上下文（按 'direction' 清单切的：简报、成交理由、禁忌） */
  contextBlock?: string;
  /** 没档案时手填的"我是做什么的" */
  industry?: string;
  /** 内容配比（lib/content-mix 的 mixPromptBlock，按方向个数换成条数）。有它就要求每个方向标明是哪种视频 */
  mixBlock?: string;
  /** 四大脚本占人设型、变现型内容类型的比例（0–100，步长 10；0 = 全用 36 计，和原来一样）。lib/tactic-mix */
  scriptsShare?: number;
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
  // 方向层只给范围（2026-10-26）：目的、人群、形式、出发点、标题、镜头都留给选题层，配比在内容规划里定
  // 核心目的不能改，所有角度都围绕它展开（2026-10-26）：方向是「一个目的下的角度地图」，不是一个范围
  // 从内容规划带来的方向：核心目的就是它原来的目的（在带来的方向原文里），不能让它空着
  const corePurposeLine = goal || (i.expand?.intent?.trim() ? '按带来的方向原本的目的（见下面的方向原文）' : '按用户勾选的目的');
  const scopeFields = `- **核心目的**：${corePurposeLine}（这一类内容的目的，所有角度都围绕它展开，不能改成别的目的）。每个方向只写一句它怎么服务这个目的，几个方向之间各不相同，不能把同一句抄几遍
- **内容方向**：一两句话，按这个顺序写三件事：① 赛道（档案里在卖的品类和穿搭，比如大码女装，观众一眼认出这是这个号）② 目标人群（档案里的目标人群，写范围）③ 大众切口（大多数人都会遇到的事：买回家不敢穿、出门时间不够、怕被人看见、家人的眼光、钱、面子、舒服）。范围不写具体的商品场景（不写「换季衣柜」「上衣和裤子怎么搭」这类），不写镜头、标题或形式
- **切入角度**：3 到 5 个角度，每个角度一行，写成「角度名 ｜ 核心问题 ｜ 切入维度 ｜ 和其他角度的差异」。切入维度只从这些里选：问题、视角、冲突、对比、时间线、地域、季节、反常识。角度之间至少在两个维度上不同，不能只是换个说法。每个角度都落在赛道和目标人群上。核心问题要是大众问题（比如「为什么买回家不敢穿」），不是商品搭配问题（比如「上衣和裤子怎么搭」）
- **思路提示**：2 到 3 句，这一类内容可以往哪些大众大事上想（只给方向性的提示，不写成题眼、题目或具体场景，也不写具体搭配；大众大事要和赛道、目标人群连在一起）
- **可拍性**：这一类需要的资源（团队、场地、设备、出镜条件），缺的标「待补」`;
  const fields = scopeFields + (full
    ? `\n- **看什么数据**：拍完看哪个数字判断这个方向行不行
- **节奏**：放在第几周`
    : `\n- **节奏**：放在第几周`);

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
    ? '## 📌 这个方向的思路\n三到五行：这个方向的核心是什么（主题、目的、为什么能起量），这个账号做它的最大优势和最大短板是什么。'
    : '## 📌 这个方向的思路\n三到五行：他的目的拆开是哪几件事、这个账号做这件事的最大优势和最大短板是什么，这一批方向怎么分工。';
  const differ = ex
    ? `- ${i.count} 个方向都必须守住上面那个方向的主题、目的和核心角度——是它的不同切口、不同拍法、不同出镜方式，彼此要拉开；不许另起和它主题无关的方向，也不能只是把它换个说法
- 它原文里已经列的子方向、选题示例，编导手上已经有了：可以往深里做，但不要原样照抄`
    : `- ${i.count} 个方向要真的不一样：全部服务用户原定目的，在子议题、对象、材料、思路或拍法上拉开，不能只是换个说法；用户只给一个目的就不增加其他目的，多目的按用户明确要求兼顾`;

  return `${head}
${i.ideas?.trim() ? `\n## 他自己已经有的想法（要认真对待：好的就展开成方向，不靠谱的直说哪里不行、怎么改）\n${i.ideas.trim()}\n` : ''}
## 条件
${conditions}

${target}
${i.contextBlock?.trim() ? `\n${i.contextBlock.trim()}\n` : ''}
## 输出格式（Markdown，标题和字段名原样保留）
${opening}

## 🧭 内容方向（勾选想做的方向，带去选题或脚本接着做）

然后出 ${i.count} 个方向，每个都用这个样子，方向之间用 --- 隔开：

### 方向1：一个让人一看就懂的名字
${fields}

（方向2、方向3……同样格式，编号连续）

最后一段：
### 我推荐先做：方向N「名字」
- **为什么是它**：结合他的目的、这个账号的资源和时间要求说清楚
- **第一周怎么开始**：3 步，每步一句，能直接照着做。只写准备和决定（确认什么人、备什么、先发哪一个、看哪一项反馈），不写镜头、台词、结尾问句和具体拍摄动作，那些留给选题层
- **其他方向什么时候做**：哪几个适合接着做、哪个先放一放

## ⚠️ 这次先别做的
两三条，说清为什么（结合档案里的禁忌、资源和目的）。

## 要求
${differ}
- **先多后选**：心里先拟 ${Math.round(i.count * 1.5)} 个候选方向（候选不输出），用三把尺子各过一遍：第一秒能不能让陌生人停下、一句话能不能被记住、这个账号拍不拍得出来。淘汰最平的，只输出得分最高的 ${i.count} 个，按推荐顺序排
- **分散人、货、场**：这 ${i.count} 个方向里，同一个单品最多出现在两个方向里，出镜的人和拍摄的场各至少换三种，不能都围着同一件货、同一个场景来写
- **人设型的人和事必须是真的**：要让人记住的那个人、那件事，只用档案里写的或前采里说的；不让店员或别人扮演顾客，不替他设计人物故事。写不出真的，就写一个他能真做到的小动作，并标【待补：……】
- 他在想法或补充要求里写到的季节、时间点（如「秋天」）是本轮硬条件：每个方向和拍法都按它来，不许换成档案或历史里别的季节，也不许写成其他时令（比如冬天）
- **用户说的具体处境必须有方向直接回应**：他在目的或想法里写的季节、客流变化、想拉回的人群、不想走的路（比如「节后冷清、把老客拉回来、不想甩卖降价」），至少有一个方向的**主题和讲法**就是针对这个处境的，并把它排在方向 1、作为「我推荐先做」的那个。只在「为什么」里提一句不算回应；不能用一个泛泛的「避坑」「知识」方向替代这个处境
- **年限照档案原词引用**：从业多少年、在本地住多少年、门店开了多少年，是三件事，不能互换。档案写「来苏州 3 年」「门店开了 2 年」，就照写，不许写成「在苏州做了 2 年」
- **不要写占位**：上面的 36 计清单、四大脚本只是给你挑用的参考，不是要你在输出里复述的小节。不要写「（清单已按要求提供）」「（内容已按要求提供）」这类话；用到哪一计就直接写计名和讲法，没用到就不写
- **真实边界（只在这里说一次，方向里不再重复）**：每个方向都是这个账号拍得出来的，用档案里的行业、在卖的品类、团队、设备、场地；档案里没有的经历、事件、人数、金额、播放量不编，写成「【待补：……】」或 X，再选档案里最具体、能拍的那个版本往下做。不说"揭秘"，不用绝对化用语，不诋毁同行
- 方向要具体到这个账号：写这家店真的会发生的事、真的在卖的东西，不要写成放之四海皆准的套话
- ${REALITY_RULE}
- 大白话，不要"赋能""打造""矩阵"这类词
${creativeCraftRules({ intent: ex?.intent || i.customGoal, selected: ex?.content, source: i.ideas, context: i.contextBlock })}`;
}
