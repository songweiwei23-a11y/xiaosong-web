import { describe, it, expect } from 'vitest';
import { readSource as read, readCode } from './helpers/source';
import { SHOWCASE_TACTICS, SHOWCASE_CARDS, FACTS } from '@/lib/showcase';
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

  it('样例本身不能空，也不能只有一条', () => {
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
  it('FACTS 里的方法数和真实数据一致', () => {
    expect(FACTS.tactics).toBe(GROWTH_TACTICS.length);
    expect(FACTS.cards).toBe(OPENING_CARDS.length);
    expect(FACTS.methods).toBe(GROWTH_TACTICS.length + OPENING_CARDS.length);
  });

  it('板块数和 app/dashboard 下真实的页面数一致', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.join(process.cwd(), 'app', 'dashboard');
    const n = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('['))
      .filter((e) => fs.existsSync(path.join(root, e.name, 'page.tsx'))).length;
    expect(FACTS.boards, `FACTS.boards 写的是 ${FACTS.boards}，实际有 ${n} 个板块`).toBe(n);
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
  it('落地页的「最受欢迎」带 z-index', () => {
    const code = readCode('app/page.tsx');
    const i = code.indexOf('最受欢迎');
    expect(i, '没找到徽章').toBeGreaterThan(0);
    // 往前找它所在的那个 div 的 className
    const cls = code.slice(Math.max(0, i - 300), i);
    expect(cls, '徽章没有 z-index，会被 glass-panel 盖掉一半').toMatch(/absolute[^>]*\bz-\d+/);
  });

  it('和它并列的卡片确实带 backdrop-filter（这才是会盖住它的原因）', () => {
    // 如果哪天卡片不再用 glass-panel，这条会提醒上面那个 z-index 还有没有必要
    const code = readCode('app/page.tsx');
    const i = code.indexOf('最受欢迎');
    expect(code.slice(i, i + 400)).toContain('glass-panel');
  });
});
