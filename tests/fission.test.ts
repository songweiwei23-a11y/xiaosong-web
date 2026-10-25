import { describe, it, expect } from 'vitest';
import { FISSION_CATEGORIES, FISSION_MAX, FISSION_MODES, buildFissionBlock, selectionLines } from '@/lib/fission';
import { buildRemixPrompt, COUNT_OPTIONS, DEFAULT_LAYERS } from '@/lib/remix';
import { OPENING_CARDS } from '@/lib/opening-cards';

const base = { layers: DEFAULT_LAYERS, count: 15 as const, differentiate: 'auto' as const, depth: 'full' as const, role: 'same' as const, duration: '30 秒' as const, outputs: ['script', 'shots'] as Array<'script' | 'shots'>, targetIndustry: '火锅店' };
const SOURCE = { kind: 'paste' as const, text: '【二创结构 · 模版1：示例】\n分段（2 段，按顺序 1:1 复刻）：\n1. 0–3 秒｜抓人｜知识：开篇 36 计：盲盒', title: '示例模版' };

describe('拆解知识可选项：每一类都能勾', () => {
  it('类别 id 不重复，每类至少有一项，项 id 在类内不重复', () => {
    const ids = FISSION_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of FISSION_CATEGORIES) {
      expect(c.items.length, c.id).toBeGreaterThan(0);
      expect(new Set(c.items.map((i) => i.id)).size, c.id).toBe(c.items.length);
    }
  });

  it('开篇包含全部开篇 36 计，并有六大钩子', () => {
    const opening = FISSION_CATEGORIES.find((c) => c.id === 'opening')!;
    expect(opening.items.filter((i) => i.id.startsWith('opening:'))).toHaveLength(OPENING_CARDS.length);
    expect(opening.items.map((i) => i.label)).toContain('盲盒');
  });

  it('结构、爆款元素、起号 36 计、情绪、人设、作用、呈现、景别、运镜、置景都在', () => {
    const ids = FISSION_CATEGORIES.map((c) => c.id);
    for (const id of ['script', 'element', 'growth', 'emotion', 'persona', 'role', 'presentation', 'shotSize', 'camera', 'setting']) {
      expect(ids).toContain(id);
    }
  });
});

describe('裂变设置写进提示词', () => {
  it('数量最多 15，选项有 1/3/5/10/15', () => {
    expect(FISSION_MAX).toBe(15);
    expect(COUNT_OPTIONS).toEqual(expect.arrayContaining([1, 3, 5, 10, 15]));
    expect(Math.max(...COUNT_OPTIONS)).toBe(15);
  });

  it('1:1 复刻：写明分段、顺序、功能、知识、镜头都不变', () => {
    const text = buildFissionBlock({ count: 3, mode: 'copy', selections: {} });
    expect(text).toContain('1:1 复刻');
    expect(text).toContain('分段数量、顺序、每段功能');
    expect(text).toContain('### 方案 N');
    expect(text).toContain('不限');
  });

  it('裂变：要求在勾选的知识里取不同组合，方案之间不能只换词', () => {
    const text = buildFissionBlock({ count: 10, mode: 'vary', selections: {} });
    expect(text).toContain('裂变');
    expect(text).toContain('不能只是换词');
  });

  it('勾了的类别只从勾中的里取，没勾的不写', () => {
    const lines = selectionLines({ opening: ['opening:1', 'hook:盲盒'], emotion: [] });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('只从这几个里用');
    expect(lines[0]).toContain('盲盒');
  });

  it('无效的项 id 被忽略', () => {
    expect(selectionLines({ opening: ['not-exist'] })).toEqual([]);
  });

  it('变体数超过 15 按 15 算；至少 1', () => {
    expect(buildFissionBlock({ count: 99, mode: 'copy', selections: {} })).toContain('15 个');
    expect(buildFissionBlock({ count: 0, mode: 'copy', selections: {} })).toContain('1 个');
  });

  it('模式选项有 1:1 复刻和裂变', () => {
    expect(FISSION_MODES.map((m) => m.id)).toEqual(['copy', 'vary']);
  });
});

describe('二创提示词：裂变 + 压缩 + 二创结构来源', () => {
  it('15 个变体：写进变体数、裂变块，并压缩（不写全文和分镜）', () => {
    const p = buildRemixPrompt(SOURCE, { ...base, fission: { mode: 'vary', selections: { element: ['element:反差'] } } });
    expect(p).toContain('出 15 个方案');
    expect(p).toContain('## 裂变设置');
    expect(p).toContain('只从这几个里用：反差');
    expect(p).toContain('#### 分段');
    expect(p).not.toContain('#### 口播全文');
    expect(p).not.toContain('#### 分镜');
  });

  it('来源是二创结构：提示严格按它的分段、顺序、知识名复刻', () => {
    const p = buildRemixPrompt(SOURCE, { ...base, count: 1, fission: { mode: 'copy', selections: {} } });
    expect(p).toContain('严格按它的分段、顺序、每段功能和知识名复刻');
    expect(p).toContain('#### 口播全文');
  });

  it('没有裂变设置时保持原来的提示词（不出现裂变块）', () => {
    const p = buildRemixPrompt(SOURCE, { ...base, count: 3 });
    expect(p).not.toContain('## 裂变设置');
  });
});
