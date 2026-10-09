import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';
import { getPlan, judgeQuota, effectivePlanId, quotaRollover } from '@/lib/config/plans';
import { quotaUnavailable, settleCreation, refreshCreationPeriod, type CreationReservation } from '@/lib/creation-quota';

export interface GuardResult {
  ok: boolean;
  userId?: string;
  response?: Response;
}

function isInvalidSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code, status } = error as { name?: string; code?: string; status?: number };
  return name === 'AuthSessionMissingError' || name === 'AuthInvalidJwtError' ||
    status === 401 || status === 403 || [
      'bad_jwt', 'invalid_jwt', 'no_authorization', 'user_not_found', 'user_banned',
      'session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used',
    ].includes(code ?? '');
}

function authFailure(error?: unknown): GuardResult {
  if (!error || isInvalidSession(error)) {
    return { ok: false, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  }
  // 超时、限流或认证服务故障不代表会话失效。拒绝本次访问，允许稍后重试，
  // 不向调用方泄露服务端错误、用户资料，也不主动登出或清理登录 Cookie。
  return {
    ok: false,
    response: NextResponse.json(
      { error: '登录服务暂时连接不稳定，请稍后重试', code: 'AUTH_TEMPORARILY_UNAVAILABLE', retryable: true },
      { status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } }
    ),
  };
}

async function checkCurrentUser(): Promise<GuardResult> {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return authFailure(error);
    if (!user) return authFailure();
    return { ok: true, userId: user.id };
  } catch (error) {
    return authFailure(error);
  }
}

/**
 * API 守卫：仅要求已登录，不检查也不扣减配额。
 * 适用于 CRUD 类接口（读写自己的数据），生成类接口请用 requireUserWithQuota。
 *
 * - 未登录 -> 401
 * - 认证服务临时故障 -> 503（稍后重试）
 */
export async function requireUser(): Promise<GuardResult> {
  return checkCurrentUser();
}

/**
 * API 守卫：要求已登录，并检查用户仍有可用配额（不扣减）。
 * 仅预检查；生成路由必须在调用模型前 reserveCreation，成功后确认、失败后释放。
 *
 * - 未登录 -> 401
 * - 认证服务临时故障 -> 503（稍后重试）
 * - 超额   -> 402（需要付费/升级）
 */
export async function requireUserWithQuota(feature?: string): Promise<GuardResult> {
  const guard = await checkCurrentUser();
  if (!guard.ok) return guard;
  const userId = guard.userId!;
  try {
  const serviceSupabase = getServiceSupabase();

  /*
   * 订阅和配额一起查。
   *
   * 原来是串行：先 await subscriptions，判断完再 await user_quotas。
   * 实测每条往返 0.9 秒，而这段代码在**每一次生成**前都要跑一遍——
   * 白等的那一秒是所有功能共同的固定开销。
   *
   * 串行的唯一好处是企业版能在查配额前就短路返回，省掉一条查询。
   * 但企业版目前 10 个用户里只有 1 个，为了它让其余 9 个每次多等一秒，
   * 这笔账是反的。
   *
   * end_date 必须一起取：没有它就判断不了订阅有没有到期。
   */
  const [{ data: subscription, error: subError }, { data: quotaRow, error: quotaError }] = await Promise.all([
    serviceSupabase
      .from('subscriptions')
      .select('plan, status, end_date')
      .eq('user_id', userId)
      .maybeSingle(),
    serviceSupabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (subError || quotaError) return { ok: false, response: quotaUnavailable() };

  // 如果用户被封禁
  if (subscription?.status === 'inactive') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: '您的账户已被封禁，请联系管理员' },
        { status: 403 }
      ),
    };
  }

  // 到期判定收敛在 effectivePlanId 里，两个判定点共用一份，免得再次走偏
  const planId = effectivePlanId(subscription);
  const plan = getPlan(planId);

  /*
   * 所有套餐都要维护使用周期。
   *
   * 这里原来一进来就对企业版 return，下面"周期到期就重置"那段永远走不到：
   * 线上企业版用户的周期 9 月 9 日到期后再没重置过，计数器从 8 月一路累加，
   * 首页接口又把"周期已结束"当成 0 显示——本月用了六十多次，首页写着 0。
   * 建记录、滚周期对所有套餐都做，再按当前配置判定限额。
   */
  const quota = quotaRow;

  if (!quota) {
    // 如果没有配额记录，创建一个
    const { error: createError } = await serviceSupabase
      .from('user_quotas')
      .insert({ user_id: userId });

    if (createError) {
      if (createError.code !== '23505') return { ok: false, response: quotaUnavailable() };
    }
    
    // 新用户，允许继续
    return { ok: true, userId };
  }

  /*
   * 换期：会员进入新的一期就清零计数，会员到期没续就把剩余次数清零；
   * 免费版一次性体验，永不重置。规则在 quotaRollover 里，首页显示也用它。
   *
   * 写回库之后不直接放行，而是拿换期后的数字接着判——
   * 原来这里重置完就 return 放行，这对"清零"是错的：过期会员会被放过一次。
   */
  const roll = quotaRollover(subscription, quota);
  if (roll.kind !== 'none') {
    // Preview only: reservation RPC applies rollover atomically.
    Object.assign(quota, roll.patch);
  }
  // Keep standalone web-search quota reads current, without resetting outside the database lock.
  if (!feature && roll.kind !== 'none') await refreshCreationPeriod(userId);

  // 仅真正的无限套餐可跳过判定；199元高频会员现在按功能限额。
  if (plan.totalQuota === -1) {
    return { ok: true, userId };
  }

  // 判定交给 lib/config/plans.ts 的 judgeQuota：
  // 免费版按功能分别限额，付费版按总量。此前这里只有分功能分支，
  // 而调用方每次都传了 feature，付费版的总量校验从未执行过，
  // 结果 150 次的套餐实际能用 8 个功能各 150 次。
  if (feature) {
    const verdict = judgeQuota(planId, feature, quota);
    if (!verdict.allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: verdict.message,
            used: verdict.used,
            limit: verdict.limit,
            // 前端据此弹付费引导，并知道是哪个功能用完了（见 lib/upgrade）
            feature,
          },
          { status: 402 }
        ),
      };
    }
  }

  return { ok: true, userId };
  } catch { return { ok: false, response: quotaUnavailable() }; }
}

/** Confirm a previously reserved successful generation, atomically and exactly once. */
export async function incrementUsageServer(
  userId: string,
  feature: string,
  taskType?: string,
  detail?: Record<string, unknown>,
  reservation?: CreationReservation,
): Promise<void> {
  if (!reservation || reservation.userId !== userId || reservation.feature !== feature) {
    throw new Error('Generation must reserve quota before calling the model');
  }
  await settleCreation(reservation, true, taskType, detail);
}
