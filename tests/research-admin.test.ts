import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ admin: true, status: vi.fn(), save: vi.fn(), search: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: async () => mock.admin ? { userId: 'admin', role: 'admin' } : null,
  requireAdminPermission: async () => mock.admin ? { userId: 'admin', role: 'admin' } : null,
}));
vi.mock('@/lib/search-config', () => ({ DEFAULT_SEARCH_ENDPOINT: 'https://example.opensearch.aliyuncs.com/v3/web-search/example', searchConfigStatus: mock.status, saveSearchConfig: mock.save, validApiKey: (key: unknown) => typeof key === 'string' && key.length >= 16 ? key : null, validEndpoint: (endpoint: unknown) => typeof endpoint === 'string' && endpoint.startsWith('https://example.opensearch.aliyuncs.com/') ? endpoint : null }));
vi.mock('@/lib/ali-search', () => ({ aliSearch: mock.search, SEARCH_FAILURE_TEXT: { auth: '密钥无权限', quota: '额度不足' } }));
import { GET, POST } from '@/app/api/admin/search-key/route';
const secret = 'private-key-not-for-clients';
const request = (body: unknown) => new Request('http://localhost/api/admin/search-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mock.admin = true; mock.status.mockResolvedValue({ configured: true, verifiedAt: '2026-10-04' }); mock.search.mockResolvedValue({ ok: true, hits: [] }); mock.save.mockResolvedValue(undefined); });
describe('管理员搜索配置', () => {
  it('非管理员无法查询或写入，不调用搜索', async () => { mock.admin = false; expect((await GET()).status).toBe(403); expect((await POST(request({ apiKey: secret }))).status).toBe(403); expect(mock.search).not.toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled(); });
  it('状态响应只含元数据', async () => { expect(await (await GET()).text()).not.toContain(secret); });
  it('真实验证成功才保存，保存后不回显密钥', async () => { const response = await POST(request({ apiKey: secret })); expect(response.status).toBe(200); expect(mock.search).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ apiKey: secret }), { topK: 1 }); expect(mock.save).toHaveBeenCalledTimes(1); expect(await response.text()).not.toContain(secret); });
  it('验证失败保留旧配置', async () => { mock.search.mockResolvedValue({ ok: false, reason: 'auth' }); expect((await POST(request({ apiKey: secret }))).status).toBe(422); expect(mock.save).not.toHaveBeenCalled(); });
  it('禁止把密钥发往任意地址', async () => { expect((await POST(request({ apiKey: secret, endpoint: 'https://attacker.example/web-search/' }))).status).toBe(400); expect(mock.search).not.toHaveBeenCalled(); });
  it('非对象请求拒绝', async () => { for (const body of [null, [], 'text']) expect((await POST(request(body))).status).toBe(400); expect(mock.search).not.toHaveBeenCalled(); });
  it('正式HTTP入口禁止提交密钥，HTTPS代理入口允许验证', async () => {
    vi.stubEnv('NODE_ENV','production');
    try {
      const unsafe=request({apiKey:secret});unsafe.headers.set('host','122.51.234.155');
      expect((await POST(unsafe)).status).toBe(400);expect(mock.search).not.toHaveBeenCalled();
      const safe=request({apiKey:secret});safe.headers.set('host','122.51.234.155');safe.headers.set('x-forwarded-proto','https');
      expect((await POST(safe)).status).toBe(200);
    } finally {vi.unstubAllEnvs();}
  });
});
