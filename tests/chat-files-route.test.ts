import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ guard: vi.fn(), upload: vi.fn(), download: vi.fn(), remove: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/api-guard', () => ({ requireUser: () => state.guard(), requireUserWithQuota: () => state.guard() }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({ storage: { from: () => ({ upload: state.upload, download: state.download, remove: state.remove }) } }) }));
vi.mock('@/lib/rate-limit', () => ({ createRateLimiter: () => () => false }));
import { GET, POST } from '@/app/api/chat-files/route';
import { verifiedAttachments } from '@/lib/chat-attachments-server';
const owner = '11111111-1111-1111-1111-111111111111';
beforeEach(() => {
  Object.values(state).forEach(v => v.mockReset());
  vi.stubEnv('DIFY_API_KEY', 'test-only-server-key'); vi.stubGlobal('fetch', state.fetch);
  state.guard.mockResolvedValue({ ok: true, userId: owner });
  state.upload.mockResolvedValue({ error: null }); state.remove.mockResolvedValue({ error: null });
  state.fetch.mockResolvedValue(Response.json({ id: '22222222-2222-2222-2222-222222222222' }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function upload(name = '资料.txt', content: string = '项目识别测试') {
  const form = new FormData(); form.append('file', new Blob([content]), name);
  return new Request('http://localhost/api/chat-files', { method: 'POST', body: form });
}
describe('文件上传与历史读取', () => {
  it('认证失败时不访问存储或模型', async () => {
    state.guard.mockResolvedValue({ ok: false, response: Response.json({ error: '请登录' }, { status: 401 }) });
    expect((await POST(upload())).status).toBe(401);
    expect(state.upload).not.toHaveBeenCalled(); expect(state.fetch).not.toHaveBeenCalled();
  });
  it('保存原文件，Dify 上传使用真实账号并返回可验证回执', async () => {
    const res = await POST(upload()); expect(res.status).toBe(200);
    const result = await res.json(); expect(verifiedAttachments([result], owner)).toHaveLength(1);
    const form = state.fetch.mock.calls[0][1].body as FormData;
    expect(form.get('user')).toBe(owner); expect(state.upload.mock.calls[0][0]).toMatch(new RegExp(`^${owner}/`));
  });
  it('模型上传失败只清理本次新文件，拒绝伪装图片', async () => {
    state.fetch.mockResolvedValue(Response.json({ error: 'failed' }, { status: 502 }));
    expect((await POST(upload())).status).toBe(502);
    expect(state.remove).toHaveBeenCalledWith([state.upload.mock.calls[0][0]]);
    expect((await POST(upload('fake.png', '<html>attack</html>'))).status).toBe(400);
  });
  it('不能跨账号或通过路径穿越读文件，文档只提供下载', async () => {
    expect((await GET(new Request('http://localhost/api/chat-files?path=99999999-9999-9999-9999-999999999999/33333333-3333-3333-3333-333333333333/file.pdf'))).status).toBe(403);
    expect((await GET(new Request(`http://localhost/api/chat-files?path=${owner}/../file.pdf`))).status).toBe(403);
    expect(state.download).not.toHaveBeenCalled();
    state.download.mockResolvedValue({ data: new Blob(['<html>test</html>']), error: null });
    const response = await GET(new Request(`http://localhost/api/chat-files?path=${owner}/33333333-3333-3333-3333-333333333333/file.html&name=test.html`));
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment/);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
