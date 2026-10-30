/**
 * 下游板块接入契约（2026-10-30）：分镜、标题、开篇、审稿，从上游正文（选题正文或脚本策略卡）读出结构和目的，写进提示词。
 * 守的是：上游有契约就写进去；上游没有就不写假的块。
 */
import { describe, expect, it } from 'vitest';
import { contractBlockFromText } from '@/lib/creation-tree';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildGrowthPlanPrompt, buildOpeningPrompt } from '@/lib/growth-standards';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildRemixPrompt, DEFAULT_LAYERS } from '@/lib/remix';

/** 脚本策略卡的写法（和脚本页输出的第 1 步一致） */
const SCRIPT_STRATEGY = [
  '### 第1步：脚本策略卡',
  '- **用户目的**：人设型。通过做川菜9年的判断，建立态度。',
  '- **实际采用形式**：四大脚本·聊观点·论证型，先立判断再用现场动作论证。',
  '',
  '### 第2步：纯文字文案',
  '我做川菜9年，最不认同的一句话，就是“炒菜嘛，火大就行”。',
].join('\n');

const NO_CONTRACT = '这是一段没有结构的普通文字，讲讲今天的天气。';

describe('从上游正文读出契约', () => {
  it('脚本策略卡：结构全名和用户目的都读出来，写成块', () => {
    const block = contractBlockFromText(SCRIPT_STRATEGY);
    expect(block).toContain('【内容树】');
    expect(block).toContain('- 大类：四大脚本');
    expect(block).toContain('- 具体结构：聊观点·论证型');
    expect(block).toContain('- 目的：人设型');
  });

  it('没有结构的文字：返回空串，不写假的块', () => {
    expect(contractBlockFromText(NO_CONTRACT)).toBe('');
  });
});

describe('下游构造函数写进契约块', () => {
  it('分镜：脚本里带契约，提示词里有内容树', () => {
    const q = buildStoryboardPrompt({
      scriptContent: SCRIPT_STRATEGY, platform: '抖音', duration: '60秒', contentType: 'food',
      visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '',
    });
    expect(q).toContain('【内容树】');
    expect(q).toContain('聊观点·论证型');
  });

  it('分镜：没有契约的脚本，提示词里没有内容树', () => {
    const q = buildStoryboardPrompt({
      scriptContent: NO_CONTRACT, platform: '抖音', duration: '60秒', contentType: 'food',
      visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '',
    });
    expect(q).not.toContain('【内容树】');
  });

  it('标题：源内容带契约，提示词里有内容树', () => {
    const q = buildTitlePrompt({
      topic: '川菜最不能省的是炒前准备', titleTypeLabel: '痛点式', titleFormulaValue: 'number-action', titleFormulaLabel: '数字+动作',
      keywordStrategyLabel: '综合', keywordStrategyDesc: '标题和正文都自然带关键词', platform: '抖音', targetAudience: '想学做川菜的人', count: 6,
      sourceContent: SCRIPT_STRATEGY,
    });
    expect(q).toContain('【内容树】');
    expect(q).toContain('- 目的：人设型');
  });

  it('开篇：主题文字带契约，提示词里有内容树', () => {
    const q = buildOpeningPrompt({ topic: SCRIPT_STRATEGY, count: 3 });
    expect(q).toContain('【内容树】');
  });

  it('审稿：稿子带契约，提示词里有内容树', () => {
    const q = buildReviewPrompt({ draftContent: SCRIPT_STRATEGY } as never);
    expect(q).toContain('【内容树】');
    expect(q).toContain('聊观点·论证型');
  });

  it('起号方案：配的四大脚本结构写的是注册表里的名字', () => {
    const q = buildGrowthPlanPrompt({});
    expect(q).toContain('配的四大脚本结构只能从这些里选，一字不差');
    expect(q).toContain('教知识·解题型');
    expect(q).toContain('聊观点·论证型');
  });

  it('二创：结构名写的是注册表里的名字（含 36 计全名）', () => {
    const q = buildRemixPrompt(
      { kind: 'paste', text: '原片文字', title: '示例' },
      { layers: DEFAULT_LAYERS, count: 3, differentiate: 'auto', depth: 'full', role: 'same', duration: '30 秒', outputs: ['script'], targetIndustry: '火锅店' } as never,
    );
    expect(q).toContain('脚本结构的名字只能从注册表里选，一字不差');
    expect(q).toContain('聊观点·论证型');
    expect(q).toContain('36计·第32计');
  });
});
