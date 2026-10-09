import { describe, expect, it } from 'vitest';
import { assembleReport, checkCitations, parsePlan, pickCandidates, readPlan, buildNotePrompt } from '@/lib/research';
import { checkUrl, decodeHtml, isPrivateAddress } from '@/lib/page-fetch';
import { extractMainText } from '@/lib/html-text';
import { parseSearchResponse } from '@/lib/ali-search';
import { openSearchKey, sealSearchKey, validEndpoint } from '@/lib/search-config';

describe('研究计划与来源核对', () => {
  it('分节节选保留正文后面的任务关键词，避免只截导航和背景', () => {
    const prompt = buildNotePrompt({topic:'Dify记忆',title:'参数研究',question:'Memory 是否跨会话保存',index:0,total:1,depth:'deep',context:'',rows:[{
      n:1,step:0,url:'https://docs.dify.ai/en/llm.md',title:'LLM',site:'docs.dify.ai',published:'',fetched:'full',
      content:'无关背景。'.repeat(1600)+'Memory does not persist across conversations.\n'+'后文。'.repeat(1800),
    }]});
    expect(prompt).toContain('Memory does not persist across conversations');
    expect(prompt).toContain('900～1600');
    expect(prompt).toContain('每一个事实、数字、观点后面紧跟来源编号');
  });
  it('快速计划最多4题；空内容拒绝，模型代码围栏可解析', () => {
    const p = { title: '研究', questions: Array.from({ length: 10 }, (_, i) => ({ q: '问题'+i, queries: ['真实问题'] })) };
    expect(readPlan(p, 'quick')?.questions).toHaveLength(4);
    expect(readPlan({ questions: [{ q: '' }] })).toBeNull();
    expect(parsePlan('前言\n```json\n'+JSON.stringify(p)+'\n```', 'standard')?.questions).toHaveLength(6);
  });
  it('删掉不存在的引用，对没有匹配来源的数字标记待核实', () => {
    const r = checkCitations('增长12%[7]。增长99%[8]。有16家门店。', new Map([[7, '增长12%']]));
    expect(r.text).toContain('增长12%[7]'); expect(r.text).not.toContain('[8]');
    expect(r.check.removed).toBe(1); expect(r.check.unverified).toBe(2);
  });
  it('引用重排为可点的真实链接，摘要降级有标签，不宣传已完成事实核验', () => {
    const r = assembleReport({ title: '测试', topic: '需求', depth: 'quick', questions: ['一个问题'], steps: [{ status: 'done', note: '来源信息[7]。' }], summary: '## 核心结论\n信息[7]', sources: [{ n: 7, step: 0, url: 'https://example.com/source', title: '来源', site: 'example.com', published: '', fetched: 'snippet', content: '来源信息' }] });
    expect(r.markdown).toContain('[[1]](https://example.com/source)');
    expect(r.markdown).toContain('仅摘录'); expect(r.markdown).toContain('不代表事实');
    expect(r.check.fullText).toBe(0);
  });
  it('同节同站最多两个，重复链接和已经使用的排除', () => {
    const h = [1,2,3].map(n => ({ url: 'https://example.com/'+n, content: '正文' }));
    expect(pickCandidates(h, new Set([h[0].url]), 5)).toHaveLength(2);
    expect(pickCandidates([h[0],h[0],h[1]],new Set(),5)).toEqual([h[0],h[1]]);
  });
});
describe('公开网页读取的边界', () => {
  it.each(['127.0.0.1','10.0.0.1','169.254.169.254','100.100.100.200','192.168.1.1','::1','::ffff:127.0.0.1','::ffff:7f00:1','::ffff:a00:1','fc00::1','fe80::1','2001:db8::1','203.0.113.1'])('拒绝非公网地址 %s', ip => expect(isPrivateAddress(ip)).toBe(true));
  it.each(['8.8.8.8','1.1.1.1','2001:4860:4860::8888'])('允许公网地址 %s', ip => expect(isPrivateAddress(ip)).toBe(false));
  it.each(['http://localhost/x','http://127.0.0.1','http://[::ffff:7f00:1]','file:///tmp/secret','https://a:b@example.com','https://example.com:8080','http://service.internal'])('URL拒绝 %s', u => expect(checkUrl(u)).toBeNull());
  it('解析正文去掉脚本导航，保留标题日期；按网页声明解码', () => {
    const text='真实正文，介绍行业情况。'.repeat(40);
    const r=extractMainText('<head><title>行业报告</title><meta property="article:published_time" content="2026-10-04"></head><nav>登录</nav><article><p>'+text+'</p></article><script>泄露密钥</script>');
    expect(r.title).toBe('行业报告'); expect(r.text).toContain(text); expect(r.text).not.toContain('泄露');
    expect(r.published).toBe('2026-10-04'); expect(decodeHtml(Buffer.from('中文'), 'text/html;charset=UTF-8')).toBe('中文');
  });
});
describe('搜索配置与真实错误', () => {
  it('鉴权错误、欠费错误、格式错误不当作无结果', () => {
    expect(parseSearchResponse(401, '{}')).toMatchObject({ ok:false,reason:'auth' });
    expect(parseSearchResponse(200, '{"code":"QuotaExceeded"}')).toMatchObject({ ok:false,reason:'quota' });
    expect(parseSearchResponse(200, '{}')).toMatchObject({ ok:false,reason:'bad_response' });
    expect(parseSearchResponse(200, '{"result":{"search_result":[]}}')).toEqual({ok:true,hits:[]});
  });
  it('密钥只能发给阿里云搜索 HTTPS；保存加密，错误密钥无法解密', () => {
    expect(validEndpoint('https://opensearch.aliyuncs.com.evil.com/web-search/x')).toBeNull();
    expect(validEndpoint('http://x.opensearch.aliyuncs.com/web-search/x')).toBeNull();
    const old=process.env.SEARCH_KEY_ENCRYPTION_SECRET;
    process.env.SEARCH_KEY_ENCRYPTION_SECRET='isolated-test-key';
    try {
      const raw='test-search-key-1234567890', sealed=sealSearchKey(raw);
      expect(sealed).not.toContain(raw); expect(openSearchKey(sealed)).toBe(raw);
      process.env.SEARCH_KEY_ENCRYPTION_SECRET='changed-test-key'; expect(openSearchKey(sealed)).toBeNull();
    } finally { if(old===undefined) delete process.env.SEARCH_KEY_ENCRYPTION_SECRET; else process.env.SEARCH_KEY_ENCRYPTION_SECRET=old; }
  });
});
