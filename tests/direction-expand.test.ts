/**
 * 在带来的方向上继续拓展（2026-10-06 线上）：
 * 自由对话里勾了「方向1：国庆后的"县城消费观察"」带去创作方向拓展，原来当「已有的想法」一并参考，
 * 要求里还写着「方向之间目的不同、思路不同、拍法不同」——出来 5 个和国庆消费对比无关的泛方向。
 */
import { describe, expect, it } from 'vitest';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { carriedIntent, creationReference, intentBlock } from '@/lib/creation-continuation';
import { readCode } from './helpers/source';

// 线上那次的真实内容（节选）：最早的提问 + 勾中的方向1（前面还带着回答的开场和热点时间轴）
const QUESTION = '我想根据我的定位 拍大流量的视频 你有什么建议吗？在我们这个小县城 一条视频把流量做起来';
const PICKED = `根据联网搜索，我给你梳理出**10个大流量内容方向**。
## 📊 **可借势的热点时间轴（2026年10月）**
- **10月1-7日**：国庆假期刚结束
## 🎯 **10个大流量内容方向（按破圈潜力排序）**
### **方向1：国庆后的"县城消费观察"（破圈指数★★★★★）**
**借势点**：国庆刚过，全国人都在聊假期消费
**为什么能破圈**：县城消费 vs 大城市消费的对比，天然引发争议和讨论
**核心角度**：不拍"南乐国庆有多热闹"，拍"国庆后县城老板的真实状态"
**可拍的3个子方向**：
1. 《国庆过完了，南乐这条街上的店老板都在干一件事》`;

const base = { purposes: [] as string[], formats: ['any'], count: 5 as const, depth: 'full' as const, profileSummary: '- 档案：实体获客编导' };

describe('认出要拓展的方向', () => {
  it('自由对话带过来：最早的提问没写方向，认勾中的那一条（不是回答开头的「热点时间轴」）', () => {
    const handed = buildCreationHandoff('free-chat', 'direction', PICKED, { originContent: QUESTION });
    const intent = carriedIntent(handed);
    expect(intent.title).toBe('国庆后的"县城消费观察"（破圈指数★★★★★）');
    expect(intent.idea).toContain('国庆后县城老板的真实状态');
  });
});

describe('提示词：在这个方向上拓展', () => {
  const handed = buildCreationHandoff('free-chat', 'direction', PICKED, { originContent: QUESTION });
  const content = creationReference(handed);
  const prompt = buildDirectionPrompt({ ...base, expand: { from: '高阶自由对话', content, intent: intentBlock(carriedIntent({ sourceContent: content, originContent: '' })) } });

  it('任务改成「在编导带来的方向上继续拓展」，带来的方向放最前面当主线', () => {
    expect(prompt).toMatch(/^【任务：在编导带来的方向上继续拓展】/);
    expect(prompt).toMatch(/守住它原来的主题、目的和核心角度/);
    expect(prompt.indexOf('## 要拓展的这个方向')).toBeLessThan(prompt.indexOf('## 他的目的'));
    expect(prompt).toContain('国庆后的"县城消费观察"');
    expect(prompt).toContain('我想根据我的定位 拍大流量的视频');
  });

  it('不再要求「目的不同、思路不同」——改成守住主题和目的、在切口和拍法上拉开', () => {
    expect(prompt).not.toMatch(/目的不同、思路不同、拍法不同/);
    expect(prompt).toMatch(/都必须守住上面那个方向的主题、目的和核心角度/);
    expect(prompt).toMatch(/不许另起和它主题无关的方向/);
    expect(prompt).toMatch(/不要原样照抄/);
  });

  it('没另勾目的：按方向原本的目的；另勾了：不偏离方向的前提下兼顾', () => {
    expect(prompt).toMatch(/按上面这个方向原本的目的来/);
    const withGoal = buildDirectionPrompt({ ...base, purposes: ['fans'], expand: { from: 'x', content } });
    expect(withGoal).toMatch(/他这次另外勾的：.+——在不偏离这个方向的前提下兼顾/);
  });

  it('没带方向来的照旧：从零铺开、方向之间要不一样', () => {
    const fresh = buildDirectionPrompt({ ...base, purposes: ['fans'] });
    expect(fresh).toMatch(/^【任务：创作方向】/);
    expect(fresh).toContain('全部服务用户原定目的');
    expect(fresh).not.toMatch(/目的不同、思路不同、拍法不同/);
  });
});

describe('页面', () => {
  const page = readCode('app/dashboard/direction/page.tsx');
  it('带过来的单独一栏「要拓展的方向」，可改、可不按它拓展', () => {
    expect(page).toMatch(/要拓展的方向（来自「/);
    expect(page).toMatch(/不按它拓展，从零出方向/);
  });
  it('带着方向来不用再勾目的；默认不按账号配比拆', () => {
    expect(page).toMatch(/!hasGoal\(\{ purposes, customGoal \}\) && !expandContent\.trim\(\)/);
    expect(page).toMatch(/setUseMix\(false\)/);
  });
  it('提示词拿到要拓展的方向，历史记录也存下来', () => {
    expect(page).toMatch(/expand: expandContent\.trim\(\) \? \{ from: handoffFrom/);
    expect(page).toMatch(/expandFrom: expandContent\.trim\(\) \? handoffFrom : ""/);
  });
});
