// 抖音今日热榜（2026-11-02 产品方：「至少能知道 10-20 个」；开物服务器直接读抖音网页热榜）
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DOUYIN_HOT_MISSING, douyinHotContext, douyinHotOnly, getDouyinHot, parseDouyinHot, resetDouyinHotCache, wantsDouyinHot, wantsHotTopics } from '@/lib/douyin-hot';

// 和 2026-11-02 线上实测返回的结构一致（字段名、类型），条数和话题是造的
const RAW = {
  data: {
    active_time: '2026-11-02 17:34:51',
    word_list: Array.from({ length: 50 }, (_, i) => ({
      position: i + 1,
      word: i === 0 ? '首届CMG世界机器人登泰山大赛' : `热点话题${i + 1}`,
      hot_value: 11116608 - i * 100000,
      sentence_id: String(2724740 + i),
      event_time: 1793582962,
      label: 3,
    })),
    trending_list: [{ word: '真实长征的难远超我们想象' }, { word: 'U17女足的拼搏值得所有人喝彩' }],
  },
};

describe('解析', () => {
  it('50 条：排名、话题、热度、开始时间、话题页链接；上升热点', () => {
    const l = parseDouyinHot(RAW, 1_000)!;
    expect(l.items).toHaveLength(50);
    expect(l.items[0]).toEqual({ rank: 1, word: '首届CMG世界机器人登泰山大赛', heat: 11116608, startedAt: new Date(1793582962 * 1000).toISOString(), link: 'https://www.douyin.com/hot/2724740' });
    expect(l.rising).toEqual(['真实长征的难远超我们想象', 'U17女足的拼搏值得所有人喝彩']);
    expect(l.activeTime).toBe('2026-11-02 17:34:51');
  });

  it('不像榜单（结构变了、条数太少）返回 null', () => {
    expect(parseDouyinHot({})).toBeNull();
    expect(parseDouyinHot({ data: { word_list: [{ word: 'a' }] } })).toBeNull();
    expect(parseDouyinHot('<html>验证码</html>')).toBeNull();
  });
});

describe('取榜单：全站 10 分钟缓存、同时多人问只请求一次、失败用 2 小时内的旧的', () => {
  beforeEach(() => resetDouyinHotCache());
  const ok = () => { let n = 0; const f = (async () => { n++; return new Response(JSON.stringify(RAW)); }) as unknown as typeof fetch; return { f, count: () => n }; };

  it('10 分钟内复用，过了再取', async () => {
    const { f, count } = ok();
    await getDouyinHot({ fetch: f, now: 0 });
    await getDouyinHot({ fetch: f, now: 9 * 60_000 });
    expect(count()).toBe(1);
    await getDouyinHot({ fetch: f, now: 11 * 60_000 });
    expect(count()).toBe(2);
  });

  it('同一时刻多人问：只请求抖音一次', async () => {
    const { f, count } = ok();
    await Promise.all([getDouyinHot({ fetch: f, now: 0 }), getDouyinHot({ fetch: f, now: 0 }), getDouyinHot({ fetch: f, now: 0 })]);
    expect(count()).toBe(1);
  });

  it('抖音失败：2 小时内用上一份，超过就 null', async () => {
    await getDouyinHot({ fetch: ok().f, now: 0 });
    const bad = (async () => new Response('x', { status: 403 })) as unknown as typeof fetch;
    expect((await getDouyinHot({ fetch: bad, now: 30 * 60_000 }))?.fetchedAt).toBe(0);
    expect(await getDouyinHot({ fetch: bad, now: 3 * 3600_000 })).toBeNull();
    const thrown = (async () => { throw new Error('超时'); }) as unknown as typeof fetch;
    resetDouyinHotCache();
    expect(await getDouyinHot({ fetch: thrown, now: 0 })).toBeNull();
  });
});

