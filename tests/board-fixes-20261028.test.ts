/**
 * 四板块评估后的修复（2026-10-28）：
 * - 内容规划：「先别做 / 不宜」是提醒，不当成编造；事实护栏替换句子时留着行首的编号和标签。
 * - 创作方向：代码给每个方向分一件大众大事和主切入维度，20 个方向里同一件最多出现两次。
 * - 脚本：一个小改动推到人的气质、整个人，现实检查要认出来。
 */
import { describe, expect, it } from 'vitest';
import { holdUnsupported, PENDING_MARK } from '@/lib/evidence-guard';
import { isNegatedLine } from '@/lib/output-guard';
import { isUnrealisticSentence } from '@/lib/reality-check';
import { assignElementPatterns, topicSlotsBlock } from '@/lib/topic-slots';
import { viralElementPrompt } from '@/lib/viral-elements';
import { buildReviewPrompt } from '@/lib/review-standards';

describe('内容规划：「先别做」是提醒', () => {
  it('「先别做……不宜编造」这一行算否定语境，事实护栏不碰它', () => {
    const line = '1. **先别做虚构客户案例或夸张改造内容**：档案里没有真实客户案例，不宜为了看点编造结果。';
    expect(isNegatedLine(line)).toBe(true);
    const r = holdUnsupported(line, () => ['客户故事']);
    expect(r).toEqual({ text: line, held: 0 });
  });
});

describe('事实护栏：只换有问题的那一句，编号和标签留着', () => {
  const flagged = (t: string) => (t.includes('上周来了一位客户') ? ['客户故事'] : []);

  it('「1. **标题**：」后面的句子有问题：换成占位，编号和标题还在', () => {
    const r = holdUnsupported('1. **老客回访**：上周来了一位客户说很满意。', flagged);
    expect(r.text).toBe(`1. **老客回访**：${PENDING_MARK}`);
    expect(r.held).toBe(1);
  });

  it('「- 标签：」也一样', () => {
    const r = holdUnsupported('- 取材：上周来了一位客户说很满意。拍店里的试衣过程。', flagged);
    expect(r.text).toBe(`- 取材：${PENDING_MARK}拍店里的试衣过程。`);
  });

  it('问题在标签本身、正文没问题：按整行处理，不放过', () => {
    const r = holdUnsupported('- **上周来了一位客户**：拍店里的试衣过程。', flagged);
    expect(r.text).toBe(PENDING_MARK);
  });
});

describe('选题：同一批里句式不重复，负面句式不落在自家的货上', () => {
  it('4 条都分到怀旧和最差：怀旧的 3 个句式先各用一次，最差的 4 个句式各用一次', () => {
    const slots = Array.from({ length: 4 }, (_, i) => ({ no: i + 1, role: '流量型', audience: '', elements: ['怀旧', '最差'], reason: '', angle: '', tactic: '', hook: '' }));
    const p = assignElementPatterns(slots);
    expect(new Set(p.slice(0, 3).map((x) => x[0])).size).toBe(3);
    expect(new Set(p.map((x) => x[1])).size).toBe(4);
    // 2026-10-29：分配表只给候选元素，不再给每条指定句式（硬套句式出了「世界上最贵的衣服，贵在闲置？」）
    expect(topicSlotsBlock(slots)).toContain('候选 怀旧、最差（挑最贴这条话题的用，不贴就换一个更贴的）');
    expect(topicSlotsBlock(slots)).not.toContain('（句式：');
  });

  it('元素规则写明：负面句式说的是市面上常见的、旧式的东西，不是这家店在卖的货', () => {
    expect(viralElementPrompt(['worst'])).toContain('不能是这家店自己在卖的货');
  });
});

describe('审稿：合规问题不受改动范围限制', () => {
  it('只要求改年限，也要把绝对化用语、功效宣称、站外导流改掉', () => {
    const p = buildReviewPrompt({ draftContent: '我们是全城最正宗的川味串串！加微信领优惠。', platform: '抖音', duration: '30秒', scriptType: '', reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: true, personalRequirements: '原稿年限写错了，按事实卡改' } as never);
    expect(p).toContain('合规问题例外，不受改动范围限制');
    expect(p).toContain('站外导流');
  });
});

describe('脚本：小改动推到人的气质', () => {
  it('「细节一动，气质也会跟着变一点」要认出来', () => {
    expect(isUnrealisticSentence('同一件衣服，细节一动，气质也会跟着变一点。')).toBe(true);
    expect(isUnrealisticSentence('扣子一解开，整个人就不一样了。')).toBe(true);
  });

  it('只说画面上哪一处变了，不误伤', () => {
    expect(isUnrealisticSentence('解开一颗扣子，领口那里松了一点。')).toBe(false);
    expect(isUnrealisticSentence('靠垫换了，腰后那一块贴住了。')).toBe(false);
  });
});
