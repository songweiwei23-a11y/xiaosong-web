import { describe, it, expect } from 'vitest';
import { AI_LENGTH_RULE, durationCeilingSeconds, durationRule } from '@/lib/ai-recommend';
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

  it('AI 推荐：内容优先，且效果最佳的要求写在前面的内容质量里', () => {
    const prompt = buildAdaptiveScriptPrompt({ ...base, duration: 'AI推荐' });
    expect(prompt).toContain('内容精彩优先');
    expect(prompt).toContain('效果最佳优先');
    expect(prompt).not.toContain('严格按');
  });
});
