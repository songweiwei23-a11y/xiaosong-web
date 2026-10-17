/**
 * 2026-10-17 跨板块链路验证里抓到的两个误报（都是真实生成的句子）：
 * 「白天自然光最好」被当成违禁词；「叠放区」被当成地名。两条都不能误报，但真的吹嘘还是要抓。
 */
import { describe, it, expect } from 'vitest';
import { scanTaboos } from '@/lib/taboos';
import { unsupportedFacts, runQualityChecks } from '@/lib/quality-checks';

describe('违禁词：拍摄条件的「最好」不算吹嘘', () => {
  it('「白天自然光最好」不报', () => {
    expect(scanTaboos('测光：白天自然光最好，或提前开店内灯光', null).map((h) => h.word)).toEqual([]);
  });
  it('真的吹嘘照样报：「我们家最好」', () => {
    expect(scanTaboos('我们家的串串最好', null).map((h) => h.word)).toEqual(['最好']);
  });
});

describe('经营承诺与占位：补上两类漏抓', () => {
  it('「免费量身高＋试坐」是资料里没有的服务承诺，要报', () => {
    const issues = unsupportedFacts('来店里坐坐，我帮你免费量身高、试不同坐深。', '');
    expect(issues.some((x) => x.startsWith('经营承诺') && x.includes('免费量身高'))).toBe(true);
  });
  it('小节只写了「已按要求提供」占位，判为内容缺失', () => {
    const r = runQualityChecks({ output: '## 起号 36 计\n*(清单已按要求提供)*', taskType: '创作方向', profile: null, source: '' });
    expect(r.issues.some((i) => i.kind === 'generation' && /占位/.test(i.detail))).toBe(true);
    expect(r.passed).toBe(false);
  });
});

describe('地名：店里的功能区不算地名', () => {
  it('「叠放区」不报成地名', () => {
    const issues = unsupportedFacts('第4步：挂衣区、叠放区、被褥区比例要合理。', '');
    expect(issues.filter((x) => x.startsWith('地名'))).toEqual([]);
  });
});

