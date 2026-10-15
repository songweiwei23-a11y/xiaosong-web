import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PALETTE, PALETTES } from '@/components/theme/palettes';

/*
 * 默认配色（2026-10-16 改为墨蓝）。首屏脚本和 DEFAULT_PALETTE 必须一致，
 * 否则刷新时会先闪一下另一种颜色。
 */
const layout = fs.readFileSync(path.join(process.cwd(), 'app', 'layout.tsx'), 'utf8');

describe('默认配色', () => {
  it('默认是墨蓝（深蓝夜色）', () => {
    expect(DEFAULT_PALETTE).toBe('midnight');
    expect(PALETTES.find((p) => p.id === DEFAULT_PALETTE)?.name).toBe('墨蓝');
  });

  it('首屏脚本的回退值和异常兜底都是同一个默认配色', () => {
    expect(layout).toContain(`localStorage.getItem('xiaosong-palette') || '${DEFAULT_PALETTE}'`);
    expect(layout).toContain(`setAttribute('data-palette', '${DEFAULT_PALETTE}')`);
    expect(layout).not.toContain("|| 'graphite'");
  });
});
