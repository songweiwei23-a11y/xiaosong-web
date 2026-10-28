/**
 * 年限修复（2026-10-28，lib/years-repair）：结果里的年数对不上事实卡，只改那一句；
 * 改写要过同一套年限检查才采用，改不好就保留原句。线上和每晚回归都接着同一套修复。
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { yearConflictSentences, yearConflicts } from '@/lib/quality-checks';
import { acceptYearsRepair, repairYears, yearsFactLines, yearsRepairPrompt } from '@/lib/years-repair';
import { needsSentenceRepair } from '@/lib/reality-repair';

const persona = { yearsInTrade: '做大码女装 6 年', yearsLocal: '在南乐开店 3 年' };

describe('整句取法：年限打架的那一整句，带着句首的标签', () => {
  it('取出的是整句（不是几个字的片段），句首的标签也带上', () => {
    const output = '开场先讲店里的事。\n- **店主**：在南乐开店 8 年，一直守着这条街。\n结尾收在一个真实的画面上。';
    expect(yearConflictSentences(output, persona)).toEqual(['- **店主**：在南乐开店 8 年，一直守着这条街。']);
  });

  it('对得上的稿子：没有句子要改', () => {
    expect(yearConflictSentences('店主在南乐开店 3 年，一直守着这条街。', persona)).toEqual([]);
  });

  it('两句各打架，各取一句；同一句里只算一次', () => {
    const output = '店主在南乐开店 8 年。\n我干这行 9 年了，一直没停。\n店主在南乐开店 8 年。';
    expect(yearConflictSentences(output, persona)).toEqual(['店主在南乐开店 8 年。', '我干这行 9 年了，一直没停。']);
  });

  it('和 yearConflicts 用同一套判断：片段有的，整句也有', () => {
    const output = '我干这行 9 年了，一直没停。';
    expect(yearConflicts(output, persona).length).toBeGreaterThan(0);
    expect(yearConflictSentences(output, persona).length).toBe(1);
  });
});

describe('修复：只改那一句，别的一字不动', () => {
  it('正文里的年数改对了：只换这一句，前后的句子原样保留', async () => {
    const text = '开场先讲店里的事。\n店主在南乐开店 8 年，一直守着这条街。\n结尾收在一个真实的画面上。';
    const ask = vi.fn(async () => '店主在南乐开店 3 年，一直守着这条街。');
    const r = await repairYears(text, ask, persona, '脚本生成');
    expect(r).toEqual({
      text: '开场先讲店里的事。\n店主在南乐开店 3 年，一直守着这条街。\n结尾收在一个真实的画面上。',
      tried: 1,
      accepted: 1,
    });
  });

  it('带标签的句子：标签保留，只换正文', async () => {
    const text = '- **店主**：在南乐开店 8 年，一直守着这条街。';
    const r = await repairYears(text, async () => '在南乐开店 3 年，一直守着这条街。', persona);
    expect(r.text).toBe('- **店主**：在南乐开店 3 年，一直守着这条街。');
  });

  it('改写后还是打架：保留原句，不为了改而改坏', async () => {
    const text = '店主在南乐开店 8 年，一直守着这条街。';
    const r = await repairYears(text, async () => '店主在南乐开店 8 年，一直守着这条街。', persona);
    expect(r).toEqual({ text, tried: 1, accepted: 0 });
  });

  it('模型回了多行：不采用，保留原句', async () => {
    const text = '店主在南乐开店 8 年，一直守着这条街。';
    const r = await repairYears(text, async () => '店主在南乐开店 3 年。\n再说一句。', persona);
    expect(r.accepted).toBe(0);
    expect(r.text).toBe(text);
  });

  it('改写明显变长（超出原句一大截）：不采用，防止改成一大段', async () => {
    const text = '我干这行 9 年了，一直没停。';
    const long = '我干这行 6 年了，这些年一直在一线守着，客人越来越多，从来没有停下来过，每天都在琢磨怎么把东西做得更好。';
    const r = await repairYears(text, async () => long, persona);
    expect(r.accepted).toBe(0);
    expect(r.text).toBe(text);
  });

  it('模型没有回答（出错）：保留原句', async () => {
    const text = '我干这行 9 年了，一直没停。';
    const r = await repairYears(text, async () => null, persona);
    expect(r.text).toBe(text);
  });

  it('稿子没有打架：不问模型、不计额度', async () => {
    const ask = vi.fn(async () => '不该被调用');
    const allow = vi.fn(() => true);
    const text = '店主在南乐开店 3 年，一直守着这条街。';
    const r = await repairYears(text, ask, persona, '脚本生成', allow);
    expect(r).toEqual({ text, tried: 0, accepted: 0 });
    expect(ask).not.toHaveBeenCalled();
    expect(allow).not.toHaveBeenCalled();
  });

  it('额度用完：有问题也不改，只能原样交付', async () => {
    const ask = vi.fn(async () => '店主在南乐开店 3 年，一直守着这条街。');
    const text = '店主在南乐开店 8 年，一直守着这条街。';
    const r = await repairYears(text, ask, persona, '脚本生成', () => false);
    expect(r.text).toBe(text);
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('改写的采用标准', () => {
  it('年限对齐、一行、长度合适：采用', () => {
    expect(acceptYearsRepair('店主在南乐开店 8 年。', '店主在南乐开店 3 年。', persona)).toBe('店主在南乐开店 3 年。');
  });

  it('去掉引号和前缀符号后再判断', () => {
    expect(acceptYearsRepair('店主在南乐开店 8 年。', '「店主在南乐开店 3 年。」', persona)).toBe('店主在南乐开店 3 年。');
  });

  it('仍然打架、空回答、多行，都不采用', () => {
    expect(acceptYearsRepair('店主在南乐开店 8 年。', '店主在南乐开店 8 年。', persona)).toBeNull();
    expect(acceptYearsRepair('店主在南乐开店 8 年。', '  ', persona)).toBeNull();
    expect(acceptYearsRepair('店主在南乐开店 8 年。', '店主在南乐开店 3 年。\n又一行', persona)).toBeNull();
  });
});

describe('断句：前一个分句的词不借给这个年数（2026-10-28 回归的两次误报）', () => {
  it('「开店3年、做大码女装6年」：6 年是从业年限，不被「开店」拖成店龄', () => {
    expect(yearConflicts('让观众记住“在南乐开店3年、做大码女装6年”的经营者。', persona)).toEqual([]);
  });

  it('「做家具12年、在苏州3年」：引号和顿号隔开，两个年数各归各', () => {
    const p = { yearsInTrade: '家具从业 12 年', yearsLocal: '来苏州 3 年' };
    expect(yearConflicts('让观众记住“做家具12年、在苏州3年”的这个人。', p)).toEqual([]);
  });

  it('箭头后面的「家具从业12年」：前面的「居住」不借给它', () => {
    const p = { yearsInTrade: '家具从业 12 年', yearsLocal: '来苏州 3 年' };
    expect(yearConflicts('沙发和床的摆放 → 借“坐得住”谈居住状态 → 回到家具从业12年的个人判断。', p)).toEqual([]);
  });

  it('断句之后仍然要认真打架：「开店8年、做大码女装6年」的 8 年还是要报', () => {
    expect(yearConflicts('店主在南乐开店8年、做大码女装6年。', persona).length).toBeGreaterThan(0);
  });
});

describe('提示词：事实卡逐条列给模型，只认这里的年数', () => {
  it('事实卡里的从业、本地、店龄分开列；一句话经历和其他硬事实也列上', () => {
    const facts = yearsFactLines({ yearsInTrade: '做川菜 9 年', yearsLocal: '来南乐半年', story: '在成都做了 9 年川菜，今年来南乐', others: '店开了2年\n每天下午4点出摊' });
    expect(facts).toContain('干这行：做川菜 9 年');
    expect(facts).toContain('在本地：来南乐半年');
    expect(facts).toContain('一句话经历：在成都做了 9 年川菜，今年来南乐');
    expect(facts).toContain('其他硬事实：店开了2年；每天下午4点出摊');
  });

  it('改写的提示词：只改这一句，只输出一行，并且讲清楚三种年数不能互换', () => {
    const p = yearsRepairPrompt('店主在南乐开店 8 年。', '干这行：做大码女装 6 年', '脚本生成');
    expect(p).toContain('只改写下面这一句里的年数');
    expect(p).toContain('只输出改后的这一句');
    expect(p).toContain('干这行：做大码女装 6 年');
    expect(p).toContain('店主在南乐开店 8 年。');
    expect(p).toContain('不能互换');
  });
});

describe('接线：线上和每晚回归都接着年限修复，并且和现实修复同一个闸门', () => {
  it('线上流水线：年限修复在现实修复之前，用同一个板块闸门和额度', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/dify/stream/route.ts'), 'utf8');
    expect(src).toContain("from '@/lib/years-repair'");
    expect(src.indexOf('repairYears(')).toBeGreaterThan(0);
    expect(src.indexOf('repairYears(')).toBeLessThan(src.indexOf('repairReality('));
    expect(src.match(/needsSentenceRepair\(body\.taskType\)/g)?.length).toBe(2);
    expect(src).toContain('() => !sentenceRepairLimited(userId)');
    expect(src).toContain('personaFacts = (full as');
  });

  it('每晚回归的修复：年限修复在现实修复之前，和线上顺序一致', () => {
    const src = readFileSync(join(process.cwd(), 'lib/quality-regression.ts'), 'utf8');
    expect(src.indexOf('repairYears(out')).toBeGreaterThan(0);
    expect(src.indexOf('repairYears(out')).toBeLessThan(src.indexOf('repairReality(out'));
    expect(src).toContain('needsSentenceRepair(task)');
  });

  it('闸门：拆解、自由对话、审稿、标题都不修（和现实修复共用）', () => {
    expect(needsSentenceRepair('选题策划')).toBe(true);
    expect(needsSentenceRepair('拆解爆款')).toBe(false);
  });
});
