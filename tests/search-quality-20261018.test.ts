import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/search-config', () => ({ getSearchConfig: vi.fn(async () => null) }));
import { hotListSearches } from '@/lib/hot-list-sources';
import { isNationalNewsHost, nationalNewsSearches } from '@/lib/national-news-sources';
import { isMarketHit, newsPlace } from '@/lib/search-quality';
import { pickFreeChatSources } from '@/lib/web-source-quality';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import type { SearchHit, aliSearch } from '@/lib/ali-search';
import type { fetchPage } from '@/lib/page-fetch';

const config = { endpoint: 'https://example.opensearch.aliyuncs.com/v3/web-search/test', apiKey: 'test-only', source: 'env' as const };
const body = '这是有依据的正文内容。'.repeat(30);
const hit = (url: string, title = url, content = body, published = ''): SearchHit => ({ url, title, content, published });
const now = Date.parse('2026-10-18T04:00:00Z');

describe('抖音热榜只搜抖音自己的站点', () => {
  it('提到抖音热榜时只搜抖音，不掺知乎和头条', () => {
    expect(hotListSearches('抖音热榜今天')?.map(h => h.site)).toEqual(['www.douyin.com']);
    expect(hotListSearches('抖音热搜有什么')?.map(h => h.site)).toEqual(['www.douyin.com']);
  });
  it('没有提到平台的热搜问题，仍然是知乎、微博、头条三家（不含抖音）', () => {
    expect(hotListSearches('今天有什么热搜')?.map(h => h.site)).toEqual(['zhihu.com', 's.weibo.com', 'toutiao.com']);
  });
});

describe('全国新闻站点', () => {
  it('国内、全国范围的新闻问题搜全国新闻站，地方新闻和热榜不搜', () => {
    expect(nationalNewsSearches('今天国内有哪些重要新闻')?.map(s => s.site)).toEqual(['thepaper.cn', 'sohu.com']);
    expect(nationalNewsSearches('郑州最近的热点新闻')).toBeNull();
    expect(nationalNewsSearches('今天国内热搜')).toBeNull();
    expect(nationalNewsSearches('今天国内天气')).toBeNull();
  });
  it('站点判断包括子域名，财经行情站不算', () => {
    expect(isNationalNewsHost('m.sohu.com')).toBe(true);
    expect(isNationalNewsHost('www.thepaper.cn')).toBe(true);
    expect(isNationalNewsHost('quote.eastmoney.com')).toBe(false);
  });
});

describe('行情页过滤', () => {
  it('新闻类问题不收股票、基金行情页', () => {
    expect(isMarketHit(hit('https://quote.eastmoney.com/x', '科创综指ETF国泰'), '今天国内有哪些重要新闻')).toBe(true);
    expect(isMarketHit(hit('https://mguba.eastmoney.com/x', '复盘：周末重要消息汇总解读，下周A股行情走势分析'), '今天国内重要新闻')).toBe(true);
  });
  it('问的是财经、股票时不挡；不是新闻的问题也不挡（装修报价是正经内容）', () => {
    expect(isMarketHit(hit('https://x.com/a', 'A股行情走势分析'), '今天A股行情怎么样')).toBe(false);
    expect(isMarketHit(hit('https://x.com/a', '装修报价指南'), '县城装修怎么获客')).toBe(false);
  });
});

describe('政府网站的新闻稿按时效算', () => {
  it('问的是今天的新闻时，过旧的政府稿不当成今天的', () => {
    const out = pickFreeChatSources([
      hit('https://www.nanle.gov.cn/content/2026/1342398.html', '南乐县安防委第六次全体会议召开', body, '2026-09-19T00:00:00+08:00'),
      hit('https://www.puyang.gov.cn/content/2026/1348022.html', '唤醒沉睡资产鼓起集体腰包', body, '2026-10-16T00:00:00+08:00'),
    ], '南乐县 今天 新闻', 2, now);
    expect(out.map(x => x.url)).toEqual(['https://www.puyang.gov.cn/content/2026/1348022.html']);
  });
  it('政策类问题仍然保留政府规定（规则页不因发布日期早就丢）', () => {
    const out = pickFreeChatSources([
      hit('https://www.cac.gov.cn/2020/rule', '网络信息内容管理规定', body, '2020-01-01T00:00:00+08:00'),
    ], '网络信息内容管理规定有哪些要求', 10, now);
    expect(out.map(x => x.url)).toEqual(['https://www.cac.gov.cn/2020/rule']);
  });
  it('全国新闻站的要闻稿排在聚合站前面', () => {
    const out = pickFreeChatSources([
      hit('https://jinrire.example.com/a', '今日要闻汇总聚合'),
      hit('https://www.thepaper.cn/newsDetail_forward_1', '【要闻】省委书记主持召开常委会会议'),
    ], '今天国内有哪些重要新闻', 2, now);
    expect(out[0].url).toContain('thepaper.cn');
  });
});

