import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/search-config', () => ({ getSearchConfig: vi.fn(async () => null) }));
import { capPerHost, dedupeByTitle, isRiskHit, isWeatherHit, normalizeTitle, titleDate, titleSaysStale } from '@/lib/search-quality';
import { isOfficialHost, officialSiteQueries } from '@/lib/search-official-sites';
import { pickFreeChatSources } from '@/lib/web-source-quality';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import { SEARCH_FAILURE_TEXT, type SearchHit, type aliSearch } from '@/lib/ali-search';
import type { fetchPage } from '@/lib/page-fetch';

const config = { endpoint: 'https://example.opensearch.aliyuncs.com/v3/web-search/test', apiKey: 'test-only', source: 'env' as const };
const body = '这是有依据的正文内容。'.repeat(30);
const hit = (url: string, title = url, content = body, published = ''): SearchHit => ({ url, title, content, published });

describe('标题与导流页过滤', () => {
  it('标题归一化忽略标点、空格和大小写', () => {
    expect(normalizeTitle('南乐县 召开会议！')).toBe(normalizeTitle('南乐县召开会议'));
  });
  it('买卖账号、开户、代运营导流页不收；问的正是这些时不挡', () => {
    expect(isRiskHit(hit('https://x.com/a', '正规买卖抖音号平台'), '抖音账号怎么运营')).toBe(true);
    expect(isRiskHit(hit('https://x.com/a', '代运营公司排行榜'), '代运营哪家靠谱')).toBe(false);
    expect(isRiskHit(hit('https://x.com/a', '短视频拍摄教程'), '抖音账号怎么运营')).toBe(false);
  });
  it('天气和气象预警页面不冒充新闻；问天气时不挡', () => {
    expect(isWeatherHit(hit('https://ynweather.com/nanle/', '南乐天气预报实时'), '南乐最近的热点新闻')).toBe(true);
    expect(isWeatherHit(hit('https://www.nanle.gov.cn/news/1', '大雾黄色预警发布'), '南乐新闻')).toBe(true);
    expect(isWeatherHit(hit('https://www.nanle.gov.cn/news/1', '南乐召开会议'), '南乐新闻')).toBe(false);
    expect(isWeatherHit(hit('https://ynweather.com/nanle/', '南乐天气预报'), '南乐今天天气')).toBe(false);
  });
});

describe('标题日期与去重', () => {
  it('能读出标题里的日期，过旧的标题判为过期，没有日期或不限时效不判', () => {
    const now = Date.parse('2026-10-18T04:00:00Z');
    expect(titleDate('2026年8月21日 通知')).toBe(Date.UTC(2026, 7, 21));
    expect(titleSaysStale('2026-08-21 南乐召开会议', 3, now)).toBe(true);
    expect(titleSaysStale('2026-10-16 南乐召开会议', 3, now)).toBe(false);
    expect(titleSaysStale('南乐召开会议', 3, now)).toBe(false);
    expect(titleSaysStale('2026-08-21 南乐召开会议', 0, now)).toBe(false);
  });
  it('同一篇文章的转载只留一条，标题太短的不去重', () => {
    const out = dedupeByTitle([
      { title: '南乐县召开全县经济工作会议' },
      { title: '南乐县召开全县经济工作会议！' },
      { title: '短' }, { title: '短' },
    ]);
    expect(out).toHaveLength(3);
  });
  it('同一站点限量，官方站点可以多留几条', () => {
    const isOfficial = (host: string) => host === 'cac.gov.cn';
    const items = [
      ...Array.from({ length: 3 }, (_, i) => ({ host: 'a.com', n: i })),
      ...Array.from({ length: 5 }, (_, i) => ({ host: 'cac.gov.cn', n: i })),
    ];
    const out = capPerHost(items, isOfficial, 2, 4);
    expect(out.filter(x => x.host === 'a.com')).toHaveLength(2);
    expect(out.filter(x => x.host === 'cac.gov.cn')).toHaveLength(4);
    expect(isOfficialHost('www.cac.gov.cn')).toBe(true);
    expect(isOfficialHost('example.com')).toBe(false);
  });
});

