import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';

/**
 * 板块做出来了、但进不去，等于没做。
 *
 * 这一轮连加了商业定位、内容定位、创作简报、起号四个板块，
 * 每个都要在三个地方登记：侧边栏、工作台首页、历史记录的路由映射。
 * 漏掉侧边栏就得手输网址；漏掉历史映射，点一条旧记录会跳到 /history。
 * 全是"不报错、只是用不到"的那类问题，只能靠扫描守住。
 */

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** 所有 dashboard 下的板块页面（排除动态路由和子页） */
function boardRoutes(): string[] {
  const root = path.join(process.cwd(), 'app', 'dashboard');
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('[') && !e.name.startsWith('_'))
    .filter((e) => fs.existsSync(path.join(root, e.name, 'page.tsx')))
    .map((e) => `/dashboard/${e.name}`);
}

/** 这些是子页或内部页，不需要出现在导航里 */
const NOT_A_BOARD = new Set([
  '/dashboard/components',
  '/dashboard/profiles', // 档案在首页「先打地基」里，侧边栏也有
  // 付费页从额度用完的提示进，不占导航位
  '/dashboard/membership',
]);

describe('每个板块都进得去', () => {
  const sidebar = read('components/dashboard/Sidebar.tsx');
  const home = read('app/dashboard/page.tsx');
  const routes = boardRoutes().filter((r) => !NOT_A_BOARD.has(r));

  it('扫到了足够多的板块', () => {
    expect(routes.length).toBeGreaterThan(8);
  });

  for (const route of routes) {
    it(`${route} 在侧边栏有入口`, () => {
      expect(sidebar, `${route} 没加到侧边栏，用户只能手输网址`).toContain(route);
    });

    it(`${route} 在工作台首页有入口`, () => {
      expect(home, `${route} 没加到首页`).toContain(route);
    });
  }
});

describe('历史记录点得回去', () => {
  const home = read('app/dashboard/page.tsx');

  /**
   * 会写历史的任务类型，都要有路由映射。
   * 没有的话点一条旧记录会跳到 /history，用户以为记录坏了。
   */
  it('每个计费任务类型都能映射回它的页面', () => {
    // AI推荐是分镜页内部用的，不单独出历史
    const skip = new Set(['AI推荐', '自由对话']);
    const missing = Object.keys(TASK_TYPE_TO_FEATURE)
      .filter((t) => !skip.has(t))
      .filter((t) => !new RegExp(`${t}:\\s*["']/dashboard`).test(home));
    expect(missing, `这些任务类型点历史会跳错：${missing.join('、')}`).toEqual([]);
  });
});

