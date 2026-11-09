import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/search-config', () => ({ getSearchConfig: vi.fn(async () => null) }));
import { hotListSearches } from '@/lib/hot-list-sources';
import { isNationalNewsHost, nationalNewsSearches } from '@/lib/national-news-sources';
import { isMarketHit, newsPlace } from '@/lib/search-quality';
import { pickFreeChatSources } from '@/lib/web-source-quality';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import type { SearchHit, aliSearch } from '@/lib/ali-search';
import type { fetchPage } from '@/lib/page-fetch';
import { readCode } from './helpers/source';

const config = { endpoint: 'https://example.opensearch.aliyuncs.com/v3/web-search/test', apiKey: 'test-only', source: 'env' as const };
const body = '这是有依据的正文内容。'.repeat(30);
const hit = (url: string, title = url, content = body, published = ''): SearchHit => ({ url, title, content, published });
const now = Date.parse('2026-10-18T04:00:00Z');

describe('抖音热榜只搜抖音自己的站点', () => {
  it('提到抖音热榜时不掺知乎和头条；抖音热榜直接读（lib/douyin-hot），不再 site: 搜（2026-11-09）', () => {
    expect(hotListSearches('抖音热榜今天')).toEqual([]);
    expect(hotListSearches('抖音热搜有什么')).toEqual([]);
  });
  it('没有提到平台的热搜问题：只剩知乎走搜索', () => {
    expect(hotListSearches('今天有什么热搜')?.map(h => h.site)).toEqual(['zhihu.com']);
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
  it('同时命中地方、热榜等多类规则时，定向搜索最多 4 次，加上通用搜索一共不超过 5 次', async () => {
    const search = vi.fn<typeof aliSearch>(async () => ({ ok: true as const, hits: [hit('https://example.com/a')] }));
    await searchFreeChatWeb('南乐今天热搜新闻', { config, search, read, onStarted, now });
    expect(search.mock.calls.length).toBeLessThanOrEqual(5);
    // 2026-11-09 起抖音、微博、头条热榜直接读（lib/hot-boards），热榜那一路只剩知乎：地方官网 + 知乎
    expect(search.mock.calls.filter(c => c[0].startsWith('site:')).length).toBeLessThanOrEqual(4);
  });
  it('抖音热榜问题不再 site: 搜抖音站点（榜单由开物服务器直接读，见 lib/douyin-hot、lib/hot-boards）', async () => {
    const search = vi.fn<typeof aliSearch>(async () => ({ ok: true as const, hits: [hit('https://www.douyin.com/hot/1', '抖音热榜', body, '2026-10-18T08:00:00+08:00')] }));
    await searchFreeChatWeb('抖音热榜今天有什么', { config, search, read, onStarted, now });
    const queries = search.mock.calls.map(c => c[0]);
    expect(queries.filter(q => q.startsWith('site:www.douyin.com'))).toEqual([]);
  });
  it('只问抖音热榜的，路由里直接用榜单、不联网搜索（boardsOnly）；问来龙去脉的照常搜', () => {
    const route = readCode('app/api/dify/chat/route.ts');
    expect(route).toMatch(/const hotOnly = boards\.some\(Boolean\) && boardsOnly\(question\)/);
    expect(route).toMatch(/prepareWebSearch\(guard\.userId!, question, hotOnly \? 'off' : body\.webSearchMode\)/);
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
