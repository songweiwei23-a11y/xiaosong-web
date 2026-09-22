import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';

export const dynamic = 'force-dynamic';

/**
 * 收款二维码的读写。
 *
 * 后台那页原先直接在浏览器里用 anon key 更新 payment_qrcodes 表。
 * 加上 RLS 之后（只允许 service_role 写）那条路会被拒——而且本来也不该
 * 让浏览器有权改收款码：这是一张收钱的图，改掉它等于把钱转到别处。
 *
 * 图片上传仍在浏览器做（走 storage 的公开桶），只有「把 URL 记进表」
 * 这一步经过服务端并校验管理员身份。
 */

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('payment_qrcodes')
    .select('*')
    .order('payment_method');

  if (error) {
    const missing = /schema cache|does not exist/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? '收款码表尚未创建，请先执行 supabase/migrations/20260922_payment.sql'
          : '读取失败',
      },
      { status: missing ? 503 : 500 }
    );
  }

  return NextResponse.json(data ?? []);
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { paymentMethod, qrcodeUrl } = await request.json();

  if (paymentMethod !== 'alipay' && paymentMethod !== 'wechat') {
    return NextResponse.json({ error: '收款方式只能是 alipay 或 wechat' }, { status: 400 });
  }
  if (!qrcodeUrl || typeof qrcodeUrl !== 'string') {
    return NextResponse.json({ error: '缺少二维码地址' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('payment_qrcodes')
    .upsert(
      {
        payment_method: paymentMethod,
        qrcode_url: qrcodeUrl,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'payment_method' }
    )
    .select()
    .single();

  if (error) {
    console.error('[admin/qrcodes] 更新失败:', error.message);
    return NextResponse.json({ error: '更新失败：' + error.message }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.UPDATE_SETTINGS,
    target_type: 'payment_qrcode',
    target_id: paymentMethod,
    details: { qrcode_url: qrcodeUrl },
  });

  return NextResponse.json(data);
}
