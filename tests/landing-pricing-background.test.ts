/**
 * 首页「适合您的方案」（#pricing）的背景（2026-10-20）：
 * 原来是实心 bg-muted，浅色下和页面底色几乎一样，看起来像没有背景。
 * 改成和功能、FAQ 区块一样的 glass-panel。这条测试守住这一点。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('首页价格方案区块的背景', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf8');
  const pricingLine = src.split('\n').find((l) => l.includes('id="pricing"')) ?? '';

  it('用 glass-panel，和 features、faq 区块一致', () => {
    expect(pricingLine).toContain('glass-panel');
    expect(src.split('\n').find((l) => l.includes('id="features"'))).toContain('glass-panel');
    expect(src.split('\n').find((l) => l.includes('id="faq"'))).toContain('glass-panel');
  });

  it('不再用实心 bg-muted 盖住氛围光', () => {
    expect(pricingLine).not.toContain('bg-muted');
  });
});
