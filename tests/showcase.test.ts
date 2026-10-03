import { describe, it, expect } from 'vitest';
import { readSource as read, readCode } from './helpers/source';
import { SHOWCASE_TACTICS, SHOWCASE_CARDS, SHOWCASE_STRUCTURES, FACTS } from '@/lib/showcase';
import { SCRIPT_STRUCTURE_DETAILS } from '@/lib/script-structure-details';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { OPENING_CARDS } from '@/lib/opening-cards';
import { SUBSCRIPTION_PLANS } from '@/lib/config/plans';

/**
 * 落地页上展示的方法样例，必须和真实方法库一字不差。
 *
 * lib/showcase.ts 里的内容是**手抄出来的常量**——这么做是为了不把 900 多行
 * 方法数据打进落地页的 JS 包（访客还没注册就先下载一份完整知识资产）。
 * 代价是：手抄的东西迟早和源头脱节。这组用例就是那道锁。
 */

describe('展示的方法和真实方法库逐字段对得上', () => {
  it('起号计：编号、名字、机制、公式、适用范围全部一致', () => {
    for (const s of SHOWCASE_TACTICS) {
      const real = GROWTH_TACTICS.find((t) => t.no === s.no);
      expect(real, `第 ${s.no} 计在真实数据里不存在`).toBeDefined();
      expect(real!.name, `第 ${s.no} 计的名字对不上`).toBe(s.name);
      expect(real!.mechanism, `${s.name} 的机制对不上`).toBe(s.mechanism);
      expect(real!.formula, `${s.name} 的结构公式对不上`).toBe(s.formula);
      expect(real!.fit, `${s.name} 的适用范围对不上`).toBe(s.fit);
    }
  });

  it('开篇卡：编号、名字、类别、公式、心理机制全部一致', () => {
    for (const s of SHOWCASE_CARDS) {
      const real = OPENING_CARDS.find((c) => c.no === s.no);
      expect(real, `第 ${s.no} 张卡在真实数据里不存在`).toBeDefined();
      expect(real!.name, `第 ${s.no} 张卡的名字对不上`).toBe(s.name);
      expect(real!.category, `${s.name} 的类别对不上`).toBe(s.category);
      expect(real!.formula, `${s.name} 的公式对不上`).toBe(s.formula);
      expect(real!.psychology, `${s.name} 的心理机制对不上`).toBe(s.psychology);
    }
  });

  it('脚本结构：名字、公式、核心逻辑、情绪曲线全部一致', () => {
    const d = SCRIPT_STRUCTURE_DETAILS as Record<string, any>;
    for (const s of SHOWCASE_STRUCTURES) {
      const real = d[s.id];
      expect(real, `脚本结构 ${s.id} 在真实数据里不存在`).toBeDefined();
      expect(real.name, `${s.id} 的名字对不上`).toBe(s.name);
      expect(real.formula, `${s.name} 的结构公式对不上`).toBe(s.formula);
      expect(real.coreLogic, `${s.name} 的核心逻辑对不上`).toBe(s.coreLogic);
      expect(real.emotionCurve, `${s.name} 的情绪曲线对不上`).toBe(s.emotionCurve);
    }
  });

  it('样例本身不能空，也不能只有一条', () => {
    expect(SHOWCASE_STRUCTURES.length).toBeGreaterThanOrEqual(3);
    // 只摆一条说明不了"成体系"
    expect(SHOWCASE_TACTICS.length).toBeGreaterThanOrEqual(3);
    expect(SHOWCASE_CARDS.length).toBeGreaterThanOrEqual(3);
  });

  it('开篇卡样例覆盖不同类别，显出这套卡是有体系的', () => {
    const cats = new Set(SHOWCASE_CARDS.map((c) => c.category));
    expect(cats.size).toBeGreaterThanOrEqual(3);
  });
});

