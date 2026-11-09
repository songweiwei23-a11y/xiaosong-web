/**
 * 各平台热榜直读（2026-11-09 联网整改阶段 2）：抖音之外，微博、百度、今日头条的热榜也由开物服务器直接读公开榜单。
 *
 * 为什么：热榜是实时页面，原来微博、头条靠搜索引擎 site: 去搜，搜到的是几天前的快照
 * （基线实测：「今天微博热搜前几名」拿到的是 18 天前的页面）。
 * 守住（和抖音热榜同一套，见 lib/douyin-hot）：只读公开榜单、不登录、不带 Cookie；每家全站一份缓存，10 分钟最多请求一次；
 * 读不到用 2 小时内的上一份并写明时间，再没有就照实说没读到——不拿旧榜单冒充今天的，不编榜单以外的话题。
 * 知乎热榜现在要登录才能看，不接（问知乎的仍走 site: 搜索，见 lib/hot-list-sources）。
 */
import { getDouyinHot, type DouyinHotList } from './douyin-hot';

export type BoardId = 'douyin' | 'weibo' | 'baidu' | 'toutiao';
export const BOARD_LABEL: Record<BoardId, string> = { douyin: '抖音热榜', weibo: '微博热搜', baidu: '百度热搜', toutiao: '今日头条热榜' };
export const BOARD_PAGE: Record<BoardId, string> = {
  douyin: 'https://www.douyin.com/hot', weibo: 'https://s.weibo.com/top/summary', baidu: 'https://top.baidu.com/board?tab=realtime', toutiao: 'https://www.toutiao.com/',
};

export interface BoardItem { rank: number; word: string; heat: number; desc: string; link: string }
export interface HotBoard { id: BoardId; items: BoardItem[]; fetchedAt: number }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const FRESH_MS = 10 * 60_000;
const STALE_MS = 2 * 3600_000;
const TIMEOUT_MS = 8000;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const safeLink = (u: unknown, fallback: string) => (typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u) ? u.slice(0, 500) : fallback);

