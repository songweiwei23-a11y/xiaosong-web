import { describe, it, expect } from 'vitest';
import { EMPTY_PROFILE, toFormData } from '@/components/profile/ProfileForm';

/**
 * 编辑页原来是个空壳（页面上写着「编辑功能正在开发中，请先删除旧档案后重新创建」），
 * 而档案列表里就有「编辑」入口。现在真做出来了，最大的风险是**改坏已有数据**：
 *
 * 老的编辑页把 target_age、target_region、video_duration、price_range 这些
 * 库里是 text[] 的字段声明成了字符串，一提交就会把数组列覆盖成空字符串。
 *
 * toFormData 是拦住这类事的那道闸：库里的一行进来，必须逐字段按
 * EMPTY_PROFILE 的类型强制转换，不能直接 spread。
 */

describe('把库里的行转成表单数据', () => {
  it('数组字段拿到数组，文本字段拿到字符串', () => {
    const f = toFormData({
      profile_name: '言山廷',
      account_platform: ['抖音', '快手'],
      target_pain_points: '怕被宰 / 价格不透明',
    });
    expect(f.account_platform).toEqual(['抖音', '快手']);
    expect(f.target_pain_points).toBe('怕被宰 / 价格不透明');
  });

  it('数组字段在库里存成了字符串时，拆成数组', () => {
    // 早期手填的数据会出现这种情况；不转换的话 .includes() 会直接抛错，
    // 整个编辑页白屏
    const f = toFormData({ target_age: '25-30岁、18-24岁' });
    expect(f.target_age).toEqual(['25-30岁', '18-24岁']);
  });

  it('文本字段在库里存成了数组时，拼回字符串', () => {
    const f = toFormData({ target_pain_points: ['怕质量有问题', '怕效果不达预期'] });
    expect(f.target_pain_points).toBe('怕质量有问题、怕效果不达预期');
  });

  it('null / undefined / 缺字段都落到安全的默认值', () => {
    const f = toFormData({ account_platform: null, target_needs: undefined });
    expect(f.account_platform).toEqual([]);
    expect(f.target_needs).toBe('');
    // 整行传 null 也不能炸
    expect(toFormData(null).profile_name).toBe('');
    expect(toFormData(undefined).equipment).toEqual([]);
  });

  it('数组里的空值会被滤掉', () => {
    const f = toFormData({ equipment: ['手机', '', null, '灯光'] as unknown[] });
    expect(f.equipment).toEqual(['手机', '灯光']);
  });

  it('不把 id / user_id / created_at 带进表单', () => {
    const f = toFormData({
      id: 'p1',
      user_id: 'u1',
      created_at: '2026-01-01',
      updated_at: '2026-02-02',
      profile_name: '测试',
    });
    // 提交时整行回传会改写这些系统字段，所以表单里根本不该有它们
    for (const k of ['id', 'user_id', 'created_at', 'updated_at']) {
      expect(Object.keys(f), `${k} 不该进表单`).not.toContain(k);
    }
    expect(f.profile_name).toBe('测试');
  });

  it('表单字段和默认值的类型一一对应', () => {
    const f = toFormData({});
    for (const [k, v] of Object.entries(EMPTY_PROFILE)) {
      expect(Array.isArray((f as Record<string, unknown>)[k]), `${k} 类型不对`).toBe(Array.isArray(v));
    }
  });

  it('真实的一行档案走一圈，该有的都在', () => {
    const row = {
      id: 'x', user_id: 'u', created_at: 't',
      profile_name: '言山廷潮汕牛肉自助火锅店',
      account_platform: ['抖音'],
      account_track: ['美食烹饪'],
      equipment: ['手机', '相机', '专业摄像机', '灯光', '收音设备', '稳定器'],
      team_structure: '2-3人小团队',
      target_pain_points: '低价自助宣传鲜切，实际是冻肉、调理合成肉',
      content_restrictions: '绝对化宣传：最好、第一、全网最便宜',
    };
    const f = toFormData(row);
    expect(f.profile_name).toBe('言山廷潮汕牛肉自助火锅店');
    expect(f.equipment).toHaveLength(6);
    expect(f.team_structure).toBe('2-3人小团队');
    // 手写的长文本原样保留，编辑时会落进「其他」框
    expect(f.content_restrictions).toContain('全网最便宜');
  });
});

describe('表单覆盖了会用到的字段', () => {
  it('包含各板块提示词真正消费的那些字段', () => {
    const keys = Object.keys(EMPTY_PROFILE);
    for (const k of [
      'target_pain_points', 'target_needs', 'unique_selling_point', 'content_value',
      'content_restrictions', 'conversion_barriers', 'conversion_path',
      'equipment', 'team_structure', 'shooting_location', 'content_tone',
      'fan_common_questions', 'unique_resources', 'competitive_weakness',
      'viral_content_pattern',
    ]) {
      expect(keys, `表单缺字段 ${k}`).toContain(k);
    }
  });

  it('不再收集那两个让用户替 AI 做分析的字段', () => {
    const keys = Object.keys(EMPTY_PROFILE);
    expect(keys).not.toContain('market_opportunity');
    expect(keys).not.toContain('conversion_hooks');
  });
});
