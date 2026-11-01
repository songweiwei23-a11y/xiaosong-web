// 整改阶段 3（2026-11-01）：脚本提示词去掉无关信息和重复规则。
// 线上选题带去脚本时，创作方向的 6 个方向整份方案拼进提示词两遍（参考内容一遍、原始想法一遍），这条脚本只用方向 1；
// 写作底线、承接要求也各出现两遍；全局禁忌的「换成」写着「一天卖 300 串」「大多数客人反馈……」。
import { describe, expect, it } from 'vitest';
import { creationReference, selectedFromBatch, continuationRules } from '@/lib/creation-continuation';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { outputRulesBlock } from '@/lib/output-rules';
import { PLATFORM_TABOOS } from '@/lib/taboos';

const DIRECTIONS = `## 📌 这个方向的思路
引流到店。这 6 个方向分工为：3 条流量型。

## 🧭 内容方向

### 方向1：拿着发型图来，先别急着照着剪
- **视频目的**：流量型
- **内容方向**：顾客拿出参考图，阿杰先不动剪刀。

---

### 方向2：哪种发型最不想花时间打理？
- **视频目的**：流量型
- **内容方向**：求助网友。

---

### 方向3：女士染烫前，先把日常打理习惯说清楚
- **视频目的**：变现型

### 我推荐先做：方向1
- 先拍方向1。

## ⚠️ 这次先别做的
1. 先别编客户对话。`;

const TOPIC = `## 选题1：拿着图来剪？先等等

**承接**：取自方向1「顾客拿出参考图，阿杰先不动剪刀」

**0️⃣ 视频目的**
流量型。`;

describe('一整批方案只带这一条取自的那个', () => {
  it('写着「取自方向N」：只留方向 N 和「这次先别做的」', () => {
    const picked = selectedFromBatch(DIRECTIONS, TOPIC);
    expect(picked).toContain('拿着发型图来');
    expect(picked).toContain('先别编客户对话');
    expect(picked).not.toContain('求助网友');
    expect(picked).not.toContain('女士染烫');
    expect(picked).not.toContain('我推荐先做');
  });

  it('写成「承接：方向N"……"」也认得出', () => {
    const picked = selectedFromBatch(DIRECTIONS, '## 选题1：别着急\n\n**承接**：方向2"哪种发型最不想花时间打理"——求助网友的拍法');
    expect(picked).toContain('求助网友');
    expect(picked).not.toContain('拿着发型图来');
  });

  it('认不出取自哪一条就原样返回，不冒险丢意图', () => {
    expect(selectedFromBatch(DIRECTIONS, '## 选题1：别的题目\n正文')).toBe(DIRECTIONS);
    expect(selectedFromBatch('### 方向1：只有一条\n内容', TOPIC)).toBe('### 方向1：只有一条\n内容');
  });

  it('标题就是批里某一条（选题页整批带过来）也认得出', () => {
    const batch = '## 选题1：甲题目\n正文甲\n\n## 选题2：乙题目\n正文乙';
    expect(selectedFromBatch(batch, '## 选题2：乙题目\n正文乙')).toBe('## 选题2：乙题目\n正文乙');
  });

  it('带去脚本的参考内容里，原始方案只剩选中的那个方向', () => {
    const ref = creationReference({ sourceContent: TOPIC, originContent: DIRECTIONS, settings: {} });
    expect(ref).toContain('【原始创作方案】');
    expect(ref).not.toContain('求助网友');
    expect(ref).toContain('【当前版本】');
  });
});

describe('脚本提示词里的规则只出现一次', () => {
  const base = { topic: '拿着图来剪', platform: '抖音', duration: 'AI推荐', source: '', requirements: '', settings: {} };

  it('账号背景已经带了写作底线时不再发第二遍', () => {
    const q = buildAdaptiveScriptPrompt({ ...base, context: `档案\n\n${outputRulesBlock()}` });
    expect(q.split('## 🧭 写作底线').length - 1).toBe(1);
  });

  it('没有账号背景时照样带写作底线', () => {
    expect(buildAdaptiveScriptPrompt({ ...base, context: '' })).toContain('## 🧭 写作底线');
  });

  it('内容树定了结构时不再说「36计、四大脚本是可选方法」', () => {
    expect(buildAdaptiveScriptPrompt({ ...base, context: '', treeBlock: '【内容树】\n- 具体结构：36计·第1计 反向操作' })).not.toContain('是可选方法');
    expect(buildAdaptiveScriptPrompt({ ...base, context: '' })).toContain('是可选方法');
  });

  it('承接要求不带某个行业的占位例子', () => {
    expect(continuationRules('script')).not.toMatch(/X串/);
  });
});

