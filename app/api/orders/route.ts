import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';
import { getPlan, SUBSCRIPTION_PLANS } from '@/lib/config/plans';

export const dynamic = 'force-dynamic';

/**
 * 用户侧的订单：下单、补传凭证、查自己的订单。
 *
 * 收款是人工核对：用户按收款码转账，上传截图，管理员在后台看图放行。
 * 不接支付宝/微信的真实支付接口——那需要企业资质和签约。
 *
 * 【金额必须服务端定】前端传过来的价格一律不采信，按 plan_id 和
 * billing_cycle 从 lib/config/plans.ts 现取。否则改一下请求体就能
 * 花 1 块钱开企业版。下单时把当时的价格快照进订单，日后调价不影响对账。
 */

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('payment_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    const missing = /schema cache|does not exist/i.test(error.message);
    return NextResponse.json(
      { error: missing ? '订单功能尚未启用' : '读取订单失败' },
      { status: missing ? 503 : 500 }
    );
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const body = await request.json();
  const planId = String(body.planId || '');
  const cycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const method = body.paymentMethod === 'wechat' ? 'wechat' : 'alipay';

  if (!(planId in SUBSCRIPTION_PLANS) || planId === 'free') {
    return NextResponse.json({ error: '请选择一个有效的付费套餐' }, { status: 400 });
  }

  const plan = getPlan(planId);
  const amount = cycle === 'yearly' ? plan.yearlyPrice : plan.price;

  // 已有未完成的同款订单就复用，避免用户反复点「立即购买」攒出一堆待审订单
  const supabase = await getServerSupabase();
  const { data: existing } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('plan_id', planId)
    .eq('billing_cycle', cycle)
    .in('status', ['pending', 'reviewing'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ ...existing[0], reused: true });
  }

  const { data, error } = await supabase
    .from('payment_orders')
    .insert({
      user_id: guard.userId!,
      plan_id: planId,
      plan_name: plan.name,
      amount,
      billing_cycle: cycle,
      payment_method: method,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    const missing = /schema cache|does not exist/i.test(error.message);
    console.error('[orders] 下单失败:', error.message);
    return NextResponse.json(
      {
        error: missing
          ? '订单功能尚未启用，请联系管理员执行数据库迁移'
          : '下单失败：' + error.message,
      },
      { status: missing ? 503 : 500 }
    );
  }

  return NextResponse.json(data);
}

/** 补传转账凭证。只允许改自己的、且只在还没审的阶段 */
export async function PATCH(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const { orderId, proofPath, paymentMethod } = await request.json();
  if (!orderId || !proofPath) {
    return NextResponse.json({ error: '缺少订单或凭证' }, { status: 400 });
  }

  /*
   * 凭证路径必须落在这个用户自己的目录下。
   * 不校验的话，用户可以把别人目录里的文件路径填进自己的订单，
   * 借别人的转账截图过审。存储桶的 RLS 管得住「谁能传」，
   * 管不住「订单里填谁的路径」。
   */
  if (!String(proofPath).startsWith(`${guard.userId}/`)) {
    return NextResponse.json({ error: '凭证路径不合法' }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('payment_orders')
    .update({
      proof_image_url: proofPath,
      proof_uploaded_at: new Date().toISOString(),
      status: 'reviewing',
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    })
    .eq('id', orderId)
    .eq('user_id', guard.userId!)
    .in('status', ['pending', 'reviewing'])
    .select()
    .maybeSingle();

  if (error) {
    console.error('[orders] 上传凭证失败:', error.message);
    return NextResponse.json({ error: '提交失败：' + error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: '订单不存在或已审核，无法再改' }, { status: 404 });
  }

  return NextResponse.json(data);
}
