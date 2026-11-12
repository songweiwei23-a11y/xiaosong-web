// 联网搜索基准评测（2026-11-09，整改阶段 0）：固定 20 问，跑开物「自由对话联网」的实际流程（读需求 → 搜索 → 挑来源 → 补读正文），
// 记下每一路搜索的状态（成功 / 限流 / 超时）、结果日期、最后挑出的来源、正文能不能读到。不调 Dify、不扣任何用户额度。
// 只在服务器跑（密钥在服务器）：BENCH_LABEL=baseline npx vitest run -c .tmp/search-bench/vitest.config.ts
// 成本：每问 1 次小模型 + 最多 5 次阿里云搜索 + 最多 3 次网页读取；20 问约 20 次小模型、≤100 次搜索（多数问题 2～3 次）。
import fs from 'node:fs';
import { it } from 'vitest';
import { planSearch } from '@/lib/search-plan';
import { aliSearch } from '@/lib/ali-search';
import { getSearchConfig } from '@/lib/search-config';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import { todayCN } from '@/lib/web-query';
import { localNewsSearches } from '@/lib/local-news-sources';
import { newsPlace } from '@/lib/search-quality';

/** 热榜直读（阶段 2 的 lib/hot-boards）：overlay 里有就用；线上还没有时跳过 */
let hb: any = null;
try { hb = await import('@/lib/hot-boards'); } catch { hb = null; }
let se: any = null;
try { se = await import('@/lib/search-engines'); } catch { se = null; }

/** window：这个问题要的时间范围（天），0 表示不限时效 */
export const QUESTIONS: { cat: string; q: string; hint: string; window: number }[] = [
  { cat: '新闻热点', q: '今天有什么热点新闻', hint: '', window: 2 },
  { cat: '新闻热点', q: '这两天抖音上什么火', hint: '行业：餐饮', window: 3 },
  { cat: '新闻热点', q: '最近一周有什么适合服装店蹭的热点', hint: '行业：大码女装', window: 8 },
  { cat: '新闻热点', q: '今天微博热搜前几名是什么', hint: '', window: 2 },
  { cat: '本地新闻', q: '濮阳最近一周有什么新闻', hint: '地区：河南濮阳', window: 8 },
  { cat: '本地新闻', q: '南乐县今天发生了什么', hint: '地区：河南南乐', window: 3 },
  { cat: '本地新闻', q: '郑州这周有什么大事', hint: '地区：河南郑州', window: 8 },
  { cat: '本地新闻', q: '县城餐饮最近有什么新变化', hint: '行业：餐饮；地区：河南南乐', window: 40 },
  { cat: '平台规则', q: '今年双十一抖音商家活动规则', hint: '', window: 60 },
  { cat: '平台规则', q: '抖音本地生活商家入驻需要什么资质和费用', hint: '', window: 0 },
  { cat: '平台规则', q: '抖音最近对团购视频有什么新规定', hint: '行业：餐饮', window: 40 },
  { cat: '平台规则', q: '视频号最新的流量扶持政策', hint: '', window: 40 },
  { cat: '行业数据', q: '2026年餐饮行业的最新数据', hint: '行业：餐饮', window: 370 },
  { cat: '行业数据', q: '大码女装市场规模有多大', hint: '行业：大码女装', window: 0 },
  { cat: '行业数据', q: '最近金价多少钱一克', hint: '', window: 3 },
  { cat: '行业数据', q: '今年家具行业生意好不好', hint: '行业：家具', window: 370 },
  { cat: '同行案例', q: '县城理发店怎么做抖音获客，有没有真实案例', hint: '行业：理发；地区：河南南乐', window: 0 },
  { cat: '同行案例', q: '火锅店抖音爆款视频案例', hint: '行业：餐饮', window: 0 },
  { cat: '同行案例', q: '服装店老板娘做抖音起号的真实故事', hint: '行业：大码女装', window: 0 },
  { cat: '同行案例', q: '家具店短视频怎么拍才有人看', hint: '行业：家具', window: 0 },
];

