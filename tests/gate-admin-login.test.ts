import { describe, it, expect } from 'vitest';
import { adminEmergencyLogin, maskEmail, parseAdminLogin, type AdminLoginDeps } from '@/lib/gate-admin-login';

const GOOD = { email: 'boss@example.com', password: 'correct-horse', code: '123456' };

/** 默认全部通过：每个用例只改它要测的那一步 */
function deps(over: Partial<AdminLoginDeps> = {}): AdminLoginDeps {
  return {
    enabled: async () => true,
    signIn: async () => ({ userId: 'user-1' }),
    isAdmin: async () => true,
    verifyTotp: async () => true,
    issuePass: async () => 'device-pass-abc',
    ...over,
  };
}

describe('应急登录：输入格式', () => {
  it('邮箱、密码、6 位验证码都合格才接受，邮箱统一小写', () => {
    expect(parseAdminLogin({ email: ' Boss@Example.COM ', password: 'correct-horse', code: '123 456' })).toEqual({
      email: 'boss@example.com',
      password: 'correct-horse',
      code: '123456',
    });
  });

  it('不合格的一律返回 null（不说具体哪里错）', () => {
    expect(parseAdminLogin(null)).toBeNull();
    expect(parseAdminLogin({ ...GOOD, email: 'not-an-email' })).toBeNull();
    expect(parseAdminLogin({ ...GOOD, password: '12345' })).toBeNull();
    expect(parseAdminLogin({ ...GOOD, code: '12345' })).toBeNull();
    expect(parseAdminLogin({ ...GOOD, code: 'abcdef' })).toBeNull();
    expect(parseAdminLogin({ ...GOOD, password: 'x'.repeat(201) })).toBeNull();
  });
});

describe('应急登录：每一步都要过', () => {
  it('全部通过：发出设备通行，带上管理员编号', async () => {
    expect(await adminEmergencyLogin(GOOD, deps())).toEqual({ ok: true, userId: 'user-1', devicePass: 'device-pass-abc' });
  });

  it('开关关着：一律失败，连密码都不去核对', async () => {
    let signInCalled = false;
    const out = await adminEmergencyLogin(GOOD, deps({ enabled: async () => false, signIn: async () => { signInCalled = true; return { userId: 'u' }; } }));
    expect(out).toEqual({ ok: false });
    expect(signInCalled).toBe(false);
  });

  it('账号或密码不对：失败', async () => {
    expect(await adminEmergencyLogin(GOOD, deps({ signIn: async () => null }))).toEqual({ ok: false });
  });

  it('账号能登录，但不是管理员：失败，不发通行', async () => {
    let issued = false;
    const out = await adminEmergencyLogin(GOOD, deps({ isAdmin: async () => false, issuePass: async () => { issued = true; return 'x'; } }));
    expect(out).toEqual({ ok: false });
    expect(issued).toBe(false);
  });

  it('管理员，但没绑定验证器或验证码不对：失败', async () => {
    expect(await adminEmergencyLogin(GOOD, deps({ verifyTotp: async () => false }))).toEqual({ ok: false });
  });
});

describe('应急登录：日志里的邮箱要脱敏', () => {
  it('只留邮箱开头两个字和域名', () => {
    expect(maskEmail('boss@example.com')).toBe('bo***@example.com');
    expect(maskEmail('a@x.io')).toBe('a***@x.io');
    expect(maskEmail('no-at-sign')).toBe('***');
  });
});