describe('全站数字口径统一', () => {
  it('FACTS 里的方法数和真实数据一致', async () => {
    expect(FACTS.tactics).toBe(GROWTH_TACTICS.length);
    expect(FACTS.cards).toBe(OPENING_CARDS.length);

    /*
     * 脚本结构只数"用户真选得到、且真有方法数据"的那些，并排除 auto。
     * auto 是「AI推荐」——它不是一种结构，是"让 AI 替你挑"，算进去就是凑数。
     */
    const { SCRIPT_STRUCTURES } = await import('@/app/dashboard/script/constants');
    const { SCRIPT_STRUCTURE_DETAILS } = await import('@/lib/script-structure-details');
    const detailIds = Object.keys(SCRIPT_STRUCTURE_DETAILS);
    const usable = (SCRIPT_STRUCTURES as { id: string }[]).filter(
      (s) => s.id !== 'auto' && detailIds.includes(s.id)
    );
    expect(FACTS.structures, `FACTS.structures 写的是 ${FACTS.structures}，实际 ${usable.length} 种`).toBe(
      usable.length
    );

    // 总数的构成在 tests/viral-elements.test.ts 里单独钉死（含八大爆款元素）
    expect(FACTS.methods, '方法总数必须把前三部分都包含进去').toBeGreaterThanOrEqual(
      GROWTH_TACTICS.length + OPENING_CARDS.length + FACTS.structures
    );
  });

  it('每种可选的脚本结构都真有方法数据——不能有选了没内容的', () => {
    // 数字要能站住，前提是那 19 种里没有空壳
    return (async () => {
      const { SCRIPT_STRUCTURES } = await import('@/app/dashboard/script/constants');
      const { SCRIPT_STRUCTURE_DETAILS } = await import('@/lib/script-structure-details');
      const d = SCRIPT_STRUCTURE_DETAILS as Record<string, any>;
      const missing = (SCRIPT_STRUCTURES as { id: string }[])
        .filter((s) => !d[s.id])
        .map((s) => s.id);
      expect(missing, `这些结构用户选得到却没有方法数据：${missing.join('、')}`).toEqual([]);

      // 每一条都得带公式和情绪曲线，否则"每条都写明情绪走向"就是假话
      for (const [id, v] of Object.entries(d)) {
        if (id === 'auto') continue;
        expect(v.formula, `${id} 没有结构公式`).toBeTruthy();
        expect(v.emotionCurve, `${id} 没有情绪曲线`).toBeTruthy();
        expect(v.avoidMistakes?.length, `${id} 没有避坑清单`).toBeGreaterThan(0);
      }
    })();
  });

  it('开篇计的类别数对得上', () => {
    const cats = new Set(OPENING_CARDS.map((c) => c.category));
    expect(FACTS.cardCategories, `写的是 ${FACTS.cardCategories} 类，实际 ${cats.size} 类`).toBe(
      cats.size
    );
  });

  /**
   * 知识库的篇数和字数是现数出来的。
   *
   * 知识资料总量会随材料增删变化，也最容易过期——
   * 删几篇资料它就不成立了。所以不能写死在文案里靠人记得改。
   */
  it('知识库的篇数和字数确实数得出来', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.join(process.cwd(), '编导知识大全', '_导入Dify');

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.md')) files.push(p);
      }
    };
    walk(root);

    expect(files.length, `FACTS.docs 写的是 ${FACTS.docs}，实际 ${files.length} 篇`).toBe(FACTS.docs);

    const libs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    expect(FACTS.libraries, `分库数写的是 ${FACTS.libraries}，实际 ${libs} 个`).toBe(libs);

    const chars = files.reduce((sum, p) => sum + fs.readFileSync(p, 'utf8').length, 0);
    const wan = chars / 10000;
    // 对外宣称的字数只能说少不能说多，所以取整后必须不大于真实值
    expect(FACTS.wordsWan, `对外说 ${FACTS.wordsWan} 万字，实际只有 ${wan.toFixed(1)} 万`).toBeLessThanOrEqual(wan);
    // 但也不能过分保守到失去意义，展示值应与现有资料量接近
    expect(FACTS.wordsWan).toBeGreaterThan(wan - 1);
  });

  it('板块数和 app/dashboard 下真实的创作板块数一致', async () => {
    /*
     * 对外说的是「N 个**创作**板块」。原来直接数 app/dashboard 下的页面目录，
     * 把会员中心也算了进去——它不是创作板块，15 其实是 14。
     * 加「我的账户」页时暴露出来：再照原样数就成了 16。
     *
     * 非创作页在这里显式列出。以后再加账户类页面，往这里补，
     * 而不是让数字悄悄涨上去。
     */
    // 创作进度（原我的作品）是把各板块的产出串起来的地方，本身不是一个创作板块
    // 新手课堂是学习页（教抖音怎么推荐、怎么拍），不产出内容，也不是创作板块
    // 素材库是存收藏的地方，同上
    const NON_CREATIVE = new Set(['membership', 'account', 'works', 'course', 'library']);
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.join(process.cwd(), 'app', 'dashboard');
    const dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('['))
      .filter((e) => fs.existsSync(path.join(root, e.name, 'page.tsx')))
      .map((e) => e.name);
    const n = dirs.filter((d) => !NON_CREATIVE.has(d)).length;
    expect(FACTS.boards, `FACTS.boards 写的是 ${FACTS.boards}，实际有 ${n} 个创作板块`).toBe(n);
    // 防空转：排除清单里的目录必须真的存在，否则排除是空的
    for (const d of NON_CREATIVE) expect(dirs, `${d} 目录不存在，排除清单过期了`).toContain(d);
  });

  it('主流程的环节和首页 MAIN_FLOW 一致', () => {
    const home = read('app/dashboard/page.tsx');
    for (const step of FACTS.pipeline) {
      expect(home, `主流程里没有「${step}」`).toContain(step);
    }
  });

  it('对外页面都从 FACTS 取数，不自己写死', () => {
    for (const f of ['app/page.tsx', 'app/login/page.tsx']) {
      expect(read(f), `${f} 没用统一口径`).toContain('@/lib/showcase');
    }
  });

  /*
   * 光引入 FACTS 还不够——FAQ 那几段长文案就是绕过它手写的，
   * 于是首页顶部数据带已经改成 92 了，往下翻到 FAQ 还写着「73 个方法」
   * 「150+ 篇」。同一页上两个数字打架，而且不报错、构建正常。
   *
   * 这条扫的是渲染出来的代码（注释已剥掉），把这几个具体的旧数字钉死。
   */
  it('对外页面里没有手写的旧数字', () => {
    const STALE: [RegExp, string][] = [
      [/150\s*\+/, '「150+」是旧的篇数，现在是 FACTS.docs'],
      [/\b73\s*[个条]\s*(?:成体系)?/, '「73 条方法」漏了 19 种脚本结构，用 FACTS.methods'],
      [/\d+\s*大类目/, '类目数是手写的，和 lib/content-types.ts 对不上'],
    ];
    for (const f of ['app/page.tsx', 'app/login/page.tsx', 'app/pricing/page.tsx']) {
      const code = readCode(f);
      for (const [re, why] of STALE) {
        expect(re.test(code), `${f}：${why}`).toBe(false);
      }
    }
  });
});