it('bench', async () => {
  const label = process.env.BENCH_LABEL || 'run';
  const config = await getSearchConfig();
  if (!config) throw new Error('没有搜索配置');
  const now = Date.now();
  const today = todayCN(now);
  const out: unknown[] = [];
  let failStreak = 0;
  // 第二个引擎（阶段 3 的 lib/search-engines）：BENCH_ENGINES=zhipu,bocha 时用配了密钥的那几家；不设就只用阿里云
  const wanted = (process.env.BENCH_ENGINES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const engines = se && wanted.length ? await se.activeEngines(wanted) : [];
  if (wanted.length && engines.length !== wanted.length) throw new Error(`要比的引擎没配好密钥：要 ${wanted.join(',')}，配了 ${engines.map((e: { engine: string }) => e.engine).join(',') || '无'}`);
  for (const c of QUESTIONS) {
    const origin = new Map<string, string>();
    const calls: { query: string; ok: boolean; reason?: string; ms: number; n: number; inWindow: number; dated: number }[] = [];
    const extraSearch = se ? (async (engine: string, key: string, query: string, opts: Record<string, unknown>) => {
      const t0 = Date.now();
      const r = await se.engineSearch(engine, key, query, opts);
      if (r.ok) for (const h of r.hits) origin.set(h.url, engine);
      const ages = r.ok ? r.hits.map((h: { published: string }) => (now - Date.parse(h.published)) / 86400000).filter(Number.isFinite) : [];
      calls.push({ query: `[${engine}] ${query}`, ok: r.ok, reason: r.ok ? undefined : r.reason, ms: Date.now() - t0, n: r.ok ? r.hits.length : 0, dated: ages.length, inWindow: c.window ? ages.filter((a: number) => a <= c.window).length : ages.length });
      return r;
    }) as never : undefined;
    const search: typeof aliSearch = async (query, cfg, opts) => {
      const t0 = Date.now();
      const r = await aliSearch(query, cfg, opts);
      if (r.ok) for (const h of r.hits) if (!origin.has(h.url)) origin.set(h.url, 'ali');
      const ages = r.ok ? r.hits.map((h) => (now - Date.parse(h.published)) / 86400000).filter(Number.isFinite) : [];
      calls.push({ query, ok: r.ok, reason: r.ok ? undefined : r.reason, ms: Date.now() - t0, n: r.ok ? r.hits.length : 0, dated: ages.length, inWindow: c.window ? ages.filter((a) => a <= c.window).length : ages.length });
      return r;
    };
    const t0 = Date.now();
    // 和自由对话路由一样：先看要不要读热榜（阶段 2 起有 lib/hot-boards；线上旧版只有抖音）
    let boardRows: { title: string; published_time: string; read_status: string; content: string; url: string }[] = [];
    let hotOnly = false;
    if (hb) {
      const ids = hb.boardsWanted(c.q, !!localNewsSearches(c.q) || !!newsPlace(c.q));
      const boards = await Promise.all(ids.map((id: string) => hb.getHotBoard(id)));
      hotOnly = boards.some(Boolean) && hb.boardsOnly(c.q);
      boardRows = boards.flatMap((b: { id: string; items: unknown[]; fetchedAt: number } | null, i: number) => (b ? [{ title: `${ids[i]} 热榜 ${b.items.length} 条`, published_time: new Date(b.fetchedAt).toISOString(), read_status: '已读榜单', content: 'x'.repeat(2000), url: `https://board.local/${ids[i]}` }] : []));
    }
    const plan = hotOnly ? null : await planSearch({ question: c.q, profileHint: c.hint, today });
    const res = hotOnly ? null : await searchFreeChatWeb(c.q, { config, search, now, onStarted: async () => {}, plan, ...(se ? { extra: engines, extraSearch } : {}) });
    const ms = Date.now() - t0;
    let sources: { title: string; published_time: string; read_status: string; content: string; url: string }[] = [];
    try { sources = JSON.parse(res?.context.slice(res.context.indexOf('{"sources"')) || '{}').sources ?? []; } catch { /* 没有来源 */ }
    sources = [...boardRows, ...sources];
    const ages = sources.map((s) => (now - Date.parse(s.published_time)) / 86400000);
    out.push({
      cat: c.cat, q: c.q, window: c.window, ms,
      plan: plan ? { intent: plan.intent, queries: plan.queries, recencyDays: plan.recencyDays } : null,
      status: sources.length ? 'done' : (res?.status.status ?? 'none'), message: res?.status.message, hotOnly,
      calls,
      sources: sources.map((s, i) => ({ engine: s.url.startsWith('https://board.local/') ? 'board' : origin.get(s.url) ?? 'other', host: (() => { try { return new URL(s.url).hostname; } catch { return '?'; } })(), title: s.title.slice(0, 50), published: s.published_time, ageDays: Number.isFinite(ages[i]) ? Math.round(ages[i] * 10) / 10 : null, read: s.read_status.slice(0, 12), chars: s.content.length })),
    });
    failStreak = sources.length ? 0 : failStreak + 1;
    if (calls.some((x) => x.reason === 'auth')) throw new Error('搜索密钥不对，停止');
    if (failStreak >= 6) { out.push({ stopped: '连续 6 问没有结果，停止' }); break; }
  }
  fs.mkdirSync('.tmp/search-bench/out', { recursive: true });
  fs.writeFileSync(`.tmp/search-bench/out/${label}.json`, JSON.stringify(out, null, 2));
});
