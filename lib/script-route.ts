/**
 * 脚本打法的唯一出处（2026-10-30）。
 *
 * 四大脚本（薛老师，管「话怎么讲」）和 36 计（小黄，管「事件怎么拍」）是两个派别。
 * 规则：一条脚本只用一派，选题标了哪一派，跳到脚本就用哪一派，不叠加。
 *   - 选题标了 36 计 → 脚本用那一计，脚本结构不带四大脚本
 *   - 选题标了四大脚本的某一种 → 脚本用那一种，不带 36 计
 *   - 什么都没标 → 脚本页让 AI 在两派里挑一派，只挑一派
 *
 * 脚本页、选题跳转、内容规划、创作方向都从这里取选项和判定，别在别处再写一份。
 */
import { FOUR_SCRIPT_CHOICES, fourScriptOfStructure, scriptFormOfTopic } from './creation-settings';
import { GROWTH_TACTICS } from './growth-tactics';
import { roleOfTactic } from './content-roles';
import { AUTO_TACTIC, tacticInText } from './creative-routes';
import { splitTopicSections } from './topic-library';
import { DEFAULT_SCRIPT_SHARE, normalizeScriptShare, routeCounts, tacticMixRule } from './tactic-mix';
import { VIRAL_ELEMENTS } from './viral-elements';

export type RouteSchool = 'four' | 'tactic';

export interface RouteOption {
  /** 'four:<结构 id>' 或 'tactic:<计名>'，全站只用这一种写法 */
  key: string;
  school: RouteSchool;
  /** 卡片标题：「晒过程·火车节」或「第32计 换个视角」 */
  title: string;
  /** 这一派的说法：四大脚本讲怎么讲，36 计讲怎么拍 */
  kind: string;
  /** 适合的目的：流量 / 人设 / 变现 */
  fit: string;
}

/** 四大脚本各对一个目的（薛老师的说法，和 lib/content-roles 的注释一致） */
const FOUR_FIT: Record<string, string> = { 教知识: '流量（涨粉）', 聊观点: '人设（吸真粉丝）', 晒过程: '变现（促成交）', 讲故事: '人设（高客单成交）' };

export const SCHOOL_LABEL: Record<RouteSchool, string> = {
  four: '四大脚本 · 薛老师 · 讲怎么讲',
  tactic: '36 计 · 小黄 · 怎么拍',
};

/** 两派的全部选项：先四大脚本（7 种），后 36 计（按序号） */
export function routeOptions(): RouteOption[] {
  const four: RouteOption[] = FOUR_SCRIPT_CHOICES.map((c) => ({
    key: `four:${c.structure}`,
    school: 'four',
    title: c.name,
    kind: '四大脚本 · 讲怎么讲',
    fit: FOUR_FIT[c.head] ?? '不限',
  }));
  const tactic: RouteOption[] = [...GROWTH_TACTICS].sort((a, b) => a.no - b.no).map((t) => ({
    key: `tactic:${t.name}`,
    school: 'tactic',
    title: `第${t.no}计 ${t.name}`,
    kind: '36 计 · 怎么拍',
    fit: roleOfTactic(t.name) ?? '不限',
  }));
  return [...four, ...tactic];
}

/** 选项 key 是 36 计时返回计名，否则 undefined（选题页要的是「打法」这个字段） */
export function tacticOfRoute(key: string): string | undefined {
  return key.startsWith('tactic:') ? key.slice('tactic:'.length) : undefined;
}

/** 一个选项归哪一派 */
export function schoolOf(key: string): RouteSchool | undefined {
  if (key.startsWith('four:')) return 'four';
  if (key.startsWith('tactic:')) return 'tactic';
  return undefined;
}

/**
 * 页面上的两个字段（打法 tactic、脚本结构 structure）→ 选项 key。
 * 36 计优先：两个都有时以 36 计为准（这种情况只来自旧数据，不能叠用）。什么都没有返回空串（AI 挑）。
 */
export function routeKeyOf(tactic: string | null | undefined, structure: string | null | undefined): string {
  if (tactic && tactic !== AUTO_TACTIC) return `tactic:${tactic}`;
  const four = fourScriptOfStructure(structure ?? undefined);
  return four ? `four:${four.structure}` : '';
}

/** 选项 key → 写进脚本页两个字段的值。一派只写它自己那一个字段，另一个归零 */
export function routeFields(key: string): { tactic: string; structure: string } {
  if (key.startsWith('tactic:')) return { tactic: key.slice('tactic:'.length), structure: 'auto' };
  if (key.startsWith('four:')) return { tactic: AUTO_TACTIC, structure: key.slice('four:'.length) };
  return { tactic: AUTO_TACTIC, structure: 'auto' };
}

/**
 * 一段选题正文标的是哪一派（只认明确标出的那一行；36 计先于四大脚本）。
 * 没标返回空串。
 */
