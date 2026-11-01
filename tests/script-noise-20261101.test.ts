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

describe('全局禁忌的「换成」不教编、不带别的行业的数字', () => {
  it('没有「300 串」「大多数客人反馈」', () => {
    const insteads = PLATFORM_TABOOS.map((t) => t.instead ?? '').join('\n');
    expect(insteads).not.toMatch(/300 串|一天卖|大多数客人反馈|开了 9 年/);
  });
});
