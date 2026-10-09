/**
 * 审稿优化：个人要求（优先级最高）、时长可 AI 推荐或自定义；
 * 以及「继续对话」不再被保存对话记录卡住（2026-10-02 产品方反馈）
 */
import { describe, it, expect } from 'vitest';
import { buildReviewPrompt, personalRequirementsReminder, AI_DURATION } from '@/lib/review-standards';
import { readCode } from './helpers/source';

const base = { draftContent: '原稿', platform: '抖音', duration: '60秒', scriptType: '教知识型' } as Parameters<typeof buildReviewPrompt>[0];

describe('个人要求', () => {
  const req = '原稿太短，扩到 60 秒\n第二段价格写错了，应该是 19.9 元';

  it('写在待审稿件、账号背景之前，并说明优先级高于一切规则', () => {
    const prompt = buildReviewPrompt({ ...base, contextBlock: '【账号档案】某店', personalRequirements: req });
    const at = prompt.indexOf('用户的个人要求（优先级最高）');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(prompt.indexOf('【账号档案】'));
    expect(at).toBeLessThan(prompt.indexOf('待审稿件'));
    expect(prompt).toContain(req);
    expect(prompt).toMatch(/优先级\*\*高于本提示词里的一切规则/);
  });

  it('优化稿那一节再提醒一次逐条落实', () => {
    const prompt = buildReviewPrompt({ ...base, personalRequirements: req });
    const opt = prompt.slice(prompt.indexOf('优化后的完整脚本'), prompt.indexOf('纯文字文案'));
    expect(opt).toMatch(/个人要求.*逐条落实/);
  });

  it('没写就一个字都不加', () => {
    for (const personalRequirements of [undefined, '', '   ']) {
      const prompt = buildReviewPrompt({ ...base, personalRequirements });
      expect(prompt).not.toContain('个人要求');
      expect(personalRequirementsReminder(personalRequirements)).toBe('');
    }
  });

  it('末尾提醒压过后面拼的连续设置', () => {
    expect(personalRequirementsReminder(req)).toMatch(/优先级最高[\s\S]*冲突时，按个人要求来[\s\S]*19\.9/);
  });
});

describe('时长', () => {
  it('AI 推荐：让模型自己判断并在优化稿开头写「建议时长」', () => {
    const prompt = buildReviewPrompt({ ...base, duration: AI_DURATION });
    expect(prompt).toMatch(/目标时长：由你按内容需要定——先保证内容讲透、讲精彩/);
    expect(prompt).toMatch(/不要为了变短删掉/);
    // 没选时长也一样按 AI 推荐，不拿 60 秒的范例去带节奏
    expect(buildReviewPrompt({ ...base, duration: '' })).toMatch(/目标时长：由你按内容需要定/);
    expect(prompt).toContain('范例有多长不代表这条要多长');
    expect(prompt).toContain('建议时长：XX秒');
    expect(prompt).not.toContain('目标时长：AI推荐');
  });

  it('指定或自定义时长原样写入，素材不足不编事实凑秒数', () => {
    const prompt = buildReviewPrompt({ ...base, duration: '2分半' });
    expect(prompt).toContain('目标时长：2分半');
    expect(prompt).toContain('不编情节或数字凑时长');
  });
});

describe('审稿页面', () => {
  const src = readCode('app/dashboard/review/page.tsx');

  it('有个人要求输入框，传给提示词、末尾提醒和历史记录', () => {
    expect(src).toMatch(/aria-label="个人要求"/);
    expect(src).toMatch(/buildReviewPrompt\(\{[\s\S]*personalRequirements,[\s\S]*\}\)/);
    expect(src).toMatch(/personalRequirementsReminder\(personalRequirements\)/);
    expect(src).toMatch(/inputData = \{[^}]*personalRequirements/);
  });

  it('时长：默认 AI 推荐，可选「自定义」并出现输入框', () => {
    expect(src).toMatch(/useState\(AI_DURATION\)/);
    expect(src).toMatch(/自定义…/);
    expect(src).toMatch(/aria-label="自定义时长"/);
    // 提示词用的是整理过的时长，不是下拉框里的原始值
    expect(src).toMatch(/duration: effectiveDuration,/);
  });

  it('AI 推荐时连续设置里不写死时长（否则会被换成 60 秒并要求不得更换）', () => {
    expect(src).toMatch(/effectiveDuration === AI_DURATION \? settingsWithoutDuration/);
  });
});

describe('继续对话不被保存对话记录卡住', () => {
  const src = readCode('components/ContinuousDialog.tsx');

  it('新建对话记录不 await，带超时；AI 请求照常发出', () => {
    expect(src).not.toMatch(/await\s+createConversation/);
    expect(src).toMatch(/withTimeout\(createConversation\(/);
  });

  it('记录建好后再把这一轮写回去', () => {
    expect(src).toMatch(/creating\.then\(writeBack, writeBack\)/);
  });
});
