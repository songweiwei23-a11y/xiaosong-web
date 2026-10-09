/**
 * 带着内容去生成选题，选题要从这份内容出发（2026-10-05 线上）。
 *
 * 审稿优化 → 生成选题：带过去的「当前版本」是整份审稿报告，那条具体的脚本埋在最后；
 * 页面又把最早的大方向填进「个人要求」（写着「所有选题必须围绕」）——结果按大方向另编了 5 个故事，
 * 和带过去的脚本不相干。
 */
import { describe, expect, it } from 'vitest';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { carriedIntent, carriesScript, continuationRules, intentBlock, topicReference } from '@/lib/creation-continuation';
import { readCode } from './helpers/source';

const DIRECTION = '### 方向1：超出预期的小事Vlog系列\n- **核心思路**：用Vlog记录你本周做的一件"客人没要求但你主动做了"的事';
const SCRIPT = '【开场钩子】0-5秒\n这家人预算只有【待确认:X】万，一进店就说"李老师我们钱不多，你看着给配吧"。\n他们看了第一套问"这套能便宜点不"，我说这已经是通货价了。';
const REVIEW = `# 1. 总评\n- **综合得分**：2.5 分\n\n# 2. 逐维度打分\n| 维度 | 得分 |\n|---|---|\n| 开场钩子 | 0/20 |\n\n# 3. 问题清单\n### 问题1：未扩写内容\n\n## 4. 优化后的完整脚本\n${SCRIPT}\n\n# 5. 修改说明\n- 加了讨价还价`;

