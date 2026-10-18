import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { foundationDone, setupProgress } from '@/lib/setup-progress';

const home = readFileSync(join(process.cwd(), 'app/dashboard/page.tsx'), 'utf8');

describe('首页「先打地基」每一行的完成状态', () => {
  const none = { profileCount: 0, positioningTypes: [] as string[] };
  const withProfile = { profileCount: 1, positioningTypes: [] as string[] };
  const withPositioning = { profileCount: 1, positioningTypes: ['账号定位'] };

  it('三步行按 key 取完成状态', () => {
    expect(foundationDone({ setupKey: 'profile' }, withProfile)).toBe(true);
    expect(foundationDone({ setupKey: 'profile' }, none)).toBe(false);
    expect(foundationDone({ setupKey: 'positioning' }, withPositioning)).toBe(true);
    expect(foundationDone({ setupKey: 'positioning' }, withProfile)).toBe(false);
    expect(foundationDone({ setupKey: 'brief' }, withPositioning)).toBe(false);
  });

  it('行业建议存过才打勾，没存不算没做完，也不影响三步进度', () => {
    const row = { positioningType: '行业建议' };
    expect(foundationDone(row, withPositioning)).toBe(false);
    expect(foundationDone(row, { profileCount: 1, positioningTypes: ['账号定位', '行业建议'] })).toBe(true);
    // 进度仍然是三步：档案、定位已做，简报没做 → 2/3（行业建议不计入）
    expect(setupProgress({ profileCount: 1, positioningTypes: ['账号定位', '行业建议'] })).toEqual({ done: 2, total: 3 });
  });

  it('没有 key 的行不算完成，脏数据不炸', () => {
    expect(foundationDone({}, withProfile)).toBe(false);
    expect(foundationDone({ setupKey: 'brief' }, { profileCount: NaN, positioningTypes: undefined as unknown as string[] })).toBe(false);
  });

  it('首页不再按下标取完成状态（下标错位就是这个 bug）', () => {
    expect(home).not.toMatch(/setupState\.steps\[i\]/);
    expect(home).toContain('foundationDone(f, setupInput)');
    expect(home).toContain('positioningType: "行业建议"');
  });
});
