import { describe, it, expect } from 'vitest';
import {
  ADVICE_TYPE,
  ADVICE_PURPOSES,
  ADVICE_STAGES,
  buildIndustryAdvicePrompt,
  adviceContextBlock,
  purposeLabel,
  stageLabel,
} from '@/lib/industry-advice';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';
import { BOARD_MANIFESTS, type Board } from '@/lib/context-manifest';

const ALL_BOARDS: Board[] = BOARD_MANIFESTS.map((m) => m.board);

const base = (over: Partial<CreatorContext> = {}): CreatorContext => ({
  profile: null,
  positioning: null,
  dealReasons: [],
  ...over,
});

describe('行业建议 · 选项', () => {
  it('类型名与定位库一致', () => {
    expect(ADVICE_TYPE).toBe('行业建议');
  });

  it('目的和阶段的 key 唯一，标签能反查', () => {
    const purposeKeys = ADVICE_PURPOSES.map((p) => p.key);
    const stageKeys = ADVICE_STAGES.map((s) => s.key);
    expect(new Set(purposeKeys).size).toBe(purposeKeys.length);
    expect(new Set(stageKeys).size).toBe(stageKeys.length);
    expect(purposeLabel('traffic')).toBe('大流量');
    expect(stageLabel('monetize')).toBe('变现期');
    expect(purposeLabel('unknown')).toBe('unknown');
  });
});

describe('行业建议 · 提示词', () => {
  const prompt = buildIndustryAdvicePrompt({
    profileSummary: '- 账号：锦园串串',
    baseline: '六维地基：三个品类都要体现',
    input: { purpose: 'monetize', stage: 'accumulate', situation: '发了 12 条，咨询多', goal: '月咨询 30 人' },
  });

  it('把选定的目的、阶段、现状、结果写进去', () => {
    expect(prompt).toContain('变现型');
    expect(prompt).toContain('积累期');
    expect(prompt).toContain('发了 12 条，咨询多');
    expect(prompt).toContain('月咨询 30 人');
  });

  it('有账号定位时要求与它一致，没有时明确说明', () => {
    expect(prompt).toContain('六维地基：三个品类都要体现');
    const noBaseline = buildIndustryAdvicePrompt({
      profileSummary: 'x',
      input: { purpose: 'traffic', stage: 'start', situation: '' },
    });
    expect(noBaseline).toContain('还没有生成过账号定位');
    expect(noBaseline).toContain('编导未填写');
  });
});

describe('adviceContextBlock', () => {
  it('没有行业建议时返回空串', () => {
    expect(adviceContextBlock(null)).toBe('');
    expect(adviceContextBlock('   ')).toBe('');
  });

  it('超长时在段落边界截断，并标注略', () => {
    const para = '第一段内容。'.repeat(40) + '\n';
    const long = Array.from({ length: 30 }, () => para).join('\n');
    const block = adviceContextBlock(long, 500);
    expect(block).toContain('（以下略）');
    expect(block.length).toBeLessThan(long.length);
  });
});

describe('行业建议 · 注入创作上下文', () => {
  const advice = '## 诊断\n起号期，先找到能起量的一类内容。';

  it('所有创作板块都带上行业建议', () => {
    const ctx = base({ advice });
    const boards = ALL_BOARDS;
    expect(boards.length).toBeGreaterThan(0);
    for (const b of boards) {
      expect(buildContextBlock(ctx, b)).toContain('行业建议（药方）');
    }
  });

  it('没有行业建议时上下文里不出现这一段', () => {
    const ctx = base({ advice: null });
    for (const b of ALL_BOARDS) {
      expect(buildContextBlock(ctx, b)).not.toContain('行业建议（药方）');
    }
  });
});
