import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { SUBSCRIPTION_PLANS } from '@/lib/config/plans';

export const dynamic = 'force-dynamic';

/**
 * 凭邀请码注册。
 *
 * 【为什么注册必须挪到服务端】原先是浏览器里调 supabase.auth.signUp()，
 * 用的是公开的 anon key。任何人都可以跳过我们的页面，直接 POST 到
 * Supabase 的 /auth/v1/signup 建号——前端加多少个邀请码输入框都拦不住。
 * 实测确认过那个接口当时是通的。
 *
 * 这里改用 service_role 的 admin.createUser()，它不受「是否允许公开注册」
 * 这个开关影响。所以正确的做法是两件事一起：
 *   1. 在 Supabase 控制台关掉 Allow new users to sign up；
 *   2. 注册只走这个接口。
 * 只做第 2 件，旧的口子还开着，等于没做。
 */

/** 邮箱格式只做最基本的判断，真正的把关交给 Supabase */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const code = String(body.code || '').trim().toUpperCase();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '请填写正确的邮箱地址' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: '请填写邀请码' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  /*
   * 顺序很讲究：先建号，再兑换码。
   *
   * 反过来的话——先占码再建号——一旦建号失败（邮箱已注册、密码太弱），
   * 这个码就白白烧掉了，用户拿着一个作废的码来找你。
   *
   * 现在这个顺序的代价是：兑换失败时会留下一个已创建的账号，
   * 所以下面失败分支里要把它删掉。删除用的是刚拿到的 id，
   * 不会误伤别人。
   */
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    // 没有配置发信服务，不能让用户卡在「等待验证邮件」上
    email_confirm: true,
  });

  if (createError || !created?.user) {
    const msg = createError?.message || '';
    if (/already been registered|already exists|duplicate/i.test(msg)) {
      return NextResponse.json({ error: '这个邮箱已经注册过了，直接登录即可' }, { status: 409 });
    }
    console.error('[auth/register] 建号失败:', msg);
    return NextResponse.json({ error: '注册失败：' + (msg || '请稍后重试') }, { status: 500 });
  }

  const userId = created.user.id;

  /*
   * 兑换邀请码。
   *
   * 走数据库函数而不是「先查再改」：两个人同时提交同一个码时，
   * 先查再改会让两边都读到「可用」，于是一个码放进来两个人。
   * 函数里是一条 UPDATE ... WHERE status='active' AND used_by IS NULL，
   * 行锁保证只有一个能成功。
   */
  const { data: claim, error: claimError } = await supabase.rpc('claim_invitation_code', {
    p_code: code,
    p_user_id: userId,
  });

  const result = Array.isArray(claim) ? claim[0] : claim;

  if (claimError || !result?.ok) {
    // 码没兑上，把刚建的账号删掉——否则这个人虽然没通过邀请，账号却已经存在
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
    return NextResponse.json({ error: result?.reason || '邀请码不可用' }, { status: 400 });
  }

  /*
   * 建立配额记录，并标记这个账号是凭邀请码进来的。
   * registered_with_invitation 这个列表里本来就有，一直没人写过。
   */
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86400_000);

  const { error: quotaError } = await supabase.from('user_quotas').insert({
    user_id: userId,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    registered_with_invitation: true,
    is_legacy_user: false,
  });
  if (quotaError) {
    // 配额行建不出来不该让注册失败：api-guard 在首次调用时会补建
    console.error('[auth/register] 建配额记录失败:', quotaError.message);
  }

  /*
   * 邀请码可以带套餐。发「体验专业版 30 天」这类码时，
   * 兑换后直接开通，不用管理员再手动改一遍。
   */
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
