import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AdminActions, ACTION_LABELS, SENSITIVE_ACTIONS, logTargetUserId } from '@/lib/admin-logger';
import { summarizeHealth, timed, SLOW_MS } from '@/lib/health';
import { readCode } from './helpers/source';

/**
 * 后台：操作日志、系统状态、概览数字。
 *
 * 这一块原来的问题都是"看着正常、其实是假的"：
 *   - 操作日志只写不读，首页按钮点了弹"开发中"
 *   - 系统状态写死成"运行正常"，服务挂了也是绿的
 *   - 付费会员数读了一个不存在的键，显示 NaN，基础会员也没算
 *   - "今日调用次数""今日活跃"两个标签和接口实际给的数不是一回事
 */

describe('操作日志', () => {
  it('每个动作都有中文名——否则日志页上会冒出一串英文代码', () => {
    const missing = Object.values(AdminActions).filter((a) => !ACTION_LABELS[a]);
    expect(missing, `这些动作没配中文名：${missing.join('、')}`).toEqual([]);
  });

  it('碰钱和权限的动作被标为敏感', () => {
    for (const a of [AdminActions.APPROVE_ORDER, AdminActions.GRANT_ADMIN, AdminActions.RESET_USER_PASSWORD]) {
      expect(SENSITIVE_ACTIONS.has(a), `${a} 应该标红`).toBe(true);
    }
  });

  describe('找得到"动的是谁"——两种写法都要认', () => {
    it('用户管理页把目标放在 details.targetUserId', () => {
      expect(logTargetUserId({ details: { targetUserId: 'u1' } })).toBe('u1');
    });
    it('权限、订阅那几处放在 target_id', () => {
      expect(logTargetUserId({ target_type: 'user', target_id: 'u2' })).toBe('u2');
      expect(logTargetUserId({ target_type: 'subscription', target_id: 'u3' })).toBe('u3');
    });
    it('订单的 target_id 是订单号，不能当成用户 id', () => {
      expect(logTargetUserId({ target_type: 'order', target_id: 'order-9' })).toBeNull();
    });
    it('邀请码、收款码没有目标用户', () => {
      expect(logTargetUserId({ target_type: 'invitation_code' })).toBeNull();
    });
  });

  it('接口按线上真实的列名读（admin_id，不是迁移文件里过时的 admin_user_id）', () => {
    const route = readCode('app/api/admin/logs/route.ts');
    expect(route).toContain('admin_id');
    expect(route).not.toContain('admin_user_id');
  });

  it('接口要求管理员权限', () => {
    const route = readCode('app/api/admin/logs/route.ts');
    const guard = route.indexOf('requireAdmin()');
    const query = route.indexOf(".from('admin_logs')");
    expect(guard).toBeGreaterThan(0);
    expect(guard, '权限检查必须在查日志之前').toBeLessThan(query);
  });

  it('后台侧边栏和概览页都能进', () => {
    expect(readCode('app/admin/layout.tsx')).toContain('/admin/logs');
    expect(readCode('app/admin/page.tsx')).toContain('/admin/logs');
  });
});

