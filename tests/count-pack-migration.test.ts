/**
 * 次数包迁移文件的静态检查（2026-10-20）。迁移文件未执行；这里只保证文件里有该有的东西：
 * 三张表开 RLS、三个函数只给 service_role、订单约束放行次数包、证据函数能认次数包预留。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATION_REGISTRY } from '@/lib/migration-registry';

const FILE = '20261020_count_packs.sql';
const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', FILE), 'utf8');

describe('次数包迁移文件', () => {
  it('在迁移台账里登记了三张表', () => {
    const entry = MIGRATION_REGISTRY.find((e) => e.file === FILE);
    expect(entry).toBeTruthy();
    expect(entry!.tables).toEqual(expect.arrayContaining(['count_pack_lots', 'count_pack_reservations', 'count_pack_ledger']));
  });

  it('三张表都开启行级安全，并且不给 anon/authenticated 任何权限', () => {
    for (const table of ['count_pack_lots', 'count_pack_reservations', 'count_pack_ledger']) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated`);
    }
  });

  it('三个数据库函数都存在，且只授予 service_role 执行权限', () => {
    for (const fn of [
      'kaiwu_reserve_pack_credit(uuid, text, text, text, integer)',
      'kaiwu_settle_pack_credit(uuid, text, boolean, text, jsonb)',
      'admin_approve_count_pack_order(uuid, uuid, boolean, text, integer, timestamptz, timestamptz)',
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn.split('(')[0].replace('public.', '')}`);
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role`);
    }
  });

  it('预留函数同一把锁、先退回过期的预留、用到期最早的批次、用完不变负', () => {
    expect(sql).toContain("hashtextextended('creation:' || p_user_id::text, 0)");
    expect(sql).toMatch(/status = 'pending' AND expires_at <= now\(\)[\s\S]*FOR UPDATE/);
    expect(sql).toMatch(/ORDER BY expires_at NULLS LAST, created_at[\s\S]*FOR UPDATE/);
    expect(sql).toContain('credits_remaining >= p_cost');
    expect(sql).toContain("RETURN jsonb_build_object('allowed', false, 'reason', 'pack_empty')");
  });

  it('结算：成功记消耗并写用量事件，失败退回次数；重复调用结果一致', () => {
    expect(sql).toContain("kind, amount, request_id, feature)\n      VALUES (p_user_id, r.lot_id, 'consume'");
    expect(sql).toContain("kind, amount, request_id, feature)\n      VALUES (p_user_id, r.lot_id, 'return'");
    expect(sql).toContain("IF r.status <> 'pending' THEN");
  });

  it('订单约束放行次数包（plan_id 以 count_pack_ 开头，billing_cycle 可为 pack），会员取值不变', () => {
    expect(sql).toContain("plan_id IN ('basic', 'pro', 'enterprise') OR left(plan_id, 11) = 'count_pack_'");
    expect(sql).toContain("billing_cycle IN ('monthly', 'yearly', 'pack')");
    expect(sql).toContain('DROP CONSTRAINT %I');
  });

  it('审核函数：只能审 reviewing 状态的订单，且订单状态和发放在同一个函数里', () => {
    expect(sql).toContain("IF o.status <> 'reviewing' THEN RAISE EXCEPTION 'order_not_reviewing:%', o.status");
    expect(sql).toContain("IF left(o.plan_id, 11) <> 'count_pack_' THEN RAISE EXCEPTION 'not_count_pack'");
  });

  it('完整结果证据函数能认次数包预留（否则次数包用户的生成会报错）', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.kaiwu_record_creation_completion(');
    expect(sql).toContain('SELECT * INTO pr FROM public.count_pack_reservations');
  });

  it('完整结果证据的外键不再指向 creation_requests（次数包预留不在那张表里），改为指向 auth.users', () => {
    expect(sql).toContain('creation_completion_evidence_user_fk');
    expect(sql).toContain('FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE');
  });

  it('最后通知 PostgREST 刷新结构', () => {
    expect(sql).toContain("NOTIFY pgrst, 'reload schema';");
  });
});