describe('首页导航没有死锚点', () => {
  /*
   * 原来导航里有个「成功案例」指向 #cases，而页面上根本没有这个版块——
   * 点了不会有任何反应。「观看演示」指向的 #demo 同样不存在。
   * 这类问题不报错、构建正常，只有真点一下才知道。
   */
  it('每个 #锚点 都有对应的版块', () => {
    const src = readCode('app/page.tsx');
    const anchors = [...src.matchAll(/href="#([a-zA-Z][\w-]*)"/g)].map((m) => m[1]);
    const ids = new Set([...src.matchAll(/id="([a-zA-Z][\w-]*)"/g)].map((m) => m[1]));
    const dead = [...new Set(anchors)].filter((a) => !ids.has(a));
    expect(dead, `这些锚点点了没反应：${dead.join('、')}`).toEqual([]);
  });

  it('确实扫到了锚点（防止正则写错导致空过）', () => {
    const src = readCode('app/page.tsx');
    const anchors = [...src.matchAll(/href="#([a-zA-Z][\w-]*)"/g)];
    expect(anchors.length).toBeGreaterThanOrEqual(4);
  });

  it('「编导方法」版块真的存在', () => {
    const src = readCode('app/page.tsx');
    expect(src).toContain('id="method"');
    expect(src).toContain('SHOWCASE_TACTICS');
    expect(src).toContain('SHOWCASE_CARDS');
  });
});

