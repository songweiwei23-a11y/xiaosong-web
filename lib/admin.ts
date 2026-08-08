/**
 * 后台管理权限系统
 */

import { supabase } from './supabase/client';

export type AdminRole = 'developer' | 'admin' | 'operator';

const ROLE_LEVELS: Record<AdminRole, number> = {
  developer: 3,
  admin: 2,
  operator: 1,
};

export async function checkAdminRole(): Promise<{
  role: AdminRole;
  userId: string;
  email: string;
} | null> {
  try {
    console.log('🔍 开始检查管理员权限...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ 获取session失败:', sessionError);
      return null;
    }
    
    if (!session) {
      console.log('⚠️ 未登录');
      return null;
    }

    const userId = session.user.id;
    const email = session.user.email || '';
    
    console.log('✅ 当前用户:', email, 'ID:', userId);
    console.log('🔍 查询admin_roles表...');

    const { data: roleData, error } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ 查询角色失败:', error);
      return null;
    }
    
    if (!roleData) {
      console.log('⚠️ 该用户没有管理员角色');
      return null;
    }

    console.log('✅ 用户角色:', roleData.role);

    return {
      role: roleData.role as AdminRole,
      userId,
      email,
    };
  } catch (error) {
    console.error('❌ checkAdminRole异常:', error);
    return null;
  }
}

export async function hasRole(requiredRole: AdminRole): Promise<boolean> {
  const adminInfo = await checkAdminRole();
  
  if (!adminInfo) {
    return false;
  }

  return ROLE_LEVELS[adminInfo.role] >= ROLE_LEVELS[requiredRole];
}

export async function isDeveloper(): Promise<boolean> {
  return hasRole('developer');
}

export async function isAdmin(): Promise<boolean> {
  return hasRole('admin');
}

export async function isAnyAdmin(): Promise<boolean> {
  return hasRole('operator');
}

export async function logAdminAction(
  action: string,
  targetType?: string,
  targetId?: string,
  details?: any
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return;
    }

    await supabase.from('admin_logs').insert({
      admin_id: session.user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: null,
    });
  } catch (error) {
    console.error('记录管理日志失败:', error);
  }
}

export async function getUserStats() {
  try {
    console.log('📊 获取用户统计...');
    
    const { count: totalUsers, error: countError } = await supabase
      .from('user_settings')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ 获取总用户数失败:', countError);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: activeUsers, error: activeError } = await supabase
      .from('script_history')
      .select('user_id')
      .gte('created_at', today.toISOString());

    if (activeError) {
      console.error('❌ 获取活跃用户失败:', activeError);
    }

    const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id) || []);

    const { count: apiCalls, error: apiError } = await supabase
      .from('script_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    if (apiError) {
      console.error('❌ 获取API调用数失败:', apiError);
    }

    const stats = {
      totalUsers: totalUsers || 0,
      activeToday: uniqueActiveUsers.size,
      apiCallsToday: apiCalls || 0,
    };
    
    console.log('✅ 统计数据:', stats);
    
    return stats;
  } catch (error) {
    console.error('❌ getUserStats异常:', error);
    return {
      totalUsers: 0,
      activeToday: 0,
      apiCallsToday: 0,
    };
  }
}

export async function getAllUsers(page = 1, pageSize = 20) {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('user_settings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      users: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return {
      users: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}