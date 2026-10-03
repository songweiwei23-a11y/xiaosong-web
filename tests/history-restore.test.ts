import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readCode, stripComments, readSource as read } from './helpers/source';

/**
 * 「换页回来内容还在」这件事，全站栽在同一个默认值上。
 *
 * /api/script-history 不传 taskType 时**只返回「脚本生成」**。
 * 而起号页、知识库页、成交理由页都是这么写的：
 *
 *     const res = await fetch('/api/script-history')
 *     const latest = rows.find(x => x.task_type === '起号方案')   // 永远 undefined
 *
 * 代码看着完全正确，构建通过、控制台干净、也不报错——
 * 唯一的症状是"换个页面回来，刚生成的东西没了"。
 * 用户会以为是产品就这样，不会报 bug。
 *
 * 这组用例用扫描守：凡是取历史来做恢复的地方，必须显式说清要哪个类型。
 */

const APP = path.join(process.cwd(), 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('取历史记录必须显式指明任务类型', () => {
  const files = walk(APP).concat(
    walk(path.join(process.cwd(), 'hooks')),
    walk(path.join(process.cwd(), 'components'))
  );

  it('确实扫到了文件（防止空过）', () => {
    expect(files.length, '一个文件都没扫到，这条用例是空的').toBeGreaterThan(50);
  });

  it('前端没有不带 taskType 的 script-history 请求', () => {
    /*
     * 只查前端发起的请求。接口自身（app/api/script-history/route.ts）
     * 当然会出现这个路径，要排除掉。
     */
    const offenders: string[] = [];
    for (const p of files) {
      if (p.includes(path.join('api', 'script-history'))) continue;
      const code = stripComments(fs.readFileSync(p, 'utf8'));
      // 匹配 fetch("/api/script-history" 后面紧跟引号结束或 ?...，检查有没有 taskType
      for (const m of code.matchAll(/fetch\(\s*[`'"]([^`'"]*\/api\/script-history[^`'"]*)/g)) {
        const url = m[1];
        // 带 id= 的是删除单条（DELETE ?id=xxx），不是取列表，不需要 taskType
        if (url.includes('id=')) continue;
        if (!url.includes('taskType=')) {
          offenders.push(`${path.relative(process.cwd(), p)} → ${url}`);
        }
      }
    }
    expect(
      offenders,
      `这些地方取历史没说要哪个类型，只会拿到「脚本生成」：\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('确实扫到了 script-history 的调用（防止正则写错导致空过）', () => {
    let n = 0;
    for (const p of files) {
      if (p.includes(path.join('api', 'script-history'))) continue;
      const code = stripComments(fs.readFileSync(p, 'utf8'));
      n += [...code.matchAll(/fetch\(\s*[`'"]([^`'"]*\/api\/script-history[^`'"]*)/g)].length;
    }
    expect(n, '一个调用都没匹配到，上面那条是空过的').toBeGreaterThanOrEqual(4);
  });
});

/**
 * 前端请求的接口必须真的存在。
 *
 * 这是「内部链接必须指向真实存在的路由」那条规矩的接口版本。
 * 分镜页和审稿页分别指向 /api/storyboards 和 /api/reviews，
 * 这两个路由从来就没有过。请求 404 → `if (!res.ok) return` 静静吞掉 →
 * 历史列表空、上次结果不恢复。不报错，页面也正常，
 * 只表现为"换页回来内容没了"。
 */
describe('前端请求的 /api 路由都真实存在', () => {
  const routes = new Set<string>();
  const apiRoot = path.join(APP, 'api');
  const collect = (dir: string, prefix: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) collect(p, `${prefix}/${e.name}`);
      else if (e.name === 'route.ts' || e.name === 'route.tsx') routes.add(prefix);
    }
  };
  collect(apiRoot, '/api');

  const files = walk(APP).concat(walk(path.join(process.cwd(), 'hooks')));

  it('确实收集到了路由表（防止空过）', () => {
    expect(routes.size, '一个 api 路由都没收集到').toBeGreaterThan(15);
    expect(routes.has('/api/script-history')).toBe(true);
  });

  it('没有指向不存在路由的请求', () => {
    const dead: string[] = [];
    let scanned = 0;
    for (const p of files) {
      const code = stripComments(fs.readFileSync(p, 'utf8'));
      for (const m of code.matchAll(/["'`](\/api\/[A-Za-z0-9\-_/]*)/g)) {
        // 带模板变量的动态路径跳过，静态部分判不了
        const url = m[1].replace(/\/$/, '');
        scanned++;
        if (routes.has(url)) continue;
        // 可能是动态段（/api/orders/123）——只要有前缀匹配的路由就算数
        if ([...routes].some((r) => url.startsWith(r + '/') || r.startsWith(url + '/'))) continue;
        dead.push(`${path.relative(process.cwd(), p)} → ${url}`);
      }
    }
    expect(scanned, '一个 /api 引用都没扫到，这条用例是空过的').toBeGreaterThan(20);
    expect(dead, `这些接口不存在，请求会 404 且被静默吞掉：\n${dead.join('\n')}`).toEqual([]);
  });
});

