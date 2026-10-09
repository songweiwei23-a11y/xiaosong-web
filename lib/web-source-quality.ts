/** 共享检索质量逻辑：匹配来源、去重、官方文档发现和问题相关原文节选。 */
import type { SearchHit } from './ali-search';
import { fetchPage } from './page-fetch';
import { extractMainText } from './html-text';
import { buildWebQuery } from './web-query';

const HUB = /^\/?(?:index\.(?:s?html?|php|aspx?))?\/?$|\/(?:channel|column|list|lanmu|news|index)\/?$/i;
const DOUYIN_OFFICIAL = ['life.douyin.com', 'school.douyin.com', 'developer.open-douyin.com', 'open.douyin.com'];
const needsDouyinGuide = (question: string) => /抖音/.test(question) && /本地生活|获客|商家/.test(question);

export function freeChatWebQuery(question: string, now = Date.now()) {
  const w = buildWebQuery(question, now);
  // 明确的Dify产品技术问题优先检索其官方文档；跨产品比较仍保留开放检索。
  const difyOnly = /dify/i.test(question) && /官方|文档|LLM|memory|vision|参数|会话变量/i.test(question)
    && !/n8n|coze|扣子|langchain|flowise/i.test(question);
  const douyinGuide = needsDouyinGuide(question);
  return { ...w, query: difyOnly && !/site:/i.test(w.query) ? `site:docs.dify.ai ${w.query}`
    : douyinGuide && !/site:/i.test(w.query) ? `site:life.douyin.com 抖音生活服务 创作指南 ${w.query}` : w.query };
}

