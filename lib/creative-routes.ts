/**
 * 两套打法：四大脚本 + 八大爆款元素（薛老师），起号 36 计（小黄）——全站唯一出处。
 *
 * 【为什么要有这份】原来 36 计只有用户手动展开「拍法」、挑中某一计才会用上；
 * 默认流程全走四大脚本 + 爆款元素。账号定位里也只给了计名，没给公式，
 * 模型不知道那一计怎么拍，自然就不用。结果是：36 计在课程里是起号主力，
 * 在产出里几乎看不见。
 *
 * 【两套各自的短板】四大脚本太依赖爆款元素找选题，而且口播为主、不容易落地；
 * 36 计好落地，但大多是流量打法，讲不清成交理由、立不住人设深度。
 * 所以两套都做好，互相补——用户选哪套是用户的事，像自助餐，每道菜都得做好。
 *
 * 【为什么公式要随提示词发】36 计精编版没导进 Dify（见 lib/growth-tactics 顶部），
 * 靠检索拿不到，只能从这里带过去。
 */

import { GROWTH_TACTICS } from './growth-tactics';
import { splitTopicSections } from './topic-library';
import { CONTENT_ROLE_LIST, TACTIC_ROLES, roleOfTactic, type ContentRole } from './content-roles';

/** 单条内容板块里"让 AI 按目的挑一计"的占位值，不是计名，不能写进历史 */
export const AUTO_TACTIC = '__auto__';

export type CreativeRoute ='两种都出' | '四大脚本' | '三十六计';
export const ROUTE_LIST: CreativeRoute[] = ['两种都出', '四大脚本', '三十六计'];

/** 界面上的说明 */
export const ROUTE_HINTS: Record<CreativeRoute, string> = {
  两种都出: '一半按四大脚本 + 爆款元素，一半按起号 36 计，每条标明用的哪套',
  四大脚本: '薛老师：爆款元素找角度，聊观点 / 晒过程 / 教知识 / 讲故事的结构讲',
  三十六计: '小黄：每条套一计现成的拍法，照公式拍，不靠口才',
};

export const ROUTES_GUIDE = `### 两套打法：四大脚本（薛老师）和起号 36 计（小黄）

以 36 计为主力，四大脚本为辅；用户指定哪套就用哪套：

| | 四大脚本 + 八大爆款元素（薛老师） | 起号 36 计（小黄） |
|---|---|---|
| 从哪出发 | **讲什么**：先用爆款元素找选题角度，再用聊观点 / 晒过程 / 教知识 / 讲故事的结构讲 | **怎么拍**：每一计是一个现成的拍法（事件怎么走），套上这个行业就能拍 |
| 强项 | 有观点、有故事，立得住人设，讲得清成交理由 | 好落地：不靠口才、不靠选题灵感，照公式拍；起号拿流量快 |
| 短板 | 太依赖爆款元素找选题；口播为主，对表达要求高，不容易落地 | 大多是流量打法，玩多了涨泛粉；讲不清成交理由，人设不够深 |

**怎么互补**：
- 36 计管**片子里发生什么**（事件走向），四大脚本管**话怎么讲**（结构），爆款元素管**标题凭什么被点**——三层可以叠在同一条上
- 四大脚本的选题想不出、口播讲不动时，换一计来拍：同样讲"装修避坑"，口播讲不动，就用「正确做法VS错误做法」现场演一遍
- 36 计的片子只有流量、没有转化时，用四大脚本的结构补上：同样是「对比改造」，按「晒过程·火车节」讲，结尾落在一个成交理由上

**计和脚本怎么配**（按这一计适合的目的）：
- 变现型的计 → 配 案例引入 / 痛点型 / 推荐型 / 晒过程（教知识·解题型也可以，但它只属于变现型）
- 人设型的计 → 配 个人成就、贵人相助、世俗偏见（观点类内容也归这里：观点立场）
- 流量型的计 → 直接按这一计的公式拍（反向、借势、冷知识、地域差异、街头采访、整蛊……），不另套教知识或观点脚本，聊观点拿不到大流量

**用计的硬要求**：计名和下面清单一字不差；那一计的结构公式要落在片子的**事件**上，不是只在标题里提一句；
挑他拍得出来的（一个人、一部手机拍不了多人剧情）。`;

