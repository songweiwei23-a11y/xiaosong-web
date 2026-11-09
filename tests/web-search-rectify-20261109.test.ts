/**
 * 联网整改（2026-11-09）阶段 1、2：时间过滤交给搜索接口、按接口上限排队、搜不到放宽一档、读深一点；
 * 微博、百度、头条热榜直接读。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { reserveAliSlot, resetAliQueue, timeRangeOf, widerRange, aliSearch } from '@/lib/ali-search';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import { boardsOnly, boardsWanted, getHotBoard, hotBoardsContext, parseBaidu, parseToutiao, parseWeibo, resetHotBoards } from '@/lib/hot-boards';
import { parseBocha, parseZhipu } from '@/lib/search-engines';
import { readCode } from './helpers/source';

const cfg = { endpoint: 'https://x.opensearch.aliyuncs.com/v3/openapi/workspaces/default/web-search/ops-web-search-001', apiKey: 'k'.repeat(20), source: 'env' as const };
const NOW = Date.parse('2026-11-09T04:00:00Z');

describe('阶段 1：时间过滤交给接口', () => {
  it('天数换成接口的 time_range，留余量；放宽一档', () => {
    expect([0, 1, 2, 3, 8, 10, 40, 370, 999].map(timeRangeOf)).toEqual([undefined, 'day', 'day', 'week', 'week', 'month', 'month', 'year', undefined]);
    expect([widerRange('day'), widerRange('week'), widerRange('month'), widerRange('year')]).toEqual(['week', 'month', 'year', undefined]);
  });
  it('请求体真的带上 time_range、extend_search（lite 不带 extend）', async () => {
    const bodies: Record<string, unknown>[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_u: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ result: { search_result: [] } }), { status: 200 }); }) as typeof fetch;
    try {
      await aliSearch('q', cfg, { way: 'pro-fetch', timeRange: 'week', extend: true, noQueue: true });
      await aliSearch('q', cfg, { way: 'lite', extend: true, noQueue: true });
      await aliSearch('q', cfg, { way: 'pro-fetch', noQueue: true });
    } finally { globalThis.fetch = realFetch; }
    expect(bodies[0]).toMatchObject({ time_range: 'week', extend_search: true });
    expect(bodies[1].extend_search).toBeUndefined();
    expect(bodies[2].time_range).toBeUndefined();
  });
});

describe('阶段 1：按接口上限排队（任意 1 秒内最多 3 次）', () => {
  afterEach(() => resetAliQueue());
  it('前三次不用等，第四次排到第一次之后 1 秒', () => {
    resetAliQueue();
    expect([reserveAliSlot(1000), reserveAliSlot(1000), reserveAliSlot(1100), reserveAliSlot(1100)]).toEqual([1000, 1000, 1100, 2000]);
    expect(reserveAliSlot(1200)).toBe(2000);
    expect(reserveAliSlot(5000)).toBe(5000);
  });
});

describe('阶段 1：自由对话联网的流程', () => {
  const hit = (title: string, days: number) => ({ url: `https://news.example.com/${encodeURIComponent(title)}`, title, content: `${title} 正文 `.repeat(200), published: new Date(NOW - days * 86400000).toISOString() });
  it('问「今天」：通用和新闻类定向搜索都带 time_range=day', async () => {
    const calls: { q: string; range?: string }[] = [];
    await searchFreeChatWeb('南乐县今天发生了什么新闻', {
      config: cfg, now: NOW, onStarted: async () => {}, read: async () => ({ ok: false }) as never,
      search: async (q, _c, o) => { calls.push({ q, range: o?.timeRange }); return { ok: true, hits: [hit('南乐 今天 新闻 一件事', 0.3)] }; },
    });
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every((c) => c.range === 'day')).toBe(true);
  });
  it('按时间一条都没搜到：放宽一档再搜，告诉模型放宽了', async () => {
    const ranges: (string | undefined)[] = [];
    const res = await searchFreeChatWeb('今天有什么新闻', {
      config: cfg, now: NOW, onStarted: async () => {}, read: async () => ({ ok: false }) as never,
      search: async (_q, _c, o) => { ranges.push(o?.timeRange); return o?.timeRange === 'day' ? { ok: true, hits: [] } : { ok: true, hits: [hit('今天 新闻 发生的事', 5)] }; },
    });
    expect(ranges).toContain('week');
    expect(res?.context).toContain('已放宽到「一周内」');
  });
  it('补读前 5 条、每条 6 秒；每一路记日志', () => {
    const src = readCode('lib/free-chat-web.ts');
    expect(src).toMatch(/index < 5 && text\.trim\(\)\.length < 2500/);
    expect(src).toMatch(/timeoutMs: 6000, maxBytes/);
    expect(src).toMatch(/console\.log\(`\[web-search\]/);
  });
});

describe('阶段 3：第二个搜索引擎', () => {
  it('读得懂智谱、博查的返回；失败分清密钥、额度、格式', () => {
    const z = parseZhipu(200, JSON.stringify({ search_result: [{ title: 't', content: 'c', link: 'https://a.com/1', media: 'A', publish_date: '2026-11-08' }, { link: 'javascript:x' }] }));
    expect(z).toEqual({ ok: true, hits: [{ url: 'https://a.com/1', title: 't', content: 'c', published: '2026-11-08' }] });
    expect(parseZhipu(401, '{"error":{"code":"1000","message":"身份验证失败"}}')).toMatchObject({ ok: false, reason: 'auth' });
    expect(parseZhipu(429, '{"error":{"code":"1701","message":"并发"}}')).toMatchObject({ ok: false, reason: 'quota' });
    expect(parseZhipu(200, '{}')).toMatchObject({ ok: false, reason: 'bad_response' });
    const bWrapped = parseBocha(200, JSON.stringify({ code: 200, data: { webPages: { value: [{ name: 'n', url: 'https://b.com/2', snippet: 's', summary: '摘要', datePublished: '2026-11-09T08:00:00+08:00' }] } } }));
    expect(bWrapped).toEqual({ ok: true, hits: [{ url: 'https://b.com/2', title: 'n', content: '摘要', published: '2026-11-09T08:00:00+08:00' }] });
    expect(parseBocha(200, JSON.stringify({ webPages: { value: [{ name: 'n', url: 'https://b.com/3', snippet: 's' }] } }))).toMatchObject({ ok: true, hits: [{ content: 's' }] });
    expect(parseBocha(200, JSON.stringify({ code: 403, msg: 'api key invalid' }))).toMatchObject({ ok: false, reason: 'auth' });
  });
  it('第二引擎拿同样的搜索词和时间过滤，结果和阿里云交替合并；它失败不影响阿里云', async () => {
    const extraCalls: { engine: string; range?: string }[] = [];
    const hitOf = (url: string) => ({ url, title: `今天 新闻 ${url}`, content: '今天 新闻 正文 '.repeat(200), published: new Date(NOW - 3600_000).toISOString() });
    const res = await searchFreeChatWeb('今天有什么新闻', {
      config: cfg, now: NOW, onStarted: async () => {}, read: async () => ({ ok: false }) as never,
      search: async () => ({ ok: true, hits: [hitOf('https://ali.com/1'), hitOf('https://ali.com/2')] }),
      extra: [{ engine: 'zhipu', key: 'k' }, { engine: 'bocha', key: 'k' }],
      extraSearch: async (engine, _k, _q, o) => { extraCalls.push({ engine, range: o?.timeRange }); return engine === 'zhipu' ? { ok: true, hits: [hitOf('https://zp.com/1')] } : { ok: false, reason: 'network' }; },
    });
    expect(extraCalls).toEqual([{ engine: 'zhipu', range: 'day' }, { engine: 'bocha', range: 'day' }]);
    expect(res?.status.sources.map((s) => s.url)).toEqual(expect.arrayContaining(['https://ali.com/1', 'https://zp.com/1', 'https://ali.com/2']));
  });
  it('默认关：线上只用后台打开了的；后台验证读不出结果不保存', () => {
    expect(readCode('lib/search-engines.ts')).toMatch(/force \? force\.includes\(e\) : all\[e\]\.enabled/);
    expect(readCode('app/api/admin/search-key/route.ts')).toMatch(/能连上，但这次没读出任何结果/);
  });
});

describe('阶段 2：热榜直接读', () => {
  afterEach(() => resetHotBoards());
  it('读得懂三家的格式；广告位不算；不像榜单返回 null', () => {
    const weibo = parseWeibo({ data: { realtime: [{ word: '广告', is_ad: 1 }, ...Array.from({ length: 6 }, (_, i) => ({ word: `话题${i}`, num: 1000 * i, label_name: i === 0 ? '新' : '' }))] } }, NOW)!;
    expect(weibo.items[0]).toMatchObject({ rank: 1, word: '话题0', desc: '标记：新' });
    expect(weibo.items.some((x) => x.word === '广告')).toBe(false);
    const html = `<html><!--s-data:${JSON.stringify({ data: { cards: [{ content: Array.from({ length: 6 }, (_, i) => ({ word: `百度${i}`, hotScore: '7904606', desc: '事件摘要', rawUrl: 'https://www.baidu.com/s?wd=x' })) }] } })}--></html>`;
    expect(parseBaidu(html, NOW)!.items[0]).toMatchObject({ word: '百度0', heat: 7904606, desc: '事件摘要' });
    expect(parseToutiao({ data: Array.from({ length: 6 }, (_, i) => ({ Title: `头条${i}`, HotValue: '123', Url: 'https://www.toutiao.com/trending/1/?a=b' })) }, NOW)!.items[0]).toMatchObject({ word: '头条0', link: 'https://www.toutiao.com/trending/1/' });
    expect(parseWeibo({ data: {} })).toBeNull();
    expect(parseBaidu('<html></html>')).toBeNull();
  });
  it('10 分钟缓存；读不到用 2 小时内的旧的；再旧就是 null', async () => {
    let n = 0;
    const ok = (async () => { n++; return new Response(JSON.stringify({ data: { realtime: Array.from({ length: 6 }, (_, i) => ({ word: `w${i}` })) } })); }) as unknown as typeof fetch;
    const bad = (async () => { n++; return new Response('x', { status: 500 }); }) as unknown as typeof fetch;
    expect((await getHotBoard('weibo', { fetch: ok, now: NOW }))?.items).toHaveLength(6);
    await getHotBoard('weibo', { fetch: ok, now: NOW + 5 * 60_000 });
    expect(n).toBe(1);
    expect(await getHotBoard('weibo', { fetch: bad, now: NOW + 60 * 60_000 })).not.toBeNull();
    expect(await getHotBoard('weibo', { fetch: bad, now: NOW + 3 * 3600_000 })).toBeNull();
  });
  it('读哪几家：点名读点名的；问热点或今天的新闻就四家；问某地新闻不读；不问热点不读', () => {
    expect(boardsWanted('微博热搜今天有什么')).toEqual(['weibo']);
    expect(boardsWanted('百度和头条热榜')).toEqual(['baidu', 'toutiao']);
    expect(boardsWanted('今天有什么热点新闻')).toEqual(['douyin', 'weibo', 'baidu', 'toutiao']);
    expect(boardsWanted('最近适合服装店蹭的热点')).toEqual(['douyin', 'weibo', 'baidu', 'toutiao']);
    expect(boardsWanted('濮阳这周有什么新闻', true)).toEqual([]);
    expect(boardsWanted('火锅店抖音爆款视频案例')).toEqual([]);
    // 带了类别的新闻不读全国热榜（交给搜索）；不限类别的读
    expect(boardsWanted('今天有什么科技新闻？')).toEqual([]);
    expect(boardsWanted('今天有什么新闻')).toEqual(['douyin', 'weibo', 'baidu', 'toutiao']);
    expect(boardsWanted('最近都发生了什么')).toEqual(['douyin', 'weibo', 'baidu', 'toutiao']);
    expect(boardsOnly('微博热搜前几名')).toBe(true);
    expect(boardsOnly('微博热搜第一是怎么回事')).toBe(false);
  });
  it('交给模型：一家 50 条、几家一起每家 20 条；没读到的照实说', () => {
    const b = { id: 'weibo' as const, fetchedAt: NOW, items: Array.from({ length: 50 }, (_, i) => ({ rank: i + 1, word: `w${i}`, heat: 0, desc: '', link: '' })) };
    expect(hotBoardsContext(['weibo'], [b], NOW)).toContain('50. w49');
    const two = hotBoardsContext(['weibo', 'baidu'], [b, null], NOW);
    expect(two).toContain('20. w19');
    expect(two).not.toContain('21. w20');
    expect(two).toContain('【百度热搜】这次没读到');
  });
  it('自由对话路由用的是四家直读，不再只有抖音', () => {
    const route = readCode('app/api/dify/chat/route.ts');
    // 问某地的事（「郑州这周有什么大事」）不塞全国热榜：地方新闻名单里没有的地名也要认出来
    expect(route).toMatch(/boardsWanted\(question, !!localNewsSearches\(question\) \|\| !!newsPlace\(question\)\)/);
    expect(route).toMatch(/hotBoardsContext\(boardIds, boards\)/);
  });
});
