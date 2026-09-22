import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildTitlePrompt } from '@/lib/title-standards';

/**
 * 审稿和标题此前的提示词分别只有 3 条和 5 条通用要求，模型拿不到
 * 评分标准、公式结构、平台差异和范例，产出全凭它自己发挥。
 * 这些用例锁住「该带的信息必须带上」，防止以后被简化回去。
 */

const DRAFT = `【开场钩子】0-3秒：拍了半年没人看？问题出在开头这3秒。

【镜头1】0-3秒
台词："你每天辛辛苦苦拍，播放量就是上不去。"
画面：正对镜头

【镜头2】3-15秒
台词："第一个原因，开头太慢。"

综上所述，非常好的方法就是这些。`;

describe('审稿提示词', () => {
  const prompt = buildReviewPrompt({
    draftContent: DRAFT,
    platform: '抖音',
    duration: '60秒',
    scriptType: '教知识型',
    reviewDimensions: '【开头吸引力】3秒钩子是否有力',
    optimizationGoals: '提升开头吸引力',
    benchmarkScript: '',
    compareMode: true,
    severityLabels: true,
  });

  it('带上了评分标准表和权重', () => {
    expect(prompt).toContain('开场钩子');
    expect(prompt).toContain('20 分');
    expect(prompt).toContain('情绪波点');
  });

  it('写明了与脚本生成同一条及格线', () => {
    expect(prompt).toContain('9.0');
    expect(prompt).toContain('MCN 级');
  });

  it('把机器数出来的客观事实喂给了模型', () => {
    expect(prompt).toContain('系统预检结果');
    expect(prompt).toContain('时间区间标注');
    expect(prompt).toContain('系统初判得分');
  });

  it('逐字比对出稿件里的书面语并点名', () => {
    // 稿件末尾写了「综上所述」「非常好」，属于二级/三级禁忌
    expect(prompt).toContain('本篇已命中');
    expect(prompt).toContain('综上所述');
  });

  it('带上了达标范例', () => {
    expect(prompt).toContain('达标范例');
    expect(prompt).toContain('【开场钩子】');
  });

  it('打开对比模式时才要求逐句对照', () => {
    expect(prompt).toContain('原文 vs 改写');

    const off = buildReviewPrompt({
      draftContent: DRAFT, platform: '抖音', duration: '60秒', scriptType: '教知识型',
      reviewDimensions: '', optimizationGoals: '', benchmarkScript: '',
      compareMode: false, severityLabels: false,
    });
    // 这个开关此前传到后端就被忽略了，界面上点了等于没点
    expect(off).not.toContain('原文 vs 改写');
  });

  it('关掉严重程度标注时不再要求打标', () => {
    const off = buildReviewPrompt({
      draftContent: DRAFT, platform: '抖音', duration: '60秒', scriptType: '教知识型',
      reviewDimensions: '', optimizationGoals: '', benchmarkScript: '',
      compareMode: false, severityLabels: false,
    });
    expect(off).not.toContain('🔴 必须改');
  });
});

describe('标题提示词', () => {
  const base = {
    topic: '教实体店老板用手机拍探店视频',
    titleTypeLabel: '痛点式',
    titleFormulaValue: 'pain-solution',
    titleFormulaLabel: '痛点+解决方案',
    keywordStrategyLabel: '搜索词',
    keywordStrategyDesc: '高搜索量',
    platform: '抖音',
    targetAudience: '实体店老板',
    count: 5,
  };

  it('把公式拆成了结构、原理和正反例', () => {
    const p = buildTitlePrompt(base);
    expect(p).toContain('公式拆解');
    expect(p).toContain('结构');
    expect(p).toContain('达标示例');
    expect(p).toContain('不达标示例');
  });

  it('不同平台给出不同的标题逻辑', () => {
    const douyin = buildTitlePrompt(base);
    const xhs = buildTitlePrompt({ ...base, platform: '小红书' });
    expect(douyin).toContain('推荐流');
    expect(xhs).toContain('搜索');
    expect(douyin).not.toEqual(xhs);
  });

  it('带上了产品级的禁用词，与账号定位模块口径一致', () => {
    const p = buildTitlePrompt(base);
    // 账号定位模块早就禁了「揭秘」，标题模块此前不知道这条规矩
    expect(p).toContain('揭秘');
    expect(p).toContain('教你看懂');
  });

  it('要求每个标题赌的动机不同，A/B 测试才有意义', () => {
    const p = buildTitlePrompt(base);
    expect(p).toContain('点击动机必须不同');
  });

  it('生成数量如实传达', () => {
    expect(buildTitlePrompt({ ...base, count: 10 })).toContain('10 个');
  });

  it('未知公式不会导致整段缺失', () => {
    const p = buildTitlePrompt({ ...base, titleFormulaValue: '不存在的公式' });
    expect(p).toContain('视频主题');
    expect(p).toContain('输出格式');
  });
});
