import { NextResponse } from 'next/server';
import { requireAdminPermission, getServiceSupabase } from '@/lib/admin-auth';

/**
 * 管理员查看某个用户的次数包：各批次的余额，以及账本（发放、消耗、退回）。
 * 只读。权限用 review_orders（运营角色已有），不新增权限项。
 */
export async function GET(request: Request) {
  const admin = await requireAdminPermission('review_orders');
  if (!admin) return NextResponse.json({ error: '无权查看次数包' }, { status: 403 });

  const userId = new URL(request.url).searchParams.get('userId') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: '请提供有效的用户 ID' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const [lots, ledger] = await Promise.all([
    supabase
      .from('count_pack_lots')
      .select('id, pack_id, order_id, credits_total, credits_remaining, expires_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('count_pack_ledger')
      .select('id, lot_id, kind, amount, order_id, request_id, feature, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  if (lots.error || ledger.error) {
    console.error('[admin/count-packs] 读取失败:', lots.error?.message ?? ledger.error?.message);
    return NextResponse.json({ error: '次数包数据暂时无法读取，可能是迁移还没执行' }, { status: 503 });
  }

  const now = Date.now();
  const balance = (lots.data ?? [])
    .filter((l) => !l.expires_at || new Date(l.expires_at).getTime() > now)
    .reduce((sum, l) => sum + (Number(l.credits_remaining) || 0), 0);

  return NextResponse.json({ userId, balance, lots: lots.data ?? [], ledger: ledger.data ?? [] });
}
