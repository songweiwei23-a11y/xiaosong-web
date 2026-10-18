import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { isGateExempt, isHttpsRequest, siteGateCookieOptions, siteGateResponse, SITE_GATE_COOKIE, type GateDeps } from '@/lib/site-gate';
import { extractTicket, safeNextPath, claimMessage, ticketStatus } from '@/lib/gate-ticket-format';
import { hashSecret, newSecret } from '@/lib/gate-tickets';

const TICKET = 'abcdefghijklmnopqrstuvwx';
const req = (path: string, cookie?: string) => new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
const deps = (over: Partial<GateDeps> = {}): GateDeps => ({
  enabled: async () => true,
  devicePass: async () => false,
  blocked: async () => false,
  admit: async () => {},
  ...over,
});
const rewrittenToGate = (res: Response | null) => !!res && (res.headers.get('x-middleware-rewrite') || '').includes('/gate');
const redirectedTo = (res: Response | null) => (res && res.status >= 300 && res.status < 400 ? res.headers.get('location') : null);

describe('首页拦截：哪些路径拦、哪些放行', () => {
  it('提示页、领门票接口、静态资源不拦', () => {
    for (const p of ['/gate', '/api/health', '/api/gate/claim', '/_next/static/chunks/x.js', '/favicon.ico', '/robots.txt']) {
      expect(isGateExempt(p), p).toBe(true);
    }
  });

  it('首页、登录、注册、价格、会话页都拦', () => {
    for (const p of ['/', '/login', '/register', '/pricing', '/dashboard', '/dashboard/breakdown', '/gatekeeper']) {
      expect(isGateExempt(p), p).toBe(false);
    }
  });

  it('拦截没开：谁都能看', async () => {
    expect(await siteGateResponse(req('/'), deps({ enabled: async () => false }))).toBeNull();
  });

  it('开关读不到又没有缓存：按关门处理', async () => {
    expect(rewrittenToGate(await siteGateResponse(req('/'), deps({ enabled: async () => null })))).toBe(true);
  });

  it('开了拦截、没有设备通行：页面地址不变，内容换成提示页', async () => {
    expect(rewrittenToGate(await siteGateResponse(req('/login'), deps()))).toBe(true);
  });

  it('带着有效的设备通行：放行', async () => {
    const res = await siteGateResponse(req('/', `${SITE_GATE_COOKIE}=device-abc`), deps({ devicePass: async (c) => c === 'device-abc' }));
    expect(res).toBeNull();
  });

  it('设备通行无效（过期、门票已撤销、或是旧的）：还是拦', async () => {
    const res = await siteGateResponse(req('/', `${SITE_GATE_COOKIE}=device-old`), deps({ devicePass: async () => false }));
    expect(rewrittenToGate(res)).toBe(true);
  });

  it('带着门票链接来的：去领设备通行，领完回到原来的页面（去掉 invite 参数）', async () => {
    const res = await siteGateResponse(req(`/login?invite=${TICKET}&next=/dashboard`), deps());
    const location = new URL(redirectedTo(res)!, 'http://localhost:3000');
    expect(location.pathname).toBe('/api/gate/claim');
    expect(location.searchParams.get('t')).toBe(TICKET);
    expect(location.searchParams.get('next')).toBe('/login?next=%2Fdashboard');
  });

  it('门票链接的 next 不会指向外部网站（只保留站内路径）', () => {
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('/\\evil')).toBe('/');
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath(undefined)).toBe('/');
  });

  it('https 判断：直连 https 或反向代理带了 x-forwarded-proto 都算', () => {
    expect(isHttpsRequest({ url: 'https://example.com/', headers: new Headers() })).toBe(true);
    expect(isHttpsRequest({ url: 'http://122.51.234.155/', headers: new Headers({ 'x-forwarded-proto': 'https' }) })).toBe(true);
    expect(isHttpsRequest({ url: 'http://122.51.234.155/', headers: new Headers() })).toBe(false);
  });
});

describe('登录状态：已登录且没被撤销的放行，没登录的才看门票', () => {
  it('已登录、门票没被撤销：不带通行也放行', async () => {
    const res = await siteGateResponse(req('/'), deps({ devicePass: async () => false }), async () => 'user-1');
    expect(res).toBeNull();
  });

  it('没登录、也没有通行：拦下', async () => {
    const res = await siteGateResponse(req('/'), deps(), async () => null);
    expect(rewrittenToGate(res)).toBe(true);
  });

  it('没登录但有通行（同一次访问里刚进门）：放行，且不记账号（没有账号可记）', async () => {
    let admitted = false;
    const res = await siteGateResponse(
      req('/', `${SITE_GATE_COOKIE}=device-abc`),
      deps({ devicePass: async (c) => c === 'device-abc', admit: async () => { admitted = true; } }),
      async () => null,
    );
    expect(res).toBeNull();
    expect(admitted).toBe(false);
  });

  it('拦截没开：不去查登录状态，也不查撤销', async () => {
    let asked = false;
    let checked = false;
    const res = await siteGateResponse(
      req('/'),
      deps({ enabled: async () => false, blocked: async () => { checked = true; return true; } }),
      async () => { asked = true; return 'user-1'; },
    );
    expect(res).toBeNull();
    expect(asked).toBe(false);
    expect(checked).toBe(false);
  });
});