describe('系统状态是真检查出来的', () => {
  const ok = (name: string, ms = 100) => ({ name, ok: true, ms });

  it('全部正常才说正常', () => {
    expect(summarizeHealth([ok('数据库'), ok('Dify')]).label).toBe('运行正常');
  });

  it('有一项挂了就说异常，并点名是哪一项', () => {
    const s = summarizeHealth([ok('数据库'), { name: 'Dify', ok: false, ms: 8000, detail: '超时' }]);
    expect(s.ok).toBe(false);
    expect(s.note).toContain('Dify');
    expect(s.note).toContain('超时');
  });

  it('都通但慢，单独说"偏慢"，不混进"正常"', () => {
    const s = summarizeHealth([ok('数据库', SLOW_MS + 1), ok('Dify')]);
    expect(s.label).toBe('运行偏慢');
  });

  it('一项都没检查到，不能说正常——那正是原来写死的假绿', () => {
    expect(summarizeHealth([]).ok).toBe(false);
  });

  it('检查本身抛异常时不往外抛，记为失败', async () => {
    const r = await timed('X', async () => {
      throw new Error('连不上');
    });
    expect(r.ok).toBe(false);
    expect(r.detail).toBe('连不上');
  });

  it('概览页不再写死"运行正常"', () => {
    const page = readCode('app/admin/page.tsx');
    expect(page).toContain('/api/admin/health');
    // 旧写法：一个纯文本的"运行正常"和"所有服务正常"
    expect(page, '又写死了"所有服务正常"').not.toContain('所有服务正常');
    expect(page, '"运行正常"又被写成了固定文字').not.toMatch(/>\s*运行正常\s*</);
  });

  it('Dify 探活用 /parameters——只读配置、不调模型、不花钱', () => {
    const route = readCode('app/api/admin/health/route.ts');
    expect(route).toContain('/v1/parameters');
    expect(route).not.toContain('chat-messages');
    // 必须有超时，否则 Dify 卡住时整张卡片一直转圈
    expect(route).toMatch(/AbortSignal\.timeout\(/);
  });
});

describe('后台概览的数字和标签', () => {
  const page = readCode('app/admin/page.tsx');

  it('不再读不存在的 premium 键', () => {
    // 套餐里没有 premium，读它得到 undefined，付费人数就成了 NaN
    expect(page).not.toMatch(/subscriptionStats\.premium/);
  });

  it('付费人数按"除免费版以外全部"算，不按名字列举', () => {
    expect(page).toContain('paidCount(');
    // 按名字列举会漏档位——原来就漏了基础会员
    expect(page).not.toMatch(/subscriptionStats\.pro\s*\+/);
  });

  it('标签和接口给的数一致', () => {
    // 接口：apiCallsToday 实为累计生成次数；activeToday 实为近 7 天活跃
    expect(page).not.toContain('今日调用次数');
    expect(page).toContain('累计生成次数');
    expect(page).not.toMatch(/今日活跃/);
    expect(page).toContain('近 7 天活跃');
  });

  it('首页三个按钮都去真实页面，不再弹"开发中"', () => {
    expect(page).not.toMatch(/开发中/);
    for (const r of ['/admin/settings', '/admin/monitor', '/admin/logs']) {
      expect(page, `${r} 没接上`).toContain(`router.push("${r}")`);
      const dir = path.join(process.cwd(), 'app', ...r.split('/').filter(Boolean));
      expect(fs.existsSync(path.join(dir, 'page.tsx')), `${r} 页面不存在`).toBe(true);
    }
  });

  it('统计付费人数时按实际有效的套餐算，过期的不算', () => {
    const stats = readCode('app/api/admin/stats/route.ts');
    expect(stats).toContain('effectivePlanId');
    expect(stats).toMatch(/select\('plan, status, end_date'\)/);
  });
});

describe('条款写的规则和系统执行的一致', () => {
  const terms = readCode('app/terms/page.tsx');

  it('额度周期从配置取，不手写天数', () => {
    expect(terms).toContain('QUOTA_PERIOD_DAYS');
    expect(terms, '条款里手写了天数').not.toMatch(/每\s*30\s*天/);
  });

  it('写明了不支持无理由退款、不开发票', () => {
    expect(terms).toContain('不支持无理由退款');
    expect(terms).toContain('不支持开具发票');
  });

  it('付款页在下单按钮之前说清退款政策', () => {
    const pay = readCode('app/payment/page.tsx');
    const notice = pay.indexOf('不支持无理由退款');
    const button = pay.indexOf('onClick={createOrder}');
    expect(notice, '付款页没有提退款政策').toBeGreaterThan(0);
    expect(notice, '退款说明必须在下单按钮之前').toBeLessThan(button);
  });

  it('隐私政策如实写了数据会交给哪些第三方', () => {
    const privacy = readCode('app/privacy/page.tsx');
    expect(privacy).toContain('Dify');
    expect(privacy).toContain('Supabase');
    expect(privacy).toContain('Claude');
  });

  it('首页不再说"数据完全保密"——和隐私政策写的第三方处理自相矛盾', () => {
    expect(readCode('app/page.tsx')).not.toContain('数据完全保密');
  });
});
