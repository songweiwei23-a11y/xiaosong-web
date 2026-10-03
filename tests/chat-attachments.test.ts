import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatFileType, sanitizeAttachments, conversationAttachments } from '@/lib/chat-attachments';
import { signAttachment, verifiedAttachments, toDifyFiles } from '@/lib/chat-attachments-server';
import { sanitizeMessages } from '@/lib/chat-message-utils';
import { difyWebStatus, sanitizeWebSources } from '@/lib/dify-web-status';

const owner = '11111111-1111-1111-1111-111111111111';
const raw = { id: '22222222-2222-2222-2222-222222222222', name: '调研.pdf', size: 1024, type: 'document' as const, storagePath: `${owner}/33333333-3333-3333-3333-333333333333/file.pdf` };
afterEach(() => vi.unstubAllEnvs());
function receipt() { vi.stubEnv('DIFY_API_KEY', 'test-only-server-secret'); return { ...raw, token: signAttachment(owner, raw) }; }

describe('附件由服务器签发并按账号隔离', () => {
  it('发送 Dify 原生文件引用，历史保留原始下载信息', () => {
    const f = receipt();
    expect(toDifyFiles(verifiedAttachments([f], owner))).toEqual([{ type: 'document', transfer_method: 'local_file', upload_file_id: raw.id }]);
    const messages = sanitizeMessages(JSON.parse(JSON.stringify([{ role: 'user', content: '读一下', timestamp: 100, attachments: [f] }])));
    expect(messages[0].attachments).toEqual([f]);
  });
  it('更换模型文件 id、大小或所有者均拒绝', () => {
    const f = receipt();
    expect(() => verifiedAttachments([{ ...f, id: '44444444-4444-4444-4444-444444444444' }], owner)).toThrow();
    expect(() => verifiedAttachments([{ ...f, size: 123 }], owner)).toThrow();
    expect(() => verifiedAttachments([f], '99999999-9999-9999-9999-999999999999')).toThrow();
  });
  it('限制数量、体积和类型，不允许任意远程链接替代附件', () => {
    const f = receipt();
    expect(() => verifiedAttachments(Array(7).fill(f), owner)).toThrow();
    expect(sanitizeAttachments([{ ...f, size: 11 * 1024 * 1024 }, { ...f, id: 'https://example.com/file' }])).toEqual([]);
    expect(chatFileType('文件.DOCX')).toBe('document');
    expect(chatFileType('file.svg')).toBeNull();
    expect(chatFileType('file.exe')).toBeNull();
  });
  it('追问携带先前附件，新会话不继承旧会话文件', () => {
    const f = receipt();
    expect(conversationAttachments([{ role: 'user', attachments: [f] }, { role: 'assistant' }], [])).toEqual([f]);
    expect(conversationAttachments([{ role: 'user', attachments: [f] }], [f])).toEqual([f]);
    expect(conversationAttachments([], [])).toEqual([]);
  });
  it('新文档不混入旧图片；追问只携带最近一批附件', () => {
    const f = receipt();
    const previous = { ...f, id: '55555555-5555-5555-5555-555555555555', name: '旧图片.png', type: 'image' as const };
    const messages = [{ role: 'user', attachments: [previous] }, { role: 'user', attachments: [f] }, { role: 'assistant' }];
    expect(conversationAttachments(messages, [f])).toEqual([f]);
    expect(conversationAttachments(messages, [])).toEqual([f]);
  });
});

describe('联网执行结果如实显示', () => {
  it('不把知识库当作联网，实际 Tavily 结果保留来源', () => {
    expect(difyWebStatus({ event: 'node_finished', data: { title: '知识检索', status: 'succeeded' } })).toBeNull();
    expect(difyWebStatus({ event: 'node_started', data: { title: 'Tavily Search' } })?.status).toBe('searching');
    const status = difyWebStatus({ event: 'node_finished', data: { title: 'Tavily Search', status: 'succeeded', outputs: { json: [{ results: [{ url: 'https://example.com/news', title: '新闻来源' }] }] } } });
    expect(status).toEqual({ status: 'done', sources: [{ url: 'https://example.com/news', title: '新闻来源' }] });
    expect(sanitizeMessages([{ role: 'assistant', content: '答复', timestamp: 100, webSearch: status }])[0].webSearch).toEqual(status);
  });
  it('工具外层成功但内容是错误时仍报失败，危险链接不展示', () => {
    expect(difyWebStatus({ event: 'node_finished', data: { title: 'Tavily Search', status: 'succeeded', outputs: { text: 'ToolInvokeError: quota exceeded' } } })?.status).toBe('unavailable');
    expect(sanitizeWebSources([{ url: 'javascript:alert(1)' }, { url: 'https://user:secret@example.com/' }, { url: 'https://example.com/', title: '来源' }, { url: 'https://example.com/' }])).toEqual([{ url: 'https://example.com/', title: '来源' }]);
  });
  it('阿里云 HTTP 响应中的真实标题和链接可显示并保存到历史', () => {
    const status = difyWebStatus({ event: 'node_finished', data: {
      title: '阿里云联网搜索 Lite', node_id: '1790086576262', status: 'succeeded',
      outputs: { status_code: 200, body: JSON.stringify({ result: { search_result: [
        { title: '行业新闻', link: 'https://example.com/news', content: '公开资料' },
        { title: '重复来源', link: 'https://example.com/news' },
        { title: '危险链接', link: 'javascript:alert(1)' },
      ] } }) },
    } });
    expect(status).toEqual({ status: 'done', sources: [{ title: '行业新闻', url: 'https://example.com/news' }] });
    expect(sanitizeMessages([{ role: 'assistant', content: '答复', timestamp: 100, webSearch: status }])[0].webSearch).toEqual(status);
  });
  it.each([
    { status_code: 429, body: '{}' },
    { status_code: 200, body: JSON.stringify({ code: 'InvalidApiKey', http_code: 401, message: 'invalid key' }) },
    { status_code: 200, body: JSON.stringify({ result: { status: 'failed' } }) },
    { status_code: 200, body: JSON.stringify({ result: { search_result: [] } }) },
    { status_code: 200, body: '<html>网关错误</html>' },
  ])('阿里云限流、业务错误和空来源均不冒充联网成功 %#', outputs => {
    expect(difyWebStatus({ event: 'node_finished', data: { title: '阿里云联网搜索 Lite', status: 'succeeded', outputs } })).toEqual({ status: 'unavailable', sources: [] });
  });
  it.each(['准备搜索请求', '整理联网结果', '本轮联网参考', '联网授权闸门'])('中间节点 %s 不被当作额外付费搜索', title => {
    expect(difyWebStatus({ event: 'node_started', data: { title } })).toBeNull();
  });
});
