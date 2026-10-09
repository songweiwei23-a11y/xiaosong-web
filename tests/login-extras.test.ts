/**
 * 登录页的小温度（2026-10-04）：按时段问候、认出老用户、今日一计、注册送什么、大写锁定提醒。
 */
import { describe, expect, it } from 'vitest';
import { freeTrialLine, greetingFor } from '@/components/auth/LoginExtras';
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
    expect(extras).toMatch(/try \{ if \(name\) window\.localStorage\.setItem/);
    expect(extras).toMatch(/try \{ name = window\.localStorage\.getItem/);
    expect(extras).toMatch(/split\("@"\)\[0\]/);
    expect(extras).toMatch(/不是你？/);
  });
  it('今日一计的方法数从 FACTS 取，不手写', () => {
    expect(extras).toMatch(/\{FACTS\.methods\} 条/);
  });
});
