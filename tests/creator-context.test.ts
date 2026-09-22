import { describe, it, expect } from 'vitest';
import {
  buildContextBlock,
  profileCompleteness,
  describeExecutionConstraints,
  type CreatorContext,
  type CreatorProfile,
} from '@/lib/creator-context';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildTitlePrompt } from '@/lib/title-standards';

/**
 * 创作上下文：账号档案 + 定位 + 成交理由，选一次全站都知道。
 *
 * 改造前的状况：用户在档案里填了 44 个字段（设备、团队、场地、人群痛点、
 * 绝对不能说什么…），但分镜、审稿、标题三个板块只把 profileId 传给 Dify
 * 做记忆隔离，档案内容一个字都没进提示词。分镜的提示词里甚至写死了
 * 「一个人用手机拍，没有灯」——而这个用户有专业摄像机、灯光和 2-3 人团队。
 */

/** 取自库里最完整的那个真实档案的结构（内容做了简化） */
const FULL: CreatorProfile = {
  id: 'p1',
  profile_name: '言山廷潮汕牛肉自助火锅店',
  account_platform: ['抖音', '快手', '小红书'],
  account_track: ['美食烹饪'],
  account_stage: '有定位，需要内容方向',
  fans_level: '0-1万',
  target_gender: '不限',
  target_age: ['25-30岁', '18-24岁'],
  target_occupation: ['白领', '宝妈'],
  target_region: ['三四线城市'],
  target_pain_points: '低价自助宣传鲜切，实际是冻肉、调理合成肉',
  target_needs: '真正鲜切原切牛肉，供货稳定不空盘',
  fan_common_questions: '牛肉是鲜切的还是冷冻调理肉？',
  content_style: ['接地气', '实用'],
  content_tone: '亲切朋友式',
  content_themes: '用户痛点答疑类：实拍后厨现切全过程',
  content_value: '花亲民自助价格，吃实打实原切鲜切潮汕牛肉',
  unique_selling_point: '坚持原切鲜切牛肉，拒绝合成调理冻肉',
  viral_content_pattern: '反差冲突基因：清汤麻辣双兼顾',
  content_restrictions: '绝对化宣传：最好、第一、全网最便宜',
  competitive_advantage: '锅底差异化壁垒',
  conversion_hooks: '60多吃潮汕牛肉自助，很多人第一反应：肉不会是合成的吧？',
  conversion_barriers: '低价自助本能怀疑',
  // 拍摄条件——分镜最缺的就是这一块
  equipment: ['手机', '相机', '专业摄像机', '灯光', '收音设备', '稳定器'],
  team_structure: '2-3人小团队',
  shooting_location: ['店铺', '外景'],
  video_duration: ['30-60秒'],
  content_format: ['口播', '探店'],
};

const ctx = (profile: CreatorProfile | null, extra: Partial<CreatorContext> = {}): CreatorContext => ({
  profile,
  positioning: null,
  dealReasons: [],
  ...extra,
});

describe('按模块切片，各取所需', () => {
  it('分镜拿到的是拍摄条件', () => {
    const b = buildContextBlock(ctx(FULL), 'storyboard');
    expect(b).toContain('真实拍摄条件');
    expect(b).toContain('专业摄像机');
    expect(b).toContain('2-3人小团队');
    expect(b).toContain('稳定器');
  });

  it('分镜不需要知道变现路径和成交障碍', () => {
    // 几千字的无关信息会稀释指令，而且每次生成都要为这些 token 付钱
    const b = buildContextBlock(ctx(FULL), 'storyboard');
    expect(b).not.toContain('成交障碍');
    expect(b).not.toContain('转化');
  });

  it('脚本拿到的是语气、卖点和已验证的钩子', () => {
    const b = buildContextBlock(ctx(FULL), 'script');
    expect(b).toContain('亲切朋友式');
    expect(b).toContain('原切鲜切');
    expect(b).toContain('已验证的开场钩子');
  });

  it('脚本不需要知道设备清单', () => {
    const b = buildContextBlock(ctx(FULL), 'script');
    expect(b).not.toContain('专业摄像机');
  });

  it('标题拿到的是人群和卖点', () => {
    const b = buildContextBlock(ctx(FULL), 'title');
    expect(b).toContain('白领');
    expect(b).toContain('核心卖点');
  });

  it('审稿拿到的是判据：说给谁听、什么语气、什么不能说', () => {
    const b = buildContextBlock(ctx(FULL), 'review');
    expect(b).toContain('亲切朋友式');
    expect(b).toContain('真实痛点');
    expect(b).toContain('硬性禁忌');
  });

  it('选题拿到的是方向：赛道、阶段、爆款基因', () => {
    const b = buildContextBlock(ctx(FULL), 'topic');
    expect(b).toContain('美食烹饪');
    expect(b).toContain('爆款基因');
  });
});

