/**
 * 2026-09-30 线上：两个新注册的号在后台都显示「已封禁」，管理员挨个点了解封。
 * 其实它们没被封——新的免费用户没有 subscriptions 行，接口拿 'inactive' 当默认值。
 */
import { describe, it, expect } from 'vitest';
import { accountStatus } from '@/lib/account-status';
import { authErrorText } from '@/lib/auth-errors';
import { readCode } from './helpers/source';

const NOW = Date.parse('2026-09-30T12:00:00Z');

describe('后台账号状态', () => {
  it('新注册、没有订阅行、没被封 → 正常', () => {
    expect(accountStatus(null, undefined, NOW)).toBe('active');
    expect(accountStatus(undefined, null, NOW)).toBe('active');
  });

  it('认证层封禁没到期 → 已封禁；到期了（或解封写成过去的时间）→ 正常', () => {
    expect(accountStatus('2126-09-30T00:00:00Z', 'active', NOW)).toBe('inactive');
    expect(accountStatus('2026-09-29T00:00:00Z', undefined, NOW)).toBe('active');
  });

  it('订阅行被封禁按钮置成 inactive → 已封禁', () => {
    expect(accountStatus(null, 'inactive', NOW)).toBe('inactive');
  });

  it('接口不再拿 inactive 当默认值；页面也不把认不出的状态显示成封禁', () => {
    const api = readCode('app/api/admin/users/route.ts');
    expect(api).not.toMatch(/subscription\?\.status \|\| 'inactive'/);
    expect(api).toMatch(/accountStatus\(authUser\.banned_until, subscription\?\.status\)/);
    expect(readCode('app/admin/users/page.tsx')).not.toMatch(/configs\[status\] \|\| configs\.inactive/);
  });
});

describe('登录报错翻成人话', () => {
  it('常见的几种英文报错都有中文', () => {
    expect(authErrorText(new Error('Invalid login credentials'))).toMatch(/邮箱或密码不对/);
    expect(authErrorText({ message: 'User is banned' })).toMatch(/已被停用/);
    expect(authErrorText(new TypeError('Load failed'))).toMatch(/连不上登录服务器/);
    expect(authErrorText(new TypeError('Failed to fetch'))).toMatch(/连不上登录服务器/);
    expect(authErrorText(new Error('Database error granting user'))).toMatch(/截图发给管理员/);
  });

  it('我们自己的中文报错原样显示；认不出的英文保留原文方便排查', () => {
    expect(authErrorText(new Error('这个邮箱已经注册过了，直接登录即可'))).toBe('这个邮箱已经注册过了，直接登录即可');
    expect(authErrorText(new Error('Something odd'))).toBe('操作失败（Something odd）');
  });

  it('登录页用它，注册后自动登录失败时不再吞掉原因', () => {
    const page = readCode('app/login/page.tsx');
    expect(page).toMatch(/setMessage\(authErrorText\(error\)\)/);
    expect(page).toMatch(/自动登录没成功（\$\{authErrorText\(signInError\)\}）/);
  });
});