/** 微博 weibo.com/ajax/side/hotSearch：data.realtime[]（word、num、note、label_name） */
export function parseWeibo(raw: unknown, now = Date.now()): HotBoard | null {
  const list = (raw as { data?: { realtime?: unknown } } | null)?.data?.realtime;
  if (!Array.isArray(list)) return null;
  const items: BoardItem[] = [];
  for (const x of list as Record<string, unknown>[]) {
    // 广告位（is_ad）不算热搜
    if (x?.is_ad) continue;
    const word = str(x?.word, 60);
    if (!word) continue;
    items.push({ rank: items.length + 1, word, heat: num(x.num), desc: str(x.label_name, 4) ? `标记：${str(x.label_name, 4)}` : '', link: `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${word}#`)}` });
    if (items.length >= 50) break;
  }
  return items.length >= 5 ? { id: 'weibo', items, fetchedAt: now } : null;
}

/** 百度 top.baidu.com/board?tab=realtime：页面里的 <!--s-data:{...}-->，data.cards[0].content[]（word/query、hotScore、desc） */
export function parseBaidu(html: string, now = Date.now()): HotBoard | null {
  const m = html.match(/<!--s-data:([\s\S]*?)-->/);
  if (!m) return null;
  let d: { data?: { cards?: { content?: unknown }[] } };
  try { d = JSON.parse(m[1]); } catch { return null; }
  const list = d?.data?.cards?.[0]?.content;
  if (!Array.isArray(list)) return null;
  const items: BoardItem[] = [];
  for (const x of list as Record<string, unknown>[]) {
    const word = str(x?.word, 60) || str(x?.query, 60);
    if (!word) continue;
    items.push({ rank: items.length + 1, word, heat: num(x.hotScore), desc: str(x.desc, 120), link: safeLink(x.rawUrl ?? x.appUrl, BOARD_PAGE.baidu) });
    if (items.length >= 50) break;
  }
  return items.length >= 5 ? { id: 'baidu', items, fetchedAt: now } : null;
}

/** 今日头条 www.toutiao.com/hot-event/hot-board/：data[]（Title、HotValue、Url） */
export function parseToutiao(raw: unknown, now = Date.now()): HotBoard | null {
  const list = (raw as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) return null;
  const items: BoardItem[] = [];
  for (const x of list as Record<string, unknown>[]) {
    const word = str(x?.Title, 60);
    if (!word) continue;
    items.push({ rank: items.length + 1, word, heat: num(x.HotValue), desc: '', link: safeLink(x.Url, BOARD_PAGE.toutiao).split('?')[0] });
    if (items.length >= 50) break;
  }
  return items.length >= 5 ? { id: 'toutiao', items, fetchedAt: now } : null;
}

function fromDouyin(list: DouyinHotList): HotBoard {
  return { id: 'douyin', fetchedAt: list.fetchedAt, items: list.items.map((x) => ({ rank: x.rank, word: x.word, heat: x.heat, desc: '', link: x.link })) };
}

const SOURCES: Record<Exclude<BoardId, 'douyin'>, { url: string; referer: string; parse: (body: string, now: number) => HotBoard | null }> = {
  weibo: { url: 'https://weibo.com/ajax/side/hotSearch', referer: 'https://weibo.com/', parse: (b, now) => { try { return parseWeibo(JSON.parse(b), now); } catch { return null; } } },
  baidu: { url: 'https://top.baidu.com/board?tab=realtime', referer: 'https://top.baidu.com/', parse: (b, now) => parseBaidu(b, now) },
  toutiao: { url: 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', referer: 'https://www.toutiao.com/', parse: (b, now) => { try { return parseToutiao(JSON.parse(b), now); } catch { return null; } } },
};

const cache = new Map<BoardId, HotBoard>();
const inflight = new Map<BoardId, Promise<HotBoard | null>>();

/** 取某一家热榜：10 分钟内用缓存；过了去读一次（同一时刻多人问只读一次）；读不到用 2 小时内的旧的；再没有返回 null */
export async function getHotBoard(id: BoardId, deps: { fetch?: typeof fetch; now?: number } = {}): Promise<HotBoard | null> {
  if (id === 'douyin') {
    const list = await getDouyinHot(deps);
    return list ? fromDouyin(list) : null;
  }
  const now = deps.now ?? Date.now();
  const hit = cache.get(id);
  if (hit && now - hit.fetchedAt < FRESH_MS) return hit;
  let p = inflight.get(id);
  if (!p) {
    const src = SOURCES[id];
    p = (async () => {
      try {
        const res = await (deps.fetch ?? fetch)(src.url, {
          headers: { 'user-agent': UA, referer: src.referer, accept: 'application/json,text/html' },
          signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store', redirect: 'error',
        });
        if (!res.ok) { console.warn(`[hot-board] ${id} HTTP ${res.status}`); return null; }
        const board = src.parse(await res.text(), now);
        if (!board) console.warn(`[hot-board] ${id} 读不出榜单（页面可能改版了）`);
        return board;
      } catch {
        console.warn(`[hot-board] ${id} 请求失败`);
        return null;
      }
    })().finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  const fresh = await p;
  if (fresh) { cache.set(id, fresh); return fresh; }
  return hit && now - hit.fetchedAt < STALE_MS ? hit : null;
}

/** 测试用 */
export function resetHotBoards(): void { cache.clear(); inflight.clear(); }

const NAMED: [RegExp, BoardId][] = [[/抖音|dy/i, 'douyin'], [/微博/, 'weibo'], [/百度/, 'baidu'], [/头条/, 'toutiao']];
const HOT_WORDS = /热点|热榜|热搜|热门|什么火|火了|爆了|上热门|榜单|蹭|借势/;
/**
 * 问的是「今天的新闻大事」这种不限类别的：「今天有什么新闻」「最近发生了什么」「热点新闻」。
 * 带了类别的（「今天有什么科技新闻」「最近的餐饮新闻」）不算——全国热榜帮不上，交给搜索
 */
const NEWS_NOW = /(?:今天|今日|这两天|这几天|最近|近期|本周|这周)(?:都|又|有)?(?:有|出了)?(?:什么|啥|哪些)?(?:新闻|大事|热点|事)|发生了?(?:什么|啥)|热点新闻|新闻热点/;

/**
 * 这句话要读哪几家热榜：点名了平台就读点名的；没点名、问的是热点 / 今天的新闻大事，就四家都读。
 * 问某个地方的新闻（有地名）不读——全国热榜帮不上，交给地方新闻的定向搜索。
 */
export function boardsWanted(question: string, hasPlace = false): BoardId[] {
  const named = NAMED.filter(([re]) => re.test(question)).map(([, id]) => id);
  const hot = HOT_WORDS.test(question) || NEWS_NOW.test(question);
  if (!hot) return [];
  if (named.length) return named;
  return hasPlace ? [] : ['douyin', 'weibo', 'baidu', 'toutiao'];
}

/** 只要榜单、不用再全网搜的：点名了平台的热榜，没问新闻细节、来龙去脉 */
export function boardsOnly(question: string): boolean {
  return NAMED.some(([re]) => re.test(question)) && /热榜|热搜|榜单|什么火|热点/.test(question)
    && !/新闻|知乎|小红书|快手|B站|详情|怎么回事|来龙去脉|为什么/.test(question);
}

const heatText = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(2)}亿` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}万` : n ? String(n) : '');
const timeCN = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');

/** 交给回答模型的一段：每家榜单原样（一家时 50 条，几家一起时每家前 20 条）+ 怎么用 */
export function hotBoardsContext(ids: BoardId[], boards: (HotBoard | null)[], now = Date.now()): string {
  const per = ids.length > 1 ? 20 : 50;
  const parts: string[] = [];
  ids.forEach((id, i) => {
    const b = boards[i];
    if (!b) { parts.push(`【${BOARD_LABEL[id]}】这次没读到（平台暂时没返回）。不要用搜索结果里的旧榜单冒充今天的，照实说没读到。`); return; }
    const age = Math.round((now - b.fetchedAt) / 60_000);
    parts.push([
      `【${BOARD_LABEL[id]}】开物服务器 ${timeCN(b.fetchedAt)}（北京时间）直接从平台读到${age >= 10 ? `；这是 ${age} 分钟前的上一份（这次没读到新的），回答里要写明时间` : ''}，来源：[${BOARD_LABEL[id]}](${BOARD_PAGE[id]})`,
      ...b.items.slice(0, per).map((x) => `${x.rank}. ${x.word}${heatText(x.heat) ? `（热度 ${heatText(x.heat)}）` : ''}${x.desc && !x.desc.startsWith('标记') ? `：${x.desc}` : ''}`),
    ].join('\n'));
  });
  parts.push('用法：这些榜单是开物服务器刚从平台读到的实时数据，可以当作已核实的热榜引用，不受「未联网」的限制。用户问热榜时按排名原样列出（话题照抄，不改不编）；问能蹭什么热点时，结合用户的行业和账号挑几条，说清切入角度和能拍什么。榜单里没有的话题不要说成在榜上；话题的细节榜单里没写的，不知道就不说。');
  return parts.join('\n\n');
}
