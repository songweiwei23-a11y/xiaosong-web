import { describe, it, expect } from 'vitest';
import { nextSteps, factsFromBody, type NextStepFacts } from '@/lib/next-steps';
import { CREATION_SOURCES } from '@/lib/creation-flow';

const base: NextStepFacts = { hasProfile: true, hasPlaceholder: false, hasScript: false, hasShots: false, hasStructure: false, isVideo: false };

describe('下一步建议：拆解的目的是二创', () => {
  it('拆出了二创结构、有档案、是视频：先写脚本，再选题，再分镜，按优先级排', () => {
    const plan = nextSteps('breakdown', { ...base, hasStructure: true, isVideo: true });
    // 拆解的目的是二创：第一步去跨行业二创，再写脚本、选题；视频的分镜排在三条之后
    expect(plan.steps.map((s) => s.target)).toEqual(['remix', 'script', 'topic']);
    expect(plan.steps.map((s) => s.priority)).toEqual([1, 2, 3]);
    expect(plan.steps[0].reason).toContain('二创结构');
    expect(plan.hint).toBeUndefined();
  });

  it('没有档案：给出提示，告诉用户选好档案才会套到账号上', () => {
    const plan = nextSteps('breakdown', { ...base, hasProfile: false, hasStructure: true });
    expect(plan.hint).toContain('选好档案');
  });

  it('没有二创结构：先把爆点拆成选题，再写脚本', () => {
    const plan = nextSteps('breakdown', { ...base, hasStructure: false });
    expect(plan.steps.map((s) => s.target)).toEqual(['topic', 'script']);
  });
});

describe('下一步建议：按编导的创作顺序', () => {
  it('脚本里还有待确认的内容：先审稿核对，再进分镜或发布', () => {
    const plan = nextSteps('script', { ...base, hasPlaceholder: true, hasScript: true, isVideo: true });
    expect(plan.steps[0]).toMatchObject({ target: 'review', priority: 1 });
    expect(plan.steps[0].reason).toContain('待确认');
  });

  it('选题之后最适合去写脚本，开头和标题排在后面', () => {
    const plan = nextSteps('topic', base);
    expect(plan.steps.map((s) => s.target)).toEqual(['script', 'growth', 'title']);
  });

  it('定位之后去选题；没有档案时给提示', () => {
    expect(nextSteps('positioning', base).steps[0].target).toBe('topic');
    expect(nextSteps('positioning', { ...base, hasProfile: false }).hint).toBeTruthy();
  });

  it('建议最多 3 条，目标不重复，优先级从 1 连续编号', () => {
    const plan = nextSteps('remix', { ...base, isVideo: true });
    expect(plan.steps.length).toBeLessThanOrEqual(3);
    expect(new Set(plan.steps.map((s) => s.target)).size).toBe(plan.steps.length);
    expect(plan.steps.map((s) => s.priority)).toEqual(plan.steps.map((_, i) => i + 1));
  });
});

describe('下一步建议：其他板块也要有', () => {
  it('每个创作板块都至少给出一条建议，理由不为空', () => {
    for (const source of Object.keys(CREATION_SOURCES)) {
      const plan = nextSteps(source, base);
      expect(plan.steps.length, source).toBeGreaterThan(0);
      for (const s of plan.steps) expect(s.reason.trim(), source).not.toBe('');
    }
  });
});

describe('从结果正文认出信号', () => {
  it('认出待确认、口播、镜头、二创结构', () => {
    const f = factsFromBody('【二创结构 · 模版1】\n第2步：纯文字文案\n镜头 1 近景 【待确认：店名】', 'breakdown', true);
    expect(f.hasPlaceholder).toBe(true);
    expect(f.hasScript).toBe(true);
    expect(f.hasShots).toBe(true);
    expect(f.hasStructure).toBe(true);
    expect(f.isVideo).toBe(true);
  });

  it('普通的选题列表不算视频，也没有待确认', () => {
    const f = factsFromBody('1. 选题一\n2. 选题二', 'topic', true);
    expect(f.hasPlaceholder).toBe(false);
    expect(f.isVideo).toBe(false);
  });
});
