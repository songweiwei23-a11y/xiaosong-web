/**
 * 热榜、热搜类问题：按平台官网搜（site:），不用全网搜。
 *
 * 2026-10-17 实测：「知乎热榜 今天」全网搜回来的全是聚合站（rsd.cqmono.com、jinrire-bang.com.cn……）；
 * 加上 site:zhihu.com 之后才是知乎自己的页面，「微博热搜」加 site:s.weibo.com 也是微博热搜本身。
 * 问的是哪个平台就只搜那个；没说平台就三家都搜，结果合并（和地方新闻的做法一样，额度仍只记一次）。
 */

export interface HotListSearch {
  /** 给人看的名字 */
  label: string;
  /** 站点（site: 后面的域名） */
  site: string;
  /** 拼在 site: 后面的搜索词 */
  keyword: string;
}

const PLATFORMS: { words: RegExp; label: string; site: string; keyword: string; onlyWhenNamed?: boolean }[] = [
  { words: /知乎/, label: '知乎', site: 'zhihu.com', keyword: '热榜' },
  { words: /微博/, label: '微博', site: 's.weibo.com', keyword: '热搜' },
  { words: /头条/, label: '今日头条', site: 'toutiao.com', keyword: '热榜' },
  // 抖音只在明确提到时才搜（不进默认的三家）。2026-10-18 实测：site:www.douyin.com 热点榜 回来的是抖音自己的 /hot/ 话题页；
  // 之前「抖音热榜」因为没有这一项，落到了默认的三家，结果全是知乎、头条。
  { words: /抖音/, label: '抖音', site: 'www.douyin.com', keyword: '热点榜', onlyWhenNamed: true },
];

/** 问的是热榜、热搜、热门话题吗 */
const HOT_LIST = /热榜|热搜|热门话题|热门榜|榜单|爆了|上热搜/;

/** 问的不是热榜类，或者不是要查当下的，返回 null */
export function hotListSearches(question: string): HotListSearch[] | null {
  if (!HOT_LIST.test(question)) return null;
  const named = PLATFORMS.filter((p) => p.words.test(question));
  const chosen = named.length ? named : PLATFORMS.filter((p) => !p.onlyWhenNamed);
  return chosen.map(({ label, site, keyword }) => ({ label, site, keyword }));
}