describe('选题自己的目的带去脚本', () => {
  it('「0️⃣ 视频目的」换行「变现型——……」也认得出（选题板块就是这么写的）', async () => {
    const { scriptFormOfTopic } = await import('@/lib/creation-settings');
    const body = '## 选题1：下午4点出摊前先做哪一步\n\n**0️⃣ 视频目的**\n变现型——让本地白领产生到店期待。\n\n**🅰 打法**\n36计·第10计 情境还原：备串';
    expect(scriptFormOfTopic(body).purpose).toBe('变现型');
  });

  it('同一行的写法照样认', async () => {
    const { scriptFormOfTopic } = await import('@/lib/creation-settings');
    expect(scriptFormOfTopic('- 视频目的：人设型\n- 四大脚本·讲故事·小有成就型：……').purpose).toBe('人设型');
  });

  it('没写目的就不填', async () => {
    const { scriptFormOfTopic } = await import('@/lib/creation-settings');
    expect(scriptFormOfTopic('## 选题1：随便一个题目\n正文').purpose).toBeUndefined();
  });
});

describe('标题只带脚本的策略卡和口播', () => {
  const SCRIPT = `## 第1步：脚本策略卡\n**核心问题**：拿图照剪适不适合\n\n---\n\n## 第2步：纯文字文案\n\n今天又有人拿图来。\n\n先别急着剪。\n\n---\n\n## 第3步：完整分镜脚本\n**【镜头1】** 顺便采访两位老顾客\n\n## 第4步：执行与优化建议\n发布后和前后几条对比`;

  it('四步脚本只留策略卡和口播，分镜、执行建议不带', async () => {
    const { titleReference } = await import('@/lib/title-standards');
    const ref = titleReference(SCRIPT);
    expect(ref).toContain('拿图照剪适不适合');
    expect(ref).toContain('先别急着剪');
    expect(ref).not.toContain('镜头1');
    expect(ref).not.toContain('执行与优化建议');
  });

  it('认不出四步格式就原样带', async () => {
    const { titleReference } = await import('@/lib/title-standards');
    expect(titleReference('一段随手写的想法')).toBe('一段随手写的想法');
  });

  it('分镜和执行建议里的「采访」「前后」不再误触发和标题无关的规则', async () => {
    const { buildTitlePrompt } = await import('@/lib/title-standards');
    const q = buildTitlePrompt({ topic: '拿着图来剪', titleTypeLabel: '痛点式', titleFormulaValue: 'auto', titleFormulaLabel: '', keywordStrategyLabel: '综合', keywordStrategyDesc: '', platform: '抖音', count: 6, sourceContent: SCRIPT } as never);
    expect(q).not.toContain('镜头1');
    expect(q).not.toContain('【顺带提到的采访】');
  });

  it('风险词的「改用」不替出镜人编经历', async () => {
    const { buildTitlePrompt } = await import('@/lib/title-standards');
    const q = buildTitlePrompt({ topic: 't', titleTypeLabel: 'AI推荐', titleFormulaValue: 'auto', titleFormulaLabel: '', keywordStrategyLabel: '综合', keywordStrategyDesc: '', platform: '抖音', count: 6 } as never);
    expect(q).not.toMatch(/我这几次都有效|我个人最推荐/);
  });
});

