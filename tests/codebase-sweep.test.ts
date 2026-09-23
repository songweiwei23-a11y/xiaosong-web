import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './helpers/source';

/**
 * 全仓库的缺陷模式扫描。
 *
 * 这一轮排查里反复出现同一类问题：**不报错、不影响构建、只在特定条件下
 * 才被用户撞见**。它们逃过了类型检查、测试和人工 review，靠的是
 * 「看起来很正常」：
 *
 *   · 毛玻璃的 backdrop-filter 被构建工具吃掉 —— 只是「看着有点素」
 *   · prose 少了 dark:prose-invert —— 浅色主题下完全正常
 *   · bg-${color}-100 这种运行时类名 —— Tailwind 扫不到，颜色静默消失
 *   · .update().eq('user_id') —— 没有那行就影响 0 行，接口照样报成功
 *   · 写 current_period_end 到 subscriptions —— 表上没这列，功能从没成功过
 *   · 页面把服务端的 402 文案丢掉 —— 额度用完显示成「生成失败，请重试」
 *   · 硬编码的 API key —— 能跑，只是谁看到仓库谁就能用
 *
 * 每修一类，就在这里加一条，让它不会再回来。
 */

const ROOTS = ['app', 'lib', 'components', 'hooks'];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(path.join(process.cwd(), r)));
const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, '/');

/*
 * 去注释已搬到 tests/helpers/source.ts。
 *
 * 原先这里那版多了一条专门处理 JSX 花括号注释的规则，而它是错的：
 * `} else {` 后面紧跟块注释时，那个左花括号会被当成 JSX 注释的开头，
 * 一路吞到很远处才收尾，把中间的真代码一起删掉。
 * 实测 app/page.tsx 因此少扫 5593 个字符——扫描器少看了那么多代码，
 * 报出来的「干净」是不作数的。
 *
 * 去掉那条特判就对了：块注释统一去掉之后，JSX 注释自然只剩一对空花括号。
 */

const sources = files.map((f) => ({ file: f, raw: fs.readFileSync(f, 'utf8') }))
  .map((x) => ({ ...x, code: stripComments(x.raw) }));

/** 把违规位置整理成「文件:行号」，便于直接点开 */
function locate(file: string, code: string, index: number) {
  return `${rel(file)}:${code.slice(0, index).split('\n').length}`;
}

