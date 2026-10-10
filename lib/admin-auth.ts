import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseFetch } from './supabase/fetch';
import { hasPermission, type AdminPermission } from './admin-permissions';
import { mfaStepPending } from './admin-mfa';

/**
 * 统一的服务端管理员鉴权。
 * 从请求 Cookie 中解析当前登录用户，再校验其管理员身份。
 * 校验顺序：admin_roles 表（优先）> user_settings.is_admin（兼容旧数据）。
 *
 * 返回 null 表示未登录或非管理员，调用方应据此返回 401/403。
 */
export interface AdminContext {
  userId: string;
  email: string;
  role: string;
}

/**
 * 服务端 Supabase 客户端（携带用户 Cookie，遵循 RLS）。
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: supabaseFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在只读上下文（如 Server Component）中忽略
          }
        },
      },
    }
  );
}

/**
 * 拥有 Service Role 权限的客户端。仅在完成管理员鉴权后用于跨用户的特权读写。
 */
export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * 校验当前请求是否来自管理员。通过则返回管理员上下文，否则返回 null。
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // 绑定了验证器的管理员，本次会话必须已通过第二步验证（见 lib/admin-mfa）
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaStepPending(aal)) {
    return null;
  }

  // 1) 优先查 admin_roles 表
  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleData?.role) {
    return { userId: user.id, email: user.email || '', role: roleData.role };
  }

  // 2) 兼容旧机制：user_settings.is_admin
  const { data: settings } = await supabase
    .from('user_settings')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (settings?.is_admin === true) {
    return { userId: user.id, email: user.email || '', role: 'admin' };
  }

  // 3) 都不满足 => 非管理员
  return null;
}

/** 当前登录的管理员是否还差第二步验证。给 check-role 用，好让页面引导去「账号安全」 */
export async function mfaPendingForCurrentUser(): Promise<boolean> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return mfaStepPending(data);
}

/**
 * 管理员 + 具体权限。管理员身份不够（比如运营去删用户）返回 null，调用方应返回 403。
 * 权限矩阵见 lib/admin-permissions.ts。
 */
export async function requireAdminPermission(perm: AdminPermission): Promise<AdminContext | null> {
  const admin = await requireAdmin();
  if (!admin) return null;
  return hasPermission(admin.role, perm) ? admin : null;
}
