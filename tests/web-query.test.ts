/**
 * 联网搜索词（2026-10-02）。线上实测：问「根据濮阳最近一周的热点新闻 帮我创作几个爆款选题」，
 * 原句照搬去搜，只回来 3 条门户首页。改成「濮阳 2026年9月 10月 热点新闻」+ 阿里云改写后，
 * 6 条里 5 条是 10 月 1 日的濮阳本地报道。
 */
import { describe, it, expect } from 'vitest';
import { buildWebQuery, isNewsQuestion } from '@/lib/web-query';
import { webQueryInputs } from '@/lib/web-search-quota';
import { pickFreeChatSources } from '@/lib/web-source-quality';
import { readCode } from './helpers/source';

const NOW = Date.parse('2026-10-02T03:45:00Z'); // 北京时间 10 月 2 日 11:45

describe('联网搜索词', () => {
  it('线上那两个真实问题：去掉任务部分，最近一周换成具体月份', () => {
    // 新闻类问题：时间用「本周」这样的词，不写年月数字（年月数字会把天气日历页排到前面，2026-10-16 实测）
    // 2026-10-17 实测：新闻类的「本周」会把天气日历页拉进来，改成不写时间词，时效交给过滤
    expect(buildWebQuery('根据濮阳最近一周的热点新闻 帮我创作几个爆款选题', NOW)).toEqual({ query: '濮阳 新闻 头条', today: '2026年10月2日', recencyDays: 10 });
    expect(buildWebQuery('联网搜索最近一周国内的新闻', NOW).query).toBe('国内的新闻');
  });

  it('句首的指令词去掉，句中的产品名「联网搜索」保留；「给出链接」这类要求不进搜索词', () => {
    expect(buildWebQuery('联网查阿里云 OpenSearch 联网搜索 Lite 当前收费，给出官方来源链接。', NOW).query).toBe('阿里云 OpenSearch 联网搜索 Lite 当前收费');
    expect(buildWebQuery('帮我查一下今年抖音餐饮团购的平台规则有什么变化', NOW).query).toBe('2026年 抖音餐饮团购的平台规则有什么变化');
  });

  it('相对时间：今天换成日期、时效窗口按说法给', () => {
    // 2026-10-17 实测：具体日期（2026年10月2日）搜不到，换成月份才有结果；时效窗口仍是 2 天
    expect(buildWebQuery('查一下今天濮阳天气', NOW)).toMatchObject({ query: '2026年10月 濮阳天气', recencyDays: 2 });
    expect(buildWebQuery('最新的抖音本地生活政策是什么？然后帮我写一条口播', NOW)).toMatchObject({ query: '2026年9月 10月 抖音本地生活政策是什么', recencyDays: 40 });
    expect(buildWebQuery('今年抖音规则', NOW).recencyDays).toBe(370);
  });

  it('不带时间的问题不加日期、不限时效；剥光了就用原话', () => {
    expect(buildWebQuery('濮阳哪家火锅店最火', NOW)).toMatchObject({ query: '濮阳哪家火锅店最火', recencyDays: 0 });
    expect(buildWebQuery('联网查一下', NOW).query).toBe('联网查一下');
  });

  it('长问题保留后半段的技术限定和比较对象，仍限制搜索请求长度', () => {
    const question = 'Dify Chatflow LLM memory conversation variables documentation ' + 'technical comparison '.repeat(4) + 'Vision high detail';
    const result = buildWebQuery(question, NOW);
    expect(result.query).toContain('Vision high detail');
    expect(result.query.length).toBeGreaterThan(100);
    expect(buildWebQuery('Dify documentation '.repeat(40), NOW).query.length).toBeLessThanOrEqual(280);
  });

  it('解释、分析后面仍可能是要查的对象，不能误删比较维度', () => {
    const result = buildWebQuery('联网核查Dify官方LLM节点Memory，解释Vision high detail和会话变量的区别', NOW);
    expect(result.query).toContain('Vision high detail');
    expect(result.query).toContain('会话变量');
  });

  it('按北京时间算日期：UTC 16 点已经是北京第二天', () => {
    expect(buildWebQuery('今天新闻', Date.parse('2026-09-30T16:30:00Z')).today).toBe('2026年10月1日');
  });

  it('交给 Dify 的三个输入项', () => {
    expect(webQueryInputs('根据濮阳最近一周的热点新闻 帮我创作几个爆款选题', NOW)).toEqual({ web_search_query: '濮阳 新闻 头条', web_search_today: '2026年10月2日', web_search_recency: '10' });
  });

  it('南乐热点新闻：搜索词不带年月数字，时效保留给后面的过滤', () => {
    const now = Date.parse('2026-10-16T04:00:00Z');
    const result = buildWebQuery('帮我查一下南乐最近的热点新闻', now);
    // 实测：「南乐 热点新闻 本周」有 5/10 条天气；2026-10-17 复测「本周」写法天气页 0–9 条不等，「南乐 新闻 头条」两次都是 0
    expect(result.query).toBe('南乐 新闻 头条');
    expect(result.query).not.toMatch(/\d{4}年|\d{1,2}月/);
    expect(result.recencyDays).toBe(40);
  });

  it('「大事、发生了什么、通知公告」也算新闻问题，不带年月数字（2026-10-17 实测：原来 10 条里 5 条天气）', () => {
    const now = Date.parse('2026-10-16T04:00:00Z');
    expect(buildWebQuery('最近南乐发生了什么大事', now).query).not.toMatch(/\d{4}年|\d{1,2}月/);
    expect(buildWebQuery('南乐县最新的通知公告', now).query).not.toMatch(/\d{4}年|\d{1,2}月/);
  });
  it('天气问题照旧带日期：天气本来就要看日子', () => {
    const now = Date.parse('2026-10-16T04:00:00Z');
    expect(buildWebQuery('南乐最近的天气怎么样', now).query).toMatch(/2026年\d{1,2}月/);
  });

  it('只有新闻、热点类问题才算新闻问题', () => {
    expect(isNewsQuestion('南乐最近的热点新闻')).toBe(true);
    expect(isNewsQuestion('濮阳头条资讯')).toBe(true);
    expect(isNewsQuestion('南乐最近的天气')).toBe(false);
    expect(isNewsQuestion('濮阳哪家火锅店最火')).toBe(false);
  });
});

