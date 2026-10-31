/**
 * 第五轮使用报告的整改（2026-10-31，docs/开物使用报告_20261030）。
 *
 * 守的是改过的几条规则：配比数字只有一个来源（01/03/04/05/06 的编造）；
 * 对标统计口径（18 的「占 100%」）；行业建议的百分数出处；起号方案和拆解的篇幅上限；
 * 脚本广告模板第 3 步的占位上限；分镜拍摄要点不写台词规则。
 * 这些都是一句话的规则，之后合并或改提示词时最容易被无声删掉，所以逐条用字符串断言守住。
 * 全部是纯函数，不调用真实模型。
 *
 * 注意：脚本第 3 步的格式要求只在广告模板里（isAd 为真且选了类型）。
 * 非广告（默认）走 buildAdaptiveScriptPrompt（lib/script-design），10 脚本的占位规则在那边，单独守。
 */
import { describe, expect, it } from 'vitest';
import { mixPromptBlock, resolveMix } from '@/lib/content-mix';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildGrowthPlanPrompt } from '@/lib/growth-standards';
import { buildIndustryAdvicePrompt } from '@/lib/industry-advice';
import { buildBenchmarkQuery } from '@/lib/benchmark-analysis';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { buildScriptBoardQuery, type ScriptBoardInput } from '@/lib/boards/script-query';
import type { CreationSettings } from '@/lib/creation-settings';

describe('配比数字只有一个来源', () => {
  it('配比块只给作用配比的数；形式、题材不写百分数', () => {
    const b = mixPromptBlock(resolveMix({ account_stage: '刚起号，定位未确定' }));
    expect(b).toContain('这里只给了作用配比的数');
    expect(b).toContain('不写百分数');
  });

  it('定位：有「百分数只有一个来源」这条红线；没有配比块时作用配比写「待定」', () => {
    const p = buildPositioningPrompt({ profileSummary: '- 档案名称：x' });
    expect(p).toContain('百分数只有一个来源');
    expect(p).toContain('作用配比写「待定」');
  });

  it('起号方案：百分数只出现在作用配比上；过线之后只写方向', () => {
    const p = buildGrowthPlanPrompt({});
    expect(p).toContain('百分数只出现在作用配比上');
    expect(p).toContain('（只写方向，不写百分数）');
  });

  it('行业建议：百分数只能照抄内容定位里的作用配比', () => {
    const p = buildIndustryAdvicePrompt({
      profileSummary: '- 档案名称：x',
      input: { purpose: 'traffic', stage: 'start', situation: '刚开始' },
    });
    expect(p).toContain('百分数只能照抄「已做过的内容定位」里的作用配比');
  });
});

describe('统计口径：样本少就不写占比和「占 100%」', () => {
  it('对标拆解：选题类型按「分布」写；样本少于 3 条不写占比、百分数', () => {
    const q = buildBenchmarkQuery({
      accountName: 'x', platform: null, materialLines: ['截图 1 张'], materialText: '', contextBlock: '',
    });
    expect(q).toContain('样本不足 3 条时不写占比和百分数');
    expect(q).toContain('样本少于 3 条时，占比、百分数、「占 100%」这类统计一律不写');
  });
});

describe('篇幅有硬上限', () => {
  it('起号方案：全文不超过 4000 字，各节有上限', () => {
    expect(buildGrowthPlanPrompt({})).toContain('全文不超过 4000 字');
  });

  it('拆解：第 1–4 点合计 1500 字以内；第 6 点每段 do、lines 有字数上限', () => {
    const p = buildTextBreakdownPrompt('一段文案', '', {} as CreationSettings);
    expect(p).toContain('第 1–4 点合计 1500 字以内');
    expect(p).toContain('direction、profile_fit 各不超过 40 字');
  });
});

describe('脚本广告模板第 3 步：【待确认】只用于事实，全篇不超过 2 处', () => {
  const input: ScriptBoardInput = {
    topic: '门店节前节后对比', platform: '抖音', scriptType: 'ad_lead', autoScriptType: false,
    effectiveRole: '变现型', isAd: true, industry: '本地服务', customIndustry: '', targetGroup: '实体店老板',
    customTargetGroup: '', style: '朴素', customStyle: '', durationMode: 'ai', duration: '60秒', customDuration: '',
    profile: null, positioningContent: null, scriptStructure: 'auto', hookType: 'auto', boomElements: [],
    directorThoughts: [], tactic: 'AI推荐', openingLine: '', openingCard: '', productInfo: '', priceInfo: '',
    scene: '室内', device: '手机', budget: '低成本(0-500)', personnel: '一人', accountPositioning: '',
    additionalInfo: '', dealReasons: [], originContent: '', focusContent: '',
    currentSettings: {} as CreationSettings,
  };

  it('格式要求写明占位只用于事实，动作和状态不占位，全篇不超过 2 处', () => {
    const q = buildScriptBoardQuery(input);
    expect(q).toContain('【待确认】占位只用于数字、价格、人名、顾客原话');
    expect(q).toContain('动作、判断、状态不用占位');
    expect(q).toContain('全篇【待确认】不超过 2 处');
  });
});

describe('10 脚本（默认路径，自适应模板）：占位只留给事实，做法不编进口播', () => {
  it('内容质量要求里写明占位范围、全篇上限，资料缺口改用文字列', () => {
    const p = buildAdaptiveScriptPrompt({
      topic: '串串备料', platform: '抖音', duration: '60秒', context: '', source: '', requirements: '', settings: {} as CreationSettings,
    });
    expect(p).toContain('【待确认】只留给数字、价格、人名、顾客原话');
    expect(p).toContain('全篇【待确认】不超过 2 处');
    expect(p).toContain('口播里不写「我会先…」「我习惯…」「我平时…」');
  });
});

describe('16 拆解（变现方向）：5 个方向的目的各不相同，结尾不都是到店，不把一次扩成习惯', () => {
  it('拆解提示词带上目的分开、goal 只写类型词、字数上限和承接原稿次数的规则', () => {
    const p = buildTextBreakdownPrompt('一段文案', '', {} as CreationSettings);
    expect(p).toContain('第 6 点的 5 个方向目的要各不相同');
    expect(p).toContain('goal 只写类型词本身，不加具体品类或行业名');
    expect(p).toContain('每段 do、lines 各不超过 30 字');
    expect(p).toContain('第 4 点之后不再加其他小节');
    expect(p).toContain('不改成「每次」「总是」「一直」');
  });
});

describe('分镜拍摄要点：只写拍的事，不写台词规则', () => {
  it('拍摄要点不写「不念什么」这类台词规则', () => {
    const p = buildStoryboardPrompt({
      scriptContent: '口播一段', platform: '抖音', duration: '60秒', contentType: 'food',
      visualStyle: 'real', visualStyleLabel: '真实记录', additionalInfo: '',
    });
    expect(p).toContain('只写拍的动作、景别、收音或安全上的事');
  });
});
