/**
 * 档案里的拍摄场地、设备不进创作板块（2026-10-31）：方向、内容规划、创作简报、分镜、选题都不能因为档案带着「棚子」就用它。
 * 用户自己在需求里写了「拍摄场地：…」才用。
 */
import { describe, expect, it } from 'vitest';
import { buildProfileSummary } from '@/lib/profile-summary';
import { buildContextBlock, describeShootingSetup, describeExecutionConstraints, type CreatorContext } from '@/lib/creator-context';
import { resolveCreationSettings, settingsFromText } from '@/lib/creation-settings';

const profile = {
  profile_name: '锦园地摊串串一元火锅',
  account_track: ['美食烹饪', '本地服务'],
  product_category: ['川味串串火锅'],
  team_structure: '2人，老板掌勺、一人出镜',
  equipment: ['手机', '稳定器'],
  shooting_location: ['棚子'],
  budget_per_video: '200元以内',
};

const ctx = { profile, positioning: null, dealReasons: [], advice: null, contentPositioning: null, businessPositioning: null } as unknown as CreatorContext;

describe('档案摘要不带拍摄场地和设备', () => {
  it('创作板块拿的摘要里没有「棚子」，也没有「场地」「设备」两栏', () => {
    const summary = buildProfileSummary(profile as never);
    expect(summary).not.toContain('棚子');
    expect(summary).not.toContain('场地：');
    // 设备（灯光、稳定器）没用，也不带；团队照常带
    expect(summary).not.toContain('设备：');
    expect(summary).toContain('团队');
  });
});

describe('账号背景不带拍摄场地和设备', () => {
  it('分镜、选题、创作方向的账号背景里没有「棚子」', () => {
    for (const board of ['storyboard', 'topic', 'direction', 'freeChat'] as const) {
      expect(buildContextBlock(ctx, board), board).not.toContain('棚子');
    }
  });

  it('拍摄条件和拍摄约束不带场地，也不带设备；团队照常', () => {
    expect(describeShootingSetup(profile as never)).not.toContain('棚子');
    expect(describeExecutionConstraints(profile as never)).not.toContain('棚子');
    expect(describeShootingSetup(profile as never)).not.toContain('可用设备');
    expect(describeShootingSetup(profile as never)).not.toContain('稳定器');
    expect(describeShootingSetup(profile as never)).toContain('团队规模');
  });
});

describe('创作设置不替用户默认拍摄场地', () => {
  it('档案里有场地和设备，创作设置里的「拍摄场地」「设备」都是空的', () => {
    const s = resolveCreationSettings({ from: '创作方向', sourceContent: '' } as never, ctx);
    expect(s.scene).toBeUndefined();
    expect(s.device).toBeUndefined();
  });

  it('用户在需求里自己写了「拍摄场地」，才会带过去', () => {
    const s = settingsFromText('拍摄场地：棚子');
    expect(s.scene).toBe('棚子');
  });
});
