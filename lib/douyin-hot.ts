/**
 * 抖音今日热榜（2026-11-02 产品方：「创作者大部分都会搜抖音今日热点榜，至少能知道 10-20 个」；
 * 「开物服务器直接调抖音网页内部的热榜接口也可以做」——推翻了之前「不抓抖音页面」的决定）。
 *
 * 抖音开放平台的热点榜接口（hotsearch）2024-11-05 起停止申请、11-29 起回收，没有正式数据源。
 * 这里由开物服务器读抖音网页版热榜用的那个接口（不用登录、不用签名，www.douyin.com/hot 页面就是它）：
 * 一次 50 条（排名、话题、热度、开始时间）+ 5 条上升热点。
 *
 * 守住：全站共用一份缓存，10 分钟最多请求一次（一天最多 144 次）；抖音那边失败就用 2 小时内的上一份并写明时间，
 * 再没有就照实说没拿到——不拿旧榜单冒充今天的，不编榜单以外的话题。
 */

const HOT_URL = 'https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const FRESH_MS = 10 * 60_000;
const STALE_MS = 2 * 3600_000;
const TIMEOUT_MS = 8000;

export interface DouyinHotItem {
  rank: number;
  word: string;
  /** 热度值（原样的数） */
  heat: number;
  /** 话题开始上榜的时间（ISO），读不出为空 */
  startedAt: string;
  link: string;
}

export interface DouyinHotList {
  items: DouyinHotItem[];
  /** 上升热点（只有话题） */
  rising: string[];
  /** 抖音那边这份榜单的更新时间（原样，北京时间字符串） */
  activeTime: string;
  /** 开物服务器读到它的时间 */
  fetchedAt: number;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** 接口返回 → 榜单；不像榜单返回 null */
export function parseDouyinHot(raw: unknown, now = Date.now()): DouyinHotList | null {
  const data = (raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : null) as Record<string, unknown> | null;
  if (!data || !Array.isArray(data.word_list)) return null;
  const items: DouyinHotItem[] = [];
  for (const w of data.word_list as Record<string, unknown>[]) {
    const word = str(w?.word, 60);
    if (!word) continue;
    const id = str(String(w.sentence_id ?? ''), 20);
    const t = Number(w.event_time);
    items.push({
      rank: Number.isFinite(Number(w.position)) && Number(w.position) > 0 ? Number(w.position) : items.length + 1,
      word,
      heat: Number.isFinite(Number(w.hot_value)) ? Number(w.hot_value) : 0,
      startedAt: Number.isFinite(t) && t > 1e9 ? new Date(t * 1000).toISOString() : '',
      link: /^\d+$/.test(id) ? `https://www.douyin.com/hot/${id}` : 'https://www.douyin.com/hot',
    });
    if (items.length >= 50) break;
  }
  if (items.length < 5) return null;
  const rising = (Array.isArray(data.trending_list) ? (data.trending_list as Record<string, unknown>[]) : []).map((x) => str(x?.word, 60)).filter(Boolean).slice(0, 10);
  return { items: items.sort((a, b) => a.rank - b.rank), rising, activeTime: str(data.active_time, 30), fetchedAt: now };
}

let cache: DouyinHotList | null = null;
let inflight: Promise<DouyinHotList | null> | null = null;

/**
 * 取抖音热榜：10 分钟内用缓存；过了就去抖音拿一次（同一时刻多人问只请求一次）；
 * 拿不到用 2 小时内的旧的；再没有返回 null。
 */
export async function getDouyinHot(deps: { fetch?: typeof fetch; now?: number } = {}): Promise<DouyinHotList | null> {
  const now = deps.now ?? Date.now();
  if (cache && now - cache.fetchedAt < FRESH_MS) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await (deps.fetch ?? fetch)(HOT_URL, {
          headers: { 'user-agent': UA, referer: 'https://www.douyin.com/hot', accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        });
        if (!res.ok) return null;
        return parseDouyinHot(await res.json(), now);
      } catch {
        return null;
      }
    })().finally(() => { inflight = null; });
  }
  const fresh = await inflight;
  if (fresh) {
    cache = fresh;
    return fresh;
  }
  return cache && now - cache.fetchedAt < STALE_MS ? cache : null;
}

/** 测试用 */
export function resetDouyinHotCache(): void {
  cache = null;
  inflight = null;
}

/** 问的是抖音的热点、热榜吗（「今天抖音有什么热点」「抖音热搜」「抖音上什么火」） */
export function wantsDouyinHot(question: string): boolean {
  return /抖音|dy/i.test(question) && /热点|热榜|热搜|热门|热度|什么火|火了|爆了|上热门|榜单/.test(question);
}

/**
 * 问「能蹭什么热点」「最近有什么热点」（没提抖音）也要今天的真榜单：
 * 2026-11-02 诊断，「最近适合服装店蹭的热点」全网搜回来的是百科和行业网站，没有一条是今天的热点。
 * 这类问题照样联网，同时带上抖音热榜，让模型从真榜单里挑能蹭的
 */
export function wantsHotTopics(question: string): boolean {
  return wantsDouyinHot(question) || /蹭.{0,4}热点|借势|热点.{0,6}(?:蹭|结合|借)|(?:最近|近期|今天|这几天|当下).{0,4}(?:有什么|有啥)?.{0,2}热点|热点话题/.test(question);
}

/** 只问抖音热榜、不用再全网搜的（问的还有新闻、别的平台、某个话题的细节，就照样联网） */
export function douyinHotOnly(question: string): boolean {
  return wantsDouyinHot(question) && !/新闻|微博|知乎|头条|百度|小红书|快手|B站|详情|怎么回事|来龙去脉|为什么/.test(question);
}

const heatText = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(2)}亿` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}万` : String(n));
const timeCN = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');

/** 交给回答模型的一段：榜单原样 + 怎么用 */
export function douyinHotContext(list: DouyinHotList, now = Date.now()): string {
  const stale = now - list.fetchedAt >= FRESH_MS;
  const lines = list.items.map((x) => `${x.rank}. ${x.word}（热度 ${heatText(x.heat)}）`);
  return [
    `【抖音热榜】开物服务器 ${timeCN(list.fetchedAt)}（北京时间）从抖音网页版热榜读到，抖音这份榜单更新于 ${list.activeTime || '未知'}，共 ${list.items.length} 条${stale ? `；这是 ${Math.round((now - list.fetchedAt) / 60_000)} 分钟前读到的上一份（这次没读到新的），回答里要写明时间` : ''}：`,
    ...lines,
    list.rising.length ? `上升热点：${list.rising.join('、')}` : '',
    '用法：用户问抖音热点、热榜时，先按排名原样列出至少前 20 条（话题和热度照抄，不改不编）；再结合用户的行业和账号，挑出能蹭的几条，每条说清切入角度和能拍什么。榜单里没有的话题不要说成在榜上；话题的细节（谁、为什么）榜单里没有，不知道就不说。',
  ].filter(Boolean).join('\n');
}

/** 没读到抖音热榜时给回答模型的一句 */
export const DOUYIN_HOT_MISSING = '【抖音热榜】这次没有读到抖音热榜（抖音那边暂时没返回）。不要用搜索结果里的旧榜单冒充今天的，也不要编热点；照实告诉用户这次没拿到，过几分钟再问。';
