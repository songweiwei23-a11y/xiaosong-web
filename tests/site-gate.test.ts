import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { isGateExempt, isHttpsRequest, siteGateToken, sameSecret, siteGateResponse, SITE_GATE_COOKIE } from '@/lib/site-gate';
import { loadGateSetting, resetGateCache, settingFromRow, type GateSetting } from '@/lib/site-gate-store';
import { validSiteAccessCode, generateSiteAccessCode } from '@/lib/site-access-code';

const CODE = 'test-gate-code-2026';
const setting = (code: string, enabled = true): GateSetting => ({ code, enabled, source: 'database' });
const req = (path: string, cookie?: string) => new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
const rewrittenToGate = (res: Response | null) => !!res && (res.headers.get('x-middleware-rewrite') || '').includes('/gate');

beforeEach(() => resetGateCache());

describe('首页拦截：哪些路径拦、哪些放行', () => {
  it('访问码页、接口、静态资源不拦', () => {
    for (const p of ['/gate', '/api/health', '/api/gate/unlock', '/_next/static/chunks/x.js', '/favicon.ico', '/robots.txt']) {
      expect(isGateExempt(p), p).toBe(true);
    }
  });

  it('首页、登录、注册、价格、会话页都拦', () => {
    for (const p of ['/', '/login', '/register', '/pricing', '/dashboard', '/dashboard/breakdown', '/gatekeeper']) {
      expect(isGateExempt(p), p).toBe(false);
    }
  });

  it('没有访问码（后台和环境变量都没设）时拦截关闭，谁都能看', async () => {
    expect(await siteGateResponse(req('/'), async () => null)).toBeNull();
  });

  it('后台关掉了拦截：没有 Cookie 也放行', async () => {
    expect(await siteGateResponse(req('/'), async () => setting(CODE, false))).toBeNull();
  });

  it('没有 Cookie：页面地址不变，内容换成访问码页', async () => {
    expect(rewrittenToGate(await siteGateResponse(req('/login'), async () => setting(CODE)))).toBe(true);
  });

  it('访问码来源读不到（unavailable）：一律拦下，就算带着「空码」算出来的 Cookie 也不放行', async () => {
    const unavailable: GateSetting = { code: '', enabled: true, source: 'unavailable' };
    const emptyToken = await siteGateToken('');
    expect(rewrittenToGate(await siteGateResponse(req('/', `${SITE_GATE_COOKIE}=${emptyToken}`), async () => unavailable))).toBe(true);
  });

  it('访问码错的邀请链接：不放行，也不发 Cookie', async () => {
    const res = await siteGateResponse(req('/?gate=wrong'), async () => setting(CODE));
    expect(rewrittenToGate(res)).toBe(true);
    expect(res!.headers.get('set-cookie')).toBeNull();
  });

  it('正确的邀请链接：发 Cookie，跳回去掉 gate 参数的地址', async () => {
    const res = await siteGateResponse(req(`/login?gate=${CODE}&next=/dashboard`), async () => setting(CODE));
    expect(res!.headers.get('location')).toBe('http://localhost:3000/login?next=%2Fdashboard');
    expect(res!.headers.get('set-cookie')).toContain(`${SITE_GATE_COOKIE}=${await siteGateToken(CODE)}`);
  });

  it('带着正确的 Cookie：放行', async () => {
    const token = await siteGateToken(CODE);
    expect(await siteGateResponse(req('/', `${SITE_GATE_COOKIE}=${token}`), async () => setting(CODE))).toBeNull();
  });

  it('Cookie 是旧访问码算出来的（已改过码）：还是拦', async () => {
    const oldToken = await siteGateToken('old-gate-code-2025');
    const res = await siteGateResponse(req('/', `${SITE_GATE_COOKIE}=${oldToken}`), async () => setting(CODE));
    expect(rewrittenToGate(res)).toBe(true);
  });
});

