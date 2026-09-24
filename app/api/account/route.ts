import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';
import { membershipStatus } from '@/lib/config/plans';

export const dynamic = 'force-dynamic';

/**
 * 当前登录用户的账户概况：邮箱 + 会员状态。
 *
 * 会员页原先把当前套餐写死成 "free"，全站也没有任何地方显示到期时间。
 * 付费会员打开会员页看到"免费版"，还能再点一次"立即升级"重复付款；
 * 到期了也不知道，只会发现额度突然变少。
 *
 * 身份从登录会话取；订阅用 service_role 读，和 api-guard 同一个口径，
 * 状态由 membershipStatus() 算——它和服务端放行用的是同一套到期判定。
 */
export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { data: sub, error } = await getServiceSupabase()
    .from('subscriptions')
    .select('plan, status, end_date')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[account] 读取订阅失败:', error.message);
    return NextResponse.json({ error: '读取会员状态失败' }, { status: 500 });
  }

  return NextResponse.json({
    email: user.email ?? null,
    banned: sub?.status === 'inactive',
    ...membershipStatus(sub),
  });
}
