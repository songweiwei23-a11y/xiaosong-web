import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 回归防线：凡是有生成结果展示区的页面，都必须在进入页面时把上次的内容取回来。
 *
 * 生成结果原本只存在组件 state 里，切到别的页面（组件卸载）或刷新，界面就空了，
 * 用户会以为内容丢了——实际一直在云端历史里，只是没被读回来显示。
 *
 * 两种实现都算达标：
 *   - 调用 useRestoreLastResult（页面用 useGenerationPage/useScriptHistory 时）
 *   - 自行回填且带「仅当前为空才写入」的保护：setXxx(current => current || ...)
 * 后者的函数式写法是关键，直接赋值会在生成结束刷新历史时盖掉刚生成的内容。
 */

const DASHBOARD = path.join(process.cwd(), 'app', 'dashboard');

function collectPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectPages(full));
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

/** 有结果展示区的页面：声明了 result / analysisResult 这类 state */
const RESULT_STATE = /const \[(result|analysisResult), set(Result|AnalysisResult)\] = useState/;

/** 达标的恢复写法 */
const RESTORE_HOOK = /useRestoreLastResult\s*\(/;
const RESTORE_INLINE = /set(?:Result|AnalysisResult)\(\s*\(?\s*current\s*\)?\s*=>\s*current\s*\|\|/;

describe('生成页必须能恢复上次的内容', () => {
  const pages = collectPages(DASHBOARD);
  const resultPages = pages.filter((p) => RESULT_STATE.test(fs.readFileSync(p, 'utf8')));

  it('能扫描到带结果区的页面', () => {
    // 脚本、选题、标题、定位、审稿、分镜、知识库、成交理由
    expect(resultPages.length).toBeGreaterThanOrEqual(7);
  });

  for (const page of resultPages) {
    const rel = path.relative(process.cwd(), page);
    it(`${rel} 进入页面时会取回上次内容`, () => {
      const source = fs.readFileSync(page, 'utf8');
      const ok = RESTORE_HOOK.test(source) || RESTORE_INLINE.test(source);
      expect(
        ok,
        `${rel} 缺少恢复逻辑：应调用 useRestoreLastResult，或用 setResult(current => current || 上次内容) 回填`
      ).toBe(true);
    });
  }
});

describe('两个公共 hook 都要吐出 lastResult', () => {
  const hooks = [
    path.join(process.cwd(), 'hooks', 'useGenerationPage.ts'),
    path.join(process.cwd(), 'app', 'dashboard', 'script', 'useScriptHistory.ts'),
  ];

  for (const hook of hooks) {
    const rel = path.relative(process.cwd(), hook);
    it(`${rel} 返回 lastResult 且只回填一次`, () => {
      const source = fs.readFileSync(hook, 'utf8');
      expect(source, `${rel} 应返回 lastResult`).toMatch(/lastResult/);
      // 必须有「只回填一次」的守卫：生成结束后也会刷新历史，
      // 那时若再回填就会用旧内容盖掉刚生成的结果
      expect(source, `${rel} 应有 restoredRef 之类的一次性守卫`).toMatch(/restoredRef/);
    });
  }
});