export function pickFreeChatSources(hits: SearchHit[], question: string, recencyDays = 0, now = Date.now(), maxSources = 6): SearchHit[] {
  const seen = new Set<string>();
  const seenContent = new Set<string>();
  const ranked: { hit: SearchHit; score: number; host: string; index: number; hub: boolean }[] = [];
  hits.forEach((hit, index) => {
    let u: URL; try { u = new URL(hit.url); } catch { return; }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return;
    // 平台经营操作及获客机制只收对应平台文档；广告课程经验不能证明推流/权限/处罚。
    if (needsDouyinGuide(question) && !DOUYIN_OFFICIAL.includes(u.hostname.toLowerCase())) return;
    // 登录入口及餐饮达人手册不能证明家居商家的推荐机制。
    if (/\/(?:p\/)?login(?:\/|$)/i.test(u.pathname)) return;
    const nonFoodMerchant = /衣柜|定制家居|家装|建材|装修|家具/.test(question);
    if (nonFoodMerchant && /美食|餐饮|探店达人/.test(hit.title) && !/家居|家装|建材/.test(hit.title)) return;
    if (needsDouyinGuide(question) && !/大会|生态伙伴|平台介绍/.test(question)
      && (/大会|生态伙伴大会/.test(hit.title) || /^\/(?:together|p\/home)\/?$/.test(u.pathname))) return;
    if (/口碑推荐|(?:精选|十大|排名).{0,12}(?:公司|服务商)|(?:公司|服务商).{0,8}(?:排行榜|推荐|哪家好)/.test(hit.title)) return;
    // 导流采集软件的推广演示不是内容创作依据，不让“截流工具”污染商家方案。
    if (/批量采集|采集.*(?:线索|评论)|一键私信|精准线索管理/.test(hit.content)
      && /主页.{0,12}领取|对这款软件|一键私信|精准线索管理/.test(hit.content)) return;
    u.hash = '';
    if (seen.has(u.href)) return; seen.add(u.href);
    const fingerprint = `${hit.title.replace(/\s/g, '')}:${hit.content.replace(/<[^>]*>|\s/g, '').slice(0, 240)}`;
    if (hit.content.length >= 150 && seenContent.has(fingerprint)) return;
    seenContent.add(fingerprint);
    const host = u.hostname.toLowerCase(), hub = HUB.test(u.pathname);
    const timestamp = Date.parse(hit.published), age = (now - timestamp) / 86400000;
    if (Number.isFinite(timestamp) && age < -2) return;
    if (recencyDays && Number.isFinite(timestamp) && age > recencyDays * 1.5 + 3) return;
    let score = Math.min(hit.content.length / 1500, 4) - (hub ? 6 : 0);
    if (/dify/i.test(question) && host === 'docs.dify.ai') score += 6;
    if (/dify/i.test(question) && host === 'docs.dify.ai' && /\/nodes\//.test(u.pathname)) score += 4;
    if (/阿里云|aliyun/i.test(question) && host === 'help.aliyun.com') score += 6;
    if (/抖音/.test(question) && ['life.douyin.com', 'school.douyin.com', 'developer.open-douyin.com', 'open.douyin.com'].includes(host)) score += 6;
    if (/政策|规定|法规|公告/.test(question) && /(^|\.)gov\.cn$/.test(host)) score += 4;
    if (hit.content.length < 150) score -= 3;
    const terms = question.match(/[a-z][a-z0-9_-]{2,}/gi) || [];
    const text = `${hit.title} ${hit.content.slice(0, 1500)}`.toLowerCase();
    score += Math.min(3, new Set(terms.filter(term => text.includes(term.toLowerCase()))).size);
    ranked.push({ hit: { ...hit, url: u.href }, score, host, index, hub });
  });
  const substantive = ranked.filter(x => !x.hub && x.hit.content.trim().length >= 150);
  const candidates = substantive.length ? substantive : ranked;
  const perSite = new Map<string, number>();
  return candidates.sort((a, b) => b.score - a.score || a.index - b.index).filter(x => {
    const n = perSite.get(x.host) || 0;
    if (n >= 3) return false; perSite.set(x.host, n + 1); return true;
  }).slice(0, maxSources).map(x => x.hit);
}

/** 从官方公开文档目录发现实际章节URL，再读取；目录本身不当成结论证据。 */
export async function readOfficialDocumentation(question: string, read: typeof fetchPage): Promise<SearchHit[]> {
  if (needsDouyinGuide(question)) {
    // 官方经营能力概述仅用来核对渠道；不将它扩写成算法或行业效果证明。
    try {
      const page = await read('https://developer.open-douyin.com/docs/resource/zh-CN/local-life/introduction/overview', { timeoutMs: 5000, maxBytes: 2_000_000 });
      if (!page.ok) return [];
      const body = extractMainText(page.html, 8000);
      return body.text.length >= 200 ? [{ url: page.url, title: '抖音官方：生活服务商家应用概述', content: body.text, published: body.published }] : [];
    } catch { return []; }
  }
  if (!/dify/i.test(question) || !/官方|文档|LLM|memory|vision|参数|会话|知识检索/i.test(question)) return [];
  try {
    const index = await read('https://docs.dify.ai/llms.txt', { timeoutMs: 4000, maxBytes: 300_000 });
    if (!index.ok) return [];
    const parseLinks = (text: string) => [...text.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)]
      .map(m => ({ title: m[1], url: m[2] })).filter(link => {
        try { const u = new URL(link.url); return u.hostname === 'docs.dify.ai' && !u.username && !u.password; }
        catch { return false; }
      });
    const links = parseLinks(index.html);
    // 官方根目录会指向语言/Cloud子目录。只沿公开英文Cloud目录读取，最多两层，避免全站抓取。
    const visited = new Set<string>();
    for (let depth = 0; depth < 2; depth++) {
      const next = links.find(link => /\/_llms\/en\/cloud(?:\.md|\/use-dify\.md)$/.test(new URL(link.url).pathname)
        && !visited.has(link.url));
      if (!next) break;
      visited.add(next.url);
      const nested = await read(next.url, { timeoutMs: 4000, maxBytes: 300_000 });
      if (nested.ok) links.push(...parseLinks(nested.html));
    }
    const ranked = links.map(link => {
      let u: URL; try { u = new URL(link.url); } catch { return null; }
      if (u.hostname !== 'docs.dify.ai' || u.username || u.password) return null;
      const text = `${link.title} ${u.pathname}`;
      let score = 0;
      if (/LLM|memory|vision|记忆|视觉/i.test(question) && /\/llm(?:[./]|$)|语言模型/i.test(text)) score += 10;
      if (/会话变量|conversation.?variables/i.test(question) && /variable.?assign|conversation.?variables|变量赋值/i.test(text)) score += 8;
      if (/知识检索|knowledge.?retrieval/i.test(question) && /knowledge.?retrieval|知识检索/i.test(text)) score += 8;
      if (/文件|附件|上传|file/i.test(question) && /document.?extract|文档提取/i.test(text)) score += 5;
      if (/\/en\//.test(u.pathname)) score += 0.2;
      return score >= 5 ? { ...link, score } : null;
    }).filter((x): x is { title: string; url: string; score: number } => !!x).sort((a, b) => b.score - a.score);
    const selected = ranked.filter((link, i, all) => all.findIndex(x => x.url === link.url) === i).slice(0, 3);
    return (await Promise.all(selected.map(async link => {
      const page = await read(link.url, { timeoutMs: 5000, maxBytes: 800_000 });
      if (!page.ok) return null;
      const body = /text\/plain|text\/markdown/.test(page.contentType)
        ? { text: page.html.trim(), published: '' }
        : extractMainText(page.html, 16_000);
      if (body.text.length < 200) return null;
      return { url: page.url, title: link.title, content: body.text.slice(0, 16_000), published: body.published };
    }))).filter((x): x is SearchHit => !!x);
  } catch { return []; }
}

/** 长正文保留开头和问题关键词附近的原文，不把导航或整页重复塞进模型。 */
export function relevantWebText(text: string, question: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text;
  const terms = [...new Set([...(question.match(/[a-z][a-z0-9_-]{2,}/gi) || []),
    ...(question.match(/会话变量|会话|记忆|持久化|知识检索|文件上传|收费|价格|政策|本地生活|获客|流量|短视频/g) || [])])];
  const ranges: [number, number][] = [[0, Math.min(1600, maxChars)]];
  const lower = text.toLowerCase();
  for (const term of terms.slice(0, 16)) {
    const pos = lower.indexOf(term.toLowerCase());
    if (pos >= 0) ranges.push([Math.max(0, pos - 350), Math.min(text.length, pos + 1600)]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged.map(([a, b]) => text.slice(a, b)).join('\n[…原文节选…]\n').slice(0, maxChars);
}

