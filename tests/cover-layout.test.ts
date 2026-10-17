import { describe, expect, it } from 'vitest';
import { COVER_PRESETS, COVER_WIDTH, coverFileName, layoutTitle } from '@/lib/cover-layout';

describe('封面图排版（整改 C）', () => {
  it('短标题：一行，用最大字号', () => {
    const r = layoutTitle('一元串串');
    expect(r.lines).toEqual(['一元串串']);
    expect(r.fontPx).toBe(150);
    expect(r.truncated).toBe(false);
  });

  it('长标题：自动换行，字号变小，行数不超过 4 行', () => {
    const r = layoutTitle('老板说这个锅底熬了三个小时，不加一点香精，一锅吃到最后');
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.length).toBeLessThanOrEqual(4);
    expect(r.fontPx).toBeLessThan(150);
    expect(r.truncated).toBe(false);
  });

  it('超长标题：按最小字号截断，末尾加省略号', () => {
    const long = '这是一个非常非常长的标题'.repeat(10);
    const r = layoutTitle(long);
    expect(r.truncated).toBe(true);
    expect(r.lines.length).toBeLessThanOrEqual(4);
    expect(r.lines[r.lines.length - 1].endsWith('…')).toBe(true);
  });

  it('每一行都不超过封面宽度', () => {
    const r = layoutTitle('大字标题要能放进封面里，不能超出画面的左右边界，这是一条很长的测试标题');
    for (const line of r.lines) {
      expect(line.length * r.fontPx).toBeLessThanOrEqual(COVER_WIDTH - 160 + r.fontPx);
    }
  });

  it('空标题：没有行', () => {
    expect(layoutTitle('   ').lines).toEqual([]);
  });

  it('有 4 套底色，文字颜色和底色对比度够用（深底白字、浅底深字）', () => {
    expect(COVER_PRESETS.length).toBe(4);
    for (const p of COVER_PRESETS) expect(p.text).toMatch(/^#/);
  });

  it('下载文件名去掉非法字符，标题为空时叫「封面」', () => {
    expect(coverFileName('一元/串串:火锅?')).toBe('一元串串火锅-封面.png');
    expect(coverFileName('   ')).toBe('封面.png');
  });
});
