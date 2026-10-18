/**
 * 全国新闻的站点（2026-10-18 实测）。
 *
 * 问「今天国内有哪些重要新闻」，通用搜索回来的是财经行情页、聚合站和首页（ETF 报价、股吧复盘、金十数据首页）。
 * 实测：限定 site:thepaper.cn、site:sohu.com 再加「今日 要闻」，当天的要闻稿明显变多。
 * 新华网、人民网、中新网的索引里几乎没有当天内容，所以没有放进来。
 *
 * 只对「国内、全国、国际」这类全国范围的问题生效。地方新闻（如「郑州最近的热点新闻」）不加，全国站点搜不到它。
 */
import { hotListSearches } from './hot-list-sources';
import { localNewsSearches } from './local-news-sources';
import { isNewsQuestion } from './web-query';

export interface NationalNewsSearch {
  site: string;
  keyword: string;
}

export const NATIONAL_NEWS_SITES: NationalNewsSearch[] = [
  { site: 'thepaper.cn', keyword: '今日 要闻' },
  { site: 'sohu.com', keyword: '今日 要闻' },
];

const NATIONAL_SCOPE = /国内|全国|国家|国际|全球|中国|海外|世界/;

/** 问的是全国范围的新闻，并且不是地方新闻或热榜（它们有各自的站点）：返回要搜的站点；否则返回 null */
export function nationalNewsSearches(question: string): NationalNewsSearch[] | null {
  if (!isNewsQuestion(question) || !NATIONAL_SCOPE.test(question)) return null;
  if (localNewsSearches(question) || hotListSearches(question)) return null;
  return NATIONAL_NEWS_SITES;
}

/** 这个站点是全国新闻站点（挑选时它的新闻稿排在前面） */
export function isNationalNewsHost(host: string): boolean {
  const h = host.toLowerCase();
  return NATIONAL_NEWS_SITES.some(s => h === s.site || h.endsWith(`.${s.site}`));
}
