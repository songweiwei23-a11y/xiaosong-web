import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';

export const dynamic = 'force-dynamic';

/**
 * 浏览器里完成的导出（比如订单页「导出本页」）先调这里留痕，再真正下载。
 * 服务端只记「谁导出了哪一类数据、多少条」，不接收数据本身。
 * 范围必须在白名单里，避免随便写一个名字把日志刷乱。
 */
const SCOPES = new Set(['orders']);

export async function POST(request: Request) {
  const admin = await requireAdminPermission('export_data');
  if (!admin) return NextResponse.json({ error: '无权导出数据' }, { status: 403 });

  let body: { scope?: unknown; count?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不对' }, { status: 400 });
  }
  const scope = typeof body.scope === 'string' ? body.scope : '';
  const count = Number(body.count);
  if (!SCOPES.has(scope) || !Number.isInteger(count) || count < 0 || count > 100000) {
    return NextResponse.json({ error: '导出范围或条数不对' }, { status: 400 });
  }

  const result = await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.EXPORT_DATA,
    target_type: scope,
    details: { scope, count },
  });
  if (!result.success) {
    return NextResponse.json({ error: '导出留痕失败，请稍后重试' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
