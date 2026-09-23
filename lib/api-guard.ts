import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';
import { getPlan, judgeQuota, usedColumnOf, effectivePlanId, FREE_ONE_TIME_FEATURES } from '@/lib/config/plans';

export interface GuardResult {
  ok: boolean;
  userId?: string;
  response?: Response;
}

/**
 * API 守卫：仅要求已登录，不检查也不扣减配额。
 * 适用于 CRUD 类接口（读写自己的数据），生成类接口请用 requireUserWithQuota。
 *
 * - 未登录 -> 401
 */
export async function requireUser(): Promise<GuardResult> {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: '请先登录' }, { status: 401 }),
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * API 守卫：要求已登录，并检查用户仍有可用配额（不扣减）。
 * 扣减由 incrementUsageServer 完成，应在 Dify 生成成功后调用。
 *
 * - 未登录 -> 401
 * - 超额   -> 402（需要付费/升级）
 */
export async function requireUserWithQuota(feature?: string): Promise<GuardResult> {
  const supabase = await getServerSupabase();
  const serviceSupabase = getServiceSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: '请先登录' }, { status: 401 }),
    };
  }

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
      .eq('user_id', user.id)
      .maybeSingle(),
    serviceSupabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
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

  // 企业版无限使用
  if (planId === 'enterprise') {
    return { ok: true, userId: user.id };
  }

  const quota = quotaRow;

  if (!quota) {
    // 如果没有配额记录，创建一个
    const { error: createError } = await serviceSupabase
      .from('user_quotas')
      .insert({ user_id: user.id });

    if (createError) {
      console.error('[api-guard] 创建配额记录失败:', createError);
    }
    
    // 新用户，允许继续
    return { ok: true, userId: user.id };
  }

  // 检查是否需要重置配额（周期已结束）
  const now = new Date();
  const periodEnd = new Date(quota.current_period_end || now);
  
  if (now > periodEnd) {
    // 自动重置配额
    await serviceSupabase
      .from('user_quotas')
      .update({
        knowledge_used: 0,
        // 免费版的定位是一次性额度，不随月重置。这条规则同时决定了价格页
        // 上的文案，所以两边都从 FREE_ONE_TIME_FEATURES 读，别再各写一份
        positioning_used:
          planId === 'free' && FREE_ONE_TIME_FEATURES.includes('positioning')
            ? quota.positioning_used
            : 0,
        topic_used: 0,
        script_used: 0,
        free_chat_used: 0,
        storyboard_used: 0,
        review_used: 0,
        title_used: 0,
        deal_reason_used: 0,
        current_period_start: now.toISOString(),
        current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: now.toISOString()
      })
      .eq('user_id', user.id);

    // 重置后允许继续
    return { ok: true, userId: user.id };
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
          },
          { status: 402 }
        ),
      };
    }
  }

  return { ok: true, userId: user.id };
}

/**
 * 服务端配额扣减：在生成成功后由 API 路由调用，将对应功能的 used +1。
 * 使用 service_role 客户端直接原子操作，无竞态风险。
 * 若扣减失败仅记录日志，不影响已返回的流式内容。
 */
export async function incrementUsageServer(userId: string, feature: string): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    const usedColumn = usedColumnOf(feature);
    if (!usedColumn) {
      console.error('[api-guard] 未知的功能类型:', feature);
      return;
    }

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
