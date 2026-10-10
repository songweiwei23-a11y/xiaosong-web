import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { cleanQuery, emailsByIds, searchUsers, UUID_RE } from '@/lib/admin-users';

export const dynamic = 'force-dynamic';

/*
 * 订单列表（后台订单审核）。
 *
 * 查询参数：
 *   status   all | pending | reviewing | approved | rejected
 *   from/to  YYYY-MM-DD，按提交时间筛选（to 当天也算在内）
 *   q        订单号、用户编号或用户邮箱（支持部分邮箱）
 *   offset / limit   翻页，limit 最多 100
 *
 * 邮箱、凭证签名链接都在服务端取：浏览器拿的是 anon key，取不到邮箱，
 * 凭证也不能给永久公开的地址。
 */

const STATUSES = ['pending', 'reviewing', 'approved', 'rejected'] as const;

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const status = sp.get('status') || 'all';
  const from = sp.get('from');
  const to = sp.get('to');
  const q = cleanQuery(sp.get('q'));
  const offset = Math.max(0, Number.parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.get('limit') || '30', 10) || 30));

  const db = getServiceSupabase();

  // 搜索词先换成用户编号列表：邮箱、用户编号都能找到订单
  let userIds: string[] | null = null;
  if (q && !UUID_RE.test(q)) {
    const { users } = await searchUsers(db, q, 0, 50);
    userIds = users.map((u) => u.id);
    if (userIds.length === 0) {
      return NextResponse.json({ items: [], total: 0, offset, limit, counts: await countByStatus(db, null) });
    }
  }

  let query = db
    .from('payment_orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all' && (STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', new Date(`${from}T00:00:00+08:00`).toISOString());
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    query = query.lt('created_at', new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400_000).toISOString());
  }
  if (q) {
    if (UUID_RE.test(q)) query = query.or(`id.eq.${q},user_id.eq.${q}`);
    else query = query.in('user_id', userIds ?? []);
  }

  const { data: orders, error, count } = await query;
  if (error) {
    // 表还没建时给一句人话，而不是把 PostgREST 的报文透给前端
    const missing = /schema cache|does not exist/i.test(error.message);
    console.error('[admin/orders] 查询失败:', error.message);
    return NextResponse.json(
      {
        error: missing
          ? '订单表尚未创建，请先执行 supabase/migrations/20260922_payment.sql'
          : '订单查询失败',
      },
      { status: missing ? 503 : 500 }
    );
  }

  const list = orders ?? [];
  const emailById = await emailsByIds(db, list.map((o) => o.user_id));

  // 转账凭证存在私有桶里，换成 30 分钟有效的签名链接；过期后失效
  const items = await Promise.all(
    list.map(async (o) => {
      let proofUrl: string | null = o.proof_image_url ?? null;
      if (proofUrl && !proofUrl.startsWith('http')) {
        const { data: signed } = await db.storage.from('payment-proofs').createSignedUrl(proofUrl, 60 * 30);
        proofUrl = signed?.signedUrl ?? null;
      }
      return {
        ...o,
        user_email: emailById.get(o.user_id) || '（用户已注销）',
        proof_image_url: proofUrl,
      };
    })
  );

  return NextResponse.json({
    items,
    total: count ?? items.length,
    offset,
    limit,
    counts: await countByStatus(db, userIds),
  });
}

/** 顶部统计：各状态的数量。搜索时只统计搜到的人 */
async function countByStatus(
  db: ReturnType<typeof getServiceSupabase>,
  userIds: string[] | null
): Promise<Record<string, number>> {
  const countOf = async (status: string | null) => {
    let q = db.from('payment_orders').select('id', { count: 'exact', head: true });
    if (status) q = q.eq('status', status);
    if (userIds) q = q.in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const { count } = await q;
    return count ?? 0;
  };
  const [all, ...rest] = await Promise.all([countOf(null), ...STATUSES.map((s) => countOf(s))]);
  const out: Record<string, number> = { all };
  STATUSES.forEach((s, i) => (out[s] = rest[i]));
  return out;
}
