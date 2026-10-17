/**
 * 2026-10-17 链路验证后的修复（docs/链路验证_20261017/链路验证报告.md）：
 * 1 用户原始处境丢失；2 没有依据的数值标准；3 年限照档案原词；4 占位代替内容。
 * 每条都用真实跑出来的句子钉住。
 */
import { describe, it, expect } from 'vitest';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildReviewPrompt } from '@/lib/review-standards';
import { unsupportedFacts, runQualityChecks } from '@/lib/quality-checks';
import { scanTaboos } from '@/lib/taboos';

const INTENT = '国庆过完这一周店里冷清了，进店的人少了一半。想拍几条视频把客人拉回来，但不想拍成甩卖降价';

describe('1 用户原始处境：方向必须有一条直接回应，脚本要体现', () => {
  it('方向提示词要求：处境要有方向直接回应，并排在方向 1', () => {
    const p = buildDirectionPrompt({ purposes: ['store'], customGoal: INTENT, formats: ['any'], count: 5, depth: 'quick' });
    expect(p).toContain('用户说的具体处境必须有方向直接回应');
    expect(p).toContain('排在方向 1');
  });
  it('脚本提示词：有用户原始处境时，成稿要体现它', () => {
    const p = buildAdaptiveScriptPrompt({
      topic: '帮客人避开家具选购的坑', platform: '抖音', duration: '30秒', context: '', source: '', requirements: '',
      settings: { userIntent: INTENT } as never,
    });
    expect(p).toContain('用户原始处境（成稿必须体现）');
    expect(p).toContain('节后冷清');
  });
});

describe('2 没有依据的数值标准：检查要抓，提示词要禁', () => {
  it('「一米六以下的人，坐深 55 到 60 就够了」没有出处，要报', () => {
    const issues = unsupportedFacts('一米六以下的人，坐深55到60就够了', '');
    expect(issues.some((x) => x.startsWith('数值标准'))).toBe(true);
  });
  it('分镜字幕「屏幕上标注 55-60cm」没有出处，要报', () => {
    const issues = unsupportedFacts('卷尺测量沙发坐深，屏幕上标注55-60cm', '');
    expect(issues.some((x) => x.startsWith('数值标准'))).toBe(true);
  });
  it('资料里有的数字照用，不报', () => {
    const issues = unsupportedFacts('坐深55到60就够了', '档案：坐深55到60厘米是我们的标准');
    expect(issues.filter((x) => x.startsWith('数值标准'))).toEqual([]);
  });
  it('已标【待测量】的不报', () => {
    const issues = unsupportedFacts('坐深【待测量】，屏幕上标注【待测量】', '');
    expect(issues.filter((x) => x.startsWith('数值标准'))).toEqual([]);
  });
  it('脚本提示词禁止用「行业常识」写具体数字', () => {
    const p = buildAdaptiveScriptPrompt({ topic: 'x', platform: '抖音', duration: '30秒', context: '', source: '', requirements: '', settings: {} as never });
    expect(p).toContain('不许用「行业常识」「通用标准」「一般来说」来写具体数字');
  });
  it('分镜提示词：字幕和道具里的数字只能照抄脚本', () => {
    const p = buildStoryboardPrompt({ scriptContent: '店主：坐一坐', platform: '抖音', duration: '30秒', contentType: 'product', visualStyle: 'cinematic', visualStyleLabel: '电影感', additionalInfo: '' });
    expect(p).toContain('数字只能照抄脚本');
  });
  it('审稿：没有依据的数值标准不能给事实维度满分', () => {
    const p = buildReviewPrompt({ draftContent: '坐深55到60', platform: '抖音', duration: '30秒', scriptType: '', reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: true } as never);
    expect(p).toContain('这一项不能给满分');
  });
});

describe('违禁词：写「不写私信、加微信」这类提醒，不算违规', () => {
  it('否定句里的「加微信」不报', () => {
    expect(scanTaboos('- **置顶评论**：店铺地址，不写"私信""加微信"', null).map((h) => h.word)).toEqual([]);
  });
});

describe('3 年限照档案原词', () => {
  it('方向提示词要求：从业、在本地、门店三种年限不能互换', () => {
    const p = buildDirectionPrompt({ purposes: ['store'], customGoal: INTENT, formats: ['any'], count: 5, depth: 'quick' });
    expect(p).toContain('年限照档案原词引用');
    expect(p).toContain('不能互换');
  });
});

describe('4 占位代替内容', () => {
  it('方向提示词：不许写「已按要求提供」这类占位', () => {
    const p = buildDirectionPrompt({ purposes: ['store'], customGoal: INTENT, formats: ['any'], count: 5, depth: 'quick' });
    expect(p).toContain('不要写占位');
  });
  it('输出里有「（清单已按要求提供）」，判为内容缺失', () => {
    const r = runQualityChecks({ output: '## 起号 36 计\n*(清单已按要求提供)*', taskType: '创作方向', profile: null, source: '' });
    expect(r.passed).toBe(false);
  });
});
