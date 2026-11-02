// 长报告的本地草稿（2026-11-02 产品方：「拆解的对标账号产出的结果怎么没有了？要有记忆保存」）
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, readDraft, saveDraft } from '@/lib/report-draft';

describe('草稿：存、读、过期、清', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } };
  });
  afterEach(() => { delete (globalThis as { window?: unknown }).window; });

  it('按 key 分开存；写完的和没写完的分得清；空报告不存', () => {
    saveDraft('benchmark:a1', { report: '一、材料清单……', done: false, materials: ['作品 42 条'] }, 1_000);
    saveDraft('benchmark:a2', { report: '完整报告', done: true, materials: [] }, 1_000);
    saveDraft('benchmark:a3', { report: '   ', done: true, materials: [] }, 1_000);
    expect(readDraft('benchmark:a1', 2_000)).toEqual({ report: '一、材料清单……', done: false, materials: ['作品 42 条'], at: 1_000 });
    expect(readDraft('benchmark:a2', 2_000)?.done).toBe(true);
    expect(readDraft('benchmark:a3', 2_000)).toBeNull();
  });

  it('超过 7 天的不再提示（顺手清掉）；存服务器成功后清掉', () => {
    saveDraft('k', { report: 'x', done: true, materials: [] }, 0);
    expect(readDraft('k', 8 * 24 * 3600_000)).toBeNull();
    expect(store.size).toBe(0);
    saveDraft('k', { report: 'x', done: true, materials: [] }, 0);
    clearDraft('k');
    expect(readDraft('k', 1)).toBeNull();
  });

  it('浏览器存储用不了：不报错，当没有草稿', () => {
    (globalThis as { window?: unknown }).window = { get localStorage() { throw new Error('禁用'); } };
    expect(() => saveDraft('k', { report: 'x', done: true, materials: [] })).not.toThrow();
    expect(readDraft('k')).toBeNull();
  });
});

describe('接线：对标拆解和账号诊断都边写边存、存好才清、打开时补存', () => {
  const read = (f: string) => fs.readFileSync(f, 'utf8');
  for (const [f, key] of [['components/benchmark/BenchmarkAnalyzer.tsx', 'benchmark:${accountId}'], ['components/works/AccountDiagnosis.tsx', 'diagnosis:${pid}']] as const) {
    it(f, () => {
      const src = read(f);
      expect(src).toContain(key);
      expect(src).toContain('done: false, materials: materialLines');
      expect(src).toContain('done: true, materials: materialLines');
      expect(src).toMatch(/clearDraft\(/);
      expect(src).toContain('上次没写完的');
      expect(src).toContain('补存好了');
      // 存服务器在清草稿之前：失败就不清
      const save = src.indexOf('await throwApiError(save');
      expect(save > -1 ? save : src.indexOf('await throwApiError(saved')).toBeLessThan(src.indexOf('clearDraft('));
    });
  }

  it('已保存的拆解：最新一份默认展开', () => {
    expect(read('app/dashboard/benchmark/page.tsx')).toContain('open={i === 0}');
  });
});
