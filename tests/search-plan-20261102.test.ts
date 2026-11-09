// 联网前先读懂需求（2026-11-02 产品方：「真的读懂用户的需求去找这些有关信息」「成本要控制住，质量也要很好」）
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSearchPlanCache, generalQueriesOf, parseSearchPlan, planBrief, planSearch, searchPlanPrompt, type SearchPlan } from '@/lib/search-plan';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import { pickFreeChatSources } from '@/lib/web-source-quality';

const PLAN: SearchPlan = {
  intent: '同行案例',
  goal: '县城理发店做抖音获客的真实案例',
  queries: ['县城理发店 抖音 获客 案例', '理发店 短视频 引流 方法', '美发 团购 抖音 本地生活'],
  recencyDays: 0,
  place: '',
  entities: ['理发', '抖音'],
  needs: ['真实案例', '具体数据'],
};

describe('搜索计划：提示词和解析', () => {
  it('提示词带今天、档案、前面的对话；追问补指代、按档案补行业地区、新闻不写年月', () => {
    const p = searchPlanPrompt({ question: '那客单价呢', recent: '用户：杭州火锅店怎么做抖音', profileHint: '行业：餐饮；地区：杭州', today: '2026年11月2日' });
    expect(p.system).toContain('今天是2026年11月2日');
    expect(p.system).toContain('用前面的对话补全');
    expect(p.system).toContain('用档案里的行业和地区补上');
    expect(p.system).toContain('新闻热点类的搜索词不写年月数字');
    expect(p.user).toContain('【前面的对话】\n用户：杭州火锅店怎么做抖音');
    expect(p.user).toContain('【这一句】那客单价呢');
  });

  it('解析：只认合规的字段；搜索词去掉 site: 和引号、去重、最多 3 条；不像计划返回 null', () => {
    const plan = parseSearchPlan('好的：{"intent":"同行案例","goal":"x","queries":["site:douyin.com 理发 案例","“理发 案例”","理发 案例","a","b c","d e"],"recencyDays":"10","entities":["理发","抖音","x"],"needs":["真实案例"]}')!;
    expect(plan.queries).toEqual(['理发 案例', 'b c', 'd e']);
    expect(plan.recencyDays).toBe(10);
    expect(plan.entities).toEqual(['理发', '抖音']);
    expect(parseSearchPlan('{"intent":"乱写","queries":["理发 案例"]}')!.intent).toBe('其他');
    expect(parseSearchPlan('{"queries":[]}')).toBeNull();
    expect(parseSearchPlan('不是 JSON')).toBeNull();
    expect(parseSearchPlan('{"queries":["x y"],"recencyDays":99999}')!.recencyDays).toBe(400);
  });

  it('控成本：案例、数据、做法、价格才搜第二个角度，新闻、定义、政策只搜一个；最多 2 个', () => {
    expect(generalQueriesOf(PLAN)).toEqual(['县城理发店 抖音 获客 案例', '理发店 短视频 引流 方法']);
    expect(generalQueriesOf({ ...PLAN, intent: '新闻热点' })).toEqual(['县城理发店 抖音 获客 案例']);
    expect(generalQueriesOf({ ...PLAN, intent: '政策规定' })).toHaveLength(1);
  });

  it('给回答模型的一句：想找什么、要有什么、先结论后依据、没找到直说', () => {
    const b = planBrief(PLAN);
    expect(b).toContain('用户想找的是：县城理发店做抖音获客的真实案例（同行案例）');
    expect(b).toContain('好结果要有：真实案例、具体数据');
    expect(b).toContain('没找到');
    expect(planBrief(null)).toBe('');
  });
});

describe('planSearch：一次小模型调用；没配置、出错、读不出就退回规则；同一句复用', () => {
  beforeEach(() => clearSearchPlanCache());
  const env = { ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'main', ASSISTANT_CHEAP_MODEL: 'cheap' };
  const reply = (text: string) => (async () => ({ content: [{ type: 'text', text }], stopReason: 'end_turn' })) as never;

  it('用便宜模型、只要 500 token；结果复用 10 分钟', async () => {
    let calls = 0;
    let model = '';
    let maxTokens = 0;
    const llm = (async (cfg: { model: string }, req: { maxTokens: number }) => {
      calls++;
      model = cfg.model;
      maxTokens = req.maxTokens;
      return { content: [{ type: 'text', text: JSON.stringify(PLAN) }], stopReason: 'end_turn' };
    }) as never;
    const input = { question: '县城理发店怎么做抖音', today: '2026年11月2日' };
    expect((await planSearch(input, { llm, env, now: 0 }))?.queries[0]).toBe('县城理发店 抖音 获客 案例');
    expect(model).toBe('cheap');
    expect(maxTokens).toBe(500);
    await planSearch(input, { llm, env, now: 5 * 60_000 });
    expect(calls).toBe(1);
    await planSearch(input, { llm, env, now: 11 * 60_000 });
    expect(calls).toBe(2);
    // 单独指定的搜索计划模型优先
    clearSearchPlanCache();
    await planSearch(input, { llm, env: { ...env, SEARCH_PLAN_MODEL: 'plan' }, now: 0 });
    expect(model).toBe('plan');
  });

  it('没配置模型、模型出错、读不出 JSON：都返回 null', async () => {
    const input = { question: 'x', today: 't' };
    expect(await planSearch(input, { llm: reply(JSON.stringify(PLAN)), env: {} })).toBeNull();
    expect(await planSearch(input, { llm: (async () => { throw new Error('超时'); }) as never, env })).toBeNull();
    expect(await planSearch({ ...input, question: 'y' }, { llm: reply('我不知道'), env })).toBeNull();
  });
});

