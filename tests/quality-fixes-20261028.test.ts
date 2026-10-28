/**
 * 2026-10-28 回归里查出的三处误报/漏报：
 * - 「最火」是广告法绝对化用语，线上生成后要替换（之前没有这一条，原样交付了）
 * - 「在南乐开店 3 年」里的 3 年是店龄，不是对不上的居住年限
 * - 「顾客见证，不代替顾客说感受」是否定的提醒，不是编出来的顾客见证
 */
import { describe, it, expect } from 'vitest';
import { sanitizeOutput } from '@/lib/output-guard';
import { yearConflicts, runQualityChecks } from '@/lib/quality-checks';

describe('生成后整理：「最火」只在夸自家时换掉，怀旧句式照用', () => {
  it('「当年最火的X」是怀旧元素的句式，原样保留（换成「很火」看点就没了）', () => {
    const t = '当年最火的校服外套，为什么现在穿出门就没面子？';
    expect(sanitizeOutput(t, '选题策划')).toBe(t);
    expect(sanitizeOutput('小时候最火的喇叭裤，现在还能穿吗？', '选题策划')).toBe('小时候最火的喇叭裤，现在还能穿吗？');
  });

  it('夸自家商品的「最火」照样换成「很火」', () => {
    expect(sanitizeOutput('我们店最火的串，今天加量。', '脚本生成')).toBe('我们店很火的串，今天加量。');
  });

  it('「不替顾客保证分量」是否定的提醒，不改成「力求分量」', () => {
    expect(sanitizeOutput('不替顾客保证分量，只说今天怎么做。', '脚本生成')).toBe('不替顾客保证分量，只说今天怎么做。');
  });
});

describe('选题序号：标题行的「选题一」统一成「选题1」，正文里的字不动', () => {
  it('标题行的中文序号改成阿拉伯数字，页面按「选题N」拆分才对得上', () => {
    const out = sanitizeOutput('## 选题一：当年很火的布艺沙发\n正文\n## 选题二：做家具的人\n', '选题策划');
    expect(out).toContain('## 选题1：当年很火的布艺沙发');
    expect(out).toContain('## 选题2：做家具的人');
  });

  it('正文里提到的「选题一」不是标题，不改', () => {
    const body = '这一条是选题一的补充说明，不改。';
    expect(sanitizeOutput(body, '选题策划')).toBe(body);
  });

  it('非选题板块不动序号', () => {
    expect(sanitizeOutput('## 选题一：这是脚本里的小节标题', '脚本生成')).toBe('## 选题一：这是脚本里的小节标题');
  });
});

describe('广告法检查：怀旧句式的「最火」不算绝对化用语', () => {
  it('「当年最火的校服外套」不报；「我们店最火的串」要报', () => {
    const nostalgia = runQualityChecks({ output: '## 选题1：当年最火的校服外套，穿错最没面子', profile: null, taskType: '选题策划' });
    expect(nostalgia.issues.filter((i) => i.kind === 'taboo')).toEqual([]);
    const boast = runQualityChecks({ output: '口播：我们店最火的串，今天加量。', profile: null, taskType: '脚本生成' });
    expect(boast.issues.map((i) => i.kind)).toContain('taboo');
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
