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

describe('弹出层：手机上从底部升起、自己能滚', () => {
  it('公共弹层：手机上挂到 body（躲开顶栏毛玻璃），限高、能滚、点遮罩关闭', () => {
    const src = readCode('components/ui/AdaptivePopover.tsx');
    expect(src).toMatch(/createPortal\(/);
    expect(src).toMatch(/document\.body\s*\)/);
    expect(src).toMatch(/max-h-\[80dvh\] overflow-y-auto/);
    expect(src).toMatch(/onClick=\{onClose\}/);
  });

  it('外观设置和首页切换档案都用它；"点外面关闭"把手机上的面板也算作里面', () => {
    for (const f of ['components/theme/ThemeToggle.tsx', 'components/dashboard/ProfileQuickSwitch.tsx']) {
      const src = readCode(f);
      expect(src, f).toMatch(/<AdaptivePopover/);
      expect(src, f).toMatch(/panelRef\.current\?\.contains\(t\)/);
    }
  });

  it('追问窗口：手机上全屏，最小化不再定宽 384px', () => {
    const src = readCode('components/ContinuousDialog.tsx');
    expect(src).toMatch(/h-\[100dvh\] w-full rounded-none sm:h-\[80vh\]/);
    expect(src).not.toMatch(/'w-96 h-16'/);
  });

  it('提示条：手机上左右留边，不再从右往左伸出屏幕', () => {
    expect(readCode('components/ui/feedback.tsx')).toMatch(/fixed inset-x-4 top-4 z-\[100\][^"]*sm:left-auto sm:right-4/);
  });
});

describe('顶栏与整体高度', () => {
  it('顶栏：手机上只留图标（邮箱和"退出"两个字在手机上藏起来）', () => {
    const src = readCode('components/auth/UserProfile.tsx');
    expect(src).toMatch(/hidden max-w-\[14rem\] truncate text-foreground sm:inline">\{user\.email\}/);
    expect(src).toMatch(/<span className="hidden sm:inline">退出<\/span>/);
  });

  it('后台整体高度用 dvh：手机浏览器的 100vh 会被地址栏挡住一截', () => {
    expect(readCode('app/dashboard/layout.tsx')).toMatch(/h-screen h-dvh/);
    expect(readCode('components/dashboard/Sidebar.tsx')).toMatch(/h-screen h-dvh/);
  });

  it('扫描：可点的按钮不能只在鼠标悬停时出现（手机没有悬停）', () => {
    const files = [...listFiles('app'), ...listFiles('components')];
    const bad: string[] = [];
    for (const f of files) {
      readCode(f).split('\n').forEach((line, i) => {
        if (!/(^|[\s"`])opacity-0(\s|")/.test(line) || !/group-hover:opacity-100/.test(line)) return;
        // 纯装饰（光晕、箭头动效、分组折叠小三角）不算
        if (/blur|ArrowRight|h-3 w-3 shrink-0/.test(line)) return;
        bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('正文长链接、长英文串自动折行', () => {
    expect(fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8')).toMatch(/\.prose\s*\{\s*overflow-wrap: anywhere;/);
  });
});

describe('登录注册页与独立页面：手机上一定有路可走', () => {
  it('登录页：顶栏占自己一行，内容在下面居中，不再浮在上面被 Logo 盖住', () => {
    /*
     * 实测：375×640 的屏幕上切到注册，内容比屏幕高，整屏居中把 Logo 顶上去，
     * 盖住了「返回首页」和外观按钮，点了没反应；外层 overflow-hidden 还让上面那截滚不回来。
     */
    const src = readCode('app/login/page.tsx');
    expect(src).toMatch(/className="relative flex min-h-screen min-h-dvh flex-col"/);
    expect(src).toMatch(/<header className="relative z-20 shrink-0">/);
    expect(src).toMatch(/<main className="flex flex-1 items-center justify-center/);
    expect(src).not.toMatch(/absolute top-0 left-0 right-0/);
  });

  it('登录页的小按钮：点击区域不低于 36px（忘记密码、今日一计的换一个）', () => {
    expect(readCode('app/login/page.tsx')).toMatch(/-my-3 py-3 pl-3 text-xs text-primary/);
    expect(readCode('components/auth/LoginExtras.tsx')).toMatch(/-my-2\.5 inline-flex[^"]*py-2\.5/);
  });

  it('扫描：没有页面把整屏内容垂直居中又裁掉溢出（手机上内容一高，上面那截就看不到、点不到）', () => {
    const files = [...listFiles('app'), ...listFiles('components')];
    expect(files.length).toBeGreaterThan(100); // 自证不是空转
    const bad: string[] = [];
    for (const f of files) {
      for (const m of readCode(f).matchAll(/className="([^"]*)"/g)) {
        const c = m[1].split(/\s+/);
        if (c.includes('min-h-screen') && c.includes('items-center') && c.includes('overflow-hidden')) bad.push(`${f}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('不在工作台框架里的页面，每一页都有出口链接（手机上没有侧栏可点）', () => {
    const pages = fs
      .readdirSync(path.join(process.cwd(), 'app'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(process.cwd(), 'app', e.name, 'page.tsx')))
      .map((e) => e.name)
      .filter((n) => !['dashboard', 'admin'].includes(n));
    expect(pages.length).toBeGreaterThan(6); // 自证不是空转
    const noExit: string[] = [];
    for (const n of pages) {
      const src = readCode(`app/${n}/page.tsx`);
      if (/redirect\(/.test(src)) continue; // 旧地址直接跳走的
      const legal = /LegalPage/.test(src) ? readCode('components/legal/LegalPage.tsx') : '';
      if (!/href="\/(dashboard[^"]*)?"/.test(src + legal)) noExit.push(n);
    }
    expect(noExit).toEqual([]);
  });

  it('上手引导：顶上就有进工作台的出口（原来只在清单最底下一行小字，全做完时连这行都没有）', () => {
    // 出口在清单上面（中间隔着新手课的入口卡片）
    expect(readCode('app/onboarding/page.tsx')).toMatch(/href="\/dashboard"[\s\S]{0,300}进入工作台[\s\S]{0,1500}<SetupChecklist/);
  });

  it('通用对话框：手机上限高、能滚、左右留边', () => {
    const src = readCode('components/ui/dialog.tsx');
    expect(src).toMatch(/max-h-\[90dvh\] w-\[calc\(100%-2rem\)\][^"]*overflow-y-auto/);
  });

  it('侧栏抽屉：手机上整个一起滚，电脑上只滚菜单', () => {
    const src = readCode('components/dashboard/Sidebar.tsx');
    expect(src).toMatch(/flex-col overflow-y-auto overscroll-contain[^`]*md:overflow-visible/);
    expect(src).toMatch(/<nav className="flex-\[1_0_auto\] px-3 pb-4 md:flex-1 md:overflow-y-auto">/);
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
