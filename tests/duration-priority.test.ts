import { describe, it, expect } from 'vitest';
import { AI_LENGTH_RULE, AI_SCRIPT_LENGTH_RULE, AI_SCRIPT_TARGET_TEXT, durationCeilingSeconds, durationRule, scriptLengthRule } from '@/lib/ai-recommend';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';

/**
 * 时长口径（2026-10-11）：编导设了时长就严格按它写；没设（AI 推荐）内容精彩优先，时长权重更低。
 */
describe('时长解析', () => {
  it('取到最长的那个数', () => {
    expect(durationCeilingSeconds('30秒')).toBe(30);
    expect(durationCeilingSeconds('15 秒')).toBe(15);
    expect(durationCeilingSeconds('15-30秒')).toBe(30);
    expect(durationCeilingSeconds('3分钟')).toBe(180);
    expect(durationCeilingSeconds('AI推荐')).toBeNull();
  });
});

describe('时长规则', () => {
  it('编导设了时长：严格按它写，给出口播字数上限，不再说「偏长没关系」', () => {
    const rule = durationRule('30秒');
    expect(rule).toContain('严格按 30秒 写');
    expect(rule).toContain('不超过约 150 字');
    expect(rule).not.toContain('偏长没关系');
  });

  it('没设或选了 AI 推荐：内容精彩优先，时长权重低于内容', () => {
    for (const d of [undefined, '', 'AI推荐', 'AI自行推断的最佳时长']) {
      const rule = durationRule(d);
      expect(rule).toBe(AI_LENGTH_RULE);
      expect(rule).toContain('内容精彩优先');
      expect(rule).toContain('时长权重低于内容');
    }
  });
});

// 2026-11-01 产品方：质量比时长重要，AI 推荐按内容讲完为止，不凑也不砍（原来 10-17 默认 1 分 30 秒～1 分 40 秒）
describe('脚本生成的时长：AI 推荐按内容讲完为止，设了就按设定写', () => {
  it('AI 推荐（或没选）：讲完为止，不给秒数和字数区间', () => {
    for (const d of [undefined, '', 'AI推荐', 'AI自行推断的最佳时长']) {
      const rule = scriptLengthRule(d);
      expect(rule).toBe(AI_SCRIPT_LENGTH_RULE);
      expect(rule).toContain('按内容讲完为止');
      expect(rule).toContain('不凑也不砍');
      expect(rule).not.toMatch(/\d+\s*[～~-]\s*\d+\s*(?:秒|字)/);
      expect(rule).not.toContain('严格按');
    }
    expect(AI_SCRIPT_TARGET_TEXT).toBe('按内容讲完为止');
  });

  it('编导设了时长：严格按设定，口播在设定的 90%～100% 之间（30 秒 → 135～150 字）', () => {
    const rule = scriptLengthRule('30秒');
    expect(rule).toContain('严格按 30秒 写');
    expect(rule).toContain('不超过约 150 字');
    expect(rule).toContain('口播约 135～150 字');
    expect(rule).not.toContain('AI');
  });

  it('编导设了 90 秒：按 90 秒写，口播约 405～450 字，不是默认区间', () => {
    const rule = scriptLengthRule('90秒');
    expect(rule).toContain('口播约 405～450 字');
    expect(rule).not.toContain(AI_SCRIPT_TARGET_TEXT);
  });

  it('脚本提示词：AI 推荐写「讲完为止」；设了 60 秒就写 60 秒，不写讲完为止', () => {
    const base = { topic: '一元火锅怎么点', platform: '抖音', context: '', source: '', requirements: '', settings: {} };
    const ai = buildAdaptiveScriptPrompt({ ...base, duration: 'AI推荐' });
    expect(ai).toContain(`AI 推荐，${AI_SCRIPT_LENGTH_RULE}`);
    expect(ai).not.toContain('约 90～100 秒');
    const fixed = buildAdaptiveScriptPrompt({ ...base, duration: '60秒' });
    expect(fixed).toContain('严格按 60秒 写');
    expect(fixed).not.toContain(AI_SCRIPT_TARGET_TEXT);
  });
});

describe('脚本提示词：时长口径跟着设置走', () => {
  const base = { topic: '一元火锅怎么点', platform: '抖音', context: '', source: '', requirements: '', settings: {} };

  it('显式 30 秒：提示词写严格按 30 秒，没有「偏长没关系」', () => {
    const prompt = buildAdaptiveScriptPrompt({ ...base, duration: '30秒' });
    expect(prompt).toContain('严格按 30秒 写');
    expect(prompt).not.toContain('偏长没关系');
  });

  it('第 4 步不教刷评论、小号预埋这类操纵数据的做法', () => {
    const prompt = buildAdaptiveScriptPrompt({ ...base, duration: 'AI推荐' });
    expect(prompt).toContain('不写刷评论、小号预埋评论、买赞买粉');
  });

  it('AI 推荐：按内容讲完为止，且效果最佳的要求写在前面的内容质量里', () => {
    const prompt = buildAdaptiveScriptPrompt({ ...base, duration: 'AI推荐' });
    expect(prompt).toContain('按内容讲完为止');
    expect(prompt).toContain('效果最佳优先');
    expect(prompt).not.toContain('严格按');
  });
});
