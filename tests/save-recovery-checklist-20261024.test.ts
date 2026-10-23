// 2026-10-24：保存失败不再静默、月报完整统计、拍摄标记同步云端。
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { addUnsaved, readUnsaved, removeUnsaved, UNSAVED_KEY, UNSAVED_MAX } from '@/lib/unsaved-results';
import { mergeChecklist, parseLocalChecklist, sameChecklist, sanitizeChecklist, type ShootChecklist } from '@/lib/production-checklist';
import { listAllWorks } from '@/lib/works';

/** 内存里的 localStorage 替身 */
function fakeStorage(opts: { failWrites?: boolean } = {}): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => { data.delete(k); },
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  } as Storage;
}

const item = (n: number) => ({ taskType: '脚本生成', inputData: { n }, result: `结果${n}`, workId: null });

describe('保存失败的暂存', () => {
  it('失败的结果进本机暂存，刷新后还在（读回来一样）', () => {
    const storage = fakeStorage();
    expect(addUnsaved(item(1), Date.parse('2026-10-24T10:00:00Z'), storage)).toBe(true);
    const list = readUnsaved(storage);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ taskType: '脚本生成', result: '结果1', workId: null });
    expect(storage.getItem(UNSAVED_KEY)).toContain('结果1');
  });

  it('最多保留 10 条，超出丢最旧的', () => {
    const storage = fakeStorage();
    for (let i = 0; i < UNSAVED_MAX + 3; i++) addUnsaved(item(i), Date.parse('2026-10-24T10:00:00Z') + i, storage);
    const list = readUnsaved(storage);
    expect(list).toHaveLength(UNSAVED_MAX);
    expect(list[0].result).toBe(`结果${UNSAVED_MAX + 2}`);
  });

  it('重试成功后移除，只移除这一条', () => {
    const storage = fakeStorage();
    addUnsaved(item(1), Date.now(), storage);
    addUnsaved(item(2), Date.now() + 1, storage);
    const [first] = readUnsaved(storage);
    removeUnsaved(first.id, storage);
    expect(readUnsaved(storage).map((x) => x.result)).toEqual(['结果1']);
  });

  it('本机存不下（额度满）时退回内存：返回 false，但本页面里仍能看到', () => {
    const storage = fakeStorage({ failWrites: true });
    expect(addUnsaved(item(9), Date.now(), storage)).toBe(false);
    expect(readUnsaved(storage).map((x) => x.result)).toEqual(['结果9']);
  });

  it('坏数据不报错，当作没有', () => {
    const storage = fakeStorage();
    storage.setItem(UNSAVED_KEY, '{不是数组');
    expect(readUnsaved(storage)).toEqual([]);
  });
});

describe('拍摄标记：合并与校验', () => {
  const shots = ['s1', 's2', 's3'];
  const at = (iso: string): ShootChecklist => ({ ids: [], updatedAt: iso });

  it('谁的 updatedAt 新用谁：断网时的旧标记不覆盖云端较新的', () => {
    const cloud: ShootChecklist = { ids: ['s1', 's2'], updatedAt: '2026-10-24T12:00:00Z' };
    const localOld: ShootChecklist = { ids: ['s3'], updatedAt: '2026-10-24T11:00:00Z' };
    expect(mergeChecklist(localOld, cloud)).toEqual(cloud);
  });

  it('本机比云端新（比如断网时改的）：用本机的', () => {
    const cloud: ShootChecklist = { ids: ['s1'], updatedAt: '2026-10-24T11:00:00Z' };
    const localNew: ShootChecklist = { ids: ['s1', 's2'], updatedAt: '2026-10-24T12:00:00Z' };
    expect(mergeChecklist(cloud, localNew)).toEqual(localNew);
    expect(mergeChecklist(null, null)).toBeNull();
  });

  it('旧版本只存在本机的数组格式也能读出来，只留仍然存在的镜头', () => {
    const got = parseLocalChecklist(JSON.stringify(['s1', 'gone', 's3']), shots);
    expect(got?.ids).toEqual(['s1', 's3']);
  });

  it('接口只接受合法的标记：ids 必须是字符串数组、时间必须能解析', () => {
    expect(sanitizeChecklist({ ids: ['a', 'a', 'b'], updatedAt: '2026-10-24T12:00:00Z' })?.ids).toEqual(['a', 'b']);
    expect(sanitizeChecklist({ ids: 'a', updatedAt: '2026-10-24T12:00:00Z' })).toBeNull();
    expect(sanitizeChecklist({ ids: ['a'], updatedAt: 'not a date' })).toBeNull();
    expect(sanitizeChecklist({ ids: Array.from({ length: 301 }, (_, i) => `x${i}`), updatedAt: '2026-10-24T12:00:00Z' })).toBeNull();
  });

  it('内容相同的两份标记判为相同（用来决定要不要推到云端）', () => {
    const a: ShootChecklist = { ids: ['s1'], updatedAt: '2026-10-24T12:00:00Z' };
    expect(sameChecklist(a, { ...a, ids: [...a.ids] })).toBe(true);
    expect(sameChecklist(a, { ...a, ids: ['s2'] })).toBe(false);
  });
});

describe('月报：作品全部读取', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  const page = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `w${i}-${n}` }));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('超过一页（50 条）也能取全：按页取，直到不足一页为止', async () => {
    const pages = [page(50), page(50), page(3)];
    const fetchSpy = vi.fn(async (_url: string) => json(pages.shift() ?? []));
    vi.stubGlobal('fetch', fetchSpy);
    const works = await listAllWorks();
    expect(works).toHaveLength(103);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[1][0])).toContain('offset=50');
  });

  it('中途有一页失败：整体报错，不返回不完整的结果（不生成漏算的月报）', async () => {
    const responses = [json(page(50)), json({ error: '服务暂时不可用' }, 500)];
    vi.stubGlobal('fetch', vi.fn(async () => responses.shift() ?? json([])));
    await expect(listAllWorks()).rejects.toThrow('服务暂时不可用');
  });
});