/**
 * 36 计清单：计名、适合哪种视频、结构公式、适合什么行业。
 * 只给计名模型不知道怎么拍，所以每一计都带公式。
 */
export function tacticIndex(opts: { roles?: ContentRole[]; exclude?: string[] } = {}): string {
  const roles = opts.roles?.length ? opts.roles : CONTENT_ROLE_LIST;
  const exclude = new Set(opts.exclude ?? []);
  const lines = GROWTH_TACTICS.filter((t) => !exclude.has(t.name))
    .filter((t) => {
      const r = roleOfTactic(t.name);
      return r ? roles.includes(r) : true;
    })
    .map((t) => `- 第${t.no}计 **${t.name}**【${roleOfTactic(t.name) ?? '流量型'}】：${t.formula}（适合：${t.fit}）`);
  return `#### 起号 36 计清单（计名【最适合的目的】：结构公式）\n\n${lines.join('\n')}`;
}

/** 选题这类"一批出很多条"的板块：按用户选的路子分配 */
export function routeAssignment(route: CreativeRoute, count: number): string {
  if (route === '四大脚本') {
    return `【这批用哪套打法】全部用**四大脚本 + 爆款元素**（薛老师）：每条标明脚本类型和用的爆款元素`;
  }
  if (route === '三十六计') {
    return `【这批用哪套打法】全部用**起号 36 计**（小黄）：每条套一计，${count} 条里尽量不重复用同一计；
每条先按目的从对应的计里挑（变现型挑【变现型】的计，以此类推），标题可以叠一个爆款元素，也可以不叠`;
  }
  const half = Math.ceil(count / 2);
  return `【这批用哪套打法】两套都出：约 ${half} 条用**起号 36 计**（小黄），其余用**四大脚本 + 爆款元素**（薛老师）。
每条标明用的哪套；用 36 计的，按这条的目的从对应的计里挑，同一批尽量不重复`;
}

/**
 * 从一条选题的正文里认出它用的是哪一计。
 * 选题带着计走到脚本页，脚本才能按那一计的公式排。
 * 长名优先匹配，避免「情境还原」这种被更短的名字截胡。
 */
const NAMES_LONGEST_FIRST = GROWTH_TACTICS.map((t) => t.name).sort((a, b) => b.length - a.length);
export function tacticInText(text: string): string | undefined {
  if (!text) return undefined;
  // 只认明确标了"36计 / 第N计"的那一行——「冷知识」「整蛊」这种短计名在正文里太常见，
  // 一条用四大脚本讲冷知识的选题，不能被认成用了第 36 计
  const labelled = text
    .split('\n')
    .filter((l) => /36\s*计|三十六计|第\s*\d+\s*计/.test(l))
    .join('\n');
  return NAMES_LONGEST_FIRST.find((n) => labelled.includes(n));
}

/**
 * 和档案禁忌直接冲突的计。
 *
 * 实测：禁忌写着"不揭秘行业内幕"，起号方案照样把「内幕揭秘」列成备选，
 * 再自己补一句"不能用揭秘两个字"——边推边打补丁。
 * 与其指望模型自己排除，不如交给它之前就从清单里拿掉。
 */
const BLOCKING_RULES: Array<{ tactic: string; when: RegExp }> = [
  { tactic: '内幕揭秘', when: /揭秘|内幕|黑料/ },
  { tactic: '整蛊', when: /整蛊|恶搞/ },
];

export function tacticsBlockedBy(restrictions?: string | null): string[] {
  const text = restrictions || '';
  return BLOCKING_RULES.filter((r) => r.when.test(text)).map((r) => r.tactic);
}

/** 一批选题里每条各用的哪一计：标题 → 计名。没用计的不列 */
export function topicTacticsOf(markdown: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const s of splitTopicSections(markdown)) {
    const t = tacticInText(s.body);
    if (t) out[s.title] = t;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 每种目的下有几计——界面和测试用 */
export const TACTIC_COUNT_BY_ROLE = Object.fromEntries(
  CONTENT_ROLE_LIST.map((r) => [r, TACTIC_ROLES[r].length])
) as Record<ContentRole, number>;
