/**
 * 联网搜索的质量过滤（2026-10-18 取样后改，纯函数）。
 * 取样发现的问题：同一篇文章被多家转载占满前排；买卖账号、开户、代运营这类导流页混进来；
 * 天气预警页冒充新闻；聚合站翻新的旧文章标着新日期。这里只处理这些确定性的问题，不替代语义判断。
 */
import type { SearchHit } from './ali-search';

/** 标题归一化：去掉标点、空格、大小写，用于判断「同一篇文章被转载」 */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 买卖账号、开户、代运营、收费、导流联系方式等。问的正是这些时不挡 */
const RISK_HIT = /买卖(?:抖音|快手|小红书|微信|视频号)?(?:号|账号|账户)|出售(?:抖音|快手|小红书|视频号)?(?:号|账号|账户)|账号交易|号商|刷粉|刷量|开户|代运营|哪家口碑好|口碑好的|加微信|加V|私信引流|联系方式/;
const RISK_QUESTION = /代运营|开户|收费|价格|费用|靠谱|口碑|哪家|服务商|交易|买号|卖号/;

export function isRiskHit(hit: Pick<SearchHit, 'title' | 'content'>, question: string): boolean {
  if (RISK_QUESTION.test(question)) return false;
  return RISK_HIT.test(hit.title) || RISK_HIT.test(hit.content.slice(0, 300));
}

/** 天气、气象预警类页面。问的不是天气时一律不收（扩大了关键词：大雾、暴雨、预警等） */
const WEATHER_HIT = /天气|气温|降雨|台风|预警|气象|大雾|暴雨|高温|寒潮|空气质量|穿衣指数|weather|tianqi/i;
const WEATHER_QUESTION = /天气|气温|降雨|台风|预警|气象|大雾|暴雨|高温|寒潮|空气质量|穿衣/;

export function isWeatherHit(hit: Pick<SearchHit, 'title' | 'url'>, question: string): boolean {
  if (WEATHER_QUESTION.test(question)) return false;
  let host = '', path = '';
  try { const u = new URL(hit.url); host = u.hostname; path = u.pathname; } catch { /* 地址不对的交给别处过滤 */ }
  return WEATHER_HIT.test(hit.title) || WEATHER_HIT.test(`${host}${path}`);
}

/** 标题里写的具体日期（如「2026-08-21」「2026年8月21日」）。没有写就返回 null */
export function titleDate(title: string): number | null {
  const m = title.match(/(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

/** 标题日期比今天早得多（超过时效窗口），说明这是旧文章被翻新 */
export function titleSaysStale(title: string, recencyDays: number, now: number): boolean {
  if (!recencyDays) return false;
  const t = titleDate(title);
  if (t === null) return false;
  const ageDays = (now - t) / 86_400_000;
  return ageDays > recencyDays * 1.5 + 3;
}

/**
 * 同一篇文章只留一条：标题相同（归一化后）的，保留排在前面的那条。
 * 标题太短（少于 6 个字）的不去重，免得把不同文章误判为同一篇。
 */
export function dedupeByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeTitle(item.title);
    if (key.length < 6) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 同一个站点最多留几条（官方站点可以多留一些，它们是主要依据） */
export function capPerHost<T extends { host: string }>(items: T[], isOfficial: (host: string) => boolean, cap = 2, officialCap = 4): T[] {
  const count = new Map<string, number>();
  return items.filter((item) => {
    const n = count.get(item.host) || 0;
    const limit = isOfficial(item.host) ? officialCap : cap;
    if (n >= limit) return false;
    count.set(item.host, n + 1);
    return true;
  });
}
