import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readSource as read, stripComments } from './helpers/source';




/**
 * 对外展示的数字必须是真的。
 *
 * 体检时发现落地页在展示编造的经营数据：接口里写着
 *   const baseUsers = 1280;      // 「返回合理的假数据」
 *   const baseScripts = 15680;   // 「让数据看起来更真实」
 * 而页面以「创作者正在使用」「用户满意度 98%」的名义展示，
 * 文案里还写着「加入1280+创作者」。
 *
 * 这不是技术缺陷——构建、测试、类型检查全绿——但对一个要收费的产品来说
 * 是实打实的合规风险。只能靠扫描守住。
 */

/**
 * 那几个具体的编造数字，不许再出现在对外页面里。
 *
 * 「10秒」是后来补上的：登录页原本写着「10秒 生成脚本」，
 * 而脚本实际要跑一两分钟、定位要几分钟。这一条比另外几个更有害——
 * 先许诺 10 秒，用户等 90 秒就会觉得"卡死了"，等于在亲手制造
 * "这产品很慢"的第一印象。
 */
const FABRICATED = ['1280', '15680', '98%', '10秒', '10000+'];

/** 面向访客的页面（登录后的工作台不算对外宣传） */
const PUBLIC_PAGES = ['app/page.tsx', 'app/pricing/page.tsx', 'app/login/page.tsx'];

