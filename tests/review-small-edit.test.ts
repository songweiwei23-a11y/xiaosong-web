/**
 * 审稿是「小改」，不是「扯头换脸」（2026-10-19）。
 * 线上实测：编导只要求口语化，审稿把开头钩子、意境、整段结构全重写了。
 * 这组测试守住三件事：个人要求能拆成改动范围；超出范围又没有说明的改动会被标出来；提示词不再鼓励整篇重写。
 */
import { describe, it, expect } from 'vitest';
import { reviewScopePlan, reviewScopeBlock, ALWAYS_PROTECTED } from '@/lib/review-scope';
import { reviewDrift } from '@/lib/review-drift';
import { buildReviewPrompt } from '@/lib/review-standards';

const scopesOf = (req: string) => reviewScopePlan(req).matched.map((r) => r.scope);

describe('个人要求 → 改动范围', () => {
  it('只要求口语化，就只归到口语化，不扩大', () => {
    expect(scopesOf('只让他简单优化口语化一些')).toEqual(['colloquial']);
  });

  it('点名错误、时长、营销腔、开头、节奏，各归各的类', () => {
    expect(scopesOf('第三段价格写错了，应该是 19.9')).toContain('facts');
    expect(scopesOf('原稿太短，改到 60 秒')).toContain('duration');
    expect(scopesOf('去掉营销腔')).toContain('marketing');
    expect(scopesOf('开头不够抓人，改一下开头')).toContain('opening');
    expect(scopesOf('节奏拖，断句多一点')).toContain('rhythm');
  });

  it('没有个人要求：写明只修有依据的问题句', () => {
    expect(scopesOf('')).toEqual([]);
    expect(reviewScopeBlock('')).toContain('没有额外要求');
  });

  it('识别不出类别：让模型先写清范围，不乱改', () => {
    expect(scopesOf('随便看看')).toEqual([]);
    expect(reviewScopeBlock('随便看看')).toContain('没有落在常见类别里');
  });

  it('范围块里列出了不动的内容：钩子、意境、结构、人物原话、结尾', () => {
    const block = reviewScopeBlock('只让他简单优化口语化一些');
    expect(block).toContain('范围外一律原样保留');
    for (const item of ['开头钩子', '意境和氛围', '结构和段落顺序', '人物原话', '结尾的收束句']) {
      expect(block).toContain(item);
    }
    expect(ALWAYS_PROTECTED.length).toBeGreaterThanOrEqual(5);
  });
});

describe('越界检查：优化稿里超出范围、又没有说明的句子', () => {
  // 原稿用真实的小节写法：小节名用 ####，和审稿输出的「### 4. 优化后的完整脚本」对得上
  const draft = '#### 【开头】\n南乐的川味地摊，下班路过就能吃上一口。\n#### 【正文】\n一块钱一串，现穿现烫。\n#### 【结尾】\n位置放在评论区。';

  it('重写了钩子、又没有说明（纯文字文案里的复述不算说明）：标为待确认', () => {
    const output = [
      '### 3. 问题清单',
      '【问题】一块钱一串，现穿现烫。→【改成】一块钱一串，现穿现烫，口语一点。',
      '### 4. 优化后的完整脚本',
      '#### 【开头】',
      '街角一盏灯，老板在等你。',
      '#### 【正文】',
      '一块钱一串，现穿现烫。',
      '#### 【结尾】',
      '位置放在评论区。',
      '### 5. 纯文字文案',
      '街角一盏灯，老板在等你。',
    ].join('\n');
    const r = reviewDrift(draft, output);
    expect(r.newSentences).toContain('街角一盏灯，老板在等你');
    expect(r.unexplained).toContain('街角一盏灯，老板在等你');
  });

  it('同一句在问题清单里有说明：不算越界', () => {
    const output = [
      '### 3. 问题清单',
      '【问题】开头生硬 →【改成】街角一盏灯，老板在等你。',
      '### 4. 优化后的完整脚本',
      '#### 【开头】',
      '街角一盏灯，老板在等你。',
      '#### 【正文】',
      '一块钱一串，现穿现烫。',
    ].join('\n');
    const r = reviewDrift(draft, output);
    expect(r.newSentences).toContain('街角一盏灯，老板在等你');
    expect(r.unexplained).toEqual([]);
  });

  it('只改了几个字、说明里写到了改动的那一段：不算越界（模型常把一句拆开写）', () => {
    const draft2 = '南乐县城的川味地摊，下班路过就能吃上一口。\n食材当天进货，价格摆在明面上。';
    const output = [
      '### 3. 问题清单',
      '| 位置 | 原文 | 改写 | 改动理由 |',
      '| 开头 | 下班路过就能吃上一口 | 下班路过就能吃一口 | 去掉书面助词 |',
      '| 正文 | 价格摆在明面上 | 价格明码标价 | 更直接 |',
      '### 4. 优化后的完整脚本',
      '#### 【开头】',
      '南乐县城的川味地摊，下班路过就能吃一口。',
      '#### 【正文】',
      '食材当天进货，价格明码标价。',
    ].join('\n');
    const r = reviewDrift(draft2, output);
    expect(r.newSentences.length).toBeGreaterThan(0);
    expect(r.unexplained).toEqual([]);
  });

  it('优化稿和原稿一字不差：没有新句子', () => {
    const output = `### 3. 问题清单\n无\n### 4. 优化后的完整脚本\n${draft}`;
    expect(reviewDrift(draft, output)).toEqual({ newSentences: [], unexplained: [] });
  });

  it('没有优化稿小节（结果没写完或格式不对）：不误报', () => {
    expect(reviewDrift(draft, '### 3. 问题清单\n只有问题，没有完整稿')).toEqual({ newSentences: [], unexplained: [] });
  });
});

describe('提示词：小改，不鼓励整篇重写', () => {
  const prompt = (req: string) => buildReviewPrompt({
    draftContent: '南乐的川味地摊，下班路过就能吃上一口。', platform: '抖音', duration: 'AI推荐', scriptType: '',
    reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: true,
    personalRequirements: req,
  } as never);

  it('个人要求会进入「本轮改动范围」，并写明范围外原样保留', () => {
    const p = prompt('只让他简单优化口语化一些');
    expect(p).toContain('本轮改动范围');
    expect(p).toContain('口语化：只把书面腔');
    expect(p).toContain('范围外一律原样保留');
  });

  it('不再要求「给出可用完整版本」，也不再附 9.5 分的范例', () => {
    const p = prompt('只让他简单优化口语化一些');
    expect(p).not.toContain('可用完整版本');
    expect(p).not.toContain('达标范例');
    expect(p).not.toMatch(/9\.5\s*分/);
    expect(p).toContain('这一节是小改后的稿');
    expect(p).toContain('分数只用来说明稿子能不能拍');
  });

  it('输出仍保留「优化后的完整脚本」小节名：分镜和标题的交接靠它识别', () => {
    expect(prompt('')).toContain('### 4. 优化后的完整脚本');
  });
});