describe('来源筛选：问的不是天气，就不收天气网页', () => {
  const hit = (title: string, url: string, content = '这是一段足够长的正文，用来代表搜索返回的网页内容。'.repeat(4)) => ({ title, url, content, published: '' });

  it('问热点新闻：天气网页不进来，新闻进来', () => {
    const picked = pickFreeChatSources([
      hit('南乐天气预报实时', 'https://ynweather.com/nanle/'),
      hit('南乐最近15天天气', 'https://www.ip.cn/tianqi/henan/puyang/nanle/15day.html'),
      hit('抢抓十五五“六张网”政策机遇，南乐找准县域基建新赛道', 'https://m.toutiao.com/article/1'),
    ], '帮我查一下南乐最近的热点新闻', 40);
    expect(picked.map((h) => h.title)).toEqual(['抢抓十五五“六张网”政策机遇，南乐找准县域基建新赛道']);
  });

  it('问天气，天气网页照常收', () => {
    const picked = pickFreeChatSources([hit('南乐天气预报实时', 'https://ynweather.com/nanle/')], '南乐最近的天气怎么样', 10);
    expect(picked).toHaveLength(1);
  });
});

describe('接线', () => {
  it('只有真的预占到联网额度时才带搜索词', () => {
    expect(readCode('lib/web-search-quota.ts')).toMatch(/\.\.\.\(requestId \? webQueryInputs\(question\) : \{\}\)/);
  });

  it('各创作板块传的是整段提示词，不能拿它做按需联网判断：不传就是不联网', () => {
    expect(readCode('app/api/dify/stream/route.ts')).toMatch(/prepareWebSearch\(guard\.userId!, originalQuery, body\.webSearchMode \?\? 'off'\)/);
  });

  it('自由对话每次都告诉模型今天几号（实测它把 2026 年的真实结果当成"未来日期"扔掉，再自己编旧来源）', () => {
    expect(readCode('app/api/dify/chat/route.ts')).toMatch(/【高阶自由对话】今天是\$\{todayCN\(\)\}（北京时间）/);
  });

  it('自由对话用用户原话判断和生成搜索词，不用拼好的长提示词', () => {
    expect(readCode('app/api/dify/chat/route.ts')).toMatch(/prepareWebSearch\(guard\.userId!, question, body\.webSearchMode\)/);
  });
});
