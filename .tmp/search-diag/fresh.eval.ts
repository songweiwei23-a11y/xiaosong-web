// 联网实时性实测（2026-11-09）：6 个要实时信息的问题，看阿里云搜索原样返回的结果有多新、正文多长、网页读不读得到，
// 以及我们最后挑了哪些。约 12 次阿里云搜索 + 6 次小模型 + 最多 30 次网页读取，不调 Dify。只在服务器跑：
//   npx vitest run -c .tmp/search-diag/vitest.config.ts fresh
import fs from 'node:fs';
import { it } from 'vitest';
import { planSearch, generalQueriesOf } from '@/lib/search-plan';
import { aliSearch } from '@/lib/ali-search';
import { getSearchConfig } from '@/lib/search-config';
import { pickFreeChatSources, freeChatWebQuery, relevanceTerms } from '@/lib/web-source-quality';
import { fetchPage } from '@/lib/page-fetch';
import { extractMainText } from '@/lib/html-text';

const QS = [
  { q: '今天有什么热点新闻', hint: '' },
  { q: '这两天抖音上什么火', hint: '行业：餐饮' },
  { q: '濮阳最近一周有什么新闻', hint: '地区：河南濮阳' },
  { q: '今年双十一抖音商家活动规则', hint: '' },
  { q: '最近餐饮行业有什么新政策', hint: '行业：餐饮' },
  { q: '这周大码女装有什么流行趋势', hint: '行业：大码女装' },
];

it('fresh', async () => {
  const config = await getSearchConfig();
  if (!config) throw new Error('没有搜索配置');
  const now = Date.now();
  const out: unknown[] = [];
  for (const c of QS) {
    const plan = await planSearch({ question: c.q, profileHint: c.hint, today: '2026年11月9日' });
    const rule = freeChatWebQuery(c.q);
    const queries = plan ? generalQueriesOf(plan) : [rule.query];
    const all = [];
    const raw = [];
    for (const q of queries) {
      const t0 = Date.now();
      const r = await aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: false, today: rule.today, timeoutMs: 20_000 });
      if (r.ok) all.push(...r.hits);
      raw.push({ q, ok: r.ok, ms: Date.now() - t0, hits: r.ok ? r.hits.map((h) => {
        const t = Date.parse(h.published);
        return { host: (() => { try { return new URL(h.url).hostname; } catch { return '?'; } })(), title: h.title.slice(0, 40), published: h.published, ageDays: Number.isFinite(t) ? Math.round((now - t) / 86400000) : null, len: h.content.length };
      }) : [] });
    }
    const recency = rule.recencyDays || (plan?.intent === '新闻热点' ? plan.recencyDays : 0);
    const picked = pickFreeChatSources(all, c.q, recency, now, 6, plan ? relevanceTerms(plan.entities, queries) : []);
    const reads = [];
    for (const h of picked.slice(0, 5)) {
      const t0 = Date.now();
      try {
        const p = await fetchPage(h.url, { timeoutMs: 5000, maxBytes: 800_000 });
        reads.push({ host: new URL(h.url).hostname, ok: p.ok, ms: Date.now() - t0, chars: p.ok ? extractMainText(p.html, 16_000).text.length : 0 });
      } catch { reads.push({ host: h.url.slice(0, 40), ok: false, ms: Date.now() - t0, chars: 0 }); }
    }
    out.push({ q: c.q, plan: plan ? { intent: plan.intent, queries, recency: plan.recencyDays } : null, recencyUsed: recency, raw, picked: picked.map((h) => ({ title: h.title.slice(0, 40), published: h.published })), reads });
  }
  fs.writeFileSync('.tmp/search-diag/fresh.json', JSON.stringify(out, null, 2));
});
