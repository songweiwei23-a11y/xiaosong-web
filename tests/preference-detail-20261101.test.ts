/**
 * 偏好学习时就过滤具体细节（2026-11-01，整改方案 1.3）。
 * 原来只在拼进提示词时过滤：学进来的「凌晨四点出摊」照样攒次数、生效。
 * 现在写回前用 lib/noise-check 的确定性抽取和 lib/scene-words 挡掉；写法类的偏好照常学。
 */
import { describe, expect, it } from 'vitest';
import { buildLearnPrompt, hasConcreteDetail, mergePreferences, preferencePromptBlock, settle, type Evidence } from '@/lib/preferences';

const NOW = Date.parse('2026-11-01T10:00:00Z');
const ev = (n: number): Evidence[] => Array.from({ length: n }, (_, i) => ({ id: `E${i + 1}`, kind: 'edit' as const, board: '脚本生成', at: '2026-10-30', text: 'x' }));
const three = ['E1', 'E2', 'E3'];

describe('偏好里的具体细节', () => {
  it('时段、经历句式、场地设备、日期算具体细节', () => {
    for (const t of ['凌晨四点起锅的画面放开头', '开头先讲有一次客人说的话', '在棚里拍，灯光打亮一点', '每周三更新时提一句上新', '下午4点出摊时拍']) {
      expect(hasConcreteDetail(t), t).toBe(true);
    }
  });

  it('写法类的偏好不算：开头习惯、口吻用词、时长、结构', () => {
    for (const t of ['开头直接说结论，不用反问开场', '不用「家人们」「宝子们」', '口播控制在 45 秒以内', '一句一行，少用长句', '结尾只留一个动作']) {
      expect(hasConcreteDetail(t), t).toBe(false);
    }
  });

  it('学的时候就不存带具体细节的条目，写法类的照常学', () => {
    const out = mergePreferences({ current: [], evidence: ev(3), rejected: [], now: NOW, learned: [
      { category: 'content', text: '凌晨四点起锅的画面放开头', evidence: three },
      { category: 'content', text: '开头先讲有一次客人说的话', evidence: three },
      { category: 'opening', text: '开头直接说结论，不用反问开场', evidence: three },
    ] });
    expect(out.map((i) => i.text)).toEqual(['开头直接说结论，不用反问开场']);
  });

  it('存量：以前学进来、已经生效的带细节条目，重算状态时降回观察中；手写的不动，但都不拼进提示词', () => {
    const base = { count: 5, from: { edits: 5, saves: 0, published: 0, feedback: 0, choices: 0 }, status: 'active' as const, firstSeen: '2026-10-01T00:00:00Z', lastSeen: '2026-10-30T00:00:00Z' };
    const out = settle([
      { ...base, id: 'a', category: 'content', text: '凌晨四点起锅的画面放开头', origin: 'learned' },
      { ...base, id: 'b', category: 'opening', text: '开头直接说结论', origin: 'learned' },
      { ...base, id: 'c', category: 'content', text: '每周三提一句上新', origin: 'manual' },
    ], NOW);
    const by = Object.fromEntries(out.map((i) => [i.id, i.status]));
    expect(by).toEqual({ a: 'watching', b: 'active', c: 'active' });
    const block = preferencePromptBlock(out);
    expect(block).toContain('开头直接说结论');
    expect(block).not.toContain('每周三');
    expect(block).not.toContain('凌晨四点');
  });

  it('学习提示词说清楚时段、场地设备、某一次的经历也不写', () => {
    const p = buildLearnPrompt({ evidence: ev(1), current: [], rejected: [], profileSummary: '', today: '2026年11月1日' });
    expect(p).toMatch(/具体时段.*拍摄场地和设备.*某一次的经历一律不写/);
  });
});
