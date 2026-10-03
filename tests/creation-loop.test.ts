/**
 * 创作闭环扫描（2026-10-02，产品方："任何板块产出的内容都要能无缝衔接，形成闭环"）。
 *
 * 审计时找出的断头路：商业定位、内容定位、创作简报生成完没有下一步；
 * 账号定位 / 内容定位 / 商业定位 / 成交理由只能出不能进。
 * 这里把三条规矩钉死，以后加板块漏接就红：
 *   1. 每个会生成内容的板块，结果下面都有「继续创作」
 *   2. 「继续创作」能去的每个板块，都真的接收带过去的内容
 *   3. 任意两个板块之间都能带（不会有某个组合带过去是空的）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildCreationHandoff, CREATION_DESTINATIONS, CREATION_SOURCES, NOTE_TARGETS, incomingNote } from '@/lib/creation-flow';
import { readCode } from './helpers/source';

const DASH = path.join(process.cwd(), 'app/dashboard');

/** 页面源码；用了共用组件的把组件也算进来 */
function pageCode(board: string): string {
  const own = readCode(`app/dashboard/${board}/page.tsx`);
  return /DeepDivePage/.test(own) ? own + readCode('components/positioning/DeepDivePage.tsx') : own;
}

/** 会生成内容的板块：调 Dify 或者存生成历史的页面 */
const GENERATING = fs.readdirSync(DASH, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(DASH, d.name, 'page.tsx')))
  .map((d) => d.name)
  .filter((b) => /\/api\/dify\/|saveGenerationHistory\(|DeepDivePage/.test(readCode(`app/dashboard/${b}/page.tsx`)));

describe('创作闭环', () => {
  it('扫描没有空转', () => {
    expect(GENERATING.length).toBeGreaterThanOrEqual(15);
  });

  it.each(GENERATING)('「%s」生成完有「继续创作」出口', (board) => {
    expect(CREATION_SOURCES[board], `${board} 不在 CREATION_SOURCES 里，结果下面不会出「继续创作」`).toBeTruthy();
    expect(pageCode(board), `${board} 没有渲染结果面板或继续创作`).toMatch(/<ResultPanel|<CreationLinks/);
  });

  it.each(CREATION_DESTINATIONS.map((d) => d.id))('「%s」能接收带过来的内容', (board) => {
    expect(fs.existsSync(path.join(DASH, board, 'page.tsx')), `${board} 页面不存在`).toBe(true);
    expect(pageCode(board), `${board} 没有 takeHandoff，带过去的内容会丢`).toMatch(/takeHandoff\(/);
  });

  it('定位类和成交理由能进：带入的内容进补充说明 / 店铺特色，点生成就纳入分析', () => {
    for (const b of ['positioning', 'content-positioning', 'business-positioning', 'deal-reason']) expect(NOTE_TARGETS.has(b)).toBe(true);
    expect(pageCode('positioning')).toMatch(/setAdditionalNotes\(incomingNote\(data\)\)/);
    expect(pageCode('content-positioning')).toMatch(/setNotes\(incomingNote\(data\)\)/);
    // 成交理由要等档案回填完再追加，否则被回填盖掉
    expect(pageCode('deal-reason')).toMatch(/incomingRef\.current = data/);
    expect(pageCode('deal-reason')).toMatch(/incomingNote\(incoming, 1200\)/);
  });

  it('带进定位类的补充说明：注明来源，太长截断', () => {
    const note = incomingNote({ from: '高阶自由对话', sourceContent: '聊清楚了：主打川味烧烤和串串' });
    expect(note).toMatch(/^【来自高阶自由对话的内容，请一并纳入分析】/);
    expect(note).toContain('主打川味烧烤和串串');
    expect(incomingNote({ from: 'x', sourceContent: '字'.repeat(5000) }).length).toBeLessThan(1900);
  });

  it('「继续创作」放在正文后面，不在顶部（产品方：放顶部用户看不到）', () => {
    const after = (file: string, body: RegExp) => {
      const src = readCode(file);
      const links = src.search(/<CreationLinks/);
      const md = src.search(body);
      expect(md, `${file} 没找到正文`).toBeGreaterThan(-1);
      expect(links, `${file} 的继续创作在正文前面`).toBeGreaterThan(md);
    };
    after('components/workspace/ResultPanel.tsx', /<Markdown>\{body\}<\/Markdown>/);
    after('app/dashboard/growth/page.tsx', /<Markdown>\{result\}<\/Markdown>/);
    after('components/positioning/DeepDivePage.tsx', /<Markdown>\{result\}<\/Markdown>/);
    // 顶部留一个跳到底部的按钮，结果很长时也找得到
    expect(readCode('components/workspace/ResultPanel.tsx')).toMatch(/label="继续创作" onClick=\{\(\) => document\.getElementById/);
  });

  it('任意来源 → 任意目的地都带得过去，正文不丢', () => {
    const sources = Object.keys(CREATION_SOURCES);
    for (const s of sources) for (const t of CREATION_DESTINATIONS) {
      if (t.id === s) continue;
      const h = buildCreationHandoff(s, t.id, '## 方向一：老板人设\n每天拍后厨', {});
      expect(h.target, `${s}→${t.id}`).toBe(`/dashboard/${t.id}`);
      expect(h.sourceContent, `${s}→${t.id}`).toContain('每天拍后厨');
    }
  });
});