describe('定向搜索封顶', () => {
  const read = vi.fn<typeof fetchPage>(async () => ({ ok: false as const, reason: 'http' as const, status: 403 }));
  const onStarted = vi.fn(async () => {});
  it('国内新闻问题搜两家全国新闻站，并把结果合并进来源', async () => {
    const search = vi.fn<typeof aliSearch>(async (query) => ({ ok: true as const, hits: query.startsWith('site:thepaper.cn')
      ? [hit('https://www.thepaper.cn/newsDetail_forward_9', '【要闻】国务院常务会议部署新举措', body, '2026-10-18T09:00:00+08:00')]
      : [hit('https://jinrire.example.com/a', '今日要闻汇总', body)] }));
    const result = await searchFreeChatWeb('今天国内有哪些重要新闻', { config, search, read, onStarted, now });
    const queries = search.mock.calls.map(c => c[0]);
    expect(queries.some(q => q.startsWith('site:thepaper.cn'))).toBe(true);
    expect(queries.some(q => q.startsWith('site:sohu.com'))).toBe(true);
    expect(result?.status.sources.map(s => s.url)).toContain('https://www.thepaper.cn/newsDetail_forward_9');
  });
  it('同时命中地方、热榜等多类规则时，定向搜索最多 3 次，加上通用搜索一共不超过 4 次', async () => {
    const search = vi.fn<typeof aliSearch>(async () => ({ ok: true as const, hits: [hit('https://example.com/a')] }));
    await searchFreeChatWeb('南乐今天热搜新闻', { config, search, read, onStarted, now });
    expect(search.mock.calls.length).toBeLessThanOrEqual(4);
    expect(search.mock.calls.filter(c => c[0].startsWith('site:')).length).toBe(3);
  });
  it('抖音热榜问题只发一次定向搜索，搜的是抖音站点', async () => {
    const search = vi.fn<typeof aliSearch>(async () => ({ ok: true as const, hits: [hit('https://www.douyin.com/hot/1', '抖音热榜', body, '2026-10-18T08:00:00+08:00')] }));
    await searchFreeChatWeb('抖音热榜今天有什么', { config, search, read, onStarted, now });
    const queries = search.mock.calls.map(c => c[0]);
    expect(queries.filter(q => q.startsWith('site:'))).toEqual(['site:www.douyin.com 热点榜']);
  });
  it('只点名一个平台的热榜：平台页面没有可用结果时直接说没找到，不掺全网结果', async () => {
    const search = vi.fn<typeof aliSearch>(async (query) => query.startsWith('site:')
      ? { ok: true as const, hits: [] }
      : { ok: true as const, hits: [hit('https://music.example.com/douyin', '抖音音乐', body, '2026-10-18T08:00:00+08:00')] });
    const result = await searchFreeChatWeb('抖音热榜今天', { config, search, read, onStarted, now });
    expect(result?.status.status).toBe('unavailable');
    expect(result?.status.message).toContain('抖音');
    expect(result?.status.sources).toEqual([]);
  });
  it('只点名一个平台的热榜：有平台页面时只用平台页面，全网结果不进来', async () => {
    const search = vi.fn<typeof aliSearch>(async (query) => query.startsWith('site:www.douyin.com')
      ? { ok: true as const, hits: [hit('https://www.douyin.com/hot/2646421', '周启豪1:4不敌张本智和', body, '2026-10-18T06:00:00+08:00')] }
      : { ok: true as const, hits: [hit('https://music.example.com/douyin', '抖音音乐', body, '2026-10-18T08:00:00+08:00')] });
    const result = await searchFreeChatWeb('抖音热榜今天', { config, search, read, onStarted, now });
    expect(result?.status.sources.map(s => s.url)).toEqual(['https://www.douyin.com/hot/2646421']);
  });
});

describe('地名新闻：来源里找不到地名就不收', () => {
  it('从新闻问题里取出紧贴时间词的地名；热榜、平台问题和没有地名的不取', () => {
    expect(newsPlace('郑州最近的热点新闻')).toBe('郑州');
    expect(newsPlace('郑州市今天新闻')).toBe('郑州');
    expect(newsPlace('抖音热榜今天')).toBeNull();
    expect(newsPlace('今天国内有哪些重要新闻')).toBeNull();
    expect(newsPlace('帮我查一下南乐最近的热点新闻')).toBeNull();
  });
  it('地名新闻只留提到这个地名的来源', () => {
    const out = pickFreeChatSources([
      hit('https://www.163.com/a', '耐克供应链转向近岸', body, '2026-10-18T08:00:00+08:00'),
      hit('https://www.zhengzhou.gov.cn/b', '郑州市召开新闻发布会', body, '2026-10-18T07:00:00+08:00'),
    ], '郑州最近的热点新闻', 10, now);
    expect(out.map(x => x.url)).toEqual(['https://www.zhengzhou.gov.cn/b']);
  });
});
