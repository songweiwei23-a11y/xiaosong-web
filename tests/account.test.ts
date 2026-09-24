import { describe, it, expect } from 'vitest';
import { generateTempPassword, validateNewPassword, MIN_PASSWORD_LENGTH } from '@/lib/password';
import { readCode } from './helpers/source';

/**
 * 账户：找回密码、修改密码。
 *
 * 在这之前全站没有任何找回途径，而注册是邀请制——忘了密码的人
 * 永远进不来，连重新注册都要再要一个邀请码。
 *
 * 又因为系统没有发信服务，找回不能走"发重置邮件"（做出来就是个点了没反应的按钮），
 * 只能走：客服核实身份 → 后台一键重置出临时密码 → 用户登录后自己改。
 */

describe('临时密码', () => {
  it('长度够、不含容易认错的字符——它是要人工抄给用户的', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw.length).toBe(10);
      // 0/O、1/l/I 认错一个就登不进去，又得再重置一次
      expect(pw, `出现了容易认错的字符：${pw}`).not.toMatch(/[0O1lI]/);
    }
  });

  it('足够随机：200 次不重复', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateTempPassword()));
    expect(seen.size).toBe(200);
  });

  it('本身就满足改密码的规则——否则用户拿着它连改都改不了', () => {
    expect(validateNewPassword(generateTempPassword())).toBeNull();
  });

  it('用的是 crypto 而不是 Math.random', () => {
    const src = readCode('lib/password.ts');
    expect(src).toContain('randomInt');
    expect(src).not.toContain('Math.random');
  });
});

describe('新密码校验', () => {
  it('和注册时的下限一致', () => {
    // 比注册还松不行，比注册还严则老用户改不了
    const register = readCode('app/api/auth/register/route.ts');
    expect(register).toMatch(new RegExp(`password\\.length < ${MIN_PASSWORD_LENGTH}`));
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull();
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('不能和当前密码一样、首尾不能是空格', () => {
    expect(validateNewPassword('abcdef', 'abcdef')).not.toBeNull();
    expect(validateNewPassword(' abcdef')).not.toBeNull();
    expect(validateNewPassword(undefined)).not.toBeNull();
  });
});

describe('后台重置密码', () => {
  const route = readCode('app/api/admin/users/route.ts');
  const block = route.slice(route.indexOf("case 'reset_password'"), route.indexOf('default:'));

  it('有这个操作', () => {
    expect(block.length, '找不到 reset_password 分支').toBeGreaterThan(50);
    expect(block).toContain('updateUserById');
    expect(block).toContain('generateTempPassword()');
  });

  it('临时密码不写进操作日志', () => {
    /*
     * 日志是给以后查的。把可用的凭证留在日志里，
     * 等于任何能看日志的人都能登进这个账号。
     */
    const logCall = block.slice(block.indexOf('logAdminAction'));
    const logArgs = logCall.slice(0, logCall.indexOf(');') + 2);
    expect(logArgs.length, '找不到日志调用').toBeGreaterThan(20);
    // 查的是那个变量有没有被传进去。动作名 RESET_USER_PASSWORD 本身带
    // password 字样，按单词查会误报
    expect(logArgs, '临时密码被写进了操作日志').not.toContain('tempPassword');
    // 日志细节里也不能出现 password 这个字段
    const details = logArgs.slice(logArgs.indexOf('{'));
    expect(details, '日志细节里出现了 password 字段').not.toMatch(/\bpassword\s*:/i);
  });

  it('后台页面有入口，并且临时密码显示在不会自动消失的弹窗里', () => {
    const page = readCode('app/admin/users/page.tsx');
    expect(page).toContain("action: 'reset_password'");
    // 不能只 notify——toast 几秒就没了，管理员来不及抄
    expect(page).toContain('setTempPw(');
    expect(page).toMatch(/tempPw &&/);
  });
});

describe('用户修改密码', () => {
  const route = readCode('app/api/account/password/route.ts');

  it('必须先验旧密码——只凭登录态就能改，借用一下电脑就能把主人锁在外面', () => {
    expect(route).toContain('signInWithPassword');
    const verify = route.indexOf('signInWithPassword');
    const update = route.indexOf('updateUserById');
    expect(verify).toBeGreaterThan(0);
    expect(verify, '验旧密码必须在改密码之前').toBeLessThan(update);
  });

  it('验完旧密码只注销这一次的会话，不把用户正在用的登录也踢掉', () => {
    // supabase-js 的 signOut 默认是 global
    expect(route).toMatch(/signOut\(\{\s*scope:\s*'local'\s*\}\)/);
  });

  it('验旧密码用不落盘的独立客户端', () => {
    expect(route).toMatch(/persistSession:\s*false/);
  });

  it('入口找得到：顶栏邮箱、侧边栏、登录页的忘记密码', () => {
    expect(readCode('components/auth/UserProfile.tsx')).toContain('/dashboard/account');
    expect(readCode('components/dashboard/Sidebar.tsx')).toContain('/dashboard/account');
    const login = readCode('app/login/page.tsx');
    expect(login).toContain('忘记密码');
    // 找回靠客服，所以必须留联系方式
    expect(login).toContain('13240286600');
  });

  it('登录页的忘记密码没有去调发邮件的接口——系统发不了信', () => {
    expect(readCode('app/login/page.tsx')).not.toContain('resetPasswordForEmail');
  });
});

describe('我的订单', () => {
  it('查订单显式按本人过滤，不只靠行级权限', () => {
    const route = readCode('app/api/orders/route.ts');
    const get = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'));
    expect(get).toMatch(/\.eq\('user_id', guard\.userId!?\)/);
  });

  it('账户页每种订单状态都告诉用户下一步怎么办', () => {
    const page = readCode('app/dashboard/account/page.tsx');
    for (const s of ['pending', 'reviewing', 'approved', 'rejected']) {
      expect(page, `缺少 ${s} 状态的展示`).toContain(s);
    }
    // 被拒要显示原因，并给出重新付款的入口
    expect(page).toContain('review_note');
    expect(page).toContain('重新付款');
  });
});