export function topicRouteOf(body: string): string {
  const tactic = tacticInText(body);
  if (tactic) return `tactic:${tactic}`;
  // 四大脚本：写全名「晒过程·火车节」；只写类型「聊观点」时结构留空，不替编导选（脚本页会提示手选），见 scriptFormOfTopic
  const four = scriptFormOfTopic(body);
  return four.structure ? `four:${four.structure}` : '';
}

/** 一批选题里，每一条各自标的派别：标题 → 选项 key（没标的不出现在结果里） */
export function topicRoutesOf(markdown: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of splitTopicSections(markdown)) {
    const key = topicRouteOf(s.body);
    if (key) out[s.title] = key;
  }
  return out;
}

/**
 * 内容规划、创作方向写进提示词的打法规则（2026-10-30）。
 * 手选优先，其次按用户设置的比例；新方案使用站点默认比例。
 * 两派只选一派，不叠加，各个方向都是这样。
 */
export function planRouteRule(p: { share?: number; picked?: string[] }): string {
  if (p.picked?.length) {
    const names = p.picked.map((k) => {
      const f = routeFields(k);
      return f.tactic !== AUTO_TACTIC ? `36计·${f.tactic}` : `四大脚本·${fourScriptOfStructure(f.structure)?.name ?? f.structure}`;
    });
    return `这批只用下面这些打法，没列的一概不用：${names.join('、')}。每个方向只用其中一派的一个，写的时候用这里的名字，一字不差。`;
  }
  const s = normalizeScriptShare(p.share ?? DEFAULT_SCRIPT_SHARE);
  if (s > 0) return `${tacticMixRule(s)}两派只选一派，不叠加。`;
  return '全部用 36 计：内容类型从 36 计清单里选一计写计名（事件怎么拍），不用四大脚本的结构名。两派只选一派，不叠加。';
}

export function routeAllocationRule(total: number, share: number | undefined, monthly: boolean, picked?: string[]) {
  const { scripts, tactics } = routeCounts(total, share);
  const unit = monthly ? '条本月排期' : '个创作方向';
  return [
    picked?.length ? planRouteRule({ picked }) : `本次 ${total} ${unit}，四大脚本 ${scripts}，36计 ${tactics}，按整数逐项落实。`,
    monthly ? '按各方向的本月条数累计，0 条备选不占名额。先分好本月排期，再写备选。' : '每个方向占一个名额。',
    '四大脚本按议题选择讲故事、晒过程、聊观点或教知识；每张卡填写「爆款元素：一个主元素｜具体看点与取材」。从成本、人群、反差、怀旧、头牌、最差、奇葩、荷尔蒙中选择适合账号的元素。流量、人设、变现都写。36计按素材选，有多个方向时分散打法。地名用于限定受众或现场，不自动选地域对比。每个方向只写一个内容类型。',
  ].join('\n');
}

/** 把未提供的经营成效当成已有案例，会把方向锁到根本拍不到的故事。 */
export function unverifiedPlanOutcome(card: string, known: string): boolean {
  return card.split(/[。！？\n]/u).some(line => {
    const claim = line.match(/起死回生|扭亏为盈|生意翻番|营业额翻倍|销量翻倍/u)?.[0];
    if (!claim || /(?:若有|如有|如果|是否|寻找|征集|先核实|先确认)/u.test(line)) return false;
    return !known.split(/[。！？\n]/u).some(fact => fact.includes(claim) && !/(?:不能|没有|不编|假设|举例)/u.test(fact));
  });
}

function hasPlanHook(value: string): boolean {
  const hook = value.replace(/^\s*(?:主(?:爆款)?元素|核心元素)\s*[：:|｜]?\s*/, '').trim();
  const element = VIRAL_ELEMENTS.find(e => hook.startsWith(e.name));
  return !!element && !hook.includes('【待确认') && hook.slice(element.name.length).replace(/[^\p{L}\p{N}]/gu, '').length >= 5;
}