describe('接到搜索上', () => {
  const hit = (url: string, title: string, content: string) => ({ url, title, content: content.padEnd(400, '。'), published: '' });

  it('有计划：按计划的 2 个角度搜（第二个只取 6 条），总数不超过 5 次；回答资料里写明用户想找什么', async () => {
    const queries: { q: string; topK: number }[] = [];
    const search = (async (q: string, _c: unknown, o: { topK: number }) => {
      queries.push({ q, topK: o.topK });
      return { ok: true, hits: [hit(`https://a.com/${queries.length}`, `${q} 理发店抖音案例`, '县城理发店在抖音上做团购，三个月到店多了')] };
    }) as never;
    const r = (await searchFreeChatWeb('县城理发店怎么做抖音 有没有案例', { config: {} as never, search, read: (async () => ({ ok: false })) as never, onStarted: async () => {}, plan: PLAN }))!;
    const general = queries.filter((x) => !x.q.startsWith('site:'));
    expect(general.map((x) => x.q)).toEqual(['县城理发店 抖音 获客 案例', '理发店 短视频 引流 方法']);
    expect(general.map((x) => x.topK)).toEqual([10, 6]);
    expect(queries.length).toBeLessThanOrEqual(5);
    expect(r.query).toBe('县城理发店 抖音 获客 案例 ｜ 理发店 短视频 引流 方法');
    expect(r.context).toContain('用户想找的是：县城理发店做抖音获客的真实案例');
  });

  it('热榜 + 两个角度：两个通用搜索都发；总数不超过 5 次（2026-11-09 起抖音、微博、头条热榜直接读，定向只剩知乎）', async () => {
    const queries: string[] = [];
    const search = (async (q: string) => { queries.push(q); return { ok: true, hits: [] }; }) as never;
    await searchFreeChatWeb('今天的热搜有什么', { config: {} as never, search, read: (async () => ({ ok: false })) as never, onStarted: async () => {}, plan: { ...PLAN, intent: '行业数据' }, extra: [] });
    // 第一轮：2 个通用 + 知乎 1 个定向；按「今天」一条都没搜到，通用搜索放宽一档再搜一次（2 个）
    expect(queries.filter((q) => !q.startsWith('site:')).length).toBeGreaterThanOrEqual(2);
    expect(queries.filter((q) => q.startsWith('site:'))).toEqual(['site:zhihu.com 热榜']);
    expect(queries.length).toBeLessThanOrEqual(5);
  });

  it('时效：模型给的只在新闻热点时用；案例、价格这类没说时间的不限时效（老案例照样收）', async () => {
    const old = { url: 'https://a.com/old', title: '理发店抖音案例', content: '县城理发店抖音团购案例'.padEnd(400, '。'), published: '2025-03-01' };
    const search = (async () => ({ ok: true, hits: [old] })) as never;
    const base = { config: {} as never, search, read: (async () => ({ ok: false })) as never, onStarted: async () => {}, now: Date.parse('2026-11-02T10:00:00+08:00') };
    const asCase = await searchFreeChatWeb('理发店抖音案例', { ...base, plan: { ...PLAN, recencyDays: 40 } });
    expect(asCase!.status.status).toBe('done');
    // 新闻热点用模型给的时效（40 天：超过 10 天不走「短时效回退旧页面」那条规则）
    const asNews = await searchFreeChatWeb('理发店抖音案例', { ...base, plan: { ...PLAN, intent: '新闻热点', recencyDays: 40 } });
    expect(asNews!.context).not.toContain('a.com/old');
  });

  it('没有计划：和原来一样，1 次通用搜索', async () => {
    const queries: string[] = [];
    const search = (async (q: string) => { queries.push(q); return { ok: true, hits: [] }; }) as never;
    await searchFreeChatWeb('县城理发店怎么做抖音', { config: {} as never, search, read: (async () => ({ ok: false })) as never, onStarted: async () => {} });
    expect(queries.filter((q) => !q.startsWith('site:')).length).toBe(1);
  });

  it('挑结果：对得上关键对象的排前面，给了两个以上、一个都对不上的往后放', () => {
    const hits = [
      hit('https://x.com/1', '奶茶店开业活动方案', '奶茶店开业怎么做活动，第二杯半价'),
      hit('https://y.com/2', '理发店抖音团购案例', '一家县城理发店在抖音做团购，评论区留地址'),
    ];
    expect(pickFreeChatSources(hits, '有没有案例', 0, Date.now(), 6, ['理发', '抖音'])[0].url).toBe('https://y.com/2');
    // 不给关键对象时按原来的顺序
    expect(pickFreeChatSources(hits, '有没有案例')[0].url).toBe('https://x.com/1');
  });
});