describe('对外说辞站得住', () => {
  const code = readCode('app/page.tsx');

  it('不再说"每周更新"——知识库不是每周更新的', () => {
    expect(code).not.toContain('每周更新');
  });

  it('不再承诺完播率数字——没有任何数据支撑', () => {
    expect(code).not.toMatch(/完播率提升\s*\d+%/);
  });

  it('不再说"编导团队人工标注"——没有这个团队', () => {
    expect(code).not.toContain('人工标注');
  });

  it('不再说"银行级加密""专属AI模型"', () => {
    expect(code).not.toContain('银行级');
    expect(code).not.toContain('专属AI模型');
  });

  it('免费版额度从配置现算，不手写', () => {
    /*
     * 原来 FAQ 手写「每月 50 次（账号定位3次、选题3次、脚本20次、对话20次）」，
     * 四个数字里三个和 plans.ts 对不上。
     */
    expect(code).toContain('quotaSummary("free")');
    expect(code).not.toMatch(/每月提供\d+次/);
    // 手写的那几个数字不该再出现在 FAQ 里
    const faq = code.slice(code.indexOf('const faqs'), code.indexOf('const colorClasses'));
    expect(faq).not.toMatch(/脚本生成\s*20\s*次/);
  });

  it('板块数不再写死成 8', () => {
    expect(code).not.toContain('8大核心功能');
  });

  it('免费版的真实额度确实能走通一条完整内容', () => {
    // FAQ 里说"足够你把一条内容从定位做到分镜走通一遍"，这句话得是真的
    const free = SUBSCRIPTION_PLANS.free.quotas;
    expect(free.positioning).toBeGreaterThanOrEqual(2); // 定位 + 简报
    expect(free.topic).toBeGreaterThanOrEqual(1);
    expect(free.script).toBeGreaterThanOrEqual(2); // 开篇 + 脚本
  });
});

/**
 * 浮在卡片上方的徽章必须有 z-index。
 *
 * 线上出过一次：价格方案里「最受欢迎」那个徽章被横着切掉将近一半。
 * 原因不是字体也不是行高——
 *   徽章高 29px、只往上露出 16px（-top-4），剩下 13px 压在卡片上；
 *   而卡片是 glass-panel，带 backdrop-filter，那会创建新的层叠上下文。
 *   两者 z-index 都是 auto 时，DOM 里靠后的卡片就画在徽章上面。
 *
 * 关键在于**徽章和卡片是兄弟关系**。子元素本来就画在父级背景之上，
 * 所以页面上其他几个同样写法的徽章都没事——只有这一处是兄弟。
 */
describe('浮动徽章不会被卡片盖住', () => {
  it('落地页的「推荐方案」带 z-index', () => {
    const code = readCode('app/page.tsx');
    const i = code.indexOf('推荐方案');
    expect(i, '没找到徽章').toBeGreaterThan(0);
    // 往前找它所在的那个 div 的 className
    const cls = code.slice(Math.max(0, i - 300), i);
    expect(cls, '徽章没有 z-index，会被 glass-panel 盖掉一半').toMatch(/absolute[^>]*\bz-\d+/);
  });

  it('和它并列的卡片确实带 backdrop-filter（这才是会盖住它的原因）', () => {
    // 如果哪天卡片不再用 glass-panel，这条会提醒上面那个 z-index 还有没有必要
    const code = readCode('app/page.tsx');
    const i = code.indexOf('推荐方案');
    expect(code.slice(i, i + 400)).toContain('glass-panel');
  });
});
