/**
 * 次数包的展示（2026-10-20）：首页额度面板（一行）、会员中心次数包标签（大卡片）、
 * 侧边栏不放次数包、付款页接线。这里渲染成静态 HTML 检查：余额、购买入口、
 * 销售关闭时「即将开放」、不出现「测试配置」、读取失败不显示成 0。
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { CountPackRow, CountPackHero, countPackOpen } from '@/components/quota/CountPackPanel';
import { PurchaseKindSwitch } from '@/components/quota/PurchaseKindSwitch';

const BUY = '/payment?plan=count_pack_trial_19_9';

const renderRow = (balance: number | null, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(CountPackRow, { balance, ...extra }));

describe('首页次数包一行：销售开放（当前配置）', () => {
  it('显示名称、规格、余额和购买按钮', () => {
    const html = renderRow(15);
    expect(html).toContain('尝鲜次数包');
    expect(html).toContain('20 次 · 长期有效');
    expect(html).toContain('>15<');
    expect(html).toContain(BUY);
    expect(html).toContain('购买 ¥19.9');
    expect(html).not.toContain('即将开放');
    expect(html).toContain('会员额度用完后，自动从这里扣');
  });

  it('余额读取失败显示横杠，不显示成 0', () => {
    const html = renderRow(null);
    expect(html).toContain('>—<');
    expect(html).not.toContain('>0<');
    expect(html).toContain('余额暂时读取不到');
  });

  it('余额为 0：提示可以再买一次', () => {
    const html = renderRow(0);
    expect(html).toContain('>0<');
    expect(html).toContain('次数用完了，可以再买一次');
    expect(html).toContain(BUY);
  });

  it('面向用户的文字里不出现「测试配置」「买断」「终身」', () => {
    for (const html of [renderRow(3), renderRow(0), renderRow(null)]) {
      expect(html).not.toContain('测试配置');
      expect(html).not.toContain('买断');
      expect(html).not.toContain('终身');
    }
  });

  it('加载中不显示余额数字', () => {
    const html = renderRow(15, { loading: true });
    expect(html).not.toContain('>15<');
    expect(html).toContain('animate-pulse');
  });
});

describe('首页次数包一行：销售关闭', () => {
  it('标「即将开放」，不放购买入口', () => {
    const html = renderRow(15, { salesOpen: false });
    expect(html).toContain('即将开放');
    expect(html).not.toContain(BUY);
    expect(html).not.toContain('购买 ¥');
    expect(html).toContain('>15<');
  });

  it('余额为 0 时提示等开放', () => {
    expect(renderRow(0, { salesOpen: false })).toContain('购买开放后可以再买');
  });
});

describe('两类购买方式的毛玻璃切换（会员中心和首页共用）', () => {
  const renderKind = (value: 'plans' | 'pack', salesOpen?: boolean) =>
    renderToStaticMarkup(createElement(PurchaseKindSwitch, { value, onChange: () => {}, salesOpen }));

  it('销售开放：包月会员和次数包两类都在，选中的那张标「当前查看」', () => {
    const html = renderKind('plans', true);
    expect(html).toContain('包月会员');
    expect(html).toContain('次数包');
    // 选中的卡片显示「当前查看」，未选中的那张才显示类型标签
    expect(html).not.toContain('按月订阅');
    expect(html).toContain('一次付款');
    expect(html).toContain('基础会员 ¥49 起 / 月');
    expect(html).toContain('买一批创作次数，20 次，长期有效，不限购');
    expect(html).toContain('¥19.9 一次付款');
    expect(html.match(/当前查看/g)?.length).toBe(1);
    expect(html).toContain('glass-selected');
    expect(html).toContain('glass-panel');
  });

  it('选中次数包时，高亮跟着走', () => {
    const html = renderKind('pack', true);
    expect(html.match(/当前查看/g)?.length).toBe(1);
    expect(html.indexOf('当前查看')).toBeGreaterThan(html.indexOf('次数包'));
  });

  it('销售关闭：整块不渲染', () => {
    expect(renderKind('plans', false)).toBe('');
  });
});

describe('会员中心次数包标签的大卡片', () => {
  it('销售开放：显示次数、有效期、价格和购买按钮', () => {
    const html = renderToStaticMarkup(createElement(CountPackHero));
    expect(html).toContain('尝鲜次数包');
    expect(html).toContain('获得 20 次创作额度');
    expect(html).toContain('长期有效');
    expect(html).not.toContain('个月有效');
    expect(html).not.toContain('作废');
    expect(html).toContain('¥19.9');
    expect(html).toContain('购买次数包');
    expect(html).toContain(BUY);
    expect(html).not.toContain('测试配置');
  });

  it('销售关闭：整块不渲染，切换标签也不出现', () => {
    const html = renderToStaticMarkup(createElement(CountPackHero, { salesOpen: false }));
    expect(html).toBe('');
    expect(countPackOpen(false)).toBe(false);
    expect(countPackOpen(true)).toBe(true);
  });
});

describe('次数包接入了各个入口', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  it('首页额度面板放了次数包一行，并且额度状态带上了 packCredits', () => {
    const src = read('app/dashboard/page.tsx');
    expect(src).toContain('<CountPackRow');
    expect(src).not.toContain('<CountPackPanel');
    expect(src).toContain('packCredits: d.packCredits');
  });

  it('侧边栏不放额度和次数包（2026-10-20 产品方决定：侧边栏占地方；额度看首页，次数包在会员中心）', () => {
    const src = read('components/dashboard/Sidebar.tsx');
    expect(src).not.toContain('SidebarQuotaCard');
    expect(src).not.toContain('CountPack');
    expect(src).toContain('<ProfileSwitcher />');
    expect(fs.existsSync(path.join(process.cwd(), 'components/quota/SidebarQuotaCard.tsx'))).toBe(false);
  });

  it('会员中心：两类购买方式切换（共用 PurchaseKindSwitch），次数包标签下显示大卡片', () => {
    const src = read('app/dashboard/membership/page.tsx');
    expect(src).toContain('<PurchaseKindSwitch value={tab} onChange={setTab} />');
    expect(src).toContain('useState<PurchaseKind>("plans")');
    expect(src).toContain('<CountPackHero />');
    expect(src).not.toContain('CountPackOfferCard');
    expect(src).not.toContain('PURCHASE_KINDS');
  });

  it('首页价格方案：同一套两类切换，次数包标签下显示大卡片，套餐卡片只在包月会员下显示', () => {
    const src = read('app/page.tsx');
    expect(src).toContain('<PurchaseKindSwitch value={purchaseKind} onChange={setPurchaseKind} />');
    expect(src).toContain('<CountPackHero />');
    expect(src).toContain('(purchaseKind === "plans" || !packOpen)');
    expect(src).toContain('purchaseKind === "pack" && packOpen');
  });

  it('两类切换是客户端组件，并且只在销售开放时显示', () => {
    const src = read('components/quota/PurchaseKindSwitch.tsx');
    expect(src.startsWith('"use client";')).toBe(true);
    expect(src).toContain('countPackOpen(salesOpen)');
  });

  it('付款页认次数包：价格、权益、有效期都从次数包配置取，并且走同一个购买判定', () => {
    const src = read('app/payment/page.tsx');
    expect(src).toContain('countPackById(planId)');
    expect(src).toContain('countPackPurchaseBlock(pack.id)');
    expect(src).toContain('packBenefits(pack)');
    expect(src).toContain('pack.price');
  });
});
