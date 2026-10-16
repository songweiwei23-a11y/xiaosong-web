/**
 * 地方新闻的可信站点（2026-10-17）。
 *
 * 通用搜索查地方新闻，常常先回来天气页、门户首页和无关地区的内容。
 * 实测（南乐、濮阳）：阿里云支持 site: 限定站点；对同一个地名，加上地方官网的结果明显多出本地新闻。
 * 名单只收已经验证过的官方站点。没验证过的地区不加，宁可少搜，也不乱搜。
 */
import { isNewsQuestion } from './web-query';

export interface LocalNewsSites {
  place: string;
  sites: string[];
}

export const LOCAL_NEWS_SITES: LocalNewsSites[] = [
  { place: '南乐', sites: ['www.nanle.gov.cn', 'www.puyang.gov.cn'] },
  { place: '濮阳', sites: ['www.puyang.gov.cn', 'www.nanle.gov.cn'] },
];

/** 问的是地方新闻，并且地名在名单里：返回要额外去搜的站点；否则返回 null（只做普通搜索） */
export function localNewsSearches(question: string): LocalNewsSites | null {
  if (!isNewsQuestion(question)) return null;
  return LOCAL_NEWS_SITES.find(x => question.includes(x.place)) ?? null;
}