describe('访问码的来源：后台优先，环境变量兜底', () => {
  it('数据库里有一行：用它，不管环境变量', () => {
    expect(settingFromRow({ code: 'db-code-2026', enabled: false }, 'env-code-2026')).toEqual({ code: 'db-code-2026', enabled: false, source: 'database' });
  });

  it('数据库没有这一行：用环境变量；环境变量也没有：没有设置', () => {
    expect(settingFromRow(null, 'env-code-2026')).toEqual({ code: 'env-code-2026', enabled: true, source: 'environment' });
    expect(settingFromRow(null, '')).toBeNull();
  });

  it('表还没建（迁移没跑）：按没有设置处理，用环境变量，不挡人', async () => {
    const missing = async () => { throw Object.assign(new Error('relation "public.site_access_settings" does not exist'), { code: '42P01' }); };
    expect(await loadGateSetting(missing, 'env-code-2026', 1)).toEqual({ code: 'env-code-2026', enabled: true, source: 'environment' });
    resetGateCache();
    expect(await loadGateSetting(missing, '', 1)).toBeNull();
  });

  it('读数据库失败，从没读到过：用环境变量；环境变量也没有就关上门', async () => {
    const down = async () => { throw new Error('fetch failed'); };
    expect(await loadGateSetting(down, 'env-code-2026', 1)).toEqual({ code: 'env-code-2026', enabled: true, source: 'environment' });
    resetGateCache();
    expect(await loadGateSetting(down, '', 1)).toEqual({ code: '', enabled: true, source: 'unavailable' });
  });

  it('30 秒内不重复查库；读失败时沿用最近一次读到的结果', async () => {
    let calls = 0;
    const good = async () => { calls += 1; return { code: 'db-code-2026', enabled: true }; };
    const down = async () => { calls += 1; throw new Error('fetch failed'); };
    await loadGateSetting(good, '', 1_000);
    await loadGateSetting(good, '', 20_000);
    expect(calls).toBe(1);
    const stale = await loadGateSetting(down, '', 40_000);
    expect(stale).toEqual({ code: 'db-code-2026', enabled: true, source: 'database' });
    expect(calls).toBe(2);
  });
});

describe('访问码的规则与摘要', () => {
  it('访问码 8–64 位，只能用字母、数字、短横线和下划线', () => {
    expect(validSiteAccessCode('abcd1234')).toBe(true);
    expect(validSiteAccessCode('ab-cd_12')).toBe(true);
    expect(validSiteAccessCode('short')).toBe(false);
    expect(validSiteAccessCode('has space 1234')).toBe(false);
    expect(validSiteAccessCode('中文访问码2026')).toBe(false);
    expect(validSiteAccessCode('x'.repeat(65))).toBe(false);
    expect(validSiteAccessCode(undefined)).toBe(false);
  });

  it('随机生成的访问码：12 位、符合规则、没有容易看错的 0 O 1 I', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateSiteAccessCode();
      expect(code).toHaveLength(12);
      expect(validSiteAccessCode(code)).toBe(true);
      expect(code).not.toMatch(/[0OI1l]/);
    }
  });

  it('摘要稳定、是 64 位十六进制，不含访问码原文', async () => {
    const a = await siteGateToken(CODE);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await siteGateToken(CODE)).toBe(a);
    expect(await siteGateToken(`${CODE}x`)).not.toBe(a);
    expect(a).not.toContain(CODE);
  });

  it('sameSecret：内容相同才相等，长度不同直接不等', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('abc', 'ab')).toBe(false);
  });

  it('https 判断：直连 https 或反向代理带了 x-forwarded-proto 都算', () => {
    expect(isHttpsRequest({ url: 'https://example.com/', headers: new Headers() })).toBe(true);
    expect(isHttpsRequest({ url: 'http://122.51.234.155/', headers: new Headers({ 'x-forwarded-proto': 'https' }) })).toBe(true);
    expect(isHttpsRequest({ url: 'http://122.51.234.155/', headers: new Headers() })).toBe(false);
  });
});