describe('带去选题的参考内容', () => {
  it('审稿 → 选题：带的是优化后的脚本，不是整份审稿报告；最初的方向要守住', () => {
    const handed = buildCreationHandoff('review', 'topic', REVIEW, { originContent: DIRECTION, settings: { topic: '超出预期的小事Vlog系列', direction: '用Vlog记录…' } });
    const ref = topicReference(handed);
    expect(ref).toContain('【这次带来的内容（选题从这里出发）】');
    expect(ref).toContain('这套能便宜点不');
    expect(ref).not.toContain('逐维度打分');
    expect(ref).not.toContain('问题清单');
    expect(ref.indexOf('这套能便宜点不')).toBeLessThan(ref.indexOf('【最初的方向'));
    expect(ref).toMatch(/【最初的方向（选题要守住它的方向、思路和目的）】\n### 方向1/);
    expect(carriesScript(handed)).toBe(true);
  });

  it('创作方向 → 选题：带的就是方向本身，照常用它；不算「带着脚本」', () => {
    const handed = buildCreationHandoff('direction', 'topic', DIRECTION, {});
    expect(topicReference(handed)).toContain('客人没要求但你主动做了');
    expect(topicReference(handed)).not.toContain('【最初的方向');
    expect(carriesScript(handed)).toBe(false);
  });

  it('自由对话、创作方向等带去选题：设置里残留的旧脚本不带，不拿它顶掉这次勾的方案', () => {
    const plan = '1. 第一条：店里人多热闹，要不要出镜？\n- 方向：店里人多是事实，拍出来让人信';
    const stale = { workingScript: '很早以前另一条脚本：南方人买家具和北方人的区别' };
    for (const source of ['free-chat', 'direction', 'positioning', 'knowledge']) {
      const handed = buildCreationHandoff(source, 'topic', plan, { settings: stale });
      expect(carriesScript(handed), source).toBe(false);
      expect(topicReference(handed), source).toContain('店里人多热闹');
      expect(topicReference(handed), source).not.toContain('南方人买家具');
    }
  });

  it('脚本、审稿、二创、分镜带去选题：算带着一条脚本', () => {
    const storyboard = '【镜头1】0-5秒\n- 台词：这家人预算只有X万\n【镜头2】5-15秒\n- 台词：他们问这套能便宜点不';
    expect(carriesScript(buildCreationHandoff('storyboard', 'topic', storyboard, {}))).toBe(true);
    expect(topicReference(buildCreationHandoff('storyboard', 'topic', storyboard, {}))).toContain('这套能便宜点不');
    expect(carriesScript(buildCreationHandoff('script', 'topic', SCRIPT, {}))).toBe(true);
    expect(carriesScript(buildCreationHandoff('review', 'topic', REVIEW, {}))).toBe(true);
  });

  it('选题的承接规则：守住原方向的思路和目的、从带来的内容出发、写明承接原文哪一处', () => {
    expect(continuationRules('topic')).toMatch(/守住原来的方向、核心思路和视频目的/);
    expect(continuationRules('topic')).toMatch(/这次带来的内容/);
    expect(continuationRules('topic')).toMatch(/承接了原文哪一处/);
    expect(continuationRules('topic')).toMatch(/不能只沿用方向或系列名另编/);
  });
});

// 线上真实的创作方向（2026-10-05）：标题写「人设型+变现型混合」，目的那一行只写了"建立信任、立人设"
const REAL_DIRECTION = `### 方向1：超出预期的小事Vlog系列（人设型+变现型混合）
- **对应目的**：建立信任、立人设、口碑/品牌形象
- **核心思路**：不提前策划剧情，**用Vlog记录你本周做的一件"客人没要求但你主动做了"的事**
- **可拍的选题示例**：
  - 这家人预算只有X万但想要新中式
- **怎么拍**：你出镜，手机拍，1-2分钟Vlog配音`;

describe('认出原方向要守住的：方向、目的、思路、拍法', () => {
  it('创作方向 → 选题：两种目的都认出来（原来只取第一种，整批成了「全部人设型」）', () => {
    const intent = carriedIntent({ sourceContent: REAL_DIRECTION, originContent: REAL_DIRECTION });
    expect(intent.title).toBe('超出预期的小事Vlog系列（人设型+变现型混合）');
    expect(intent.roles).toEqual(['人设型', '变现型']);
    expect(intent.idea).toContain('客人没要求但你主动做了');
    expect(intent.howTo).toContain('手机拍');
    const block = intentBlock(intent);
    expect(block).toMatch(/【原方向要守住的】/);
    expect(block).toMatch(/- 目的：建立信任、立人设、口碑\/品牌形象（人设型、变现型都要有，每条只担其中一个，不出别的目的）/);
    expect(block).toMatch(/- 核心思路：/);
  });

  it('审稿 → 选题：脚本里没写方向，从最初的方向认', () => {
    const handed = buildCreationHandoff('review', 'topic', REVIEW, { originContent: REAL_DIRECTION });
    expect(carriedIntent(handed).roles).toEqual(['人设型', '变现型']);
    expect(carriedIntent(handed).idea).toContain('客人没要求但你主动做了');
  });

  it('只写了一种目的：每条都是这一种', () => {
    const one = '### 方向2：按预算配全屋实战系列\n- **视频目的**：变现型\n- **核心思路**：客人进店→我问预算→带他看';
    expect(carriedIntent({ sourceContent: one, originContent: one }).roles).toEqual(['变现型']);
    expect(intentBlock(carriedIntent({ sourceContent: one, originContent: one }))).toMatch(/（每条都是变现型）/);
  });

  it('最初的是一整批方向时，看这次勾中的那一条', () => {
    const batch = `${REAL_DIRECTION}\n\n### 方向2：按预算配全屋实战系列\n- **视频目的**：变现型`;
    const picked = '### 方向2：按预算配全屋实战系列\n- **视频目的**：变现型\n- **核心思路**：带客人按预算挑';
    expect(carriedIntent({ sourceContent: picked, originContent: batch }).title).toBe('按预算配全屋实战系列');
  });

  it('什么都认不出来（自由对话里一段普通的话）：不写这一段，不硬凑', () => {
    expect(intentBlock(carriedIntent({ sourceContent: '明天拍三条视频，第一条店里人多热闹', originContent: '' }))).toBe('');
  });
});

describe('选题页接线', () => {
  const page = readCode('app/dashboard/topic/page.tsx');

  it('带入内容用 topicReference', () => {
    expect(page).toMatch(/setSourceReference\(topicReference\(handed\)\)/);
  });

  it('带着脚本来时，大方向不再填进「个人要求」', () => {
    expect(page).toMatch(/setPersonalRequirement\(carriesScript\(incomingSetup\) \? '' : s\.direction \?\? ''\)/);
  });

  it('原方向的方向、目的、思路放进提示词；带方向和带脚本说法不同', () => {
    expect(page).toMatch(/const intent = intentBlock\(carriedIntent\(incomingSetup\)\)/);
    expect(page).toMatch(/if \(intent\) query \+= `\$\{intent\}\\n`/);
    expect(page).toMatch(/必须按它的方向、核心思路和目的来设计/);
    // 示例是待落实的方案；深化取材而非强迫换方向，未知数字仍不可编。
    expect(page).toMatch(/topicSourceRules\(carriesScript\(incomingSetup\)\)/);
    const sourceRules = readCode('lib/topic-design.ts');
    expect(sourceRules).toContain('不是已经拍完或必须避开的内容');
    expect(sourceRules).toContain('示例和待确认数字不是事实');
    expect(page).toMatch(/同时守住原方向的思路和目的/);
    // 方向不再从设置里删：原方向要守住
    expect(page).not.toMatch(/delete currentSettings\.direction/);
  });

  it('目的按原方向：写了两种就按配比、只在这两种里分', () => {
    expect(page).toMatch(/if \(roles\.length >= 2\) \{\s*setTopicRole\('按配比'\);/);
    expect(page).toMatch(/setMixOverride\(\{ preset: 'custom', custom: \{ 流量型: 0, 人设型: 0, 变现型: 0, \.\.\.Object\.fromEntries/);
  });

  it('带来的内容放在提示词最前面、写成硬要求；配比和打法排在它后面', () => {
    const anchor = page.indexOf('【这批选题从带来的内容出发】');
    expect(anchor).toBeGreaterThan(0);
    expect(anchor).toBeLessThan(page.indexOf('【这批选题的目的】'));
    expect(anchor).toBeLessThan(page.indexOf('topicRoutePrompt({ route, count: topicCount'));
    // 原来夹在中间的那段删掉了，不重复发
    expect(page).not.toMatch(/的创作参考】\\n\$\{sourceReference\}/);
  });

  it('带着内容来的：不去追热点，每条写「承接」，交稿前逐条查出处', () => {
    expect(page).toMatch(/sourced \? `- 💡 新角度在带来的内容范围里找/);
    expect(page).toMatch(/if \(sourced\) query \+= `\*\*承接\*\*/);
    expect(page).toMatch(/if \(sourced\) query \+= `🔗 交稿前逐条检查/);
  });
});
