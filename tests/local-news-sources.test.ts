import { describe, expect, it } from 'vitest';
import { localNewsSearches, LOCAL_NEWS_SITES } from '@/lib/local-news-sources';

describe('地方新闻站点名单', () => {
  it('地方新闻问题：返回验证过的官网站点', () => {
    expect(localNewsSearches('帮我查一下南乐最近的热点新闻')?.place).toBe('南乐');
    expect(localNewsSearches('濮阳市最近的民生新闻')?.place).toBe('濮阳');
  });
  it('名单里的站点都是政府官网，不是门户或天气站', () => {
    for (const entry of LOCAL_NEWS_SITES) {
      for (const site of entry.sites) expect(site, entry.place).toMatch(/\.gov\.cn$/);
    }
  });
  it('天气、没有验证过的地区、非新闻问题都不加站点搜索', () => {
    expect(localNewsSearches('南乐今天的天气')).toBeNull();
    expect(localNewsSearches('郑州最近的热点新闻')).toBeNull();
    expect(localNewsSearches('南乐的火锅店哪家好')).toBeNull();
  });
});
