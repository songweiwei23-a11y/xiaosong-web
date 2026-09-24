import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { ACTION_LABELS, SENSITIVE_ACTIONS, logTargetUserId } from '@/lib/admin-logger';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

/**
 * 管理员操作日志。
 *
 * admin_logs 之前**只写不读**：审核订单、改套餐、封禁、授权管理员……
 * 每一次都记下来了，但全站没有一处能看。后台首页的「操作日志」按钮
 * 点了只弹"开发中"。审计日志看不到，等于没有——真要查"是谁、什么时候
 * 给谁开了会员"时，无从查起。
 *
 * 列名按线上真实结构：admin_id / action / target_type / target_id / details。
 * 仓库里 supabase/migrations/admin_logs.sql 写的是 admin_user_id，那份是过时的。
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const action = searchParams.get('action') || '';

  const db = getServiceSupabase();
  let query = db
    .from('admin_logs')
    .select('id, admin_id, action, target_type, target_id, details, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (action) query = query.eq('action', action);

  const { data: rows, error, count } = await query;
  if (error) {
    console.error('[admin/logs] 读取失败:', error.message);
    return NextResponse.json({ error: '读取操作日志失败' }, { status: 500 });
  }

  /*
   * 把 id 换成邮箱。只查这一页里出现过的人，不拉全量。
   * 订单类日志的目标是订单号，要先查订单拿到 user_id。
   */
  const list = rows ?? [];
  const orderIds = list.filter((r) => r.target_type === 'order' && r.target_id).map((r) => r.target_id as string);
  const orderUser = new Map<string, string>();
  if (orderIds.length) {
    const { data: orders } = await db.from('payment_orders').select('id, user_id').in('id', orderIds);
    for (const o of orders ?? []) orderUser.set(o.id, o.user_id);
  }

  const targetOf = (r: (typeof list)[number]) =>
    logTargetUserId(r) ?? (r.target_type === 'order' && r.target_id ? orderUser.get(r.target_id) ?? null : null);

  const ids = new Set<string>();
  for (const r of list) {
    if (r.admin_id) ids.add(r.admin_id);
    const t = targetOf(r);
    if (t) ids.add(t);
  }

  const emailOf = new Map<string, string>();
  await Promise.all(
    [...ids].map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      if (data?.user?.email) emailOf.set(id, data.user.email);
    })
  );

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    // 筛选下拉用：只给真实出现过的动作会显得更干净，但那要多一次全表扫描。
    // 动作种类是有限的，直接给全量中文表
    actions: ACTION_LABELS,
    items: list.map((r) => {
      const target = targetOf(r);
      return {
        id: r.id,
        createdAt: r.created_at,
        action: r.action,
        label: ACTION_LABELS[r.action] ?? r.action,
        sensitive: SENSITIVE_ACTIONS.has(r.action),
        adminEmail: emailOf.get(r.admin_id) ?? r.admin_id,
        targetEmail: target ? emailOf.get(target) ?? target : null,
        targetType: r.target_type,
        targetId: r.target_id,
        details: r.details ?? {},
      };
    }),
  });
}
