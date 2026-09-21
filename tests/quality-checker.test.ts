import { describe, it, expect } from 'vitest';
import { findForbiddenOpenings, evaluateScriptQualityStrict, getRelevantExample } from '@/lib/quality-checker';

describe('废话开场检测', () => {
  it('开头真的用了废话开场 -> 判违规', () => {
    expect(findForbiddenOpenings('大家好我是小宋，今天给大家分享三个技巧。')).toContain('大家好我是');
  });

  it('开头引用为反面教材 -> 豁免', () => {
    expect(findForbiddenOpenings('❌ 错误示范："大家好我是XX"，观众直接划走。')).toHaveLength(0);
    expect(findForbiddenOpenings('不会的呢？镜头一开就是"大家好我是XX"。')).toHaveLength(0);
  });

  it('中后段出现 -> 不算开场违规', () => {
    const s = 'x'.repeat(600) + '很多人开头就是大家好我是XX，这样不行。';
    expect(findForbiddenOpenings(s)).toHaveLength(0);
  });
});

describe('修复后的范例自评', () => {
  it('teach_60s 范例应当及格', () => {
    const r = evaluateScriptQualityStrict(getRelevantExample('teach', '60秒', 'compare'));
    console.log(`teach_60s: 得分 ${r.score} 等级 ${r.level} 通过 ${r.passCheck}`);
    console.log('剩余问题: ' + (r.issues.join(' | ') || '无'));
    expect(r.passCheck).toBe(true);
  });
});
