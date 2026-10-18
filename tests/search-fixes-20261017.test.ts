/**
 * 2026-10-17 联网搜索修复（docs/联网搜索体检_20261017.md）：
 * 「今天」写成具体日期搜不到；明显要查实时信息的不自动搜；官方文档被时效过滤误伤。
 * 每条都用实测时出现过的问题来钉。
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({}) }));
import { buildWebQuery } from '@/lib/web-query';
import { pickFreeChatSources } from '@/lib/web-source-quality';
import { wantsWebSearch } from '@/lib/web-search-quota';
import type { SearchHit } from '@/lib/ali-search';
import { hotListSearches } from '@/lib/hot-list-sources';
import { searchFreeChatWeb } from '@/lib/free-chat-web';

const NOW = Date.parse('2026-10-17T04:00:00Z'); // 北京时间 10 月 17 日 12 点
const body = '这是一段足够长的正文，用来代表搜索返回的网页内容，包含具体的规则说明和日期信息。'.repeat(4);
const hit = (url: string, title: string, published: string): SearchHit => ({ url, title, content: body, published });

describe('搜索词：今天、昨天不写成具体日期', () => {
  it('北京今天天气：搜索词用月份，不带「10月17日」', () => {
    const w = buildWebQuery('北京今天天气怎么样', NOW);
    expect(w.query).toContain('2026年10月');
    expect(w.query).not.toMatch(/10月17日/);
    expect(w.recencyDays).toBe(2); // 时效窗口照旧
  });
  it('今天南乐有什么新闻：新闻类不写时间词（「本周」会招来天气页），时效交给过滤', () => {
    const w = buildWebQuery('今天南乐有什么新闻', NOW);
    expect(w.query).toBe('南乐 新闻 头条');
    expect(w.query).not.toMatch(/今天|本周|10月17日|有什么/);
    expect(w.recencyDays).toBe(2);
  });
});

describe('按需联网：实时事实要自动搜', () => {
  it.each(['特斯拉最近股价', '郑州地铁现在票价是多少', '知乎热榜今天有什么'])('自动搜 %s', (q) => {
    expect(wantsWebSearch(q, 'auto')).toBe(true);
  });
  it('咨询类的「今年做账号怎么安排」不算要查资料，不扣额度', () => {
    expect(wantsWebSearch('今年做账号的节奏怎么安排', 'auto')).toBe(false);
  });
});

describe('热榜、热搜：按平台官网搜（2026-10-17 实测：全网搜回来的是聚合站）', () => {
  it('问哪个平台就只搜哪个', () => {
    expect(hotListSearches('知乎热榜今天有什么')?.map((h) => h.site)).toEqual(['zhihu.com']);
    expect(hotListSearches('微博热搜今天有什么')?.map((h) => h.site)).toEqual(['s.weibo.com']);
  });
  it('没说平台就四家都搜（2026-10-18 起含抖音）', () => {
    expect(hotListSearches('今天有什么热搜')?.map((h) => h.site)).toEqual(['zhihu.com', 's.weibo.com', 'toutiao.com', 'www.douyin.com']);
  });
  it('微博用户主页不当成热搜来源（实测：「热搜」搜出来的几乎都是 /user/ 主页）', () => {
    const kept = pickFreeChatSources(
      [{ url: 'https://s.weibo.com/user/123456', title: '微博热搜', content: '这是一段足够长的正文，用来代表微博用户主页的内容。'.repeat(6), published: '2026-08-19' }],
      '今天有什么微博热搜',
      2,
      Date.parse('2026-10-17T04:00:00Z'),
    );
    expect(kept).toEqual([]);
  });
  it('不是热榜问题不搜', () => {
    expect(hotListSearches('特斯拉最近股价')).toBeNull();
  });
  it('整条链路真的发出 site: 搜索，平台页进入来源', async () => {
    const config = { endpoint: 'https://example.opensearch.aliyuncs.com/v3/web-search/test', apiKey: 'test-only', source: 'env' as const };
    const long = '知乎热榜今日话题及热度排行，这是一段足够长的正文用来代表平台页面的内容。'.repeat(6);
    const search = vi.fn(async (query: string) => ({
      ok: true as const,
      hits: query.startsWith('site:zhihu.com') ? [{ url: 'https://www.zhihu.com/hot', title: '知乎热榜', content: long, published: '2026-10-17' }] : [],
    }));
    const result = await searchFreeChatWeb('知乎热榜今天有什么', {
      config, search, read: vi.fn(async () => ({ ok: false as const, reason: 'http' as const, status: 403 })),
      onStarted: vi.fn(async () => {}), now: Date.parse('2026-10-17T04:00:00Z'),
    });
    expect(search.mock.calls.some((c) => String(c[0]).startsWith('site:zhihu.com'))).toBe(true);
    expect(result?.status.sources.map((s) => s.url)).toContain('https://www.zhihu.com/hot');
  });
});

describe('来源过滤：官方文档不按发布时间丢', () => {
  it('抖音平台规则页（发布于很久以前）在「最近」的问题里保留', () => {
    const kept = pickFreeChatSources(
      [hit('https://life.douyin.com/support/content/rules', '抖音来客商家经营规则', '2025-01-01')],
      '最近抖音本地生活有什么新规则',
      40,
      NOW,
    );
    expect(kept.map((h) => h.url)).toContain('https://life.douyin.com/support/content/rules');
  });
  it('今天的天气：新鲜来源不足时，回退给最近的几条旧页面（日期照实保留，由模型标明）', () => {
    const kept = pickFreeChatSources(
      [
        hit('https://a.example.com/w1', '北京2026年10月天气预报', '2026-10-04'),
        hit('https://b.example.com/w2', '北京天气预报资讯', '2026-10-13'),
        hit('https://c.example.com/w3', '北京天气预报30天', '2026-10-11'),
      ],
      '北京今天天气怎么样',
      2,
      NOW,
    );
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((h) => h.published)).toBe(true);
  });
  it('普通新闻网站的旧页面仍然按时效丢掉（没有放宽）', () => {
    const kept = pickFreeChatSources(
      [hit('https://news.example.com/a', '旧闻', '2025-01-01')],
      '最近有什么新闻',
      10,
      NOW,
    );
    expect(kept).toEqual([]);
  });
});