describe('什么时候读', () => {
  it('问抖音热点、热榜、热搜、什么火都算；不提抖音的不算', () => {
    for (const q of ['今天抖音有什么热点', '抖音热搜', '抖音热榜前20', '最近抖音上什么火', '帮我看看抖音今日热点榜']) expect(wantsDouyinHot(q), q).toBe(true);
    for (const q of ['微博热搜', '今天有什么新闻', '抖音怎么起号']) expect(wantsDouyinHot(q), q).toBe(false);
  });

  it('问「能蹭什么热点」「最近有什么热点」（没提抖音）也带上今天的抖音热榜，但照样联网', () => {
    for (const q of ['最近适合服装店蹭的热点', '有什么热点可以借势', '这几天有什么热点', '今天抖音有什么热点']) expect(wantsHotTopics(q), q).toBe(true);
    for (const q of ['餐饮店团购怎么定价', '热点新闻的写作方法是什么']) expect(wantsHotTopics(q), q).toBe(false);
    expect(douyinHotOnly('最近适合服装店蹭的热点')).toBe(false);
  });

  it('只问抖音热榜的不再全网搜；还问新闻、别的平台、某个话题来龙去脉的照样联网', () => {
    expect(douyinHotOnly('今天抖音有什么热点')).toBe(true);
    expect(douyinHotOnly('抖音热点和微博热搜对比一下')).toBe(false);
    expect(douyinHotOnly('抖音热搜第一是怎么回事')).toBe(false);
  });
});

describe('交给回答模型的那一段', () => {
  it('原样 50 条带热度、写明读到和更新时间；要求至少列前 20、照抄不编、再按行业挑能蹭的', () => {
    const l = parseDouyinHot(RAW, Date.parse('2026-11-02T09:40:00Z'))!;
    const c = douyinHotContext(l, l.fetchedAt + 60_000);
    expect(c).toContain('开物服务器 11-02 17:40（北京时间）从抖音网页版热榜读到，抖音这份榜单更新于 2026-11-02 17:34:51，共 50 条');
    expect(c).toContain('1. 首届CMG世界机器人登泰山大赛（热度 1111.7万）');
    expect(c).toContain('50. 热点话题50');
    expect(c).toContain('至少前 20 条');
    expect(c).toContain('不改不编');
    expect(c).toContain('挑出能蹭的几条');
    // 用的是缓存里旧的那份：写明是多久前的
    expect(douyinHotContext(l, l.fetchedAt + 30 * 60_000)).toContain('30 分钟前读到的上一份');
    expect(DOUYIN_HOT_MISSING).toContain('不要用搜索结果里的旧榜单冒充今天的');
  });
});

describe('接线', () => {
  const read = (f: string) => fs.readFileSync(f, 'utf8');

  it('自由对话：问抖音热点就读；只问热榜的不联网、不扣额度；用户关了联网不读；榜单放在回答规则后面', () => {
    const r = read('app/api/dify/chat/route.ts');
    // 2026-11-09 起抖音之外还读微博、百度、头条（lib/hot-boards），用户关了联网仍然不读
    expect(r).toContain("const boardIds = body.freeChat === true && body.webSearchMode !== 'off'");
    expect(r).toContain("prepareWebSearch(guard.userId!, question, hotOnly ? 'off' : body.webSearchMode)");
    expect(r).toContain('freeChatAnswerRules(webSession.enabled) + hotBlock');
  });

  it('开物助理的联网：问热榜直接给榜单，读不到照实说（和自由对话同一套 lib/hot-boards）', () => {
    const t = read('lib/assistant/tools.ts');
    expect(t).toContain('if (boardsOnly(question))');
    expect(t).toContain("{ status: 'unavailable', message: '这次没读到热榜', sources: [] }");
  });

  it('插件不读热榜（产品方：调用插件过分了）', () => {
    expect(fs.existsSync('browser-extension/kaiwu-capture/hot.js')).toBe(false);
  });
});
