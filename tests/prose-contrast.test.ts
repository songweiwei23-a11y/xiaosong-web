import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 回归防线：凡是用了 typography 插件的 `prose` 的地方，必须同时带
 * `dark:prose-invert`。
 *
 * prose 会把正文颜色写死成深灰（#374151）。这个产品是深色为主的，
 * 深灰字配深灰底的结果是正文几乎看不见——只有加粗、引用这些自带
 * 其它样式的元素还能勉强辨认。
 *
 * 这类问题一不报错、二不影响功能、三在浅色主题下完全正常，
 * 只会在用户切到深色时撞上，然后说一句「文字都淹没了」。
 * 自由对话和历史面板就是这么漏掉的，而同一个产品里的 ResultPanel
 * 和 ContinuousDialog 一直是对的。
 */

const ROOTS = ['app', 'components'];

function collectTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsx(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('深色主题下 prose 的对比度', () => {
  const files = ROOTS.flatMap((r) => collectTsx(path.join(process.cwd(), r)));

  /** 取出每一处 className 里含 prose 的完整属性值 */
  function proseClassNames(source: string): string[] {
    const hits: string[] = [];
    // className="..." 与 className={`...`} 两种写法都要覆盖
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
    for (const m of source.matchAll(re)) {
      const value = m[1] ?? m[2] ?? '';
      // \bprose\b 才算——prose-headings 这类修饰符单独出现不构成问题
      if (/(^|\s)prose(\s|$)/.test(value)) hits.push(value);
    }
    return hits;
  }

  const offenders: string[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const cls of proseClassNames(source)) {
      if (!cls.includes('prose-invert')) {
        offenders.push(`${path.relative(process.cwd(), file)} → "${cls.replace(/\s+/g, ' ').trim()}"`);
      }
    }
  }

  it('每一处 prose 都带上了 dark:prose-invert', () => {
    expect(
      offenders,
      '这些地方的 prose 缺少 dark:prose-invert，深色主题下正文会看不见：\n' +
        offenders.join('\n')
    ).toEqual([]);
  });

  it('确实扫描到了用 prose 的文件（防止正则失效导致用例空过）', () => {
    const withProse = files.filter((f) => proseClassNames(fs.readFileSync(f, 'utf8')).length > 0);
    expect(withProse.length).toBeGreaterThan(0);
  });
});
