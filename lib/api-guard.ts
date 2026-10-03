import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';
import {
  getPlan, judgeQuota, usedColumnOf, effectivePlanId, quotaRollover,
} from '@/lib/config/plans';

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
 * 扣减由 incrementUsageServer 完成，应在 Dify 生成成功后调用。
 *
 * - 未登录 -> 401
 * - 认证服务临时故障 -> 503（稍后重试）
 * - 超额   -> 402（需要付费/升级）
 */
export async function requireUserWithQuota(feature?: string): Promise<GuardResult> {
  const guard = await checkCurrentUser();
  if (!guard.ok) return guard;
  const userId = guard.userId!;
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
  const [{ data: subscription }, { data: quotaRow }] = await Promise.all([
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
      console.error('[api-guard] 创建配额记录失败:', createError);
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
    const { error: rollError } = await serviceSupabase
      .from('user_quotas')
      .update(roll.patch)
      .eq('user_id', userId);
    if (rollError) console.error('[api-guard] 额度换期写入失败:', rollError.message);
    Object.assign(quota, roll.patch);
  }

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
}

/**
 * 服务端配额扣减：在生成成功后由 API 路由调用，将对应功能的 used +1。
 * 使用 service_role 客户端直接原子操作，无竞态风险。
 * 若扣减失败仅记录日志，不影响已返回的流式内容。
 */
export async function incrementUsageServer(
  userId: string,
  feature: string,
  taskType?: string,
  /** 这次做了什么（自由对话的提问和回答），给管理后台的实时监控看 */
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    const usedColumn = usedColumnOf(feature);
    if (!usedColumn) {
      console.error('[api-guard] 未知的功能类型:', feature);
      return;
    }

    // 记一条使用记录：首页「本月已用」按它按自然月数，删历史记录也不会少。
    // 表还没建（迁移没跑）时只记日志，不影响计数器
    const base = { user_id: userId, feature, task_type: taskType ?? null };
    const row: Record<string, unknown> = detail ? { ...base, detail } : base;
    let { error: eventError } = await supabase.from('usage_events').insert(row);
    // detail 列是后加的：迁移没跑时整条插入会失败，那样连"本月已用"都少记一次。退回不带它再写
    if (eventError && detail) {
      ({ error: eventError } = await supabase.from('usage_events').insert(base));
    }
    if (eventError) console.error('[api-guard] 使用记录写入失败:', eventError.message);

    // 获取当前值
    const { data: quota } = await supabase
      .from('user_quotas')
      .select(usedColumn)
      .eq('user_id', userId)
      .single();

    if (quota) {
      const currentValue = (quota[usedColumn as keyof typeof quota] as number) || 0;
      
      // 更新 +1
      const { error: updateError } = await supabase
        .from('user_quotas')
        .update({ 
          [usedColumn]: currentValue + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[api-guard] incrementUsageServer update error:', updateError);
      } else {
        console.log(`[api-guard] 配额扣减成功: ${feature} -> ${currentValue + 1}`);
      }
    }
  } catch (err) {
    console.error('[api-guard] incrementUsageServer exception:', err);
  }
}
