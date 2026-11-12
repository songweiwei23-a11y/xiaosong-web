/**
 * 登录页的小温度（2026-10-04）：按时段问候、认出老用户、今日一计、注册送什么、大写锁定提醒。
 * 退出登录必须清掉本机记住的名字，否则共用电脑打开 /login 仍显示「欢迎回来，上一个账号」。
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { freeTrialLine, greetingFor } from '@/components/auth/LoginExtras';
import { attachLoginNameCleanup, forgetLoginName, readLoginName, rememberLoginName } from '@/lib/login-memory';
import { SUBSCRIPTION_PLANS } from '@/lib/config/plans';
import { readCode } from './helpers/source';

describe('按时段问候', () => {
  it.each([[7, '早上好'], [12, '中午好'], [15, '下午好'], [20, '晚上好'], [1, '夜深了'], [23, '夜深了']])('%i 点：%s', (h, t) => {
    expect(greetingFor(h as number, true).title).toContain(t as string);
  });
  it('注册时换成欢迎语', () => expect(greetingFor(9, false).title).toContain('欢迎来到开物'));
});

describe('注册送什么：从配置算', () => {
  it('自由对话、知识库次数和免费版配置一致', () => {
    const line = freeTrialLine();
    expect(line).toContain(`自由对话 ${SUBSCRIPTION_PLANS.free.quotas.freeChat} 次`);
    expect(line).toContain(`知识库 ${SUBSCRIPTION_PLANS.free.quotas.knowledge} 次`);
    expect(line).toMatch(/各创作板块 \d+(～\d+)? 次/);
  });
});

describe('接到登录页', () => {
  const page = readCode('app/login/page.tsx');
  const extras = readCode('components/auth/LoginExtras.tsx');
  it('小眼睛、大写锁定提醒、自动填充提示都有', () => {
    expect(page).toMatch(/type=\{showPassword \? "text" : "password"\}/);
    expect(page).toMatch(/getModifierState\?\.\("CapsLock"\)/);
    expect(page).toMatch(/autoComplete=\{isLogin \? "current-password" : "new-password"\}/);
  });
  it('问候、今日一计、注册礼都放上了', () => {
    expect(page).toMatch(/<LoginGreeting isLogin=\{isLogin\} \/>/);
    expect(page).toMatch(/<DailyTip \/>/);
    expect(page).toMatch(/freeTrialLine\(\)/);
  });
  it('本机存储读写都包了 try（隐私模式不报错），只存邮箱 @ 前面那段；能「不是你？」清掉', () => {
    const memory = readCode('lib/login-memory.ts');
    expect(memory).toMatch(/try \{ if \(name\) window\.localStorage\.setItem/);
    expect(memory).toMatch(/try \{ return window\.localStorage\.getItem/);
    expect(memory).toMatch(/try \{ window\.localStorage\.removeItem/);
    expect(memory).toMatch(/split\("@"\)\[0\]/);
    expect(extras).toMatch(/不是你？/);
    expect(extras).toMatch(/forgetLoginName\(\)/);
    expect(page).toMatch(/rememberLoginName\(email\.trim\(\)\)/);
  });
  it('今日一计的方法数从 FACTS 取，不手写', () => {
    expect(extras).toMatch(/\{FACTS\.methods\} 条/);
  });
});

describe('登录页记住的名字：退出要清掉', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('只记邮箱 @ 前面最多 20 字；退出后读不到，登录页也就不会喊这个人', () => {
    vi.stubGlobal('window', { localStorage: storage });
    rememberLoginName('coder@biandao.icu');
    expect(readLoginName()).toBe('coder');
    rememberLoginName('abcdefghijklmnopqrstuvwxyz@example.com');
    expect(readLoginName()).toBe('abcdefghijklmnopqrst');
    forgetLoginName();
    expect(readLoginName()).toBe('');
    expect(store.size).toBe(0);
  });

  it('没有 @ 的不记；再退出一次（本来就没有）也不报错', () => {
    vi.stubGlobal('window', { localStorage: storage });
    rememberLoginName('不是邮箱');
    expect(readLoginName()).toBe('');
    expect(() => forgetLoginName()).not.toThrow();
  });

  it('存储被禁用时，记住、读取、清除都不抛错', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('禁用'); } });
    expect(() => rememberLoginName('coder@biandao.icu')).not.toThrow();
    expect(readLoginName()).toBe('');
    expect(() => forgetLoginName()).not.toThrow();
  });

  it('只有 SIGNED_OUT 清掉名字；登录成功（SIGNED_IN）和刷新会话都不动它', () => {
    vi.stubGlobal('window', { localStorage: storage });
    let listener: ((event: string) => void) | null = null;
    attachLoginNameCleanup({
      onAuthStateChange: (cb) => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    });
    rememberLoginName('coder@biandao.icu');
    for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY']) {
      listener!(event);
      expect(readLoginName(), event).toBe('coder');
    }
    listener!('SIGNED_OUT');
    expect(readLoginName()).toBe('');
  });
});

describe('SIGNED_OUT 只在浏览器客户端清一次', () => {
  const root = process.cwd();
  function files(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        files(full, out);
      } else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it('各页面的 onAuthStateChange 不处理 SIGNED_OUT，清名字只挂在 supabase 浏览器客户端', () => {
    const listeners = [...files(path.join(root, 'app')), ...files(path.join(root, 'components')), ...files(path.join(root, 'lib')), ...files(path.join(root, 'hooks'))]
      .filter((f) => /onAuthStateChange\(/.test(fs.readFileSync(f, 'utf8')));
    const rel = listeners.map((f) => path.relative(root, f)).sort();
    expect(rel).toEqual([
      'components/auth/UserProfile.tsx',
      'components/landing/LandingNavCTA.tsx',
      'components/works/ProductionPack.tsx',
      'lib/home-prefs.ts',
      'lib/login-memory.ts',
    ]);
    for (const file of rel) {
      if (file === 'lib/login-memory.ts') continue;
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      const slice = src.slice(src.indexOf('onAuthStateChange('), src.indexOf('onAuthStateChange(') + 240);
      expect(slice, file).not.toContain('SIGNED_OUT');
      expect(slice, file).not.toContain('forgetLoginName');
    }
    const client = readCode('lib/supabase/client.ts');
    const memory = readCode('lib/login-memory.ts');
    expect(client).toContain('attachLoginNameCleanup(supabase.auth)');
    expect(client.match(/attachLoginNameCleanup\(/g)).toHaveLength(1);
    expect(memory).toMatch(/if \(event === "SIGNED_OUT"\) forgetLoginName\(\)/);
    expect(readCode('app/login/page.tsx')).toMatch(/rememberLoginName\(email\.trim\(\)\)/);
  });
});
