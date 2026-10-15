import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/*
 * 退出就要重新进门（第一道的闭环，2026-10-18）：
 * 任何账号退出登录，都要同时作废这台设备的首页通行。
 * 这里是回归测试：以后新加了退出登录的入口，忘了接这一步，这个测试会红。
 */

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

/** 列出 app 和 components 下所有前端源码（排除 API 路由） */
function clientFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.endsWith(path.join('app', 'api'))) continue;
      clientFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('退出登录：作废这台设备的首页通行', () => {
  it('每一处前端退出登录（supabase.auth.signOut）都同时调用 /api/gate/logout', () => {
    const callers = [...clientFiles(path.join(root, 'app')), ...clientFiles(path.join(root, 'components'))]
      .filter((f) => /supabase\.auth\.signOut\(/.test(fs.readFileSync(f, 'utf8')));
    expect(callers.length).toBeGreaterThan(0); // 自证不是空转
    for (const file of callers) {
      expect(fs.readFileSync(file, 'utf8'), path.relative(root, file)).toContain('/api/gate/logout');
    }
  });

  it('退出接口清掉 Cookie，并作废库里这台设备的通行', () => {
    const route = read('app/api/gate/logout/route.ts');
    expect(route).toContain('revokeDevicePass');
    expect(route).toContain('maxAge: 0');
    expect(route).toContain('SITE_GATE_COOKIE');
  });

  it('作废通行按摘要删除库里的那一行，并清掉缓存', () => {
    const tickets = read('lib/gate-tickets.ts');
    expect(tickets).toMatch(/export async function revokeDevicePass[\s\S]*?\.delete\(\)\.eq\('cookie_hash', await hashSecret\(cookieSecret\)\)/);
    expect(tickets).toMatch(/export async function revokeDevicePass[\s\S]*?resetGateCaches\(\);/);
  });
});
