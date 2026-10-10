import { NextResponse } from 'next/server';
import { requireAdmin, requireAdminPermission, getServiceSupabase } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { isUsableQrcodeUrl } from '@/lib/payment-qrcode';

export const dynamic = 'force-dynamic';

/**
 * 收款二维码的读写。
 *
 * 后台那页原先直接在浏览器里用 anon key 更新 payment_qrcodes 表。
 * 加上 RLS 之后（只允许 service_role 写）那条路会被拒——而且本来也不该
 * 让浏览器有权改收款码：这是一张收钱的图，改掉它等于把钱转到别处。
 *
 * 图片上传仍在浏览器做（走 storage 的公开桶），这里只负责把 URL 记进表，
 * 并校验：占位图、非 https 的地址一律不收（见 lib/payment-qrcode）。
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
  const admin = await requireAdminPermission('manage_payments');
  if (!admin) return NextResponse.json({ error: '无权修改收款码' }, { status: 403 });

  const { paymentMethod, qrcodeUrl } = await request.json();

  if (paymentMethod !== 'alipay' && paymentMethod !== 'wechat') {
    return NextResponse.json({ error: '收款方式只能是 alipay 或 wechat' }, { status: 400 });
  }
  if (!qrcodeUrl || typeof qrcodeUrl !== 'string') {
    return NextResponse.json({ error: '缺少二维码地址' }, { status: 400 });
  }
  if (!isUsableQrcodeUrl(qrcodeUrl)) {
    return NextResponse.json(
      { error: '这张图不能当收款码：地址必须是 https 开头，而且不能是占位图。请重新上传真实的收款二维码' },
      { status: 400 }
    );
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

/** 启用或停用。启用前确认库里已经有一张可用的收款码，不能把一个空地址或占位图启用 */
export async function PATCH(request: Request) {
  const admin = await requireAdminPermission('manage_payments');
  if (!admin) return NextResponse.json({ error: '无权修改收款码' }, { status: 403 });

  const { paymentMethod, isActive } = await request.json();
  if (paymentMethod !== 'alipay' && paymentMethod !== 'wechat') {
    return NextResponse.json({ error: '收款方式只能是 alipay 或 wechat' }, { status: 400 });
  }
  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: '缺少启用状态' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (isActive) {
    const { data: current } = await supabase
      .from('payment_qrcodes')
      .select('qrcode_url')
      .eq('payment_method', paymentMethod)
      .maybeSingle();
    if (!isUsableQrcodeUrl(current?.qrcode_url)) {
      return NextResponse.json(
        { error: '还没有可用的收款码，先上传真实的二维码再启用' },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from('payment_qrcodes')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('payment_method', paymentMethod)
    .select()
    .single();

  if (error || !data) {
    console.error('[admin/qrcodes] 切换失败:', error?.message);
    return NextResponse.json({ error: '切换失败，请刷新后重试' }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.TOGGLE_PAYMENT_QRCODE,
    target_type: 'payment_qrcode',
    target_id: paymentMethod,
    details: { isActive },
  });

  return NextResponse.json(data);
}
