import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';

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
export async function requireUserWithQuota(): Promise<GuardResult> {
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

  const { data: settings } = await supabase
    .from('user_settings')
    .select('quota_used, quota_limit')
    .eq('user_id', user.id)
    .maybeSingle();

  if (settings && settings.quota_limit != null && settings.quota_used >= settings.quota_limit) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `本月使用次数已达上限（${settings.quota_limit}次），请升级会员或等待下月重置` },
        { status: 402 }
      ),
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * 服务端配额扣减：在生成成功后由 API 路由调用，将 quota_used +1。
 * 使用 service_role 客户端直接原子操作，无竞态风险。
 * 若扣减失败仅记录日志，不影响已返回的流式内容。
 */
export async function incrementUsageServer(userId: string): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    // 先尝试 RPC 原子自增（需 DB 侧建函数，见 supabase/migrations）
    const { error: rpcError } = await supabase.rpc('increment_quota_used', {
      p_user_id: userId,
    });

    if (!rpcError) return;

    // RPC 不存在时回退：读取当前值后 +1 更新
    const { data: settings } = await supabase
      .from('user_settings')
      .select('quota_used')
      .eq('user_id', userId)
      .maybeSingle();

    if (settings != null) {
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ quota_used: (settings.quota_used ?? 0) + 1 })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[api-guard] incrementUsageServer update error:', updateError);
      }
    }
  } catch (err) {
    console.error('[api-guard] incrementUsageServer exception:', err);
  }
}
