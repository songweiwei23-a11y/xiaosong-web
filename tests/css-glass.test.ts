import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 回归防线：backdrop-filter 的带前缀版本必须写在标准版本**之前**。
 *
 * 【踩过的坑】源码里原本是这个顺序：
 *
 *   backdrop-filter: blur(...);
 *   -webkit-backdrop-filter: blur(...);
 *
 * 构建时 CSS 压缩会把这两条合并成一条，保留的是**后写的那个属性名**，
 * 也就是 -webkit- 版本。而 Chrome 只认标准的 backdrop-filter
 * （CSS.supports('-webkit-backdrop-filter') 返回 false），
 * 于是编译产物里的模糊在浏览器里完全不生效。
 *
 * 实测确认过：改顺序之前，.glass-panel 的计算样式是
 * `backdrop-filter: none`——整个产品的毛玻璃一直是死的，
 * 包括侧边栏。这件事不报错、不影响功能，只是「看起来有点素」，
 * 所以从上线起就没人发现。
 *
 * 顺序反过来之后，压缩保留标准属性，老 Safari 仍能从前缀版本受益。
 */

const CSS_FILES = ['app/globals.css', 'app/palettes.css'];

describe('毛玻璃的 backdrop-filter 写法', () => {
  for (const rel of CSS_FILES) {
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) continue;

    it(`${rel} 里 -webkit- 版本都写在标准版本之前`, () => {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      const problems: string[] = [];

      lines.forEach((line, i) => {
        // 只看标准属性的声明行（排除注释和 -webkit- 那行本身）
        const isStandard = /^\s*backdrop-filter\s*:/.test(line);
        if (!isStandard) return;

        const prev = lines[i - 1] ?? '';
        const next = lines[i + 1] ?? '';

        if (/-webkit-backdrop-filter\s*:/.test(next)) {
          problems.push(
            `第 ${i + 1} 行：标准属性写在了 -webkit- 之前，` +
              `压缩后会只剩 -webkit-，Chrome 认不了`
          );
        } else if (!/-webkit-backdrop-filter\s*:/.test(prev)) {
          problems.push(`第 ${i + 1} 行：缺少配套的 -webkit-backdrop-filter`);
        }
      });

      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  it('globals.css 里确实声明了模糊（防止正则失效导致用例空过）', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
    const count = (css.match(/^\s*backdrop-filter\s*:/gm) || []).length;
    expect(count).toBeGreaterThan(0);
  });

  it('卡片与侧边栏各自有独立的模糊半径变量', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
    // 卡片数量多，半径要比侧边栏轻；两者共用一个变量就没法分别调
    expect(css).toMatch(/--glass-blur\s*:/);
    expect(css).toMatch(/--panel-blur\s*:/);
  });

  /**
   * 参与 box-shadow 列表组合的变量不能取值 `none`。
   *
   * 踩过的坑：深色下 --panel-shadow 是 none，而卡片写的是
   * `box-shadow: var(--panel-shadow), var(--panel-highlight)`。
   * CSS 不允许 none 出现在阴影列表里，整条声明被判非法丢弃，
   * 顶边高光于是一条都没生效——而模糊是好的，所以问题很难看出来。
   * 要「没有阴影」就用零尺寸全透明阴影。
   */
  it('阴影类变量不取 none，否则组合进列表会让整条声明失效', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
    const bad = [...css.matchAll(/--(panel-shadow|panel-shadow-hover|panel-highlight)\s*:\s*none\s*;/g)]
      .map((m) => m[1]);
    expect(bad, `这些变量取了 none，会让 box-shadow 的列表组合整条失效：${bad.join('、')}`).toEqual([]);
  });
});
