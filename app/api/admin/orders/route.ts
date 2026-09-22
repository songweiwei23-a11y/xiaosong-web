import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 后台订单列表。
 *
 * 订单页原先是在浏览器里直接查表，并且用 supabase.auth.admin.getUserById()
 * 取用户邮箱——那是 service_role 才有的方法，页面拿的是 anon key。
 * 实测返回 `User not allowed`，不抛错但每一条订单的邮箱都会显示「未知」。
 * 管理员看着一屏「未知」，根本不知道是谁付的钱。
 *
 * 邮箱这类信息本来就该在服务端取：一是只有服务端有权限，
 * 二是不该把「按 id 查任意用户」的能力放到浏览器里。
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const supabase = getServiceSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;

  let query = supabase
    .from('payment_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: orders, error } = await query;

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

  if (!orders || orders.length === 0) return NextResponse.json([]);

  /*
   * 补上邮箱。listUsers 一次拿回来再在内存里配对，
   * 比逐条 getUserById 少几十次往返——订单页一次要显示上百条。
   */
  const emailById = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error: userError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (userError) {
      console.error('[admin/orders] 读取用户列表失败:', userError.message);
      break;
    }
    for (const u of data.users) if (u.email) emailById.set(u.id, u.email);
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 100) break;
  }

  /*
   * 转账凭证存在私有桶里，不能直接给公开 URL。
   * 这里换成短时效的签名链接：管理员看得到，链接过期后失效，
   * 不会变成一个永久可访问的支付截图地址。
   */
  const withExtras = await Promise.all(
    orders.map(async (o) => {
      let proofUrl: string | null = o.proof_image_url ?? null;
      if (proofUrl && !proofUrl.startsWith('http')) {
        const { data: signed } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(proofUrl, 60 * 30); // 30 分钟
        proofUrl = signed?.signedUrl ?? null;
      }
      return {
        ...o,
        user_email: emailById.get(o.user_id) || '（用户已注销）',
        proof_image_url: proofUrl,
      };
    })
  );

  return NextResponse.json(withExtras);
}
