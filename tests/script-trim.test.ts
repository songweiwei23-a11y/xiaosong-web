import { describe, it, expect } from 'vitest';
import { trimSpokenStep, spokenStep } from '@/lib/script-repair';

// 每句 10 个汉字 + 句号
const S = '一二三四五六七八九十。';
const step2 = (sentences: number) => `## 第1步：脚本策略卡\n策略。\n\n## 第2步：纯文字文案\n${Array(sentences).fill(S).join('')}\n\n## 第3步：完整分镜脚本\n镜头一。`;

describe('口播本地裁剪：只删句子，不改字', () => {
  it('未超预算：原样返回', () => {
    const text = step2(5);
    expect(trimSpokenStep(text, 100)).toBe(text);
  });

  it('超预算：裁到预算以内，保留第一句（钩子）和最后一句（收尾）', () => {
    const out = trimSpokenStep(step2(12), 50);
    const n = spokenStep(out);
    expect(n).not.toBeNull();
    expect(n!).toBeLessThanOrEqual(50);
    // 第一句与最后一句都在
    expect(out.indexOf(S)).toBeGreaterThan(-1);
    expect(out.lastIndexOf(S)).toBeGreaterThan(out.indexOf(S));
  });

  it('其他步骤原样保留', () => {
    const out = trimSpokenStep(step2(12), 50);
    expect(out).toContain('## 第1步：脚本策略卡\n策略。');
    expect(out).toContain('## 第3步：完整分镜脚本\n镜头一。');
  });

  it('没有第 2 步纯文字文案：原样返回', () => {
    const text = '## 第1步：脚本策略卡\n策略。\n## 第2步：候选方向\n方向一。';
    expect(trimSpokenStep(text, 5)).toBe(text);
  });

  it('首尾两句本身就超预算：只保留第一句；第一句也超就原样返回', () => {
    const out = trimSpokenStep(step2(6), 15);
    expect(spokenStep(out)!).toBeLessThanOrEqual(15);
    expect(trimSpokenStep(step2(6), 5)).toBe(step2(6));
  });
});
