/**
 * 内容规划 → 创作方向 → 选题的连锁问题，止血（2026-10-29 方案 B）。
 * 线上那条链路：规划 11 个流量方向全是「同一出镜人换衣对比」，方向的切入点是代码轮换的大众大事，
 * 选题被代码强塞两个句式，又被锁在方向的软话题上，出了「世界上最贵的衣服，贵在闲置？」这类标题。
 */
import { describe, expect, it } from 'vitest';
import { PRODUCT_HERO_RULE } from '@/lib/sharp-rules';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { resolveMix } from '@/lib/content-mix';
import { joinUniqueLines } from '@/lib/creation-settings';
import { runQualityChecks } from '@/lib/quality-checks';

describe('「主角是卖的东西」只管变现型和对比类', () => {
  it('流量型对比也变货，但不强制每条都对比', () => {
    expect(PRODUCT_HERO_RULE).toContain('这条管变现型，以及任何要做对比、前后变化的内容');
    expect(PRODUCT_HERO_RULE).toContain('流量型也遵守对比变量规则');
    expect(PRODUCT_HERO_RULE).toContain('不是每条都要对比');
  });

  it.skip('内容规划的「出发点」按目的分三种写法：流量写元素、三有、看点（形式不限），变现写成交理由和主角货，人设写人', () => {
    const p = buildContentPlanPrompt({ lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '', resolved: resolveMix(null), industry: '大码女装' });
    expect(p).toContain('· 流量型写「围绕：人、货、场里的哪一个｜三有：有用、有趣、有共鸣写一个词，观众看完得到什么｜爆款元素：哪一个，让观众看到什么（选反差就写清两边是哪两样货、哪两类人或哪两个时代）｜看点');
    expect(p).toContain('任何脚本结构配上爆款元素都是大流量');
    expect(p).not.toContain('九类里的哪一类');
    // 2026-10-29：原来写「不写成换衣、换款对比」，和「流量型做反差也换货」打架，统一成一个口径（瘦身后放在标准的红线里）
    expect(p).not.toContain('不写成换衣、换款对比');
    expect(p).toContain('做反差或对比时，变的是卖的东西，人、场、动作不变');
    expect(p).toContain('· 变现型写「成交理由：……｜主角：在卖的哪样东西');
    expect(p).toContain('· 人设型写「人：');
  });
});

describe('交接：同一句话不再每过一个板块叠一遍', () => {
  it('按行去重，保留第一次出现的顺序，去掉空行', () => {
    const carried = '第一条作品   就想要流量 曝光\n第一条作品   就想要流量 曝光';
    expect(joinUniqueLines(carried, '涨粉曝光', '第一条作品   就想要流量 曝光', '')).toBe('第一条作品   就想要流量 曝光\n涨粉曝光');
    expect(joinUniqueLines(undefined, null, '  ')).toBe('');
  });
});

describe('选题的爆款元素检查只提醒，不挡交付', () => {
  it.skip('标题认不出元素：给出提醒，但不算不合格', () => {
    const output = '## 选题1：试衣间里那条裤子\n**1️⃣ 爆款元素**\n- 怀旧：套「当年最火的X」\n**2️⃣ 开篇钩子**\n一句话';
    const r = runQualityChecks({ output, profile: null, taskType: '选题策划' });
    const issue = r.issues.find((i) => i.detail.includes('标题里认不出爆款元素'));
    expect(issue).toBeDefined();
    expect(issue!.blocking).toBe(false);
  });
});
