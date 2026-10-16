/**
 * 2026-10-16 摸底考试后的检查程序修复（docs/摸底考试_20261016/摸底考试报告.md 第七节）。
 * 每条都用摸底时真实出现过的句子来钉，误报和漏报两边都要守住。
 */
import { describe, it, expect } from 'vitest';
import { sectionHeading } from '@/lib/quality-regression';
import { unsupportedFacts, runQualityChecks, stripSelfCheck } from '@/lib/quality-checks';
import { findExcludedMentions } from '@/lib/interview-exclusions';
import { reconcileReviewScores } from '@/lib/result-reconciliation';

describe('审稿评分：页面端重算，和表格合计对齐', () => {
  it('摸底 02 题：表格合计 23 分，结论里「调整至 3.5 分」改成合计对应的分数', () => {
    const md = [
      '| 维度 | 得分/权重 | 问题 |',
      '|---|---|---|',
      '| 核心目的与开场钩子 | 4/20 | a |',
      '| 信息递进与情绪波点适配 | 2/20 | b |',
      '| 事实与证据 | 0/20 | c |',
      '| 表达与人设 | 6/15 | d |',
      '| 拍摄执行与时长 | 8/15 | e |',
      '| 收束与目的兑现 | 3/10 | f |',
      '**合计：23/100 → 最终得分 2.3 分**',
      '**修正：上表实际合计 23 分，但考虑用户明确要求改年限这一核心事实错误已在优化稿中落实，调整至 3.5 分（仍属不合格）**',
    ].join('\n');
    const out = reconcileReviewScores(md);
    expect(out).toContain('合计：23 / 100 → 2.3 / 10');
    expect(out).not.toMatch(/调整至\s*3\.5\s*分/);
    expect(out).toContain('最终合计为2.3分');
  });
});

describe('小节标题：带括号的时长标注不算缺失', () => {
  it('「## 开篇（0-5秒）」「## 开篇：0-5秒」「## 开篇」都认得', () => {
    expect(sectionHeading('开篇').test('## 开篇（0-5秒）')).toBe(true);
    expect(sectionHeading('开篇').test('## 开篇：0-5秒')).toBe(true);
    expect(sectionHeading('开篇').test('## 开篇')).toBe(true);
    expect(sectionHeading('开头').test('## 开头（金钱型钩子+场景切入）')).toBe(true);
  });
  it('「## 选题1【流量型·起号36计】」这种方括号标注也算（2026-10-16 复跑：美甲选题被误判缺失）', () => {
    expect(sectionHeading('选题1').test('## 选题1【流量型·起号36计·第31计】')).toBe(true);
  });
  it('真的写错字的标题（「开築」）仍然认不出，这是模型的错，不能放过', () => {
    expect(sectionHeading('开篇').test('## 开築')).toBe(false);
  });
});

describe('叙述性编造：顾客反馈、复购结果、经营承诺、个人经历', () => {
  const promptOutput06 = '好多客人第一次来，就冲着能不能便宜点，我说：你先尝，不好吃不要钱。结果呢？吃完了跟我说，这个价格，在成都都不一定吃得到。现在不少人变成了老客，隔三差五就过来，还带朋友。';
  it('06 题原文：顾客反馈、「不好吃不要钱」、老客复购都能抓到', () => {
    const issues = unsupportedFacts(promptOutput06, '');
    expect(issues.some((x) => x.startsWith('顾客见证') && x.includes('吃完了跟我说'))).toBe(true);
    expect(issues.some((x) => x.startsWith('经营承诺') && x.includes('不好吃不要钱'))).toBe(true);
    expect(issues.some((x) => x.startsWith('顾客见证') && x.includes('变成了老客'))).toBe(true);
  });
  it('04 题原文：「之前在别的店做过」是没有出处的个人经历', () => {
    const issues = unsupportedFacts('我在杭州待了2年，之前在别的店做过，知道很多女生想做美甲但觉得贵。', '');
    expect(issues.some((x) => x.startsWith('个人经历') && x.includes('之前在别的店做过'))).toBe(true);
  });
  it('资料里本来就有的，照用不算编', () => {
    const issues = unsupportedFacts('我在杭州待了2年，之前在别的店做过。', '我在杭州待了2年，之前在别的店做过');
    expect(issues.some((x) => x.startsWith('个人经历'))).toBe(false);
  });
  it('正常的说法不误报：回头客比一单利润重要、吃完饭再拍', () => {
    const clean = '做了5年美甲，我还是觉得，回头客比一单利润重要。吃完饭再来拍，我想你下次还来。';
    expect(unsupportedFacts(clean, '').filter((x) => /顾客见证|经营承诺|个人经历/.test(x))).toEqual([]);
  });
});

describe('模型对照事实卡的自检复述，不算交付内容', () => {
  it('「- 事实卡严格遵守：「开店2年」」被剔掉，不再拿它和事实卡比年限', () => {
    const text = '正文一句话。\n- 事实卡严格遵守:「在苏州3年」「开店2年」「从业12年」分别对应\n';
    expect(stripSelfCheck(text)).not.toContain('开店2年');
  });
});

describe('只提醒、不判不通过的几类', () => {
  it('模型自称「自检通过」只提醒：页面会删掉这句，内容本身没错就不判不通过', () => {
    const result = runQualityChecks({ output: '这是一段正常的口播。无编造，自检通过。', taskType: '脚本生成', profile: null, source: '这是一段正常的口播。' });
    const selfCert = result.issues.filter((i) => i.detail.startsWith('模型自称'));
    expect(selfCert.length).toBeGreaterThan(0);
    expect(selfCert.every((i) => i.blocking === false)).toBe(true);
    expect(result.passed).toBe(true);
  });
  it('自称自检通过，同时正文真有编造，仍然判不通过', () => {
    const result = runQualityChecks({ output: '吃完了跟我说，这个价格很便宜。无编造，自检通过。', taskType: '脚本生成', profile: null, source: '' });
    expect(result.passed).toBe(false);
  });
});

describe('排除清单：整段命中算数，单个切碎的片段只提醒', () => {
  const excluded = ['公益营销：给贫困户送米面油，联系村书记对接'];
  it('整段短词（冒号前的要点题目）命中：判数（强）', () => {
    const hits = findExcludedMentions('这一条咱们搞一次公益营销活动', excluded);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].strong).toBe(true);
  });
  it('只撞上一个三字片段命中：只提醒（不强）', () => {
    const hits = findExcludedMentions('我们这个月的村书记换了人，大家都在聊', excluded);
    expect(hits.every((h) => h.strong === false)).toBe(true);
  });
});