describe('撤销门票：已登录的账号也要凭有效通行进门', () => {
  const cookieReq = (path = '/') => req(path, `${SITE_GATE_COOKIE}=device-abc`);
  const validPass = async (c: string) => c === 'device-abc';

  it('门票被撤销的已登录账号、没有通行：拦下（和没登录一样）', async () => {
    const res = await siteGateResponse(req('/dashboard'), deps({ blocked: async () => true }), async () => 'user-1');
    expect(rewrittenToGate(res)).toBe(true);
  });

  it('门票被撤销的已登录账号、带的通行已经失效（门票撤了）：拦下', async () => {
    const res = await siteGateResponse(cookieReq('/dashboard'), deps({ blocked: async () => true, devicePass: async () => false }), async () => 'user-1');
    expect(rewrittenToGate(res)).toBe(true);
  });

  it('门票被撤销的已登录账号，拿新门票重新凭有效通行进门：放行，并解除撤销记录（admit）', async () => {
    const admitted: string[] = [];
    const res = await siteGateResponse(
      cookieReq('/dashboard'),
      deps({ blocked: async () => true, devicePass: validPass, admit: async (c, u) => { admitted.push(`${c}|${u}`); } }),
      async () => 'user-1',
    );
    expect(res).toBeNull();
    expect(admitted).toEqual(['device-abc|user-1']);
  });

  it('没被撤销的已登录账号，带着有效通行：放行，并记下这台设备属于谁（撤销时才找得到）', async () => {
    const admitted: string[] = [];
    const res = await siteGateResponse(
      cookieReq('/dashboard'),
      deps({ devicePass: validPass, admit: async (c, u) => { admitted.push(`${c}|${u}`); } }),
      async () => 'user-2',
    );
    expect(res).toBeNull();
    expect(admitted).toEqual(['device-abc|user-2']);
  });

  it('被撤销的账号带着门票链接来：去领新的设备通行', async () => {
    const res = await siteGateResponse(req(`/dashboard?invite=${TICKET}`), deps({ blocked: async () => true }), async () => 'user-1');
    const location = new URL(redirectedTo(res)!, 'http://localhost:3000');
    expect(location.pathname).toBe('/api/gate/claim');
    expect(location.searchParams.get('t')).toBe(TICKET);
  });

  it('通行 Cookie 是会话 Cookie：不设过期时间，关掉浏览器就没了', () => {
    const opts = siteGateCookieOptions(false);
    expect(opts).not.toHaveProperty('maxAge');
    expect(opts).not.toHaveProperty('expires');
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });
});

describe('门票：解析、提示语、状态', () => {
  it('粘贴的门票原文或整条邀请链接都能取出门票；乱写的不认', () => {
    expect(extractTicket(TICKET)).toBe(TICKET);
    expect(extractTicket(`  http://localhost:3000/?invite=${TICKET}  `)).toBe(TICKET);
    expect(extractTicket('https://x.example/?other=1')).toBeNull();
    expect(extractTicket('短')).toBeNull();
    expect(extractTicket('')).toBeNull();
  });

  it('每种失败原因都有一句说明，未知原因按无效处理', () => {
    expect(claimMessage('revoked')).toContain('撤销');
    expect(claimMessage('expired')).toContain('期限');
    expect(claimMessage('full')).toContain('设备');
    expect(claimMessage('something-new')).toBe(claimMessage('invalid'));
  });

  it('门票状态：撤销优先，然后是过期、设备用完，其余可用', () => {
    const now = Date.parse('2026-10-16T00:00:00Z');
    const base = { kind: 'invite' as const, revoked_at: null, claim_until: '2026-10-20T00:00:00Z', devices_used: 0, max_devices: 3 };
    expect(ticketStatus(base, now)).toBe('active');
    expect(ticketStatus({ ...base, revoked_at: '2026-10-15T00:00:00Z' }, now)).toBe('revoked');
    expect(ticketStatus({ ...base, claim_until: '2026-10-15T00:00:00Z' }, now)).toBe('expired');
    expect(ticketStatus({ ...base, devices_used: 3 }, now)).toBe('full');
    // 管理员门票没有进门期限
    expect(ticketStatus({ ...base, kind: 'admin', claim_until: null }, now)).toBe('active');
  });

  it('门票原文的摘要稳定、不含原文，每次生成的门票都不同', async () => {
    const a = await hashSecret(TICKET);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashSecret(TICKET)).toBe(a);
    expect(a).not.toContain(TICKET);
    const s1 = newSecret();
    const s2 = newSecret();
    expect(s1).not.toBe(s2);
    expect(s1).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});