describe('禁忌是硬约束，凡产出内容的模块都要带上', () => {
  for (const m of ['topic', 'script', 'review', 'title'] as const) {
    it(`${m} 带上了「绝对不能说」`, () => {
      expect(buildContextBlock(ctx(FULL), m)).toContain('全网最便宜');
    });
  }
});

describe('成交理由只给变现相关的模块', () => {
  const withDeals = ctx(FULL, { dealReasons: ['专业强', '实在不坑'] });

  it('选题、脚本、标题带上', () => {
    for (const m of ['topic', 'script', 'title'] as const) {
      expect(buildContextBlock(withDeals, m)).toContain('实在不坑');
    }
  });

  it('分镜和审稿不带——它们不决定卖什么', () => {
    for (const m of ['storyboard', 'review'] as const) {
      expect(buildContextBlock(withDeals, m)).not.toContain('实在不坑');
    }
  });
});

describe('没有档案时不产出噪音', () => {
  it('完全没有上下文就返回空串', () => {
    expect(buildContextBlock(ctx(null), 'script')).toBe('');
  });

  it('档案很空时不会输出一堆「未设置」', () => {
    const bare: CreatorProfile = { id: 'p2', profile_name: '新档案' };
    const b = buildContextBlock(ctx(bare), 'script');
    expect(b).not.toContain('未设置');
    expect(b).not.toContain('null');
    expect(b).not.toMatch(/：\s*$/m);
  });

  it('只有定位没有档案，也要把定位带上', () => {
    const b = buildContextBlock(
      ctx(null, { positioning: { name: '定位', summary: '本地家具零售赛道', full: '本地家具零售赛道' } }),
      'topic'
    );
    expect(b).toContain('本地家具零售');
  });
});

describe('接进各板块的提示词', () => {
  it('分镜：有真实设备时不再按「一个人手机没有灯」设计', () => {
    const withCtx = buildStoryboardPrompt({
      scriptContent: '测试脚本内容，足够长以便解析。',
      platform: '抖音', duration: '60秒', contentType: 'food',
      visualStyle: 'cinematic', visualStyleLabel: '电影感', additionalInfo: '',
      contextBlock: buildContextBlock(ctx(FULL), 'storyboard'),
    });
    expect(withCtx).toContain('按它给的条件来');
    expect(withCtx).not.toContain('可能只有一部手机、一个人、没有灯');
    expect(withCtx).toContain('专业摄像机');
  });

  it('分镜：没有档案时保留原来的保守假设', () => {
    const noCtx = buildStoryboardPrompt({
      scriptContent: '测试脚本内容，足够长以便解析。',
      platform: '抖音', duration: '60秒', contentType: 'food',
      visualStyle: 'cinematic', visualStyleLabel: '电影感', additionalInfo: '',
    });
    // 宁可设计得简单，也不要给出拍不出来的镜头
    expect(noCtx).toContain('只有一部手机、一个人、没有灯');
  });

  it('审稿：账号背景排在稿件之前', () => {
    const p = buildReviewPrompt({
      draftContent: '一段待审的稿子。', platform: '抖音', duration: '60秒',
      scriptType: '教知识型', reviewDimensions: '', optimizationGoals: '',
      benchmarkScript: '', compareMode: false, severityLabels: false,
      contextBlock: buildContextBlock(ctx(FULL), 'review'),
    });
    // 顺序反了模型会先形成通用判断，再被背景信息拉扯
    expect(p.indexOf('账号背景')).toBeLessThan(p.indexOf('待审稿件'));
    expect(p).toContain('亲切朋友式');
  });

  it('标题：账号背景排在主题之前', () => {
    const p = buildTitlePrompt({
      topic: '教你挑牛肉', titleTypeLabel: '痛点式', titleFormulaValue: 'pain-solution',
      titleFormulaLabel: '痛点+解决方案', keywordStrategyLabel: '搜索词',
      keywordStrategyDesc: '高搜索量', platform: '抖音', targetAudience: '', count: 5,
      contextBlock: buildContextBlock(ctx(FULL), 'title'),
    });
    expect(p.indexOf('账号背景')).toBeLessThan(p.indexOf('视频主题'));
  });
});