/** 只补缺失的可拍看点，不让模型再重写已经符合配比的一批方向。 */
export function planHookRepair(markdown: string) {
  const blocks = markdown.split(/(?=^#{2,4}\s*方向\s*\d+)/m);
  const line = /^[\t -]*(?:\*\*)?爆款元素(?:\*\*)?\s*[:：][^\n]*/m;
  const missing = blocks.flatMap((block, i) => {
    const card = block.split(/\n#{1,4}\s/)[0];
    if (!/^#{2,4}\s*方向\s*\d+/.test(card) || !/内容类型[^\n]*(?:晒过程|教知识|讲故事|聊观点)/.test(card)) return [];
    if (/本月条数\*{0,2}\s*[:：]\s*0\s*条/.test(card)) return [];
    const hook = card.match(line)?.[0]?.replace(/^.*?[:：]\s*/, '') || '';
    return hasPlanHook(hook) ? [] : [{ id: i, card }];
  });
  if (!missing.length) return null;
  const prompt = '只补这些创作方向的爆款元素及可拍看点。尊重本轮资源和禁忌。每条只用一个元素（' + VIRAL_ELEMENTS.map(e => e.name).join('、') +
    '），evidence 写本方向真实可拍的动作及观众为什么想看，未知结果留待现场。删去预设的成绩、顾客反应或未经确认的经历，不写待填占位。仅返回 JSON {"hooks":[{"id":对应整数,"element":"成本","evidence":"这张卡的具体看点"}]}。\n' + JSON.stringify(missing);
  function apply(raw: string): string {
    try {
      const { hooks } = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      if (!Array.isArray(hooks)) return markdown;
      const result = [...blocks];
      for (const { id, card } of missing) {
        const h = hooks.find(row => row?.id === id);
        if (!VIRAL_ELEMENTS.some(e => e.name === h?.element) || typeof h.evidence !== 'string') continue;
        const hook = h.element + '｜' + h.evidence.replace(/[\r\n]+/g, ' ').trim();
        if (!hasPlanHook(hook)) continue;
        const field = '- **爆款元素**：' + hook;
        result[id] = line.test(card) ? result[id].replace(line, () => field) : result[id].replace(/^[^\n]*内容类型[^\n]*$/m, label => label + '\n' + field);
      }
      return result.join('');
    } catch { return markdown; }
  }
  return { prompt, apply };
}

/** 只数卡片中的内容类型，月度规划按实际排期加权，表格和推荐段不占名额。 */
export function planRouteIssue(text: string, total: number, share: number, monthly: boolean, picked: string[] = [], known?: string): string {
  const cards = text.normalize('NFKC').replace(/\*\*/g, '').split(/(?=^#{2,4}\s*方向\s*\d+)/m)
    .filter(card => /^#{2,4}\s*方向\s*\d+/.test(card));
  const options = routeOptions();
  const expected = routeCounts(total, share);
  let scripts = 0;
  let tactics = 0;
  const activeTactics: string[] = [];
  for (const [i, card] of cards.entries()) {
    const fields = card.split(/\n#{1,4}\s/)[0];
    if (known !== undefined && unverifiedPlanOutcome(fields, known)) return `方向${i + 1}使用了资料中尚未确认的经营成果，请改成可以实际调查的内容。`;
    const label = fields.match(/^[\t -]*内容类型\s*[:：]\s*(.+)$/m)?.[1]?.trim() ?? '';
    const compact = label.replace(/\s+/g, '');
    const four = options.filter(o => o.school === 'four' && compact.includes(o.title.replace(/\s+/g, '')));
    const tactic = GROWTH_TACTICS.filter(t => compact.includes(t.name.normalize('NFKC')) || new RegExp('第' + t.no + '计(?!\\d)').test(compact));
    // 四大脚本结构名可能含有36计的通用字眼；显式写了四大脚本时，不能把这类文字重叠误判成两派混用。
    const recognizedTactic = /四大脚本/.test(compact) && four.length ? [] : tactic;
    if (four.length + recognizedTactic.length !== 1 || (four.length && /36计/.test(compact)) || (recognizedTactic.length && /四大脚本/.test(compact))) return `方向${i + 1}的内容类型须填写一种可识别的结构或计名。`;
    const key = four[0]?.key ?? 'tactic:' + recognizedTactic[0].name;
    if (picked.length && !picked.includes(key)) return `方向${i + 1}用了手选清单以外的打法。`;
    const weight = monthly ? Number(fields.match(/^[\t -]*本月条数\s*[:：]\s*(\d+)\s*条/m)?.[1]) : 1;
    if (!Number.isSafeInteger(weight)) return `方向${i + 1}缺少本月条数。`;
    if (four.length && weight > 0) {
      const hook = fields.match(/^[\t -]*爆款元素\s*[:：]\s*(.+)$/m)?.[1] ?? '';
      if (!hasPlanHook(hook)) return `方向${i + 1}的四大脚本缺少爆款元素和可拍的看点。`;
    }
    if (four.length) scripts += weight;
    else { tactics += weight; if (weight > 0) activeTactics.push(key); }
    if (!picked.length && ((share === 100 && !four.length) || (share === 0 && four.length))) return `方向${i + 1}的派别不符合本次全选设置。`;
  }
  if (!picked.length && activeTactics.length >= 3 && new Set(activeTactics).size === 1) return '本轮多个36计方向全部沿用同一计，请根据各自的素材更换打法和看点。';
  if (scripts + tactics !== total || (!picked.length && scripts !== expected.scripts)) {
    return `实际四大脚本 ${scripts}、36计 ${tactics}。` + routeAllocationRule(total, share, monthly, picked);
  }
  return '';
}

/** 提示词里写明的规则，内容规划、创作方向、脚本共用，保证三处说的是同一件事 */
export const ONE_SCHOOL_RULE = '一条内容只用一派：四大脚本（讲怎么讲）和 36 计（怎么拍）不叠加。用了 36 计，策略卡第一条写「用的计：36计·第N计 计名」；用了四大脚本，策略卡第一条写「用的脚本：四大脚本·具体结构名」。';
