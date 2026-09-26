/**
 * 手机适配。这些毛病在电脑上一个都看不出来，只有拿手机打开才露馅，所以用扫描守住：
 *
 * - 脚本页写死左右两栏、左栏 470px：手机上结果栏被挤成 64px，生成的脚本根本看不了
 * - 工作区两栏各自滚动：手机上表单一长，结果栏被压成 0 高
 * - 自由对话的会话列表常驻 256px、后台侧栏常驻 256px：内容区只剩一条缝
 * - 输入框 13px：iPhone 一点进去整页放大
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import * as SCRIPT_CONSTANTS from '@/app/dashboard/script/constants';

const listFiles = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []
  );

describe('工作区：手机上下排，电脑左右排', () => {
  it('共用骨架：手机上不设里外两层滚动，只有 lg 以上才各自滚动', () => {
    const src = readCode('components/workspace/WorkspaceLayout.tsx');
    expect(src).toMatch(/flex flex-col lg:h-full lg:flex-row/);
    expect(src).toMatch(/lg:w-\[470px\]/);
    // 所有 overflow-y-auto 都得带 lg: 前缀
    expect(src.match(/(?<!lg:)overflow-y-auto/g) ?? []).toEqual([]);
    expect(src).toContain('id="workspace-result"');
  });

  it('脚本页和共用骨架一样：不再写死 470px 左栏', () => {
    const src = readCode('app/dashboard/script/page.tsx');
    expect(src).toMatch(/flex flex-col lg:h-full lg:flex-row/);
    expect(src).not.toMatch(/(?<!lg:)w-\[470px\]/);
    expect(src).toContain('id="workspace-result"');
  });

  it('扫描：后台所有页面都没有不带断点前缀的 300px 以上定宽', () => {
    const files = [...listFiles('app/dashboard'), ...listFiles('components/workspace')];
    expect(files.length).toBeGreaterThan(20); // 自证不是空转
    const bad: string[] = [];
    for (const f of files) {
      const src = readCode(f);
      for (const m of src.matchAll(/(?<![\w:-])w-\[(\d{3,4})px\]/g)) {
        if (Number(m[1]) >= 300) bad.push(`${f}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('手机上点了生成，自动滚到结果区', () => {
    const src = readCode('components/workspace/ResultPanel.tsx');
    expect(src).toMatch(/window\.innerWidth < 1024[\s\S]{0,120}getElementById\("workspace-result"\)[\s\S]{0,40}scrollIntoView/);
  });

  it('各板块的生成按钮在手机上贴底（电脑上照旧）', () => {
    const controls = readCode('components/form/controls.ts');
    expect(controls).toMatch(/GENERATE_BTN = `\$\{PRIMARY_BTN\} sticky bottom-3[^`]*lg:static/);
    for (const p of ['topic', 'knowledge', 'positioning', 'title', 'deal-reason', 'review', 'storyboard']) {
      expect(readCode(`app/dashboard/${p}/page.tsx`), p).toMatch(/className=\{GENERATE_BTN\}/);
    }
  });
});

describe('侧栏：手机上收起、浮在上面', () => {
  it('自由对话的会话列表：手机上浮层，默认收起，选完收起', () => {
    const src = readCode('app/dashboard/free-chat/page.tsx');
    expect(src).toMatch(/absolute inset-y-0 left-0 z-30 flex w-64[^"]*md:static/);
    expect(src).toMatch(/if \(window\.innerWidth < 768\) setSidebarOpen\(false\)/);
    expect(src).toMatch(/100dvh/);
  });

  it('管理后台：手机上侧栏从左边滑出，有顶栏按钮打开', () => {
    const src = readCode('app/admin/layout.tsx');
    expect(src).toMatch(/fixed inset-y-0 left-0 z-40[^`]*md:relative[^`]*md:translate-x-0/);
    expect(src).toMatch(/menuOpen \? "translate-x-0" : "-translate-x-full"/);
    expect(src).toMatch(/aria-label="打开菜单"/);
  });
});

describe('细节', () => {
  it('手机上输入框至少 16px，iPhone 点进去不会放大', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toMatch(/@media \(max-width: 639px\)\s*\{[\s\S]{0,200}textarea,[\s\S]{0,40}select\s*\{\s*font-size: 16px !important;/);
  });

  it('宽表格在框里横滑，不挤扁：markdown 单元格有最小宽度，价格对比表有最小宽度', () => {
    expect(readCode('components/markdown.tsx')).toMatch(/min-w-\[5\.5rem\]/);
    expect(readCode('app/pricing/page.tsx')).toMatch(/min-w-\[34rem\]/);
    expect(readCode('app/pricing/page.tsx')).toMatch(/sticky left-0/);
  });

  it('档案表单的步骤条按宽度伸缩，不再定宽 40px 一段', () => {
    const src = readCode('components/profile/ProfileForm.tsx');
    expect(src).not.toMatch(/h-0\.5 w-10/);
    expect(src).toMatch(/h-0\.5 min-w-2 flex-1/);
  });

  it('脚本页的选项清单没有重复项（重复会显示两个一样的选项）', () => {
    let checked = 0;
    for (const [name, v] of Object.entries(SCRIPT_CONSTANTS)) {
      if (!Array.isArray(v)) continue;
      const keys = v.map((x: any) => (typeof x === 'string' ? x : x?.id ?? x?.label ?? JSON.stringify(x)));
      const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dup, name).toEqual([]);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});
