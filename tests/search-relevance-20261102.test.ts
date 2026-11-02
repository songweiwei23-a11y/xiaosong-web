// 联网搜索「为什么没找到用户要的」（2026-11-02 线上诊断，6 个创作者常问的问题）：
// 引擎其实搜到了相关内容，是我们挑结果时丢了——这里用诊断里的真实标题做回归。
import { describe, expect, it } from 'vitest';
import { freeChatWebQuery, pickFreeChatSources, relevanceTerms } from '@/lib/web-source-quality';
import { isMarketHit, isRiskHit } from '@/lib/search-quality';

const hit = (url: string, title: string, content = '') => ({ url, title, content: (content || title).padEnd(600, '。'), published: '' });

describe('不再只收抖音官方文档', () => {
  it('「县城理发店怎么做抖音获客」：通用搜索不换成官方站，第三方的案例和做法留下', () => {
    const q = '县城理发店怎么做抖音获客，有没有真实案例';
    expect(freeChatWebQuery(q).query).not.toMatch(/site:/);
    const focus = relevanceTerms(['理发店', '抖音', '获客', '案例', '县城'], ['县城理发店 抖音获客 案例', '小县城理发店 抖音运营 方法']);
    const picked = pickFreeChatSources([
      hit('https://view.inews.qq.com/a', '在兴趣岛学会拍短视频之后，这位县城理发师转身成为“公益人”', '县城理发师 抖音 短视频 到店'),
      hit('https://tv.sohu.com/v/1', '美发店做抖音一个月就起飞的方法 微微烫 美发 同城流量 同城获客', '理发店 抖音 同城获客'),
      hit('https://www.sohu.com/a/2', '县城Tony的快乐你不懂，进军私域，月入十几万', '县城 理发店 私域'),
    ], q, 0, Date.now(), 6, focus);
    expect(picked.length).toBe(3);
  });

  it('「抖音本地生活商家入驻资质和费用」「双十一抖音商家活动规则」：第三方说明也留下', () => {
    const q = '抖音本地生活商家入驻需要什么资质和费用';
    const focus = relevanceTerms(['抖音', '本地生活', '入驻资质', '费用', '营业执照'], ['抖音本地生活商家入驻资质费用']);
    const picked = pickFreeChatSources([
      hit('https://zhidao.baidu.com/q/1', '怎么加入抖音本地生活服务', '抖音 本地生活 入驻 营业执照'),
      hit('https://m.douyin.com/share/note/7', '抖音本地生活服务商入驻条件及费用', '入驻 费用 资质'),
    ], q, 0, Date.now(), 6, focus);
    expect(picked.length).toBe(2);
  });
});

describe('相关性排第一，灌水和行情页不要', () => {
  it('团购定价：「团购价怎么定才不亏」排在「双人套餐起名大全」「开户联系方式」前面，后两个直接不要', () => {
    const q = '餐饮店抖音团购套餐价格怎么定';
    const focus = relevanceTerms(['抖音团购', '定价', '套餐', '餐饮'], ['餐饮抖音团购定价策略', '抖音团购套餐价格设置方法']);
    const picked = pickFreeChatSources([
      hit('https://3zuf.ohblr.cn/post/1', '抖音双人套餐起名大全（抖音道具双人）', '套餐 起名 抖音'.repeat(40)),
      hit('https://73406505.b2b.11467.com/m/2', '2026年抖音团购开户、抖音团购联系方式？', '抖音团购 开户 联系方式'),
      hit('https://www.lanvge.com/1362/', '抖音团购的团购价怎么定才不亏？', '抖音团购 定价 保本价 引流价'),
      hit('https://zhuanlan.zhihu.com/p/675332806', '餐饮老板做抖音，爆款团购套餐如何设置', '餐饮 抖音团购 套餐 定价'),
    ], q, 0, Date.now(), 6, focus);
    const urls = picked.map((x) => x.url);
    expect(urls.slice(0, 2).sort()).toEqual(['https://www.lanvge.com/1362/', 'https://zhuanlan.zhihu.com/p/675332806']);
    expect(urls).not.toContain('https://3zuf.ohblr.cn/post/1');
    expect(urls).not.toContain('https://73406505.b2b.11467.com/m/2');
  });

  it('问价格、费用不再放行导流页；真问代运营、开户的才放行', () => {
    const ad = { title: '2026年抖音团购开户、抖音团购联系方式？', content: '' };
    expect(isRiskHit(ad, '团购套餐价格怎么定')).toBe(true);
    expect(isRiskHit(ad, '入驻要多少费用')).toBe(true);
    expect(isRiskHit(ad, '抖音团购怎么开户')).toBe(false);
  });

  it('个股行情页：不是问财经的一律不要', () => {
    expect(isMarketHit({ title: '森马服饰', url: 'https://data.eastmoney.com/stockdata/002563.html' }, '最近适合服装店蹭的热点')).toBe(true);
    expect(isMarketHit({ title: 'e公司', url: 'https://www.egsea.com/quotation/stock-info/sz002832.html' }, '服装行业营销')).toBe(true);
    expect(isMarketHit({ title: '森马服饰', url: 'https://data.eastmoney.com/stockdata/002563.html' }, '森马服饰股价')).toBe(false);
  });

  it('一个关键词都对不上的不要（官方文档除外）', () => {
    const focus = relevanceTerms(['美容美发', '短视频', '开头'], ['美业抖音视频开头文案']);
    const picked = pickFreeChatSources([
      hit('https://www.bilibili.com/video/x', '39asdfasdfquiweruqweuifu', 'asdfasdf'),
      hit('https://m.meipian.cn/5peg9pj6', '发百条视频没客源｜美业短视频开头该怎么写', '美业 短视频 开头'),
    ], '美业门店短视频爆款开头怎么写', 0, Date.now(), 6, focus);
    expect(picked.map((x) => x.url)).toEqual(['https://m.meipian.cn/5peg9pj6']);
  });

  it('相关性词：去掉「怎么、方法、案例、年份」这类不区分内容的词', () => {
    expect(relevanceTerms(['理发店'], ['理发店 抖音 案例 2026年 方法'])).toEqual(['理发店', '抖音']);
  });
});
