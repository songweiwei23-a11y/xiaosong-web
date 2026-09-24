import { describe, it, expect } from 'vitest';
import {
  buildProfileSummary,
  PROFILE_SUMMARY_FIELDS,
  PROFILE_SUMMARY_EXCLUDED,
} from '@/lib/profile-summary';
import { EMPTY_PROFILE } from '@/components/profile/ProfileForm';
import { readCode } from './helpers/source';

/**
 * 定位用的档案摘要。
 *
 * 【线上的毛病】账号定位页自己拼摘要，漏了「数据最好的内容类型」等六七栏。
 * 提示词说"主打内容看数据最好的内容类型"，模型却从没见过这一栏——
 * 档案里填的是"讲故事、拍工作过程"，定位给的是"教知识 60%"。
 */

describe('档案摘要', () => {
  it('表单里每一栏都进摘要，或者写明了为什么不进', () => {
    const covered = new Set([
      ...PROFILE_SUMMARY_FIELDS.map(([k]) => k),
      ...Object.keys(PROFILE_SUMMARY_EXCLUDED),
    ]);
    const keys = Object.keys(EMPTY_PROFILE);
    // 扫描自证不空转：表单字段少于 30 个说明读错了东西
    expect(keys.length).toBeGreaterThanOrEqual(30);
    const missing = keys.filter((k) => !covered.has(k));
    expect(missing, `这些档案字段既没进摘要、也没说明为什么不进：${missing.join('、')}`).toEqual([]);
  });

  it('定主打内容要用的几栏都在', () => {
    const s = buildProfileSummary({
      profile_name: '实体获客编导',
      viral_content_pattern: '讲故事 / 讲经历的、拍工作过程的',
      content_tone: '幽默搞笑式',
      target_region: ['本地同城', '南乐县'],
      fan_common_questions: '多少钱',
      conversion_barriers: ['不相信是真的'],
    });
    expect(s).toContain('- 数据最好的内容类型（定主打内容的首要依据）：讲故事 / 讲经历的、拍工作过程的');
    expect(s).toContain('- 语言风格：幽默搞笑式');
    expect(s).toContain('- 地域：本地同城、南乐县');
    expect(s).toContain('- 客人常问：多少钱');
    expect(s).toContain('- 成交障碍：不相信是真的');
  });

  it('空栏不写，免得一堆"未设置"', () => {
    const s = buildProfileSummary({ profile_name: 'x', content_tone: '', equipment: [] });
    expect(s).toBe('- 档案名称：x');
  });

  it('账号定位、商业定位、内容定位用的是同一份', () => {
    expect(readCode('app/dashboard/positioning/page.tsx')).toMatch(
      /const buildProfileSummary = \(\) => \(activeProfile \? summarizeProfile\(activeProfile\) : ''\)/
    );
    expect(readCode('components/positioning/DeepDivePage.tsx')).toMatch(
      /const profileSummary = \(p: Profile\) => buildProfileSummary\(p\)/
    );
  });

  it('单节重写也带上用户定的方向', () => {
    expect(readCode('app/dashboard/positioning/page.tsx')).toMatch(/userDirection=\{additionalNotes \|\| undefined\}/);
    expect(readCode('components/positioning/SectionEditor.tsx')).toMatch(/profileSummary,\s*userDirection,\s*\}\)/);
  });
});
