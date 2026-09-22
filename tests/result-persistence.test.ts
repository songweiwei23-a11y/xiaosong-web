import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 每个生成页离开再回来，内容都该还在。
 *
 * 【为什么要卡这个】生成出来的正文只活在组件 state 里，切到别的页面
 * 再切回来（组件被卸载重建）或刷新，界面就空了——用户以为内容丢了，
 * 其实一直在库里躺着，只是没被取回来显示。
 *
 * 成交理由页当初就是这样（「本页原先既不保存也不恢复」），
 * 商业定位和内容定位也漏了：它们只读账号定位当地基，
 * **从来没读过自己上次的产出**。别的生成页都有恢复，只有这两个没有。
 *
 * 所以立成规则：新加生成页忘了做恢复，这条会红。
 */

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * 认可的恢复方式有几种，只要用了其中一种就算过：
 *   useRestoreLastResult  从云端历史回填（多数生成页）
 *   从 /api/positioning 按类型读回自己上次的产出（定位族）
 *   页面自己写的 restore（成交理由）
 */
function hasRestore(src: string): boolean {
  return (
    /useRestoreLastResult/.test(src) ||
    /setResult\(\s*\(cur\w*\)\s*=>\s*cur\w*\s*\|\|/.test(src) ||
    /setResult\(\s*\(current\)\s*=>\s*current\s*\|\|/.test(src) ||
    /setAnalysisResult\(\s*\(current\)\s*=>\s*current\s*\|\|/.test(src) ||
    /setValues\(parseBrief\(/.test(src)
  );
}

const PAGES: Array<[string, string]> = [
  ['选题策划', 'app/dashboard/topic/page.tsx'],
  ['脚本生成', 'app/dashboard/script/page.tsx'],
  ['分镜脚本', 'app/dashboard/storyboard/page.tsx'],
  ['审稿优化', 'app/dashboard/review/page.tsx'],
  ['标题封面', 'app/dashboard/title/page.tsx'],
  ['账号定位', 'app/dashboard/positioning/page.tsx'],
  ['成交理由', 'app/dashboard/deal-reason/page.tsx'],
  ['创作简报', 'app/dashboard/creative-brief/page.tsx'],
  // 商业定位和内容定位共用这个组件
  ['商业/内容定位', 'components/positioning/DeepDivePage.tsx'],
];

describe('离开页面再回来，内容还在', () => {
  for (const [name, rel] of PAGES) {
    it(`${name}会把上次的结果取回来`, () => {
      expect(hasRestore(read(rel)), `${name}（${rel}）没有任何恢复机制`).toBe(true);
    });
  }
});

describe('恢复不能覆盖用户正在看的内容', () => {
  /**
   * 回填必须是「仅当前为空时写入」。无条件 setResult(saved) 会把
   * 用户刚生成的、或正在流式输出的内容盖掉。
   */
  it('深挖页用的是「为空才填」', () => {
    const src = read('components/positioning/DeepDivePage.tsx');
    expect(src).toMatch(/setResult\(\(cur\) => cur \|\| mine\.full_content\)/);
  });

  it('通用 hook 也是「为空才填」', () => {
    const src = read('hooks/useRestoreLastResult.ts');
    expect(src).toMatch(/setResult\(\(current\) => current \|\| lastResult\)/);
  });
});

describe('深挖页读的是自己那一类，不是别人的', () => {
  const src = read('components/positioning/DeepDivePage.tsx');

  it('按 title 取回本页类型的产出', () => {
    // 商业定位页取「商业定位」，内容定位页取「内容定位」，
    // 取错就会把另一个板块的产出显示在这里
    expect(src).toMatch(/get\('账号定位'\), get\(title\)/);
  });

  it('同时取地基和自己的产出，不是只取地基', () => {
    expect(src).toContain('六维地基，当这次深挖的基础');
    expect(src).toContain('上次生成的结果');
  });

  it('标出生成时间，让用户知道这是存档', () => {
    expect(src).toContain('savedAt');
    expect(src).toContain('生成');
  });
});
