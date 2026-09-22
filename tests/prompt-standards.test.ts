import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';

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

describe('分镜提示词', () => {
  const SCRIPT = `【开场钩子】0-3秒：拍了半年没人看？问题出在开头这3秒。
我每天辛辛苦苦拍，播放量就是上不去。
第一个原因，开头太慢。观众前三秒决定走不走。
第二个原因，画面在复述台词，没有新信息。
记住一句话：开头不是自我介绍，是抛钩子。`;

  const base = {
    scriptContent: SCRIPT,
    platform: '抖音',
    duration: '60秒',
    contentType: 'tutorial',
    visualStyle: 'cinematic',
    visualStyleLabel: '电影感',
    additionalInfo: '',
  };

  it('带上了景别的语言，而不只是列名', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('景别不是随便选的');
    expect(p).toContain('滥用会怎样');
    expect(p).toContain('特写');
  });

  it('把景别节奏和镜头时长写清楚了', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('2-4 秒');
    expect(p).toContain('开场 3 秒内至少切');
  });

  it('运镜带手机拍摄的现实约束', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('运动镜头占比不超过');
    expect(p).toContain('稳定器');
  });

  it('明确要求画面不要复述台词——新手最大的坑', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('画面不要复述台词');
    expect(p).toContain('反差');
  });

  it('讲了剪辑点和轴线', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('动作接动作');
    expect(p).toContain('180度法则');
  });

  it('不同内容类型给不同的设计要点', () => {
    const tutorial = buildStoryboardPrompt(base);
    const food = buildStoryboardPrompt({ ...base, contentType: 'food' });
    expect(tutorial).toContain('开场先给');
    expect(food).toContain('食材细节');
    expect(tutorial).not.toEqual(food);
  });

  it('不同平台给不同的画幅与安全区', () => {
    const douyin = buildStoryboardPrompt(base);
    const bili = buildStoryboardPrompt({ ...base, platform: 'B站' });
    expect(douyin).toContain('9:16');
    expect(bili).toContain('16:9');
  });

  it('按目标时长反推镜头数，并要求总时长对得上', () => {
    const p60 = buildStoryboardPrompt(base);
    expect(p60).toContain('60 秒');
    const p15 = buildStoryboardPrompt({ ...base, duration: '15秒' });
    expect(p15).toContain('15 秒');
    expect(p15).not.toEqual(p60);
  });

  it('长视频的分钟数能解析出来', () => {
    const p = buildStoryboardPrompt({ ...base, duration: '3-5分钟' });
    expect(p).toContain('300 秒');
  });

  it('口播明显超时会点出来，要求标明删减处', () => {
    const long = { ...base, duration: '15秒', scriptContent: '啊'.repeat(600) };
    expect(buildStoryboardPrompt(long)).toContain('超出目标');
  });

  it('口播明显不够会要求补空镜', () => {
    const short = { ...base, duration: '90秒', scriptContent: '很短的一句话。' };
    expect(buildStoryboardPrompt(short)).toContain('空镜');
  });

  it('要求输出节奏自检，数字对不上要改表不要改数', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('节奏自检');
    expect(p).toContain('特写占比');
    expect(p).toContain('回去改表');
  });

  it('要求给按机位合并的拍摄顺序，而不是按镜号拍', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('不按镜号顺序拍');
  });

  it('禁止反问用户要信息', () => {
    const p = buildStoryboardPrompt(base);
    expect(p).toContain('反问用户');
  });

  it('未知内容类型/平台不会导致整段缺失', () => {
    const p = buildStoryboardPrompt({ ...base, contentType: 'xxx', platform: '未知平台' });
    expect(p).toContain('分镜脚本表');
    expect(p).toContain('节奏自检');
  });
});
