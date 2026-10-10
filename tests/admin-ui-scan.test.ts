import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readCode, readSource } from './helpers/source';

const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(tsx?|ts)$/.test(e.name) ? [path.join(dir, e.name)] : []
  );

const toPosix = (f: string) => f.split(path.sep).join('/');
const ADMIN_PAGES = walk('app/admin')
  .map(toPosix)
  .filter((f) => /\/page\.tsx$/.test(f));
// 实时监控是「控制室」风格，保留自己的视觉，只拆分了结构
const KIT_PAGES = ADMIN_PAGES.filter((f) => !f.includes('/monitor/'));

describe('后台页面：统一用同一套组件', () => {
  it('扫描：每个管理页（监控页除外）都从共用组件取页头、面板、表格、弹窗', () => {
    expect(KIT_PAGES.length).toBeGreaterThan(10); // 自证不是空转
    const bad = KIT_PAGES.filter((f) => !readCode(f).includes('@/components/admin/kit'));
    expect(bad).toEqual([]);
  });

  it('扫描：后台页面不再用浏览器原生弹窗（prompt / alert），统一用 Dialog', () => {
    const bad = ADMIN_PAGES.filter((f) => /\b(prompt|alert)\(/.test(readCode(f)));
    expect(bad).toEqual([]);
  });

  it('扫描：后台没有「开发中」之类的占位按钮', () => {
    const bad = walk('app/admin').filter((f) => /开发中|敬请期待|即将上线/.test(readSource(f)));
    expect(bad).toEqual([]);
  });

  it('扫描：后台不用 next/image 显示签名链接（那种图在线上显示不出来）', () => {
    const bad = walk('app/admin').filter((f) => /from ['"]next\/image['"]/.test(readSource(f)));
    expect(bad).toEqual([]);
  });
});

describe('后台接口：每一个都要求管理员身份', () => {
  it('扫描：app/api/admin 下每个路由都调用了 requireAdmin', () => {
    const routes = walk('app/api/admin').map(toPosix).filter((f) => /\/route\.ts$/.test(f));
    expect(routes.length).toBeGreaterThan(15); // 自证不是空转
    const bad = routes.filter((f) => !readSource(f).includes('requireAdmin'));
    expect(bad).toEqual([]);
  });

  it('废弃的 /api/admin/check 已经删掉', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/api/admin/check'))).toBe(false);
  });

  it('收款码启用前校验地址，付款页展示前也校验', () => {
    expect(readCode('app/api/admin/qrcodes/route.ts')).toMatch(/isUsableQrcodeUrl/);
    expect(readCode('app/payment/page.tsx')).toMatch(/isUsableQrcodeUrl\(q\.qrcode_url\)/);
  });

  it('驳回订单必须写原因', () => {
    expect(readCode('app/api/admin/orders/review/route.ts')).toMatch(/驳回订单请写明原因/);
  });

  it('用户列表的搜索词不进日志', () => {
    expect(readCode('app/api/admin/users/route.ts')).not.toMatch(/console\.log\([^)]*search/);
  });
});

describe('后台导航', () => {
  it('导航按组织：概览、用户与会员、订单与收款、内容质量、系统', () => {
    const layout = readCode('app/admin/layout.tsx');
    for (const label of ['用户与会员', '订单与收款', '内容质量', '系统']) {
      expect(layout).toContain(`label: "${label}"`);
    }
  });
});
