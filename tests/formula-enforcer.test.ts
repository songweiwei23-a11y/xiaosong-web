import { describe, it, expect } from 'vitest';
import { recommendFormula, generateFormulaGuide, getFormulaStructure } from '@/lib/formula-enforcer';
import { getRelevantExample, evaluateScriptQualityStrict } from '@/lib/quality-checker';

describe('脚本公式选择', () => {
  it('按脚本类型推荐默认公式', () => {
    expect(recommendFormula('teach')).toBe('compare');
    expect(recommendFormula('recommend')).toBe('recommend');
    expect(recommendFormula('story')).toBe('story');
  });

  it('用户显式选定结构时优先于类型推断', () => {
    expect(recommendFormula('teach', '故事')).toBe('story');
    expect(recommendFormula('teach', '解题型')).toBe('solve');
    expect(recommendFormula('story', '对比型')).toBe('compare');
  });

  it('未知类型回落到最通用的对比型，不会抛错', () => {
    expect(recommendFormula('')).toBe('compare');
    expect(recommendFormula('未知类型', '不存在的结构')).toBe('compare');
  });
});

describe('公式执行指南', () => {
  it('包含分段蓝图所需的各层信息', () => {
    const guide = generateFormulaGuide('compare');
    expect(guide).toContain('时间分配');
    expect(guide).toContain('分段结构');
    expect(guide).toContain('必须包含');
    expect(guide).toContain('执行检查清单');
    // 这是相对 enhance-prompt 的增量所在：具体到秒的分段
    expect(guide).toMatch(/\d+\s*-\s*\d+\s*秒/);
  });

  it('四套公式都能产出足够详细的指南', () => {
    for (const t of ['compare', 'solve', 'recommend', 'story'] as const) {
      const guide = generateFormulaGuide(t);
      expect(guide.length).toBeGreaterThan(600);
      const struct = getFormulaStructure(t);
      // 每个分段都应出现在指南里
      for (const s of struct.sections) expect(guide).toContain(s.name);
    }
  });
});

describe('MCN 参考范例', () => {
  it('能按类型与时长取到范例，且含分段与波点标注', () => {
    const ex = getRelevantExample('teach', '60秒', 'compare');
    expect(ex.length).toBeGreaterThan(500);
    expect(ex).toMatch(/\d+\s*-\s*\d+\s*秒/);
    expect(ex).toContain('台词');
  });

  it('30 秒以内取短范例', () => {
    const ex = getRelevantExample('recommend', '30秒', 'recommend');
    expect(ex.length).toBeGreaterThan(300);
  });

  it('范例自身应能通过质量校验（否则等于拿不达标的东西当范本）', () => {
    const ex = getRelevantExample('teach', '60秒', 'compare');
    const r = evaluateScriptQualityStrict(ex);
    expect(r.passCheck).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(8);
  });
});
