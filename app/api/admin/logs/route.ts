import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { ACTION_LABELS, SENSITIVE_ACTIONS, logTargetUserId } from '@/lib/admin-logger';
import { emailsByIds } from '@/lib/admin-users';
import { toCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;
const EXPORT_LIMIT = 5000;

/**
 * 管理员操作日志。
 *
 * admin_logs 之前**只写不读**：审核订单、改套餐、封禁、授权管理员……
 * 每一次都记下来了，但全站没有一处能看。审计日志看不到，等于没有——
 * 真要查"是谁、什么时候给谁开了会员"时，无从查起。
 *
 * 查询参数：page、action、from/to（YYYY-MM-DD，按北京时间的日期）、format=csv 导出（最多 5000 条，忽略分页）。
 * 列名按线上真实结构：admin_id / action / target_type / target_id / details。
 */

function dayStart(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00+08:00`).toISOString();
}

function dayEndExclusive(s: string | null): string | null {
  const start = dayStart(s);
  return start ? new Date(new Date(start).getTime() + 86400_000).toISOString() : null;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const action = sp.get('action') || '';
  const from = dayStart(sp.get('from'));
  const to = dayEndExclusive(sp.get('to'));
  const csv = sp.get('format') === 'csv';

  const db = getServiceSupabase();
  let query = db
    .from('admin_logs')
    .select('id, admin_id, action, target_type, target_id, details, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (csv) query = query.limit(EXPORT_LIMIT);
  else query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (action) query = query.eq('action', action);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);

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
  const emailOf = await emailsByIds(db, [...ids]);

  const items = list.map((r) => {
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
  });

  if (csv) {
    const body = toCsv(items, [
      { header: '时间', value: (r) => new Date(r.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) },
      { header: '操作', value: (r) => r.label },
      { header: '是否敏感', value: (r) => (r.sensitive ? '是' : '') },
      { header: '操作人', value: (r) => r.adminEmail },
      { header: '对象', value: (r) => r.targetEmail ?? r.targetId ?? '' },
      { header: '细节', value: (r) => JSON.stringify(r.details) },
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="admin-logs-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    actions: ACTION_LABELS,
    items,
  });
}
