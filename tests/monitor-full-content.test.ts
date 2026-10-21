/**
 * 实时动态的完整内容（2026-10-22）：最近 EVENT_LIMIT 条都有完整输入和全文，
 * 每条只读一次数据库（缓存），超出的只留在缓存外、不占内存。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fillContent, pruneContent } from '@/lib/admin-monitor-data';
import { EVENT_LIMIT } from '@/lib/monitor';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('内容缓存：只读缺的，分批读，读过的不再读', () => {
  it('第一次读全部，第二次只读新出现的', async () => {
    const cache = new Map<string, { id: string; text: string }>();
    const loads: string[][] = [];
    const load = async (ids: string[]) => {
      loads.push(ids);
      return ids.map((id) => ({ id, text: `全文${id}` }));
    };
    await fillContent(cache, ['a', 'b', 'c'], load, (r) => r.id);
    expect(loads).toEqual([['a', 'b', 'c']]);
    expect(cache.get('b')?.text).toBe('全文b');

    await fillContent(cache, ['a', 'b', 'c', 'd'], load, (r) => r.id);
    expect(loads).toEqual([['a', 'b', 'c'], ['d']]);
  });

  it('一次最多读 100 个，超过就分批；重复的 id 只读一次', async () => {
    const cache = new Map<string, { id: string }>();
    const loads: string[][] = [];
    const ids = [...Array.from({ length: 250 }, (_, i) => `id${i}`), 'id0'];
    await fillContent(cache, ids, async (missing) => {
      loads.push(missing);
      return missing.map((id) => ({ id }));
    }, (r) => r.id);
    expect(loads.map((l) => l.length)).toEqual([100, 100, 50]);
    expect(cache.size).toBe(250);
  });

  it('不在列表里的记录从缓存里去掉，内存不会越攒越多', () => {
    const cache = new Map<string, number>([['keep', 1], ['gone', 2]]);
    pruneContent(cache, ['keep']);
    expect([...cache.keys()]).toEqual(['keep']);
  });
});

describe('接线：列表最近 EVENT_LIMIT 条都有完整内容；全文不再截成 2 万字', () => {
  it('列表上限是 200 条，接口和页面用同一个数字', () => {
    expect(EVENT_LIMIT).toBe(200);
    const route = read('app/api/admin/monitor/route.ts');
    expect(route).toContain('EVENT_LIMIT');
    expect(route).not.toContain('DETAIL_ROWS');
    expect(route).not.toContain('.slice(0, 60)');
    expect(route).toContain('fillContent(generationContent');
    expect(route).toContain('fillContent(usageDetailContent');
    expect(read('app/admin/monitor/page.tsx')).toContain('EVENT_LIMIT');
  });

  it('看完整记录：全文上限放宽到 20 万字', () => {
    const record = read('app/api/admin/monitor/record/route.ts');
    expect(record).toMatch(/const RESULT_CAP = 200_000;/);
    expect(record).not.toMatch(/const RESULT_CAP = 20000;/);
  });

  it('页面说明写清楚范围，并且每条都有「看完整记录」入口', () => {
    const page = read('app/admin/monitor/page.tsx');
    expect(page).toContain('看完整记录');
    const parts = read('components/admin/monitor/parts.tsx');
    expect(parts).toContain('看完整记录');
  });
});