describe('接口按任务类型过滤', () => {
  const route = readCode('app/api/script-history/route.ts');

  it('支持逗号分隔的多个类型——起号页一次要恢复两个板块', () => {
    expect(route).toContain("split(',')");
    expect(route).toContain(".in('task_type'");
  });

  it('仍然支持单个类型和 all', () => {
    expect(route).toContain(".eq('task_type'");
    expect(route).toMatch(/raw !== 'all'/);
  });

  it('类型列表为空时不过滤，而不是悄悄返回空数组', () => {
    // .eq('task_type', undefined) 会返回空，页面表现为"什么都没恢复"
    expect(route).toMatch(/types\.length === 1/);
    expect(route).toMatch(/types\.length > 1/);
  });
});

describe('起号页的两个板块都能恢复', () => {
  const code = readCode('app/dashboard/growth/page.tsx');

  it('请求里带上了这一页需要的四个类型', () => {
    for (const t of ['起号方案', '开篇钩子', '选题策划', '脚本生成']) {
      expect(code, `请求里少了「${t}」`).toContain(t);
    }
    expect(code).toContain('taskType=');
  });

  it('正文和当时的输入都恢复——只恢复正文是半截的', () => {
    // 起号方案存的是 { picked, notes }
    expect(code).toContain('setPlanResult');
    expect(code).toContain('setPickedTactics');
    expect(code).toContain('setPlanNotes');
    // 开篇钩子存的是 { topic, currentOpening, picked }
    expect(code).toContain('setOpeningResult');
    expect(code).toContain('setTopic');
    expect(code).toContain('setCurrentOpening');
    expect(code).toContain('setPickedCards');
  });

  it('恢复时不覆盖用户已经动过的输入', () => {
    /*
     * 请求是异步的。用户可能在它返回之前就开始勾选了——
     * 这时候把历史盖上去，等于把人正在做的事抹掉。
     * 所以一律用函数式更新，先看当前值。
     */
    expect(code).toMatch(/setPickedTactics\(\(c\) =>/);
    expect(code).toMatch(/setPlanNotes\(\(c\) => c \|\|/);
    expect(code).toMatch(/setTopic\(\(c\) => c \|\|/);
    expect(code).toMatch(/setPickedCards\(\(c\) =>/);
  });

  it('两个板块存的输入字段名和恢复时读的对得上', () => {
    /*
     * 存的是 run() 的第四个参数。字段名对不上就是另一种静默失效：
     * 存了、也取了，但读的是不存在的字段，结果还是空。
     */
    const src = read('app/dashboard/growth/page.tsx');
    // 后面多存了一个当时用的内容配比（2026-10-02），恢复端不读它
    expect(src).toMatch(/\{ picked: pickedTactics, notes: planNotes(, contentMix: [^}]+)? \}/);
    expect(src).toContain('{ topic, currentOpening, picked: pickedCards, referenceContent, originContent }');
    // 恢复端读的必须是同样这几个名字
    expect(code).toContain('planIn.picked');
    expect(code).toContain('planIn.notes');
    expect(code).toContain('openIn.topic');
    expect(code).toContain('openIn.currentOpening');
    expect(code).toContain('openIn.picked');
    expect(code).toContain('openIn.referenceContent');
    expect(code).toContain('openIn.originContent');
    // 档案是异步加载的，首次挂载还未就绪时不能永久跳过恢复。
    expect(code).toContain('[contextLoading, context.profile?.id]');
  });
});