describe('全仓库缺陷模式扫描', () => {
  it('扫描到了足够多的源文件（防止路径写错导致用例空过）', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('没有运行时拼接的 Tailwind 类名', () => {
    // Tailwind 构建时扫描源码收集类名，`bg-${x}-100` 这种它看不见，
    // 对应样式压根不会生成——不报错，只是颜色没了
    const bad: string[] = [];
    for (const { file, code } of sources) {
      for (const m of code.matchAll(/(?:bg|text|border|from|to|ring|fill|stroke)-\$\{/g)) {
        bad.push(locate(file, code, m.index!));
      }
    }
    expect(bad, `这些类名是运行时拼出来的，样式不会生效：\n${bad.join('\n')}`).toEqual([]);
  });

  it('没有硬编码的密钥', () => {
    const bad: string[] = [];
    const extra = walk(path.join(process.cwd(), 'tests'));
    const all = [...sources, ...extra.map((f) => ({ file: f, code: fs.readFileSync(f, 'utf8') }))];
    for (const { file, code } of all) {
      for (const m of code.matchAll(/(app-[A-Za-z0-9]{20,}|dataset-[A-Za-z0-9]{20,})/g)) {
        bad.push(`${locate(file, code, m.index!)} → ${m[0].slice(0, 12)}…`);
      }
    }
    expect(bad, `密钥不能写进仓库：\n${bad.join('\n')}`).toEqual([]);
  });

  it('流式解析都开了 stream 模式', () => {
    // decode(value) 不传 {stream:true}：中文一个字三字节，
    // 被拆在两个数据块边界上时会解码成乱码
    const bad: string[] = [];
    for (const { file, code } of sources) {
      for (const m of code.matchAll(/decoder\.decode\(\s*value\s*\)/g)) {
        bad.push(locate(file, code, m.index!));
      }
    }
    expect(bad, `这些地方的中文会偶发乱码：\n${bad.join('\n')}`).toEqual([]);
  });

  it('生成页都把服务端的错误文案带给用户', () => {
    // 直接 throw new Error("生成失败") 会丢掉服务端的 402 文案，
    // 额度用完显示成「生成失败，请重试」，用户于是一直重试
    const bad: string[] = [];
    for (const { file, code } of sources) {
      if (!/app\/dashboard\/.*page\.tsx$/.test(rel(file))) continue;
      for (const m of code.matchAll(/if\s*\(\s*!\s*\w+\.ok\s*\)\s*throw new Error\(/g)) {
        bad.push(locate(file, code, m.index!));
      }
    }
    expect(bad, `应改用 throwApiError：\n${bad.join('\n')}`).toEqual([]);
  });

  it('对 subscriptions 不使用 user_quotas 的列名', () => {
    // 这张表上是 start_date / end_date。写成 current_period_* 会报列不存在，
    // 「设置会员到期时间」就是因此从没成功过
    const bad: string[] = [];
    for (const { file, code } of sources) {
      if (!/from\(['"]subscriptions['"]\)/.test(code)) continue;
      for (const m of code.matchAll(/current_period_(start|end)/g)) {
        const before = code.slice(Math.max(0, m.index! - 400), m.index!);
        if (/subscriptions/.test(before) && !/user_quotas/.test(before.slice(-200))) {
          bad.push(`${locate(file, code, m.index!)} → ${m[0]}`);
        }
      }
    }
    expect(bad, `subscriptions 表上没有这些列：\n${bad.join('\n')}`).toEqual([]);
  });

  it('页面里没有写死的套餐价格与额度', () => {
    // 价格曾经在四个地方各写一份，企业版首页 199、收款页收 599
    const bad: string[] = [];
    for (const { file, code } of sources) {
      if (!/\.tsx$/.test(rel(file))) continue;
      for (const m of code.matchAll(/(?:price|yearlyPrice|quota)\s*[:=]\s*(\d{2,4})/g)) {
        bad.push(`${locate(file, code, m.index!)} → ${m[0]}`);
      }
    }
    expect(bad, `应从 lib/config/plans.ts 取值：\n${bad.join('\n')}`).toEqual([]);
  });

  it('每个 API 路由都有身份校验', () => {
    const bad: string[] = [];
    for (const { file, code } of sources) {
      if (!/app\/api\/.*route\.ts$/.test(rel(file))) continue;
      const name = rel(file).replace('app/api/', '/api/').replace('/route.ts', '');
      // 公开入口：站点统计、注册（注册本身靠邀请码把关）
      if (/\/api\/(public|auth\/register)/.test(name)) continue;
      if (!/requireAdmin|requireUserWithQuota|requireUser\b|getUser\(\)/.test(code)) {
        bad.push(name);
      }
    }
    expect(bad, `这些接口任何人都能调：\n${bad.join('\n')}`).toEqual([]);
  });

  it('前端调用的接口都真实存在', () => {
    const existing = sources
      .filter((s) => /app\/api\/.*route\.ts$/.test(rel(s.file)))
      .map((s) => rel(s.file).replace('app/api/', '/api/').replace('/route.ts', ''));

    const called = new Set<string>();
    for (const { code } of sources) {
      for (const m of code.matchAll(/fetch\(\s*[`'"](\/api\/[^`'"?${]*)/g)) {
        called.add(m[1].replace(/\/$/, ''));
      }
    }

    const missing = [...called].filter(
      (c) => !existing.includes(c) && !existing.some((e) => c.startsWith(e + '/'))
    );
    expect(missing, `这些接口被调用但不存在：\n${missing.join('\n')}`).toEqual([]);
  });

  it('没有从未被引用的 lib / hooks 模块', () => {
    const others = (self: string) =>
      sources.filter((s) => s.file !== self).map((s) => s.code).join('\n') +
      walk(path.join(process.cwd(), 'tests')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

    const bad: string[] = [];
    for (const { file } of sources) {
      const r = rel(file);
      const m = r.match(/^(lib|hooks)\/(.+)\.tsx?$/);
      if (!m) continue;
      const spec = `@/${m[1]}/${m[2].replace(/\/index$/, '')}`;
      // 结尾要卡住，否则 @/lib/admin 会误匹配 @/lib/admin-auth
      const re = new RegExp(spec.replace(/[/\-.]/g, '\\$&') + `['"]`);
      if (!re.test(others(file))) bad.push(r);
    }
    expect(bad, `这些模块没有任何地方引用：\n${bad.join('\n')}`).toEqual([]);
  });

  /**
   * Markdown 渲染只能走 components/markdown。
   *
   * 分镜正文是一张 7 列表格，但页面上渲染成了一整段流水账。原因是
   * react-markdown 默认只认 CommonMark，表格属于 GFM 扩展，不挂 remark-gfm
   * 就不识别——而且不报错：那些行被当成一个普通段落，Markdown 又会把
   * 段落内的单换行折叠成空格，于是整张表塌成一行。
   *
   * 当时全站 5 个渲染点全漏了插件，分镜页还 import 了 remarkGfm 却没用上
   * （真正渲染的是 ResultPanel），看代码只会以为早就支持了。
   * 这种「不报错、构建正常、只是显示不对」的事，靠人记是记不住的。
   */
  it('Markdown 渲染都走统一组件（否则表格不会被识别）', () => {
    const bad: string[] = [];
    for (const { file, code } of sources) {
      if (rel(file) === 'components/markdown.tsx') continue;
      for (const m of code.matchAll(/from\s+['"]react-markdown['"]|from\s+['"]remark-gfm['"]/g)) {
        bad.push(locate(file, code, m.index!));
      }
    }
    expect(
      bad,
      `这些地方直接用了 react-markdown / remark-gfm：\n${bad.join('\n')}\n` +
        `改用 <Markdown>（@/components/markdown）——它挂了 remark-gfm，表格才认得出来。`
    ).toEqual([]);
  });

  /**
   * 「当前在用哪个档案」只能走 lib/active-profile。
   *
   * 之前有三个地方各自往 localStorage.activeProfileId 写，只有侧边栏那个会广播
   * profileChanged。于是从档案总览页切了账号，定位页和各创作板块收不到通知，
   * 界面上显示的档案和实际进提示词的档案悄悄错开——不报错、构建正常，
   * 用户也看不出来，只会觉得「AI 怎么答得不对」。这种只能靠扫描守住。
   */
  it('activeProfileId 只在 lib/active-profile 里直接读写', () => {
    const bad: string[] = [];
    for (const { file, code } of sources) {
      if (rel(file) === 'lib/active-profile.ts') continue;
      for (const m of code.matchAll(
        /localStorage\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*['"`]activeProfileId/g
      )) {
        bad.push(locate(file, code, m.index!));
      }
    }
    expect(
      bad,
      `这些地方绕过 lib/active-profile 直接读写 activeProfileId：\n${bad.join('\n')}\n` +
        `改用 getActiveProfileId() / setActiveProfileId()——后者把「写存储」和「通知其他板块」绑在一起，漏不掉。`
    ).toEqual([]);
  });
});
