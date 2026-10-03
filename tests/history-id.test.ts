import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistoryId } from '@/lib/history-id';

afterEach(() => vi.unstubAllGlobals());

describe('HTTP 正式站的历史编号', () => {
  it('没有 randomUUID 时，拆解和二创仍能取得数据库接受的 UUID，连续生成不冲突', () => {
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    const ids = Array.from({ length: 128 }, () => createHistoryId());
    expect(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('安全上下文继续使用浏览器原生 UUID', () => {
    const id = '22222222-2222-4222-8222-222222222222';
    const native = vi.fn(() => id);
    vi.stubGlobal('crypto', { randomUUID: native });
    expect(createHistoryId()).toBe(id);
    expect(native).toHaveBeenCalledOnce();
  });
});
