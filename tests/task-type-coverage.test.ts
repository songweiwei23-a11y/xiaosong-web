import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';
import { SEARCH_TOPIC_HINT } from '@/lib/search-query';

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

  /**
   * 光有 taskType 不够——值还得是计费表认识的。
   *
   * 这一条正是之前漏网的地方：知识库页和成交理由页发的是 '知识库查询'，
   * 表里写的是 '知识库'；分镜页的推荐按钮发 'AI推荐'，表里没有。
   * 三者都通过了「有没有传」的检查，却全部兜底成 script，
   * 于是知识库查询去扣脚本额度，一扣就是几十次没人发现。
   */
  describe('taskType 的值必须在计费表里', () => {
    for (const page of callers) {
      const rel = path.relative(process.cwd(), page);
      const source = fs.readFileSync(page, 'utf8');
      const values = extractStreamCalls(source)
        .map((call) => call.match(/taskType\s*:\s*["'](.+?)["']/)?.[1])
        .filter((v): v is string => !!v);

      for (const value of values) {
        it(`${rel} 的「${value}」已登记`, () => {
          expect(
            TASK_TYPE_TO_FEATURE[value],
            `「${value}」不在 lib/task-type.ts 的映射表里，用量会被错记到脚本生成名下`
          ).toBeTruthy();
        });
      }
    }
  });

  /**
   * 上面那组只扫 app/dashboard 下的 page.tsx，**盖不住把请求委托给组件的页面**。
   *
   * 商业定位和内容定位就是这样：页面本身只写
   * `<DeepDivePage taskType="商业定位" …/>`，真正的 fetch 在组件里，
   * 组件拿到的是变量而不是字面量。两边都躲过了检查——
   * 而漏登记的后果是静默扣到「脚本生成」的额度，正是这条防线要防的事。
   *
   * 所以再扫一遍全仓库的 taskType 字面量，两种写法都认：
   * 对象属性 `taskType: "X"` 和 JSX 属性 `taskType="X"`。
   */
  it('全仓库出现的 taskType 字面量都已登记', () => {
    const roots = ['app', 'components', 'lib'].map((d) => path.join(process.cwd(), d));
    const files: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name)) files.push(full);
      }
    };
    roots.forEach(walk);

    const seen = new Map<string, string>(); // 任务类型 -> 首次出现的文件
    for (const f of files) {
      const rel = path.relative(process.cwd(), f).replace(/\\/g, '/');
      // task-type.ts 自己就是那张表，跳过
      if (rel === 'lib/task-type.ts') continue;
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/taskType\s*[:=]\s*["']([^"']+)["']/g)) {
        if (!seen.has(m[1])) seen.set(m[1], rel);
      }
    }

    expect(seen.size, '一个 taskType 字面量都没扫到，说明扫描写错了').toBeGreaterThan(5);

    const bad = [...seen.entries()]
      .filter(([v]) => !TASK_TYPE_TO_FEATURE[v])
      .map(([v, f]) => `${v}（${f}）`);
    expect(bad, `这些 taskType 没在计费表里，用量会被错记到脚本生成名下：\n${bad.join('\n')}`).toEqual([]);
  });

  /**
   * 计费表里的每个任务类型也都该有检索主题词的条目。
   * 缺了不会报错，只会让知识库召回失去锚点——属于典型的静默劣化。
   */
  it('计费表里的任务类型都在检索主题词表中有条目', () => {
    const missing = Object.keys(TASK_TYPE_TO_FEATURE).filter(
      (t) => !(t in SEARCH_TOPIC_HINT)
    );
    expect(missing, `这些任务类型缺少检索主题词条目：${missing.join('、')}`).toEqual([]);
  });

  /**
   * 流式响应必须交给 lib/sse-stream 统一解析，不能各页面手写。
   *
   * 手写版本反复出现两个同样的缺陷，且都不会报错、只在长文本里偶发：
   *   - decode(value) 未传 { stream: true }：中文一个字占 3 字节，被拆到
   *     两个数据块边界上时会解码成乱码；
   *   - 没有跨块行缓冲：被截断的半行 JSON 解析失败后整行丢弃，内容缺一截。
   */
  describe('流式解析必须复用 readDifyStream', () => {
    for (const page of callers) {
      const rel = path.relative(process.cwd(), page);
      it(`${rel} 不手写 SSE 解析`, () => {
        const source = fs.readFileSync(page, 'utf8');
        expect(source, `${rel} 应从 @/lib/sse-stream 引入 readDifyStream`).toMatch(
          /readDifyStream/
        );
        // decode 必须开启 stream 模式；裸 decode(value) 一律视为手写残留
        const bareDecode = /decoder\.decode\(\s*value\s*\)/.test(source);
        expect(bareDecode, `${rel} 存在未开 stream 模式的 decode(value)`).toBe(false);
      });
    }
  });
});