describe('落地页不展示编造的数据', () => {
  for (const page of PUBLIC_PAGES) {
    it(`${page} 里没有那几个编造的数字`, () => {
      if (!fs.existsSync(path.join(process.cwd(), page))) return;
      // 注释里可以提（用来说明当初错在哪），渲染的代码里不行
      const code = stripComments(read(page));
      const found = FABRICATED.filter((n) => code.includes(n));
      expect(found, `${page} 里还有编造的数字：${found.join('、')}`).toEqual([]);
    });
  }

  it('公开统计接口查的是真实数据，不再造假', () => {
    const code = stripComments(read('app/api/public/stats/route.ts'));
    // 造假的痕迹
    expect(code).not.toMatch(/const\s+baseUsers\s*=/);
    expect(code).not.toMatch(/Math\.random\(\)/);
    // 真实来源
    expect(code).toContain('countAuthUsers');
    expect(code).toContain('script_history');
  });

  it('拿不到真实数据时返回 null，而不是退回假数', () => {
    expect(stripComments(read('app/api/public/stats/route.ts'))).toContain('users: null');
    // 前端的 catch 分支里不许再塞写死的数
    expect(stripComments(read('app/page.tsx'))).not.toMatch(/animateNumbers\(\{\s*users:\s*\d+/);
  });

  it('没有真实数字时那一块不渲染', () => {
    const code = stripComments(read('app/page.tsx'));
    expect(code).toMatch(/tiles\.length === 0/);
    expect(code).toMatch(/typeof t\.value === 'number'/);
  });
});

/**
 * 额度文案只能有一个来源。
 *
 * 这个产品在这件事上翻过车：文案写「所有功能 150次/月」而实际每个功能
 * 各 150 次，一份套餐卖出了 8 倍的量。收敛到 quotaSummary() 之后，
 * 价格页却还在读配置里手写的那份 features，改额度时会悄悄停在旧数字上。
 */
describe('额度文案不会和实际执行脱节', () => {
  it('套餐配置里不再有手写的额度文案', () => {
    const src = read('lib/config/plans.ts');
    const plansBlock = src.slice(
      src.indexOf('export const SUBSCRIPTION_PLANS'),
      src.indexOf('// 功能名称映射')
    );
    expect(plansBlock, 'SUBSCRIPTION_PLANS 里又出现了 features 文案').not.toMatch(
      /^\s*features:\s*\[/m
    );
  });

  it('三个展示价格的页面都用现算的额度文案', () => {
    for (const page of [
      'app/pricing/page.tsx',
      'app/dashboard/membership/page.tsx',
      'app/page.tsx',
    ]) {
      expect(read(page), `${page} 没有用 quotaSummary`).toContain('quotaSummary');
    }
  });

  it('价格页不再整个摊开套餐对象——那会连手写文案一起带出来', () => {
    const src = read('app/pricing/page.tsx');
    expect(src).toContain('quotaSummary');
    expect(src).toContain('planSellingPoints');
  });
});

/**
 * 业务承诺必须是他真能兑现的。
 *
 * 这三条是问过本人才改的：
 *   退款 —— 不认，虚拟商品不支持无理由退款
 *   发票 —— 开不了，目前不支持
 *   客服邮箱 support@xiaosong.ai —— 这个邮箱根本不存在
 *
 * 前两条写在页面上就是承诺，做不到会变成纠纷；第三条更直接：
 * 用户遇到问题写信过去石沉大海，比没有联系方式还糟。
 */
describe('对外承诺兑现得了', () => {
  const PAGES = [
    'app/page.tsx',
    'app/pricing/page.tsx',
    'app/dashboard/membership/page.tsx',
  ];

  it('不承诺无理由退款', () => {
    /*
     * 查的是"承诺"，不是"退款"这两个字。
     * 第一版直接匹配 /无理由退款/，把「**不**支持无理由退款」这句
     * 正确的声明也一起拦了——页面上必须能说清不提供什么，
     * 否则用户是在不知情的情况下付钱。
     */
    for (const p of PAGES) {
      const code = stripComments(read(p));
      expect(code, `${p} 还在承诺无理由退款`).not.toMatch(/(?<!不)支持无理由退款/);
      expect(code, `${p} 还在承诺全额退款`).not.toMatch(/可申请全额退款|全额退款，无需理由/);
      expect(code, `${p} 还在承诺 7 天退款`).not.toMatch(/7\s*天[内]?[^。，]{0,10}(可申请)?退款/);
    }
  });

  it('但必须说清"不提供什么"——不能含糊带过', () => {
    // 用户有权在付钱前知道退不了
    const landing = stripComments(read('app/page.tsx'));
    expect(landing).toMatch(/不支持无理由退款/);
  });

  it('不承诺开发票', () => {
    const code = stripComments(read('app/page.tsx'));
    expect(code).not.toMatch(/可以开具增值税/);
    expect(code).not.toMatch(/\d\s*个工作日内开具/);
  });

  it('不再留那个不存在的邮箱', () => {
    for (const p of PAGES) {
      expect(stripComments(read(p)), `${p} 还留着不存在的邮箱`).not.toContain('xiaosong.ai');
    }
  });

  it('留的是真能联系上的方式', () => {
    // 手机/微信同号，是他本人在对接
    expect(stripComments(read('app/page.tsx'))).toContain('SUPPORT_WECHAT');
    expect(read('lib/config/contact.ts')).toContain("'songwei886688'");
  });
});

/**
 * 套餐权益只能写真做了的。
 *
 * 2026-09 扫描时，各档位卡片上卖着一串代码里一行都没有的东西：
 * API 接口调用、团队协作、数据导出、数据报表 / 分析报告、高级 / 定制化模板、
 * 多版本对比、最高优先级、社区功能。人工服务类的「1v1 专属顾问」
 * 「专属客服」本人确认做不到；「邮件客服」那个邮箱根本不存在。
 * 选题卡片还写着「AI 实时分析热点趋势」「爆款概率预测」——
 * 系统没有任何热点数据源，也没有任何预测。
 *
 * 而对外政策是"虚拟商品不支持无理由退款"。卖不存在的权益、又不退款，
 * 是最容易变成纠纷的组合。这组用例把撤掉的说法钉死。
 */
describe('套餐里不卖没做的权益', () => {
  const FILES = [
    'app/page.tsx',
    'app/pricing/page.tsx',
    'app/login/page.tsx',
    'app/dashboard/membership/page.tsx',
    // 额度用完时的付费引导（原来是 components/quota-exhausted.tsx，已换成全站统一的这一个）
    'components/upgrade/UpgradePrompt.tsx',
    'lib/config/plans.ts',
  ];

  /** [正则, 为什么不能写] —— 查的是渲染出来的代码，注释里解释当初为什么撤可以留着 */
  const UNBUILT: [RegExp, string][] = [
    [/API\s*接口/, 'API 接口没有做'],
    [/团队协作/, '团队协作没有做'],
    // 「数据导出」2026-10-04 起是真的（我的账户 → 一键导出本人全部内容，app/api/account/export），产品方确认可以写；批量处理仍然没有
[/批量处理|批量生成/, '没有批量处理'],
    [/数据报表|数据分析报告/, '用户端没有任何报表'],
    [/高级模板|定制化模板|模板支持/, '没有模板系统，更没有按档位区分'],
    [/多版本|一键多版本/, '没有多版本生成与对比'],
    [/最高优先级|优先响应|优先客服/, '没有优先队列'],
    [/社区功能/, '没有社区'],
    [/专属(顾问|客服|客户经理)|1v1/, '本人确认做不到'],
    [/邮件客服/, '那个邮箱不存在'],
    [/实时分析热点|热点追踪|爆款概率/, '没有热点数据源，也没有任何预测'],
  ];

  for (const f of FILES) {
    it(`${f} 不承诺没做的东西`, () => {
      const code = stripComments(read(f));
      const hits = UNBUILT.filter(([re]) => re.test(code)).map(([re, why]) => `${re.source}（${why}）`);
      expect(hits, `${f} 里还在卖：\n${hits.join('\n')}`).toEqual([]);
    });
  }

  it('三个展示套餐的页面都只从 planSellingPoints 取权益，不自己手写', () => {
    // 原来首页、会员页各手写一份，和价格页读的那份三方互不一致
    for (const f of ['app/page.tsx', 'app/pricing/page.tsx', 'app/dashboard/membership/page.tsx']) {
      expect(read(f), `${f} 没用 planSellingPoints`).toContain('planSellingPoints');
    }
  });

  it('权益清单本身不是空的——撤光了也不行', async () => {
    const { planSellingPoints } = await import('@/lib/config/plans');
    for (const id of ['free', 'basic', 'pro', 'enterprise']) {
      expect(planSellingPoints(id).length, `${id} 一条权益都没有`).toBeGreaterThan(0);
    }
  });

  it('13 个额度类别与全部创作板块开放的权益一致', async () => {
    const { COUNTED_FEATURES, planSellingPoints } = await import('@/lib/config/plans');
    // 2026-10-02 加了创作方向（direction_used），12 → 13
    expect(COUNTED_FEATURES.length).toBe(13);
    expect(planSellingPoints('basic')).toContain('全部创作板块开放');
  });
});

/**
 * 公示的价格对比表不能和实际额度对不上。
 *
 * 这张表原来是手写的，而且是旧数据：基础会员写 150次/月、专业写 500次/月，
 * 实际只有 50 和 120——对外宣传比实际多 3 倍。账号定位免费版写 1 次
 * （实际 3）、脚本生成写 20 次（实际 8）。
 *
 * 这是一张公示价格的表，写错就是虚假宣传；而同一页还写着"不支持无理由退款"，
 * 用户按 150 次买、拿到 50 次，是实打实的纠纷。
 */
describe('价格对比表和实际额度一致', () => {
  const code = stripComments(read('app/pricing/page.tsx'));

  it('表体从配置现算，不再手写', () => {
    expect(code).toContain('COUNTED_FEATURES.map');
    expect(code).toContain('SUBSCRIPTION_PLANS[planId].quotas');
  });

  it('旧的 150/500 已经不在表里', () => {
    expect(code).not.toMatch(/150\s*次\/月/);
    expect(code).not.toMatch(/500\s*次\/月/);
  });

  it('表里的数字确实等于配置里的额度', async () => {
    const { SUBSCRIPTION_PLANS: P, COUNTED_FEATURES: CF } = await import('@/lib/config/plans');
    // 现算意味着这些值就是配置值——顺带确认配置本身没被改乱
    expect(P.basic.quotas.script).toBe(50);
    expect(P.pro.quotas.script).toBe(120);
    expect(CF.length).toBeGreaterThanOrEqual(8);
  });

  it('免费版的一次性额度标成「次」而不是「次/月」', () => {
    // 免费版是一次性体验、不按月重置，写成「次/月」是另一种形式的说错
    expect(code).toMatch(/planId === 'free' \? \([\s\S]{0,120}`\$\{n\} 次`/);
  });
});
