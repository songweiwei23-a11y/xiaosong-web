import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { SUBSCRIPTION_PLANS } from '@/lib/config/plans';
import { clientIp } from '@/lib/client-ip';
import { normalizeInvitationCode } from '@/lib/invitation-code';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/*
 * 凭邀请码注册，只走这个接口（服务端用 service_role 建号）。
 *
 * 顺序：限流 → 核对码（不占用）→ 写注册授权 → 建号 → 原子兑换码。
 * 码在建号之前就核对，所以无效的码永远不会创建账号；错误信息不区分「码不存在」
 * 与「码已用过」，也不区分「邮箱已注册」与其它失败，避免被拿来探测。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attemptLimited = createRateLimiter(15 * 60_000, 20);
const INVALID_CODE = '邀请码无效、已用过或已过期，请核对后重试，或联系客服领取';
const REGISTER_FAILED = '注册失败：这个邮箱可能已经注册过了，请直接登录；如仍无法注册，请联系客服';

export async function POST(request: Request) {
  if (attemptLimited(clientIp(request))) {
    return NextResponse.json({ error: '尝试太频繁了，请 15 分钟后再试' }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const rawCode = String(body.code || '');

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '请填写正确的邮箱地址' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 });
  }
  if (!rawCode.trim()) {
    return NextResponse.json({ error: '请填写邀请码' }, { status: 400 });
  }
  const code = normalizeInvitationCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: invite, error: inviteError } = await supabase
    .from('invitation_codes')
    .select('status, used_by, expires_at')
    .ilike('code', code)
    .maybeSingle();

  if (inviteError) {
    console.error('[auth/register] 读取邀请码失败:', inviteError.message);
    return NextResponse.json({ error: '注册服务暂时不可用，请稍后再试' }, { status: 503 });
  }
  const expired = !!invite?.expires_at && new Date(invite.expires_at) <= new Date();
  if (!invite || invite.status !== 'active' || invite.used_by || expired) {
    return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
  }

  // 注册授权：auth.users 上的插入前触发器靠它放行建号，15 分钟内有效
  const { error: authError } = await supabase
    .from('registration_authorizations')
    .upsert({ email, invitation_code: code, created_at: new Date().toISOString() }, { onConflict: 'email' });

  if (authError) {
    console.error('[auth/register] 写注册授权失败:', authError.message);
    const missing = /schema cache|does not exist/i.test(authError.message);
    return NextResponse.json(
      {
        error: missing
          ? '注册功能尚未启用，请先执行 supabase/migrations/20260922_invite_only_enforce.sql'
          : '注册失败，请稍后重试',
      },
      { status: missing ? 503 : 500 }
    );
  }

  const releaseAuthorization = () =>
    supabase.from('registration_authorizations').delete().eq('email', email).then(() => {});

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    // 没有配置发信服务，不能让用户卡在「等待验证邮件」上
    email_confirm: true,
  });

  if (createError || !created?.user) {
    await releaseAuthorization();
    const msg = createError?.message || '';
    if (/password/i.test(msg)) {
      return NextResponse.json({ error: '密码不符合要求，请换一个更复杂的密码' }, { status: 400 });
    }
    console.error('[auth/register] 建号失败:', msg);
    return NextResponse.json({ error: REGISTER_FAILED }, { status: 400 });
  }

  const userId = created.user.id;

  // 兑换是「检查 + 占用」的原子操作：两人同时提交同一个码，只有一个能成功
  const { data: claim, error: claimError } = await supabase.rpc('claim_invitation_code', {
    p_code: code,
    p_user_id: userId,
  });

  const result = Array.isArray(claim) ? claim[0] : claim;

  if (claimError || !result?.ok) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    if (claimError) {
      console.error('[auth/register] 兑换邀请码失败:', claimError.message);
      const missing = /function .*claim_invitation_code.*does not exist/i.test(claimError.message);
      return NextResponse.json(
        {
          error: missing
            ? '邀请码功能尚未启用，请先执行 supabase/migrations/20260922_invitations.sql'
            : '邀请码校验失败，请稍后重试',
        },
        { status: missing ? 503 : 500 }
      );
    }
    return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86400_000);

  // upsert 而不是 insert：建号时触发器已经插过一行 user_quotas
  const { error: quotaError } = await supabase.from('user_quotas').upsert(
    {
      user_id: userId,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      registered_with_invitation: true,
      is_legacy_user: false,
    },
    { onConflict: 'user_id' }
  );
  if (quotaError) {
    // 配额行写不进去不该让注册失败：api-guard 在首次调用时会补建
    console.error('[auth/register] 写配额记录失败:', quotaError.message);
  }

  const planType: string = result.plan_type || 'free';
  if (planType !== 'free' && planType in SUBSCRIPTION_PLANS) {
    const { error: subError } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: planType,
        status: 'active',
        start_date: now.toISOString(),
        end_date: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (subError) console.error('[auth/register] 开通套餐失败:', subError.message);
  }

  return NextResponse.json({
    success: true,
    plan: planType,
    message: planType === 'free' ? '注册成功' : `注册成功，已开通${SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS].name}`,
  });
}
