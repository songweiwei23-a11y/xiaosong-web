/**
 * 付费引导：额度快用完、用完的那一刻怎么请人付费。
 *
 * 这一刻是用户最愿意付钱的时候。守的都是"不报错、只是钱没收到"的那类：
 * 某个板块用完了却没弹引导、推荐了跳两档的贵套餐、提醒一用就弹烦死人。
 */
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import { recommendPlan, shouldNudge, valueRecap } from '@/lib/upgrade';
import fs from 'node:fs';

describe('推荐哪一档', () => {
  it('只推往上一档：免费 → 基础（不直接推 99 的专业版）', () => {
    expect(recommendPlan('free')).toBe('basic');
    expect(recommendPlan('basic')).toBe('pro');
    expect(recommendPlan('pro')).toBe('enterprise');
    expect(recommendPlan('enterprise')).toBeNull();
    expect(recommendPlan('脏数据')).toBe('basic');
  });
});

describe('回顾"你已经用开物做了什么"', () => {
  it('按次数从多到少、带量词、最多 4 项、没用过的不列', () => {
    expect(valueRecap({ script: 5, topic: 12, storyboard: 0, title: 2, review: 1, freeChat: 3 })).toEqual([
      '12 批选题', '5 条脚本', '3 次对话', '2 组标题',
    ]);
    expect(valueRecap({})).toEqual([]);
  });
});

describe('快用完的提醒', () => {
  it('剩 3 次以内提醒；用完的不提醒（那时弹窗）；上限很小的功能不提醒', () => {
    expect(shouldNudge(3, 10)).toBe(true);
    expect(shouldNudge(1, 10)).toBe(true);
    expect(shouldNudge(4, 10)).toBe(false);
    expect(shouldNudge(0, 10)).toBe(false);
    expect(shouldNudge(2, 5)).toBe(false);
  });

  it('同一个功能同一期只提醒一次（记在本机）', () => {
    const src = readCode('components/upgrade/UpgradePrompt.tsx');
    expect(src).toMatch(/kaiwu:nudged:\$\{feature\}:\$\{period \?\? "trial"\}/);
    expect(src).toMatch(/localStorage\.setItem\(nudgeKey\(hit\.feature, q\?\.periodEnd\), "1"\)/);
  });
});

describe('全站都接上了', () => {
  it('工作台框架里挂着付费引导', () => {
    expect(readCode('app/dashboard/layout.tsx')).toContain('<UpgradePrompt />');
  });

  it('服务端回 402 时带上是哪个功能；统一报错那里一接住就弹引导（所有板块都走它）', () => {
    expect(readCode('lib/api-guard.ts')).toMatch(/limit: verdict\.limit,\s*feature,/);
    expect(readCode('lib/api-error.ts')).toMatch(/if \(isQuotaError\(response\.status\)\) openUpgrade\(feature\)/);
  });

  it('生成前预检查用完的板块：弹引导，不再只给一行字', () => {
    for (const p of ['script', 'storyboard', 'positioning', 'title', 'review']) {
      const src = readCode(`app/dashboard/${p}/page.tsx`);
      expect(src, p).toMatch(new RegExp(`openUpgrade\\("${p}"\\)`));
      expect(src, p).not.toMatch(/的额度已用完/);
    }
  });

  it('生成成功后发信号（快用完提醒靠它）：公共保存、选题页、自由对话', () => {
    expect(readCode('lib/history.ts')).toMatch(/历史记录已保存[\s\S]{0,120}notifyGenerated\(\)/);
    expect(readCode('app/dashboard/topic/page.tsx')).toContain('notifyGenerated()');
    expect(readCode('app/dashboard/free-chat/page.tsx')).toMatch(/if \(assistantText\) notifyGenerated\(\)/);
  });

  it('额度接口给出每个功能的剩余次数（80% 以下的也给，剩 3 次的免费额度才 70%）', () => {
    expect(readCode('app/api/quota/check/route.ts')).toMatch(/features\.push\(/);
  });

  it('脚本页原来那套单独的提醒撤掉了（它把"任何功能用完"都说成"脚本用完了"）', () => {
    const src = readCode('app/dashboard/script/page.tsx');
    expect(src).not.toMatch(/QuotaReminder|QuotaExhausted|showQuotaBanner|checkQuotaStatus/);
    expect(fs.existsSync('components/quota-reminder.tsx')).toBe(false);
    expect(fs.existsSync('components/quota-exhausted.tsx')).toBe(false);
  });

  it('弹窗一步去付款，推荐的那档直接带上', () => {
    expect(readCode('components/upgrade/UpgradePrompt.tsx')).toMatch(/href=\{`\/payment\?plan=\$\{nextPlan\.id\}`\}/);
  });
});
