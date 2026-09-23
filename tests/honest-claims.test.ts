import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readSource as read, readCode, stripComments } from './helpers/source';




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
