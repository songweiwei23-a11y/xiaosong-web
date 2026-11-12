// 联网搜索诊断：6 个创作者常问的问题，记下每一步——搜索计划、引擎原样返回、我们挑了哪些。
// 约 6 次小模型 + 10 次阿里云搜索，不读网页、不调 Dify。只在服务器上跑：
//   npx vitest run -c .tmp/search-diag/vitest.config.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { planSearch, generalQueriesOf } from '@/lib/search-plan';
import { aliSearch } from '@/lib/ali-search';
import { getSearchConfig } from '@/lib/search-config';
import { pickFreeChatSources, freeChatWebQuery, relevanceTerms } from '@/lib/web-source-quality';

const QS = [
  { q: '县城理发店怎么做抖音获客，有没有真实案例', hint: '行业：理发；地区：河南南乐' },
  { q: '餐饮店抖音团购套餐价格怎么定', hint: '行业：餐饮；主卖：川菜、烧烤；地区：濮阳' },
  { q: '最近适合服装店蹭的热点', hint: '行业：服装；主卖：大码女装' },
  { q: '抖音本地生活商家入驻需要什么资质和费用', hint: '' },
  { q: '美业门店短视频爆款开头怎么写，给我几个例子', hint: '行业：美容美发' },
  { q: '今年双十一抖音商家有什么活动规则', hint: '' },
];

it('诊断', async () => {
  const config = await getSearchConfig();
  if (!config) throw new Error('没有搜索配置');
  const out: unknown[] = [];
  for (const c of QS) {
    const plan = await planSearch({ question: c.q, profileHint: c.hint, today: '2026年11月2日' });
    const rule = freeChatWebQuery(c.q);
    const queries = plan ? generalQueriesOf(plan) : [rule.query];
    const raw: { q: string; ok: boolean; reason?: string; hits: { host: string; title: string; published: string; len: number; head: string; url: string }[] }[] = [];
    const all = [];
    for (const q of queries) {
      const r = await aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: false, today: rule.today, timeoutMs: 20_000 });
      if (r.ok) all.push(...r.hits);
      raw.push({
        q, ok: r.ok, reason: r.ok ? undefined : r.reason,
        hits: r.ok ? r.hits.map((h) => ({ host: (() => { try { return new URL(h.url).hostname; } catch { return '?'; } })(), title: h.title.slice(0, 50), published: h.published, len: h.content.length, head: h.content.replace(/\s+/g, ' ').slice(0, 100), url: h.url })) : [],
      });
    }
    const recency = rule.recencyDays || (plan?.intent === '新闻热点' ? plan.recencyDays : 0);
    const picked = pickFreeChatSources(all, c.q, recency, Date.now(), 6, plan ? relevanceTerms(plan.entities, queries) : []);
    out.push({ q: c.q, queries, rawCount: raw.reduce((n, r) => n + r.hits.length, 0), picked: picked.map((h) => h.title.slice(0, 40)) });
  }
  fs.writeFileSync('.tmp/search-diag/result.json', JSON.stringify(out, null, 2));
});
