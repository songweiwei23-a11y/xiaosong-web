/**
 * 体检里的现实检查（2026-10-28）：创作类板块写了「一个小变量推大结论」「一次反应推成普遍道理」这类说法，
 * 体检要标出来；拆解是在分析别人的视频、自由对话是闲聊，不查。不分行业。
 */
import { describe, it, expect } from 'vitest';
import { runQualityChecks, QUALITY_LABELS } from '@/lib/quality-checks';

const OVERREACH = '同一件大码外套，扣子解开一颗，穿出来的人气质完全不同。';
const ONE_CASE_TO_ALL = '一位客户说舒服，就说明挑沙发所有人都要试靠垫。';

describe('体检：现实检查', () => {
  it('创作类板块（脚本、选题、标题）写了不符合现实的说法，要标 reality', () => {
    for (const taskType of ['脚本生成', '选题策划', '标题封面']) {
      const kinds = runQualityChecks({ output: `${OVERREACH}\n${ONE_CASE_TO_ALL}`, profile: null, taskType }).issues.map((i) => i.kind);
      expect(kinds).toContain('reality');
    }
  });

  it('不符合现实的说法算挡交付的问题（passed 为 false）', () => {
    expect(runQualityChecks({ output: ONE_CASE_TO_ALL, profile: null, taskType: '脚本生成' }).passed).toBe(false);
  });

  it('正常的说法不标', () => {
    const r = runQualityChecks({ output: '这一次试坐，客户说比刚才舒服，我们只记录这一次的反应。', profile: null, taskType: '脚本生成' });
    expect(r.issues.map((i) => i.kind)).not.toContain('reality');
  });

  it('拆解和自由对话不查现实（分析别人的视频、闲聊）', () => {
    for (const taskType of ['拆解爆款', '自由对话']) {
      const kinds = runQualityChecks({ output: ONE_CASE_TO_ALL, profile: null, taskType }).issues.map((i) => i.kind);
      expect(kinds).not.toContain('reality');
    }
  });

  it('标签有中文说明，夜间回归的看板能看懂', () => {
    expect(QUALITY_LABELS.reality).toMatch(/不符合现实/);
  });
});