describe('跨板块交接', () => {
  /**
   * 用户要的是「彻底互通」：选题生成完能直接去设计开篇，
   * 脚本写完能直接换个开头，开篇页能看到刚生成的选题和脚本。
   */
  it('选题页有「设计开篇」入口', () => {
    const src = read('app/dashboard/topic/page.tsx');
    expect(src).toContain('设计开篇');
    expect(src).toMatch(/tab:\s*["']opening["']/);
    expect(src).toContain('/dashboard/growth');
  });

  it('脚本页有「换个开头」入口，并带上正文开头', () => {
    const src = read('app/dashboard/script/page.tsx');
    expect(src).toContain('换个开头');
    // 脚本两三千字，让用户自己从里面找开头是多余的
    expect(src).toMatch(/currentOpening:\s*extractOpening\(body\)/);
  });

  it('起号页接得住交接，并能列出最近的选题和脚本', () => {
    const src = read('app/dashboard/growth/page.tsx');
    expect(src).toMatch(/takeHandoff\(\)/);
    expect(src).toContain('recentTopics');
    expect(src).toContain('recentScripts');
    // 点一条脚本要能把开头调出来改
    expect(src).toContain('extractOpening(s.body)');
  });
});

/**
 * 内部链接必须指向真实存在的路由。
 *
 * 这条是扫描顺带逮到的：额度用完的提示里「立即升级套餐」指向
 * /dashboard/subscription，而那个页面根本不存在——用户点了进 404，
 * 等于把付费入口堵死了。这类问题不报错、构建正常，只有真点一下才知道。
 */
describe('内部链接都指向存在的页面', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.tsx$/.test(e.name)) out.push(full);
    }
    return out;
  };

  /** 某个 /dashboard/xxx 或 /xxx 路由有没有对应的 page.tsx */
  const routeExists = (route: string) => {
    const segs = route.replace(/^\//, '').split('/').filter(Boolean);
    const dir = path.join(process.cwd(), 'app', ...segs);
    if (fs.existsSync(path.join(dir, 'page.tsx'))) return true;
    // 动态路由：父目录下有 [xxx]
    const parent = path.join(process.cwd(), 'app', ...segs.slice(0, -1));
    if (!fs.existsSync(parent)) return false;
    return fs
      .readdirSync(parent, { withFileTypes: true })
      .some((e) => e.isDirectory() && e.name.startsWith('['));
  };

  /**
   * 写死的站内路径。三种写法都要认：
   *   JSX        <Link href="/dashboard/xxx">
   *   配置对象   { href: "/dashboard/xxx" }
   *   代码跳转   router.push("/dashboard/xxx") / router.replace / redirect
   * 带 ${} 的模板字符串是动态的，扫不了，跳过。
   */
  const LINK_RE =
    /(?:href\s*[=:]\s*\{?\s*|router\.(?:push|replace)\(\s*|redirect\(\s*|location\.href\s*=\s*)["'](\/[^"'`\s]*)["']/g;

  /** 扫到的所有链接，供下面两条用例共享 */
  const links: { file: string; route: string }[] = [];
  for (const f of [
    ...walk(path.join(process.cwd(), 'app')),
    ...walk(path.join(process.cwd(), 'components')),
  ]) {
    const rel = path.relative(process.cwd(), f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(LINK_RE)) {
      // 去掉 ?query 和 #hash，只留路径
      const route = m[1].split(/[?#]/)[0].replace(/\/$/, '');
      if (!route || route === '/') continue;
      links.push({ file: rel, route });
    }
  }

  /**
   * 扫描本身得先站得住。之前这条正则漏了 href 和引号之间的 `=`，
   * 结果 83 个文件只扫出 13 条链接、全是 router.push，JSX 里的一条没看见——
   * 用例照样绿。所以先卡一个下限，别让它哪天又悄悄扫空。
   */
  it('确实扫到了链接', () => {
    expect(links.length).toBeGreaterThan(30);
    expect(new Set(links.map((l) => l.file)).size).toBeGreaterThan(8);
  });

  it('没有指向不存在页面的链接', () => {
    const bad = links.filter((l) => !routeExists(l.route)).map((l) => `${l.file} → ${l.route}`);
    expect([...new Set(bad)], `这些链接指向不存在的页面，点了会 404：\n${bad.join('\n')}`).toEqual([]);
  });
});

describe('从脚本正文里截开头', () => {
  it('去掉结构标记，只留要念的话', async () => {
    const { extractOpening } = await import('@/lib/handoff');
    const script = `# 脚本标题

【开场】0-5秒：60多吃潮汕牛肉自助，你敢信是原切的吗？

【中段】5-40秒：今天直接带你们进后厨。`;
    const out = extractOpening(script);
    expect(out).toContain('60多吃潮汕牛肉自助');
    expect(out).not.toContain('【开场】');
    expect(out).not.toContain('0-5秒');
    expect(out).not.toContain('#');
    // 只要开头那一段，不要把中段也带上
    expect(out).not.toContain('进后厨');
  });

  it('太长时按句号断，不切在半句上', async () => {
    const { extractOpening } = await import('@/lib/handoff');
    const long = '第一句话写得很长很长很长很长很长。' + '第二句也不短不短不短不短不短。' + '第三句继续。';
    const out = extractOpening(long, 40);
    expect(out.endsWith('。')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(40);
  });

  it('空值不炸', async () => {
    const { extractOpening } = await import('@/lib/handoff');
    for (const x of ['', '   ', null as unknown as string, undefined as unknown as string]) {
      expect(extractOpening(x)).toBe('');
    }
  });
});

/**
 * 首页的主流程要和真实能走通的链路一致。
 *
 * 原来是选题→脚本→分镜三步，那时候板块之间并没打通，摆成流程只是好看。
 * 现在开篇和标题都在链上，埋在「更多工具」里等于告诉用户这条链不存在。
 */
describe('首页主流程就是真实链路', () => {
  const home = read('app/dashboard/page.tsx');
  const flow = home.slice(home.indexOf('const MAIN_FLOW'), home.indexOf('const FOUNDATION'));

  it('五步齐全，顺序和实际交接一致', () => {
    const order = ['/dashboard/topic', '/dashboard/growth', '/dashboard/script',
                   '/dashboard/storyboard', '/dashboard/title'];
    const seen = order.map((r) => flow.indexOf(r));
    expect(seen.every((i) => i >= 0), '有步骤没进主流程').toBe(true);
    // 必须是递增的：顺序错了用户会按错的次序做
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('开篇直接落在开篇标签上，不用再点一下', () => {
    expect(flow).toContain('/dashboard/growth?tab=opening');
  });

  it('提到了「不用复制粘贴」——这条链通了但不说没人知道', () => {
    expect(home).toContain('不用复制粘贴');
  });

  it('标题不再重复出现在更多工具里', () => {
    const tools = home.slice(home.indexOf('const MORE_TOOLS'), home.indexOf('const TASK_ROUTES'));
    expect(tools).not.toContain('/dashboard/title');
    // 起号打法那一半还在工具里，并且直接落到打法标签
    expect(tools).toContain('/dashboard/growth?tab=plan');
  });
});

describe('起号页认得出地址栏里的标签', () => {
  const src = read('app/dashboard/growth/page.tsx');

  it('读 ?tab= 并且只认两个合法值', () => {
    expect(src).toContain("new URLSearchParams(window.location.search).get('tab')");
    expect(src).toMatch(/t === 'opening' \|\| t === 'plan'/);
  });

  it('不用 useSearchParams——那会要求整页包 Suspense', () => {
    // 只看有没有真的用：代码里那句注释本身就提到了这个名字，
    // 光查字符串会命中注释（和之前 grep 误报断链是同一类坑）
    expect(src).not.toMatch(/import\s*\{[^}]*useSearchParams/);
    expect(src).not.toMatch(/useSearchParams\s*\(/);
  });
});
