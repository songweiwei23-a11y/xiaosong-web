/**
 * 后台删除用户（2026-10-04 产品方：清理垃圾用户；删了以后信息随之删除，想再用只能拿邀请码重新注册）。
 */
import { describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { USER_DATA_TABLES, purgeUser, previewUserData } from '@/lib/admin-delete-user';
import { ACTION_LABELS, AdminActions, SENSITIVE_ACTIONS } from '@/lib/admin-logger';
import { readCode } from './helpers/source';

const BAD = '11111111-1111-4111-8111-111111111111';
const GOOD = '22222222-2222-4222-8222-222222222222';

function fakeStorage(files: Record<string, string[]>) {
  const removed: string[] = [];
  return {
    removed,
    from: (bucket: string) => ({
      list: async (prefix: string) => {
        const all = (files[bucket] ?? []).filter((p) => !removed.includes(`${bucket}:${p}`) && p.startsWith(`${prefix}/`));
        const names = new Map<string, boolean>();
        for (const p of all) {
          const rest = p.slice(prefix.length + 1);
          const [head, ...tail] = rest.split('/');
          names.set(head, names.get(head) || tail.length === 0);
        }
        return { data: [...names].map(([name, isFile]) => ({ name, id: isFile ? `id-${name}` : null })), error: null };
      },
      remove: async (paths: string[]) => { removed.push(...paths.map((p) => `${bucket}:${p}`)); return { error: null }; },
    }),
  };
}

function setup(opts: { missingTables?: string[] } = {}) {
  const seed: Record<string, Record<string, unknown>[]> = {};
  for (const t of USER_DATA_TABLES) seed[t] = [{ user_id: BAD, n: 1 }, { user_id: BAD, n: 2 }, { user_id: GOOD, n: 3 }];
  seed.invitation_codes = [{ code: 'ABC', used_by: BAD, status: 'used' }, { code: 'XYZ', used_by: GOOD, status: 'used' }];
  const db = createFakeDb(seed, { missingTables: opts.missingTables });
  const storage = fakeStorage({
    'chat-attachments': [`${BAD}/a1/file.pdf`, `${BAD}/a2/file.png`, `${GOOD}/a3/file.pdf`],
    'payment-proofs': [`${BAD}/order-1.jpg`, `${GOOD}/order-2.jpg`],
  });
  const deleteUser = vi.fn(async () => ({ error: null }));
  return { db, storage, deleteUser, client: { from: db.from, storage, auth: { admin: { deleteUser } } } };
}

describe('删除用户：数据随之删除', () => {
  it('每张表里这个人的数据都删掉，别人的一行不动；上传的文件删掉；最后删登录账号', async () => {
    const s = setup();
    const r = await purgeUser(s.client, BAD);
    for (const t of USER_DATA_TABLES) {
      expect(s.db.tables[t].map((x: Record<string, unknown>) => x.user_id), t).toEqual([GOOD]);
    }
    expect(s.storage.removed.sort()).toEqual([`chat-attachments:${BAD}/a1/file.pdf`, `chat-attachments:${BAD}/a2/file.png`, `payment-proofs:${BAD}/order-1.jpg`].sort());
    expect(r.files).toBe(3);
    expect(s.deleteUser).toHaveBeenCalledWith(BAD);
  });

  it('用过的邀请码解开关联，但仍是「已使用」，不会被别人再用', async () => {
    const s = setup();
    await purgeUser(s.client, BAD);
    expect(s.db.tables.invitation_codes).toEqual([{ code: 'ABC', used_by: null, status: 'used' }, { code: 'XYZ', used_by: GOOD, status: 'used' }]);
  });

  it('某张表还没建（迁移没跑）：跳过，照样删完', async () => {
    const s = setup({ missingTables: ['creator_preferences'] });
    const r = await purgeUser(s.client, BAD);
    expect(r.skipped).toEqual(['creator_preferences']);
    expect(s.deleteUser).toHaveBeenCalled();
  });

  it('删数据出错就停下，不删登录账号（可以再点一次接着删）', async () => {
    const s = setup();
    const broken = { ...s.client, from: (t: string) => (t === 'works' ? { delete: () => ({ eq: async () => ({ error: { message: 'permission denied' } }) }) } : s.db.from(t)) };
    await expect(purgeUser(broken, BAD)).rejects.toThrow(/「works」里的数据没删掉.*账号还没删/);
    expect(s.deleteUser).not.toHaveBeenCalled();
  });

  it('删除前的预览：数得出档案、作品、生成记录、对话、素材、订单', async () => {
    const s = setup();
    const c = await previewUserData(s.client, BAD);
    expect(c).toMatchObject({ user_profiles: 2, works: 2, script_history: 2, chat_conversations: 2, material_library: 2, payment_orders: 2 });
  });

  it('覆盖了这个人能留下数据的主要表', () => {
    for (const t of ['user_profiles', 'script_history', 'works', 'chat_conversations', 'material_library', 'payment_orders', 'subscriptions', 'user_quotas', 'research_jobs', 'creator_preferences', 'account_positioning', 'deal_reasons']) {
      expect(USER_DATA_TABLES as readonly string[]).toContain(t);
    }
  });
});

describe('接口守卫', () => {
  const route = readCode('app/api/admin/users/route.ts');
  it('不能删自己、不能删管理员、必须输入对方邮箱', () => {
    expect(route).toMatch(/userId === admin\.userId\) return NextResponse\.json\(\{ error: '不能删除自己的账号' \}/);
    expect(route).toMatch(/role\?\.role \|\| settings\?\.is_admin === true/);
    expect(route).toMatch(/confirmEmail !== email\.toLowerCase\(\)/);
  });
  it('删除记进操作日志，标为敏感操作', () => {
    expect(route).toMatch(/logAdminAction\(admin\.userId, AdminActions\.DELETE_USER/);
    expect(ACTION_LABELS[AdminActions.DELETE_USER]).toBe('删除用户');
    expect(SENSITIVE_ACTIONS.has(AdminActions.DELETE_USER)).toBe(true);
  });
  it('页面：删除前先看数据、输入邮箱一致才能点「永久删除」', () => {
    const page = readCode('app/admin/users/page.tsx');
    expect(page).toMatch(/"delete_preview"/);
    expect(page).toMatch(/del\.input\.trim\(\)\.toLowerCase\(\) !== del\.preview\.email\.toLowerCase\(\)/);
  });
});
