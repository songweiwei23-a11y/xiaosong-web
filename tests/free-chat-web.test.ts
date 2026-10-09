import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/search-config', () => ({ getSearchConfig: vi.fn(async () => null) }));
import { freeChatWebQuery, pickFreeChatSources, relevantWebText, searchFreeChatWeb, readOfficialDocumentation } from '@/lib/free-chat-web';
import { getSearchConfig } from '@/lib/search-config';
import type { SearchHit, aliSearch } from '@/lib/ali-search';
import type { fetchPage } from '@/lib/page-fetch';
import { extractMainText } from '@/lib/html-text';

const config = { endpoint: 'https://example.opensearch.aliyuncs.com/v3/web-search/test', apiKey: 'test-only', source: 'env' as const };
const hit = (url: string, content = '正文。'.repeat(100), published = ''): SearchHit => ({ url, title: url, content, published });

describe('自由对话搜索源头', () => {
  it('家居商家不会拿登录页和餐饮达人专属手册当成可执行的平台依据', () => {
    const out = pickFreeChatSources([
      { ...hit('https://life.douyin.com/support/content/food'), title: '生活服务团购达人成长手册-美食小白篇' },
      hit('https://life.douyin.com/p/login?ref=ad'),
      { ...hit('https://life.douyin.com/together'), title: '2023生态伙伴大会' },
      { ...hit('https://developer.open-douyin.com/docs/local-life/overview'), title: '生活服务商家应用概述' },
    ], '县城定制衣柜商家抖音本地生活获客');
    expect(out.map(x => x.url)).toEqual(['https://developer.open-douyin.com/docs/local-life/overview']);
  });
  it('页面在head、style、script中被截断时不把样式和脚本冒充正文', () => {
    for (const tag of ['head', 'style', 'script']) {
      expect(extractMainText(`<${tag}>${'.css{display:block;}'.repeat(100)}`).text).toBe('');
    }
    expect(extractMainText('<body><p>有效正文。</p><style>'+'.css{display:block;}'.repeat(100)).text).toBe('有效正文。');
  });
  it('Dify官方参数查询优先官方域名，跨产品比较不被限制到一方', () => {
    expect(freeChatWebQuery('联网核查Dify LLM Memory官方文档').query).toContain('site:docs.dify.ai');
    expect(freeChatWebQuery('Dify与n8n的Memory有何区别').query).not.toContain('site:');
  });
  it('本地商家问题保留业务约束并优先官方创作指南，官方内容高于培训广告', () => {
    const question = '抖音本地生活获客，我是县城定制衣柜店老板，一个人用手机和三脚架';
    expect(freeChatWebQuery(question).query).toContain('site:life.douyin.com');
    expect(freeChatWebQuery(question).query).toContain('县城定制衣柜');
    expect(pickFreeChatSources([hit('https://example.com/course'), hit('https://life.douyin.com/support/content/guide')], question)[0].url).toContain('life.douyin.com');
  });
  it('商家获客不把第三方宣传当成平台依据，真实补读官方经营能力而非编写固定答案', async () => {
    const read = vi.fn<typeof fetchPage>(async url => ({ ok: true, url, contentType: 'text/html', html: '<article><p>'+'官方说明短视频、直播和POI渠道，未说明推流权重。'.repeat(20)+'</p></article>' }));
    const out = await readOfficialDocumentation('抖音本地生活商家获客', read);
    expect(out[0].content).toContain('未说明推流权重');
    expect(pickFreeChatSources([hit('https://example.com/course'), ...out], '抖音本地生活商家获客')).toHaveLength(1);
  });
  it('过滤重复和带凭证URL，正文优先于门户首页，官方匹配高于转载', () => {
    const out = pickFreeChatSources([
      hit('https://blog.example.com/article'), hit('https://docs.dify.ai/en/llm'),
      hit('https://docs.dify.ai/en/llm#memory'), hit('https://news.example.com/'),
      hit('https://user:pass@evil.example.com/post'),
    ], 'Dify Memory文档');
    expect(out.map(x => x.url)).toEqual(['https://docs.dify.ai/en/llm', 'https://blog.example.com/article']);
  });
  it('时效查询不把过期或未来日期网页当成当前资料', () => {
    const now = Date.parse('2026-10-07T04:00:00Z');
    expect(pickFreeChatSources([hit('https://example.com/old', undefined, '2025-01-01'), hit('https://example.com/future', undefined, '2030-01-01')], '最近新闻', 10, now)).toEqual([]);
  });
  it('不把服务商排行榜广告当成行业方法证据', () => {
    const ad = { ...hit('https://example.com/ad'), title: '2026精选昆明短视频获客服务公司口碑推荐' };
    expect(pickFreeChatSources([ad, hit('https://example.com/guide')], '短视频获客').map(x => x.url)).toEqual(['https://example.com/guide']);
  });
  it('去掉采集工具推广和不同查询链接的同一篇内容', () => {
    const guide = { ...hit('https://example.com/guide?q=1'), title: '实际案例方法' };
    const tool = { ...hit('https://example.com/tool'), content: '批量采集评论，精准线索管理，然后一键私信，到我的主页领取软件。'.repeat(10) };
    expect(pickFreeChatSources([guide, { ...guide, url: 'https://example.com/guide?q=2' }, tool], '行业获客').map(x => x.url)).toEqual([guide.url]);
  });
  it('从官方目录选择实际LLM、变量赋值、知识检索章节，不引用目录本身或外域', async () => {
    const read = vi.fn<typeof fetchPage>(async url => ({ ok: true, url, contentType: 'text/plain', html: url.endsWith('llms.txt')
      ? '[LLM](https://docs.dify.ai/en/cloud/use-dify/nodes/llm.md)\n[Variable Assigner](https://docs.dify.ai/en/cloud/use-dify/nodes/variable-assigner.md)\n[Knowledge Retrieval](https://docs.dify.ai/en/cloud/use-dify/nodes/knowledge-retrieval.md)\n[LLM](https://evil.example.com/llm.md)'
      : '真实官方章节内容。'.repeat(60) }));
    const out = await readOfficialDocumentation('Dify LLM Memory、会话变量和知识检索官方文档', read);
    expect(out).toHaveLength(3); expect(out.every(x => x.url.startsWith('https://docs.dify.ai/'))).toBe(true);
    expect(out.some(x => x.url.endsWith('llms.txt'))).toBe(false);
  });
  it('保留长正文后半段的关键词原文并控制长度', () => {
    const text = '背景'.repeat(5000) + '\nMemory does not persist across conversations.\n' + '后文'.repeat(5000);
    const picked = relevantWebText(text, 'Dify Memory', 4000);
    expect(picked).toContain('Memory does not persist across conversations');
    expect(picked.length).toBeLessThanOrEqual(4000);
  });
  it('支持官方根目录的Cloud子索引，不读取目录为证据', async () => {
    const read = vi.fn<typeof fetchPage>(async url => ({ ok: true, url, contentType: 'text/markdown', html:
      url.endsWith('llms.txt') ? '[Cloud](https://docs.dify.ai/_llms/en/cloud.md)\n[重复](https://docs.dify.ai/_llms/en/cloud.md)'
        : url.includes('/_llms/') ? '[LLM](https://docs.dify.ai/en/cloud/use-dify/nodes/llm.md)'
          : '真实Memory章节正文。'.repeat(60) }));
    const out = await readOfficialDocumentation('Dify LLM Memory官方文档', read);
    expect(out.map(x => x.url)).toEqual(['https://docs.dify.ai/en/cloud/use-dify/nodes/llm.md']);
    expect(read).toHaveBeenCalledTimes(3);
  });
  it('一轮只调一次付费增强搜索；补读使用安全读取器，失败保留片段', async () => {
    const onStarted = vi.fn(async () => {});
    const search = vi.fn<typeof aliSearch>(async () => ({ ok: true as const, hits: [hit('https://example.com/article')] }));
    const read = vi.fn<typeof fetchPage>(async () => ({ ok: false as const, reason: 'http' as const, status: 403 }));
    const result = await searchFreeChatWeb('行业方法', { config, search, read, onStarted });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][2]).toMatchObject({ way: 'pro-fetch', rewrite: true, topK: 10 });
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(result?.status.status).toBe('done'); expect(result?.readCount).toBe(0);
    expect(result?.context).toContain('搜索返回的正文或片段');
    expect(read.mock.calls[0][1]).toMatchObject({ timeoutMs: 5000, maxBytes: 800_000 });
  });
  it('原网页补读成功才记录已读，不冒称阅读全文', async () => {
    const result = await searchFreeChatWeb('行业方法', { config, onStarted: vi.fn(async () => {}),
      search: vi.fn(async () => ({ ok: true as const, hits: [hit('https://example.com/article', '短摘要')] })),
      read: vi.fn(async () => ({ ok: true as const, url: 'https://example.com/article', contentType: 'text/html', html: `<article><p>${'这里是有依据的正文内容。'.repeat(50)}</p></article>` })),
    });
    expect(result?.readCount).toBe(1); expect(result?.context).toContain('已补读公开网页正文，以下为节选');
  });
  it('搜索故障不报告搜索成功，不再自动发第二次收费请求', async () => {
    const search = vi.fn(async () => ({ ok: false as const, reason: 'quota' as const }));
    const read = vi.fn();
    const result = await searchFreeChatWeb('行业方法', { config, search, read, onStarted: vi.fn(async () => {}) });
    expect(result?.status.status).toBe('unavailable'); expect(result?.status.sources).toEqual([]);
    expect(search).toHaveBeenCalledTimes(1); expect(read).not.toHaveBeenCalled();
  });
  it('无服务端密钥时保留Dify回退路径，未发请求不确认开始', async () => {
    vi.mocked(getSearchConfig).mockResolvedValueOnce(null);
    const onStarted = vi.fn(async () => {}), search = vi.fn();
    expect(await searchFreeChatWeb('问题', { onStarted, search })).toBeNull();
    expect(onStarted).not.toHaveBeenCalled(); expect(search).not.toHaveBeenCalled();
  });
});
