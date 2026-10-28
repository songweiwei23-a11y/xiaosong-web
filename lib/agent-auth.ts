import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';

/**
 * 代理身份（2026-10-28）：登录账号在 agents 表里、状态是 active。
 *
 * 不看 admin_roles：那张表一有记录就算管理员（见 lib/gate-tickets 的 isAdminUser），
 * 代理放进去就会绕过首页拦截、还能进后台。代理只能进 /agent 和 /api/agent/*。
 *
 * 返回 null 表示未登录、不是代理、或者代理已停用；调用方应返回 403。
 */
export interface AgentContext {
  agentId: string;
  userId: string;
  displayName: string;
}

export async function requireAgent(): Promise<AgentContext | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // user.id 来自已验证的会话，所以用 service_role 查 agents 表是安全的（agents 表对前端不开放）
  const { data, error } = await getServiceSupabase()
    .from('agents')
    .select('id, display_name, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data || data.status !== 'active') return null;

  return { agentId: data.id as string, userId: user.id, displayName: (data.display_name as string) || '' };
}
