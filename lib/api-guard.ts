import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/admin-auth';

export interface GuardResult {
  ok: boolean;
  userId?: string;
  response?: Response;
}

/**
 * API 守卫：要求已登录，并检查用户仍有可用配额（不扣减）。
 * 实际扣减仍由前端 incrementUsage 完成，这里只做服务端准入拦截，
 * 防止未登录/超额用户直接调用生成接口消耗 Dify 额度。
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

  // 无设置记录时放行（首次使用会由业务侧初始化），仅在明确超额时拦截
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
