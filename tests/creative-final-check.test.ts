import { describe, expect, it } from 'vitest';
import { creativeCraftRules, creativeFinalCheck } from '@/lib/creative-craft';
import { unsupportedFacts } from '@/lib/quality-checks';

const unknown = '尚未采访，没有采访结果或已知答案。';

describe('发布后采访事实回归', () => {
  it('错误示范中的价格、比例和经历不混入事实提醒，下一节标题仍检查', () => {
    const answer = '# 不可用示范\n❌ 我问了一圈，每家答案都不一样。\n❌ 老板说每天少了200块，90%的店主都如此。\n# 标题候选\n1. 我问了这条街5家店：国庆前后生意有什么变化';
    const flags = unsupportedFacts(answer, unknown);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toContain('问了这条街5家店');
  });
  it('在虚构候选后加采访后可用仍提醒，真实材料可以支持同一句', () => {
    const answer = '# 标题候选\n1. 我问了这条街5家店（采访后可用）';
    expect(unsupportedFacts(answer, unknown).join('|')).toContain('采访经历');
    expect(unsupportedFacts(answer, '实际采访记录：我问了这条街5家店')).toEqual([]);
  });
  it('一致或不同的条件分支可以保留，确定差异的候选仍提醒', () => {
    expect(unsupportedFacts('如果每家答案不一样，分别核对各自的依据。', unknown)).toEqual([]);
    expect(unsupportedFacts('标题：老板们感受居然不一样', unknown).join('|')).toContain('采访结果');
  });
  it('区间和否定服务承诺不误报，真实地名与新增承诺仍提示', () => {
    expect(unsupportedFacts('统一相同时间区间，不承诺免费测量，也不建议加免费设计。', '')).toEqual([]);
    expect(unsupportedFacts('郑州市免费设计，保证服务。', '').join('|')).toMatch(/地名.*郑州市/);
    expect(unsupportedFacts('郑州市免费设计，保证服务。', '').join('|')).toContain('经营承诺');
  });
  it('未经确认的实际价格和百分比不会因相邻反例消失', () => {
    const flags = unsupportedFacts('❌ 每天少了200块。\n实际文案：我们人均68元，90%的顾客满意。', '');
    expect(flags.join('|')).toContain('68元');
    expect(flags.join('|')).toContain('90%');
  });
});

describe('服务端最终创作约束的适用范围', () => {
  it('未标记请求与高阶自由对话不增加创作约束', () => {
    expect(creativeFinalCheck('请比较两种服务器配置')).toBe('');
    expect(creativeFinalCheck('【高阶自由对话】【本轮内容落实规则】请研究采访方法')).toBe('');
  });
  it('演示任务保留执行和技术边界，不增加采访事实假设', () => {
    const q = creativeCraftRules({ intent: '用真实样柜演示开合，不要采访。' });
    const tail = creativeFinalCheck(q);
    expect(tail).toContain('估算不能替代测量');
    expect(tail).not.toContain('采访有没有真做过');
  });
  it('真实采访摘要不被要求虚假回退为尚未采访', () => {
    const q = creativeCraftRules({ intent: '采访两家店主，已有真实采访摘要，按记录写视频。' });
    const tail = creativeFinalCheck(q);
    expect(tail).toContain('真实采访摘要、记录或原话均可据实使用');
    expect(tail).not.toContain('没有给出真实的采访实录（受访者的原话），那采访就还没做');
  });
});
