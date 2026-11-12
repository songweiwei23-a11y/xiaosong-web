/**
 * 登录页的小温度（2026-10-04）：按时段问候、认出老用户、今日一计、注册送什么、大写锁定提醒。
 * 退出登录必须清掉本机记住的名字，否则共用电脑打开 /login 仍显示「欢迎回来，上一个账号」。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { freeTrialLine, greetingFor } from '@/components/auth/LoginExtras';
import { forgetLoginName, readLoginName, rememberLoginName } from '@/lib/login-memory';
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
});