describe('分镜只按要念的话算时长，只带脚本前三步', () => {
  const SCRIPT = `## 第1步：脚本策略卡\n**核心问题**：拿图照剪适不适合\n\n## 第2步：纯文字文案\n\n今天又有人拿图来，我还是那句话：先别急着剪。\n\n## 第3步：完整分镜脚本\n**【镜头1】0-8秒** 台词：今天又有人拿图来\n\n## 第4步：执行与优化建议\n${'发布后和你自己前几条的数据比，顺便采访两位老顾客。\n'.repeat(80)}`;

  it('预检的口播秒数只算纯文字文案，不报假的「超出目标」', async () => {
    const { buildStoryboardPrompt } = await import('@/lib/storyboard-standards');
    const q = buildStoryboardPrompt({ scriptContent: SCRIPT, platform: '抖音', duration: '60秒', contentType: 'auto', visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '' } as never);
    expect(q).not.toMatch(/口播时长超出目标/);
    expect(q).toMatch(/按口播 5 字\/秒约 \*\*\d{1,2} 秒\*\*/);
  });

  it('第 4 步执行建议不带进分镜，也不误触发采访规则', async () => {
    const { buildStoryboardPrompt, storyboardScript } = await import('@/lib/storyboard-standards');
    expect(storyboardScript(SCRIPT)).not.toContain('执行与优化建议');
    expect(storyboardScript(SCRIPT)).toContain('【镜头1】');
    expect(storyboardScript('一段没有分步的稿子')).toBe('一段没有分步的稿子');
    const q = buildStoryboardPrompt({ scriptContent: SCRIPT, platform: '抖音', duration: '60秒', contentType: 'auto', visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '' } as never);
    expect(q).not.toContain('【顺带提到的采访】');
  });

  it('方法论示范不带具体时段（「五点去市场」「凌晨的市场」）', async () => {
    const { buildStoryboardPrompt } = await import('@/lib/storyboard-standards');
    const q = buildStoryboardPrompt({ scriptContent: '一段稿子', platform: '抖音', duration: '60秒', contentType: 'auto', visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '' } as never);
    expect(q).not.toMatch(/五点去市场|凌晨的市场/);
  });
});

describe('「顺带提到的采访」只在真提到采访时才触发', () => {
  it('「主人可以看，随时有问题」这类普通句子不触发', async () => {
    const { creativeCraftRules } = await import('@/lib/creative-craft');
    expect(creativeCraftRules({ source: '洗护全程主人可以看，随时有问题我们也能调整' })).not.toContain('【顺带提到的采访】');
    expect(creativeCraftRules({ source: '想预约可以私信问我' })).not.toContain('【顺带提到的采访】');
  });

  it('「顺便采访两位老顾客」「另外问问老板」照样触发', async () => {
    const { creativeCraftRules } = await import('@/lib/creative-craft');
    expect(creativeCraftRules({ intent: '聊观点。顺便采访两位老顾客' })).toContain('【顺带提到的采访】');
    expect(creativeCraftRules({ intent: '讲讲火候，另外问问老板的意见' })).toContain('【顺带提到的采访】');
  });
});

describe('二创不把同一份档案贴两遍', () => {
  it('账号背景里已经有这份档案时，「这个账号的档案」只留指引', async () => {
    const { buildRemixPrompt, DEFAULT_LAYERS, DEFAULT_OUTPUTS } = await import('@/lib/remix');
    const summary = '- 档案名称：阿杰剪发\n\n### 🪪 人设事实卡（最硬的事实，以它为准）\n- **出镜人是谁**：店主阿杰';
    const opts = { layers: DEFAULT_LAYERS, count: 3, differentiate: 'auto', depth: 'quick', role: 'same', duration: '跟原片', outputs: DEFAULT_OUTPUTS, profileSummary: summary, store: { name: '阿杰剪发', lines: ['男士剪发'] } };
    const q = buildRemixPrompt({ kind: 'paste', text: '别人的爆款', title: 't', industry: '餐饮' } as never, { ...opts, contextBlock: `## 账号背景\n${summary}\n禁忌…` } as never);
    expect(q.split('人设事实卡').length - 1).toBe(1);
    // 没有账号背景时照样贴档案
    const alone = buildRemixPrompt({ kind: 'paste', text: '别人的爆款', title: 't', industry: '餐饮' } as never, opts as never);
    expect(alone).toContain('人设事实卡');
  });
});

describe('全局禁忌的「换成」不教编、不带别的行业的数字', () => {
  it('没有「300 串」「大多数客人反馈」', () => {
    const insteads = PLATFORM_TABOOS.map((t) => t.instead ?? '').join('\n');
    expect(insteads).not.toMatch(/300 串|一天卖|大多数客人反馈|开了 9 年/);
  });
});
