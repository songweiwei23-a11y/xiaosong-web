/**
 * 按问题类型决定补查哪些官方站点（同一个阿里云接口，只是多发几条带 site: 的查询）。
 * 取样发现：政策、平台规则这类问题，前 10 条里几乎见不到官方页面，全是转载和导流页。
 * 这里只列确定存在、问题明确指向的官方站点；不确定的域名不放进来。
 */

export interface OfficialSiteQuery {
  site: string;
  query: string;
}

/** 站点 → 对应的问题 */
const RULES: { site: string; when: RegExp; not?: RegExp }[] = [
  // 网信办：短视频、AI 内容、标识、网络信息内容相关的规定
  { site: 'cac.gov.cn', when: /新规|规定|办法|标识|标注|网信|网络信息|AIGC|生成式|监管|备案/ },
  // 抖音生活服务（本地生活、团购、商家入驻、佣金、来客）
  { site: 'life.douyin.com', when: /抖音/, not: /热榜|热搜|热点/ },
  { site: 'life.douyin.com', when: /本地生活|团购|入驻|佣金|来客|抽成|商家/ },
  // Dify 官方文档
  { site: 'docs.dify.ai', when: /dify/i },
  // 阿里云帮助中心
  { site: 'help.aliyun.com', when: /阿里云|aliyun/i },
];

/** 问题里的官方站点查询，最多 2 条，避免一次问题发出太多请求 */
export function officialSiteQueries(question: string): OfficialSiteQuery[] {
  const core = question.replace(/\s+/g, ' ').trim().slice(0, 40);
  const picked: OfficialSiteQuery[] = [];
  const used = new Set<string>();
  for (const rule of RULES) {
    if (used.has(rule.site)) continue;
    if (!rule.when.test(question)) continue;
    if (rule.not?.test(question)) continue;
    used.add(rule.site);
    picked.push({ site: rule.site, query: `site:${rule.site} ${core}` });
    if (picked.length >= 2) break;
  }
  return picked;
}

/** 这个站点是不是官方来源（挑选时官方站点可以多留几条） */
export const OFFICIAL_HOSTS = ['cac.gov.cn', 'life.douyin.com', 'school.douyin.com', 'open.douyin.com', 'developer.open-douyin.com', 'docs.dify.ai', 'help.aliyun.com'];

export function isOfficialHost(host: string): boolean {
  const h = host.toLowerCase();
  return OFFICIAL_HOSTS.includes(h) || /(^|\.)gov\.cn$/.test(h);
}
