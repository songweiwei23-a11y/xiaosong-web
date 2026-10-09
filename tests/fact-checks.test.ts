/**
 * 关键事实核对（2026-10-04）：价格、地名、资历荣誉、"据统计"——档案和素材里都没有的标出来请人核对。
 */
import { describe, expect, it } from 'vitest';
import { runQualityChecks, unsupportedFacts, QUALITY_LABELS } from '@/lib/quality-checks';

const profile = { profile_name: '锦园地摊串串一元火锅', price_range: ['人均 30 元以内'], target_region: ['濮阳市南乐县'], persona_facts: { mainProducts: '川味串串火锅、川菜' } };
const known = JSON.stringify(profile);

describe('关键事实核对', () => {
  it('编出来的价格、分店、荣誉、地名、无出处数据都报', () => {
    const out = '人均 68 元吃到撑！我们已经开了 5 家分店，还拿过金奖。郑州市的朋友也专门来。据统计 80% 的人都爱吃辣。';
    const f = unsupportedFacts(out, known);
    expect(f.join('|')).toMatch(/价格「.*68 元/);
    expect(f.join('|')).toMatch(/资历\/荣誉「.*5 家分店/);
    expect(f.join('|')).toMatch(/金奖/);
    expect(f.join('|')).toMatch(/地名「郑州市」/);
    expect(f.join('|')).toMatch(/据统计.*没给出处/);
  });

  it('档案、素材里有的照用不报：一元、30 元、南乐县、素材里的 38 块', () => {
    const out = '一元一串，人均 30 元以内，南乐县的老街坊都知道。今天的锅底 38 块。';
    expect(unsupportedFacts(out, `${known}\n素材：锅底三十八块`)).toEqual([]);
  });

  it('评论区、后厨这些"区"不是地名；写了来源的数据不报', () => {
    expect(unsupportedFacts('评论区好多人问，带你看后厨。', known)).toEqual([]);
    expect(unsupportedFacts('数据显示外卖增长很快（来源：美团研究院报告）', known)).toEqual([]);
  });

  it('只查创作类板块；拆解（分析别人的视频）不查；2026-10-05 起没建档案也查（拿这次的素材比对）', () => {
    const out = '人均 68 元。';
    expect(runQualityChecks({ output: out, profile, taskType: '脚本生成' }).issues.map((i) => i.kind)).toContain('facts');
    expect(runQualityChecks({ output: out, profile, taskType: '拆解爆款' }).issues.map((i) => i.kind)).not.toContain('facts');
    expect(runQualityChecks({ output: out, profile: null, taskType: '脚本生成' }).issues.map((i) => i.kind)).toContain('facts');
    expect(runQualityChecks({ output: out, profile, taskType: '脚本生成', source: '这次活动人均 68 元' }).passed).toBe(true);
    expect(QUALITY_LABELS.facts).toMatch(/关键事实/);
  });
});
