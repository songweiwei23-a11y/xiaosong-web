import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 回归防线：任何调用 /api/dify/stream 的页面都必须显式传 taskType。
 *
 * 缺失 taskType 时后端会兜底成"未知"，后果有三层且都不会报错，
 * 只会静默劣化，很难在使用中发现：
 *   1. buildSearchQuery 取不到主题提示词，知识库检索命中率下降；
 *   2. Dify 会话按 `taskType:profileId` 分档，全部落到"未知:default"
 *      后，脚本、选题、审稿的上下文互相污染；
 *   3. getFeatureFromTaskType 兜底返回 'script'，用量记到错误的功能上
 *      （选题曾长期扣的是脚本额度）。
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

/** 截取 fetch("/api/dify/stream", {...}) 这一整个调用的文本 */
function extractStreamCalls(source: string): string[] {
  const calls: string[] = [];
  const marker = '/api/dify/stream';
  let from = 0;

  while (true) {
    const hit = source.indexOf(marker, from);
    if (hit === -1) break;
    from = hit + marker.length;

    // 从调用处向后取一段，覆盖到 body 结束即可；括号配平比正则更可靠。
    let depth = 0;
    let started = false;
    let end = from;
    for (let i = from; i < source.length; i++) {
      const c = source[i];
      if (c === '(') { depth++; started = true; }
      else if (c === ')') {
        depth--;
        if (started && depth <= 0) { end = i; break; }
      }
    }
    calls.push(source.slice(hit, end));
  }
  return calls;
}

describe('dify/stream 调用方必须声明 taskType', () => {
  const pages = collectPages(DASHBOARD);

  it('能扫描到 dashboard 页面', () => {
    expect(pages.length).toBeGreaterThan(5);
  });

  const callers = pages.filter((p) =>
    fs.readFileSync(p, 'utf8').includes('/api/dify/stream')
  );

  it('存在调用 /api/dify/stream 的页面', () => {
    expect(callers.length).toBeGreaterThan(0);
  });

  for (const page of callers) {
    const rel = path.relative(process.cwd(), page);
    it(`${rel} 的每次调用都带 taskType`, () => {
      const source = fs.readFileSync(page, 'utf8');
      for (const call of extractStreamCalls(source)) {
        expect(call, `${rel} 有一处 /api/dify/stream 调用未传 taskType`).toMatch(
          /taskType\s*:/
        );
      }
    });
  }
});