describe('官方站点补查', () => {
  it('政策规定类问题补查网信办站点，并且只带 site: 查询', () => {
    const q = officialSiteQueries('生成式AI标识新规有哪些要求');
    expect(q.map(x => x.site)).toEqual(['cac.gov.cn']);
    expect(q[0].query.startsWith('site:cac.gov.cn ')).toBe(true);
  });
  it('抖音热榜问的是热点，不补查抖音生活服务站点', () => {
    expect(officialSiteQueries('抖音热榜今天的热点')).toEqual([]);
  });
  it('抖音本地生活问题补查生活服务官方站点', () => {
    expect(officialSiteQueries('抖音本地生活商家入驻要求').map(x => x.site)).toEqual(['life.douyin.com']);
  });
  it('一次问题最多补查两个官方站点', () => {
    expect(officialSiteQueries('Dify 阿里云 本地生活 新规')).toHaveLength(2);
  });
});

describe('来源挑选', () => {
  const now = Date.parse('2026-10-18T04:00:00Z');
  it('转载的同一篇文章只留一条', () => {
    const out = pickFreeChatSources([
      hit('https://a.example.com/1', '南乐县召开全县经济工作会议'),
      hit('https://b.example.com/2', '南乐县召开全县经济工作会议！'),
    ], '南乐县经济工作会议', 0, now);
    expect(out).toHaveLength(1);
  });
  it('官方站点排在聚合站前面', () => {
    const out = pickFreeChatSources([
      hit('https://news.example.com/a', '生成式人工智能标识办法解读'),
      hit('https://www.cac.gov.cn/2025/rule', '网络信息内容生成合成办法'),
    ], '生成式AI标识新规有哪些要求', 0, now);
    expect(out[0].url).toContain('cac.gov.cn');
  });
  it('导流页不进来源', () => {
    const out = pickFreeChatSources([
      hit('https://ad.example.com/x', '正规买卖抖音号平台'),
      hit('https://docs.example.com/y', '抖音账号运营基础'),
    ], '抖音账号怎么运营', 0, now);
    expect(out.map(x => x.url)).toEqual(['https://docs.example.com/y']);
  });
  it('标题写着过旧日期的页面，新鲜来源足够时不混进来', () => {
    const out = pickFreeChatSources([
      hit('https://old.example.com/a', '2026-08-21 南乐召开会议'),
      hit('https://new.example.com/b', '南乐召开全县会议'),
      hit('https://new.example.com/c', '南乐发布本周通知'),
    ], '南乐本周会议', 3, now);
    expect(out.map(x => x.url)).not.toContain('https://old.example.com/a');
    expect(out).toHaveLength(2);
  });
});

describe('搜索流程：官方站点结果与失败文案', () => {
  const read = vi.fn<typeof fetchPage>(async () => ({ ok: false as const, reason: 'http' as const, status: 403 }));
  const onStarted = vi.fn(async () => {});
  it('政策问题会发出官方站点查询，官方结果进入来源', async () => {
    const search = vi.fn<typeof aliSearch>(async (query) => ({ ok: true as const, hits: query.startsWith('site:cac.gov.cn')
      ? [hit('https://www.cac.gov.cn/2025/rule', '网络信息内容生成合成办法', body)]
      : [hit('https://blog.example.com/x', '行业解读', body)] }));
    const result = await searchFreeChatWeb('生成式AI标识新规有哪些要求', { config, search, read, onStarted });
    expect(search.mock.calls.some(c => c[0].startsWith('site:cac.gov.cn'))).toBe(true);
    expect(result?.status.sources.map(s => s.url)).toContain('https://www.cac.gov.cn/2025/rule');
  });
  it('通用搜索失败时，官方站点的结果照常使用，不整体判失败', async () => {
    const search = vi.fn<typeof aliSearch>(async (query) => query.startsWith('site:cac.gov.cn')
      ? { ok: true as const, hits: [hit('https://www.cac.gov.cn/2025/rule', '网络信息内容生成合成办法', body)] }
      : { ok: false as const, reason: 'quota' as const });
    const result = await searchFreeChatWeb('生成式AI标识新规有哪些要求', { config, search, read, onStarted });
    expect(result?.status.status).toBe('done');
    expect(result?.status.sources.map(s => s.url)).toEqual(['https://www.cac.gov.cn/2025/rule']);
  });
  it('全部搜索都没有结果时，失败文案用给用户看的说明，不显示原始错误代码', async () => {
    const search = vi.fn<typeof aliSearch>(async () => ({ ok: false as const, reason: 'quota' as const }));
    const result = await searchFreeChatWeb('行业方法', { config, search, read, onStarted });
    expect(result?.status.status).toBe('unavailable');
    expect(result?.status.message).toBe(SEARCH_FAILURE_TEXT.quota);
    expect(result?.status.message).not.toContain('quota');
  });
});
