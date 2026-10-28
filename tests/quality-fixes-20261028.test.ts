/**
 * 2026-10-28 回归里查出的三处误报/漏报：
 * - 「最火」是广告法绝对化用语，线上生成后要替换（之前没有这一条，原样交付了）
 * - 「在南乐开店 3 年」里的 3 年是店龄，不是对不上的居住年限
 * - 「顾客见证，不代替顾客说感受」是否定的提醒，不是编出来的顾客见证
 */
import { describe, it, expect } from 'vitest';
import { sanitizeOutput } from '@/lib/output-guard';
import { yearConflicts, runQualityChecks } from '@/lib/quality-checks';

describe('生成后整理：「最火」替换成「很火」', () => {
  it('选题里的「当年最火的X」改成「当年很火的X」，别的字不动', () => {
    expect(sanitizeOutput('当年最火的校服外套，为什么现在穿出门就没面子？', '选题策划')).toBe('当年很火的校服外套，为什么现在穿出门就没面子？');
  });
});

describe('年限：居住年限字段里写的店龄', () => {
  const persona = { yearsInTrade: '做大码女装 6 年', yearsLocal: '在南乐开店 3 年' };

  it('「女装6年、在南乐开店3年」不误报', () => {
    expect(yearConflicts('店主女装6年、在南乐开店3年，手上的活一直没停。', persona)).toEqual([]);
  });

  it('开店年数写错了还是要报', () => {
    expect(yearConflicts('店主在南乐开店 8 年，一直守着这条街。', persona).length).toBeGreaterThan(0);
  });
});

describe('顾客见证：否定的提醒不算编的', () => {
  it('「顾客见证，不代替顾客说感受」不报 facts', () => {
    const r = runQualityChecks({ output: '顾客见证，不代替顾客说感受。\n口播：这一次只讲店里怎么做。', profile: null, taskType: '选题策划' });
    expect(r.issues.filter((i) => i.kind === 'facts')).toEqual([]);
  });

  it('真的编了一句顾客的话还是要报', () => {
    const r = runQualityChecks({ output: '口播：很多客人都说这里的串好吃。', profile: null, taskType: '脚本生成' });
    expect(r.issues.map((i) => i.kind)).toContain('facts');
  });
});
