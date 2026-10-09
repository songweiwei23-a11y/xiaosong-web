/**
 * 「AI 推荐」不设上限（2026-10-06 产品方）：
 * 编导选了 AI 推荐、或者什么都没选，要的是质量最好的结果——不偷偷填 60 秒、不拿 60 秒范例带节奏、
 * 不按平台写死时长；跳到下一个板块也不替编导定。选了什么就按选的来。
 */
import { describe, expect, it } from 'vitest';
import { resolveCreationSettings } from '@/lib/creation-settings';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { buildStoryboardPrompt, auditStoryboard, FOLLOW_SCRIPT } from '@/lib/storyboard-standards';
import { AI_LENGTH_RULE } from '@/lib/ai-recommend';
import { readCode } from './helpers/source';

const ctx = { profile: { video_duration: ['30-60秒'], account_platform: ['抖音'] } as never, positioning: null, dealReasons: [] };

describe('跳到下一个板块：时长不替编导定', () => {
  it('上一页选了 AI 推荐 → 下一页没有时长（=AI 推荐），不再变成 60 秒或档案的常拍时长', () => {
    const s = resolveCreationSettings({ from: '脚本生成', sourceContent: '一条没写时长的脚本', settings: { duration: 'AI推荐' } }, ctx);
    expect(s.duration).toBeUndefined();
  });

  it('编导选了 / 稿子里写明了时长，照带', () => {
    expect(resolveCreationSettings({ from: '脚本生成', settings: { duration: '90秒' } }, ctx).duration).toBe('90秒');
    expect(resolveCreationSettings({ from: '脚本生成', sourceContent: '**建议时长：110秒**\n正文' }, ctx).duration).toBe('110秒');
  });

  it('真实链路：创作方向 → 脚本，方向里没写时长，脚本页拿到的是空（AI 推荐）', () => {
    const handed = buildCreationHandoff('direction', 'script', '### 方向1：按预算配全屋\n- **视频目的**：变现型\n- **核心思路**：带客人按预算挑', {});
    expect(resolveCreationSettings(handed, ctx).duration).toBeUndefined();
  });
});

describe('各板块页面', () => {
  it('脚本页：默认 AI 推荐；带过来没时长就切到 AI 推荐；智能推荐不再按平台写死时长', () => {
    const page = readCode('app/dashboard/script/page.tsx');
    expect(page).toMatch(/useState<"preset" \| "custom" \| "ai">\("ai"\)/);
    expect(page).toMatch(/if \(!s\.duration\) setDurationMode\('ai'\)/);
    expect(page).not.toMatch(/setDurationMode\("preset"\); setDuration\("60秒"\)/);
    // AI 推荐时：时长不限、以效果为准；不压缩；不拿 60 秒范例
    expect(page).toMatch(/时长不限，以效果最好为准：\$\{AI_LENGTH_RULE\}/);
    expect(page).toMatch(/const durationForCalc = isAiDuration \? "" : finalDuration/);
  });

  it('审稿页：带过来没时长保持 AI 推荐', () => {
    expect(readCode('app/dashboard/review/page.tsx')).toMatch(/setDuration\(s\.duration \?\? AI_DURATION\)/);
  });

  it('二创页：带过来没时长保持「跟原片」，且「跟原片」不卡死长度', () => {
    expect(readCode('app/dashboard/remix/page.tsx')).toMatch(/setDuration\(\(s\.duration \?\? '跟原片'\) as RemixDuration\)/);
    expect(readCode('lib/remix.ts')).toMatch(/参考原片的长度，但不卡死/);
  });

  it('知识库查询不再写死 60 秒', () => {
    expect(readCode('app/dashboard/knowledge/page.tsx')).not.toMatch(/duration: "60秒"/);
  });

  it('选题不再「严格控制在220字以内」', () => {
    expect(readCode('app/dashboard/topic/page.tsx')).not.toMatch(/严格控制在220字以内/);
  });

  it('AI 推荐的口径：先保证内容精彩，不压缩、不注水，偏长交给审稿去缩', () => {
    expect(AI_LENGTH_RULE).toMatch(/不为了短而压缩或删减/);
    expect(AI_LENGTH_RULE).toMatch(/不注水/);
    expect(AI_LENGTH_RULE).toMatch(/审稿优化里缩/);
  });
});

describe('分镜：默认按脚本长度，台词一句不删', () => {
  const script = '这家人预算只有X万，一进店就说李老师我们钱不多你看着给配吧。'.repeat(20); // 约 600 字 ≈ 120 秒
  const base = { scriptContent: script, platform: '抖音', contentType: 'talking', visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '' };

  it('页面默认「按脚本长度」，带过来没时长也是它', () => {
    const page = readCode('app/dashboard/storyboard/page.tsx');
    expect(page).toMatch(/useState\(FOLLOW_SCRIPT\)/);
    expect(page).toMatch(/setDuration\(s\.duration \?\? FOLLOW_SCRIPT\)/);
  });

  it('按脚本长度：目标按台词算、不让删台词、不要求凑某个总数', () => {
    const prompt = buildStoryboardPrompt({ ...base, duration: FOLLOW_SCRIPT });
    expect(prompt).toMatch(/按脚本台词实际要念的长度排（约 1\d\d 秒）。台词一句不删/);
    expect(prompt).not.toMatch(/口播时长超出目标/);
    expect(prompt).not.toMatch(/正好等于/);
  });

  it('编导选了 60 秒：照 60 秒排（超了会提示哪几句可删——那是编导自己要的）', () => {
    const prompt = buildStoryboardPrompt({ ...base, duration: '60秒' });
    expect(prompt).toMatch(/目标时长：60秒（60 秒）/);
    expect(prompt).toMatch(/口播时长超出目标/);
  });

  it('核对分镜表：按脚本长度时拿脚本算目标，不拿 60 秒', () => {
    const table = '| 1 | 中景 | 固定 | 画面 | 台词 | 60 | 要点 |\n| 2 | 中景 | 固定 | 画面 | 台词 | 60 | 要点 |';
    const audit = auditStoryboard(table, FOLLOW_SCRIPT, script)!;
    expect(audit.target).toBeGreaterThan(100);
    expect(audit.issues.join()).not.toMatch(/比目标多/);
  });
});
