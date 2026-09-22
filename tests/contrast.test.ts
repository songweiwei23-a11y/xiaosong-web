import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 文字对比度守卫：浅色、深色，以及四套配色方案，全部要能看清。
 *
 * 【为什么需要它】这个产品的配色改过很多轮，而对比度问题有三个特点，
 * 合在一起就是「没人会发现」：
 *   1. 不报错、不影响功能；
 *   2. 只在某一套主题下暴露——比如 text-muted-foreground/70 在深色下是
 *      3.91 没问题，浅色下只有 2.85，11px 的大写标签基本看不清；
 *   3. 改配色的人通常只看自己在用的那一套。
 *
 * 用户已经因为这类问题反馈过一次「文字都淹没了」（那次是 prose 漏了
 * dark:prose-invert，见 tests/prose-contrast.test.ts）。这里守的是
 * 另一头：主题变量本身的配比。
 *
 * 判据用 WCAG：正文 4.5:1，小字/次要信息 3:1。
 */

/* ---------- 颜色计算 ---------- */
type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function luminance([r, g, b]: RGB): number {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 半透明前景压在背景上之后的实际颜色 */
function composite(fg: RGB, bg: RGB, alpha: number): RGB {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as RGB;
}

/* ---------- 从 CSS 抽变量 ---------- */
function blockOf(css: string, selector: string): string | null {
  const i = css.indexOf(selector);
  if (i < 0) return null;
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') {
      depth--;
      if (depth === 0) return css.slice(open, j);
    }
  }
  return null;
}

function varsOf(block: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function parseHsl(value: string | undefined): RGB | null {
  const m = String(value ?? '').match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  return m ? hslToRgb(+m[1], +m[2], +m[3]) : null;
}

/* ---------- 组装所有主题 ---------- */
const globals = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const palettesPath = path.join(process.cwd(), 'app/palettes.css');
const palettes = fs.existsSync(palettesPath) ? fs.readFileSync(palettesPath, 'utf8') : '';

const light = varsOf(blockOf(globals, ':root'));
const dark = { ...light, ...varsOf(blockOf(globals, '.dark')) };

const themes: { name: string; vars: Record<string, string> }[] = [
  { name: '浅色', vars: light },
  { name: '深色', vars: dark },
];

for (const m of palettes.matchAll(/\[data-palette=["']?([\w-]+)["']?\]/g)) {
  const v = varsOf(blockOf(palettes, m[0]));
  // 配色方案只覆盖深色，没覆盖到的变量沿用深色的默认值
  if (Object.keys(v).length) themes.push({ name: `配色 ${m[1]}`, vars: { ...dark, ...v } });
}

const BODY = 4.5;
const SMALL = 3.0;

describe('各主题下的文字对比度', () => {
  it('至少扫描到浅色、深色和若干配色方案', () => {
    expect(themes.length).toBeGreaterThanOrEqual(3);
  });

  for (const theme of themes) {
    const v = theme.vars;
    const bg = parseHsl(v.background);
    const card = parseHsl(v.card);
    const fg = parseHsl(v.foreground);
    const muted = parseHsl(v['muted-foreground']);
    const primary = parseHsl(v.primary);
    const opacity = parseFloat(v['glass-opacity'] ?? '1');

    // 卡片是半透明玻璃，文字实际压在「卡片色 × 透明度 + 页面背景」的混合色上，
    // 只拿卡片色算会高估对比度
    const cardReal = bg && card ? composite(card, bg, opacity) : null;

    it(`${theme.name}：正文清晰`, () => {
      expect(bg && card && fg, `${theme.name} 缺少基础颜色变量`).toBeTruthy();
      expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(BODY);
      expect(contrast(fg!, cardReal!)).toBeGreaterThanOrEqual(BODY);
    });

    it(`${theme.name}：次要文字清晰`, () => {
      expect(contrast(muted!, cardReal!)).toBeGreaterThanOrEqual(BODY);
    });

    it(`${theme.name}：小标题（次要文字 70% 透明）达到小字底线`, () => {
      // 界面里十几处区块小标题是 text-muted-foreground/70，
      // 浅色下曾经只有 2.85:1
      const label = composite(muted!, cardReal!, 0.7);
      expect(contrast(label, cardReal!)).toBeGreaterThanOrEqual(SMALL);
    });

    it(`${theme.name}：主色文字在卡片上可读`, () => {
      expect(contrast(primary!, cardReal!)).toBeGreaterThanOrEqual(SMALL);
    });

    it(`${theme.name}：次要文字确实比正文弱，层次没被抹平`, () => {
      // 只顾提高对比度会把次要文字变得和正文一样重，层次就没了
      expect(contrast(muted!, cardReal!)).toBeLessThan(contrast(fg!, cardReal!));
    });
  }
});
