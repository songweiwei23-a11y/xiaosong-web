import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { hasPermission, ROLE_PERMISSIONS } from '@/lib/admin-permissions';
import { mfaStepPending } from '@/lib/admin-mfa';

/**
 * 权限矩阵（巡检 L2）与管理员二次验证（巡检 MFA）。
 */
describe('权限矩阵', () => {
  it('admin 与 developer 拥有全部权限：现有管理员的行为不变', () => {
    const all = Object.keys(ROLE_PERMISSIONS.admin);
    expect(all.length).toBeGreaterThan(5);
    for (const perm of ['manage_admins', 'delete_user', 'review_orders', 'manage_payments', 'manage_secrets', 'export_data'] as const) {
      expect(hasPermission('admin', perm)).toBe(true);
      expect(hasPermission('developer', perm)).toBe(true);
    }
  });

  it('operator：能审单、改会员、封禁、看内容，但不能授权、删用户、改收款码、换密钥、导出', () => {
    expect(hasPermission('operator', 'review_orders')).toBe(true);
    expect(hasPermission('operator', 'manage_membership')).toBe(true);
    expect(hasPermission('operator', 'manage_users')).toBe(true);
    expect(hasPermission('operator', 'view_content')).toBe(true);
    expect(hasPermission('operator', 'manage_admins')).toBe(false);
    expect(hasPermission('operator', 'delete_user')).toBe(false);
    expect(hasPermission('operator', 'manage_payments')).toBe(false);
    expect(hasPermission('operator', 'manage_secrets')).toBe(false);
    expect(hasPermission('operator', 'export_data')).toBe(false);
  });

  it('未知角色、空角色一律没有权限（默认拒绝）', () => {
    expect(hasPermission('intern', 'view_content')).toBe(false);
    expect(hasPermission(null, 'view_content')).toBe(false);
    expect(hasPermission(undefined, 'view_content')).toBe(false);
  });

  it('users 路由按动作校验：删除动作要 delete_user，封禁要 manage_users', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/users/route.ts'), 'utf8');
    expect(src).toMatch(/delete_user:\s*'delete_user'/);
    expect(src).toMatch(/ban_user:\s*'manage_users'/);
    expect(src).toMatch(/update_membership:\s*'manage_membership'/);
  });
});

describe('管理员二次验证（mfaStepPending）', () => {
  it('绑定了验证器、本次会话还没验：需要验证', () => {
    expect(mfaStepPending({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true);
  });

  it('已经是 aal2：不需要再验', () => {
    expect(mfaStepPending({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false);
  });

  it('没绑定验证器（nextLevel 也是 aal1）：不挡，不会把没绑定的人锁在外面', () => {
    expect(mfaStepPending({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false);
  });

  it('拿不到 AAL 信息：不挡（按未绑定处理，交给角色判断）', () => {
    expect(mfaStepPending(null)).toBe(false);
    expect(mfaStepPending(undefined)).toBe(false);
    expect(mfaStepPending({})).toBe(false);
  });
});