/**
 * 这一组是上一轮实测打出来的。当时结构已经接上、单测全绿，
 * 拿真实档案跑 Dify 却发现带背景那版反而更少提到专业设备——
 * 因为提示词主体里无条件写着「手机即可，不需要专业设备」，
 * 266 字的背景块压不过写死的方法论。**结构接上 ≠ 生效。**
 */
describe('写死的拍摄假设不能盖过真实条件', () => {
  it('没填设备时保留保守假设——宁可简单，也不要给出拍不出来的方案', () => {
    const c = describeExecutionConstraints(null);
    expect(c).toContain('手机即可');
    expect(c).toContain('一个人就能拍');
  });

  it('填了专业设备就不再说「手机即可，不需要专业设备」', () => {
    const c = describeExecutionConstraints(FULL);
    expect(c).not.toContain('手机即可');
    expect(c).not.toContain('不需要专业设备');
    expect(c).toContain('专业摄像机');
    expect(c).toContain('稳定器');
  });

  it('有团队就允许需要两个人配合的方案', () => {
    expect(describeExecutionConstraints(FULL)).toContain('两个人配合');
  });

  it('团队写明是一个人时，不出需要他人配合的方案', () => {
    const solo: CreatorProfile = { id: 'p3', profile_name: '单人号', equipment: ['手机'], team_structure: '1人单干' };
    const c = describeExecutionConstraints(solo);
    expect(c).toContain('需要他人配合出镜的选题不要出');
    expect(c).not.toContain('两个人配合');
  });

  it('不管哪种情况，可执行性的底线都还在', () => {
    for (const p of [null, FULL]) {
      expect(describeExecutionConstraints(p)).toContain('凌晨拍摄');
    }
  });
});

describe('档案完整度', () => {
  it('填得满的档案分数高', () => {
    expect(profileCompleteness(FULL)).toBeGreaterThan(70);
  });

  it('空档案是 0', () => {
    expect(profileCompleteness({ id: 'x', profile_name: '空' })).toBe(0);
    expect(profileCompleteness(null)).toBe(0);
  });
});

describe('提示词规模可控', () => {
  it('单个模块的上下文不超过 4000 字', () => {
    // 无关信息会稀释指令，而且每次生成都要为这些 token 付钱
    for (const m of ['topic', 'script', 'storyboard', 'review', 'title'] as const) {
      const size = buildContextBlock(
        ctx(FULL, {
          positioning: { name: 'n', summary: '定'.repeat(5000), full: '位'.repeat(5000) },
          dealReasons: ['专业强', '实在不坑'],
        }),
        m
      ).length;
      expect(size, `${m} 的上下文有 ${size} 字，太长了`).toBeLessThan(4000);
    }
  });
});
