/**
 * 联网前先「读懂需求」（2026-11-02 产品方：「真的读懂用户的需求去找这些有关信息，让用户真的可以搜到想找的内容」；
 * 「成本要控制住，质量也要很好」）。
 *
 * 原来只靠 lib/web-query 的正则把原话剥成一个搜索词：说法一变就失灵，追问（「那客单价呢」）丢了上文，
 * 只搜一个角度，也不知道用户是哪个行业、哪个地方。
 * 现在先让模型把「这句话 + 前面一两轮 + 档案 + 今天」读成一份搜索计划：要找的是什么、2～3 个角度的搜索词、
 * 补全的指代、地点和时效、关键对象、好结果要有什么。搜索和挑结果都按它来。
 *
 * 成本：每次真正联网多 1 次小模型调用（只要一小段 JSON，限 500 token，8 秒超时）；同一句 10 分钟内复用。
 * 没配置模型、超时、读不出 JSON：返回 null，调用方退回原来的规则（lib/web-query），搜索照常。
 */
import { readAssistantConfig, readCheapModel, type AssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';

export type SearchIntent = '新闻热点' | '行业数据' | '同行案例' | '方法做法' | '政策规定' | '产品价格' | '平台规则' | '知识解释' | '其他';
export const SEARCH_INTENTS: SearchIntent[] = ['新闻热点', '行业数据', '同行案例', '方法做法', '政策规定', '产品价格', '平台规则', '知识解释', '其他'];

export interface SearchPlan {
  /** 要找的是哪一类 */
  intent: SearchIntent;
  /** 一句话说清用户到底想找什么（补全了上文的指代） */
  goal: string;
  /** 搜索词：第一条是主搜索词，其余是别的角度；最多 3 条 */
  queries: string[];
  /** 时效：只要最近 N 天的；0 表示不限 */
  recencyDays: number;
  /** 地点（问的是某地的事才有） */
  place: string;
  /** 关键对象：结果里应该出现的词（地名、行业、产品、平台、人名），挑结果时用 */
  entities: string[];
  /** 好结果要有什么：具体数据、真实案例、官方来源、操作步骤…… */
  needs: string[];
}

export interface SearchPlanInput {
  question: string;
  /** 前面一两轮对话（追问时补全指代用），可以为空 */
  recent?: string;
  /** 档案里的行业、主卖什么、地区（用户没说地点、行业时用它补） */
  profileHint?: string;
  /** 今天（北京时间），例如 2026年11月2日 */
  today: string;
}

const MAX_QUERY_CHARS = 60;

export function searchPlanPrompt(input: SearchPlanInput): { system: string; user: string } {
  const system = [
    '你是搜索策划。用户在一个短视频创作工具里问问题，要联网查资料。你的任务：读懂他真正想找什么，写出能搜到它的搜索词。不回答问题本身。',
    `今天是${input.today}（北京时间）。「今天、最近、本周、今年」都按这个日期算。`,
    '',
    '规则：',
    '1. 去掉对 AI 的指令（帮我、写个脚本、做成表格），只留要查的事。',
    '2. 追问里的「它、这个、那家、那里、换成…」用前面的对话补全；补不出来就按原话。',
    '3. 用户没说地点、行业，而问题和他自己的生意有关（同行、案例、价格、获客、本地），用档案里的行业和地区补上；问的是通用知识、全国新闻就不要加。',
    '4. 搜索词像人在搜索框里打的：2～6 个关键词、空格分开，不超过 30 个字，不写成句子，不加 site:，不加引号。',
    '5. 写 1～3 个搜索词，每个换一个角度（比如：案例 / 方法 / 数据）。问题简单、一个角度就够的（某条新闻、某个定义、某个价格）只写 1 个，不要凑。',
    '6. 新闻热点类的搜索词不写年月数字（会搜出日历和天气页），时效写进 recencyDays。',
    '7. recencyDays：只有用户明确说了时间（今天 2、昨天 3、最近一周或本周 10、最近一个月或「最新」40、今年 370），或者问的是新闻热点时才写；案例、方法、价格、数据、政策、定义这类没说时间的，一律写 0（老文章也有用）。',
    '8. 问热点、蹭热点、热搜、最近发生了什么，intent 都是「新闻热点」。',
    '',
    '只输出一个 JSON 对象，不要任何别的文字：',
    `{"intent": "${SEARCH_INTENTS.join('|')}", "goal": "一句话：他到底想找什么（补全指代）", "queries": ["主搜索词", "别的角度"], "recencyDays": 0, "place": "地点或空", "entities": ["结果里应该出现的关键词，最多 5 个"], "needs": ["好结果要有什么，最多 3 条，比如：具体数据、真实案例、官方来源、操作步骤"]}`,
  ].join('\n');
  const user = [
    input.profileHint?.trim() ? `【用户的档案】${input.profileHint.trim()}` : '【用户的档案】（没有）',
    input.recent?.trim() ? `【前面的对话】\n${input.recent.trim().slice(0, 1500)}` : '【前面的对话】（没有，这是第一句）',
    `【这一句】${input.question.trim().slice(0, 1500)}`,
  ].join('\n\n');
  return { system, user };
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** 解析模型给的计划；不像计划就返回 null（调用方退回规则） */
export function parseSearchPlan(raw: string): SearchPlan | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const queries = (Array.isArray(d.queries) ? d.queries : [])
    .map((q) => clean(q, MAX_QUERY_CHARS).replace(/\bsite:\S+/gi, '').replace(/["“”]/g, '').trim())
    .filter((q) => q.length >= 2)
    .filter((q, i, all) => all.indexOf(q) === i)
    .slice(0, 3);
  if (!queries.length) return null;
  const intent = SEARCH_INTENTS.includes(d.intent as SearchIntent) ? (d.intent as SearchIntent) : '其他';
  const days = Number(d.recencyDays);
  return {
    intent,
    goal: clean(d.goal, 120),
    queries,
    recencyDays: Number.isFinite(days) && days > 0 ? Math.min(Math.round(days), 400) : 0,
    place: clean(d.place, 20),
    entities: (Array.isArray(d.entities) ? d.entities : []).map((e) => clean(e, 20)).filter((e) => e.length >= 2).slice(0, 5),
    needs: (Array.isArray(d.needs) ? d.needs : []).map((e) => clean(e, 30)).filter(Boolean).slice(0, 3),
  };
}

/**
 * 要搜几个角度（控制成本）：主搜索词一定搜；第二个角度只在「找案例、数据、做法、价格」这类一次搜不全的问题上搜；
 * 新闻、定义、政策这类一个角度就够。最多 2 次通用搜索。
 */
export function generalQueriesOf(plan: SearchPlan): string[] {
  const multi: SearchIntent[] = ['同行案例', '行业数据', '方法做法', '产品价格'];
  return plan.queries.slice(0, multi.includes(plan.intent) ? 2 : 1);
}

const cache = new Map<string, { at: number; plan: SearchPlan }>();
const CACHE_MS = 10 * 60_000;
// 线上实测（2026-11-02，12 个问法）：3.8～6.0 秒，6 秒会卡掉个别；8 秒
const TIMEOUT_MS = 8000;

/** 读搜索计划用哪个模型：SEARCH_PLAN_MODEL > 便宜模型 > 助理主模型 */
function planConfig(env: Record<string, string | undefined> = process.env): AssistantConfig | null {
  const cfg = readAssistantConfig(env);
  if (!cfg) return null;
  const model = env.SEARCH_PLAN_MODEL?.trim() || readCheapModel(env) || cfg.model;
  return { ...cfg, model };
}

export async function planSearch(
  input: SearchPlanInput,
  deps: { llm?: typeof callAssistantLlm; env?: Record<string, string | undefined>; now?: number } = {},
): Promise<SearchPlan | null> {
  const cfg = planConfig(deps.env);
  if (!cfg) return null;
  const now = deps.now ?? Date.now();
  const key = `${input.profileHint ?? ''}\n${input.recent ?? ''}\n${input.question}`.slice(-3000);
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.plan;
  const prompt = searchPlanPrompt(input);
  try {
    const res = await (deps.llm ?? callAssistantLlm)(
      cfg,
      { system: prompt.system, messages: [{ role: 'user', content: prompt.user }], tools: [], maxTokens: 500 },
      { signal: AbortSignal.timeout(TIMEOUT_MS), retryDelayMs: 0 },
    );
    const text = res.content.filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('');
    const plan = parseSearchPlan(text);
    if (plan) {
      if (cache.size > 500) cache.clear();
      cache.set(key, { at: now, plan });
    }
    return plan;
  } catch {
    return null;
  }
}

/** 给回答的模型看的一段：用户到底想找什么、好结果要有什么 */
export function planBrief(plan: SearchPlan | null | undefined): string {
  if (!plan) return '';
  return [
    `用户想找的是：${plan.goal || plan.queries[0]}（${plan.intent}）`,
    plan.needs.length ? `好结果要有：${plan.needs.join('、')}` : '',
    '回答先给结论，再给依据；每条依据写清来自哪个来源、什么日期；资料里没有的就直说没找到，不用无关内容凑。',
  ].filter(Boolean).join('。');
}

/** 测试用 */
export function clearSearchPlanCache(): void {
  cache.clear();
}
