import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';

export const dynamic = 'force-dynamic';

/**
 * 管理员权限管理。
 *
 * 【口径必须和 requireAdmin 一致】鉴权时的判断顺序是
 * admin_roles 表（优先）→ user_settings.is_admin（兼容旧数据）。
 * 而这个接口原先只读 user_settings，于是通过 admin_roles 授权的管理员
 * 在列表里根本不出现——页面显示「只有 1 个管理员」，实际可能有两个，
 * 想撤销也撤销不掉。
 *
 * 另外原先只接受 userId（一串 UUID）。管理员手上通常只有对方的邮箱，
 * 要先去数据库里翻 UUID 才能授权，等于这个页面存在也用不了。
 * 现在按邮箱授权。
 */

async function listAdminIds(supabase: ReturnType<typeof getServiceSupabase>) {
  const ids = new Set<string>();

  const { data: roles } = await supabase.from('admin_roles').select('user_id, role');
  const roleById = new Map<string, string>();
  for (const r of roles ?? []) {
    if (r.user_id) {
      ids.add(r.user_id);
      roleById.set(r.user_id, r.role || 'admin');
    }
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('is_admin', true);
  for (const s of settings ?? []) if (s.user_id) ids.add(s.user_id);

  return { ids, roleById };
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: '无管理员权限' }, { status: 403 });

    const supabase = getServiceSupabase();
    const { ids, roleById } = await listAdminIds(supabase);

    if (ids.size === 0) return NextResponse.json({ admins: [] });

    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const admins = (data?.users ?? [])
      .filter((u) => ids.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        role: roleById.get(u.id) ?? 'admin',
        // 通过 admin_roles 授权的是「新机制」，只在 user_settings 里的是历史遗留
        source: roleById.has(u.id) ? 'admin_roles' : 'user_settings',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_self: u.id === admin.userId,
      }));

    return NextResponse.json({ admins });
  } catch (error: any) {
    console.error('[admin/permissions] GET 失败:', error);
    return NextResponse.json({ error: '读取管理员列表失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: '无管理员权限' }, { status: 403 });

    const supabase = getServiceSupabase();
    const { action, email, userId } = await request.json();

    // 按邮箱找人。listUsers 一页 1000，够用；超出再翻页
    const resolveUser = async () => {
      if (userId) {
        const { data } = await supabase.auth.admin.getUserById(userId);
        return data?.user ?? null;
      }
      if (!email) return null;
      const target = String(email).trim().toLowerCase();
      let page = 1;
      for (;;) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) return null;
        const hit = data.users.find((u) => u.email?.toLowerCase() === target);
        if (hit) return hit;
        if (data.users.length < 1000) return null;
        page += 1;
        if (page > 100) return null;
      }
    };

    if (action === 'add_admin') {
      const user = await resolveUser();
      if (!user) {
        return NextResponse.json({ error: '找不到这个用户，请确认邮箱是否注册过' }, { status: 404 });
      }

      // 写 admin_roles——这是 requireAdmin 优先认的机制
      const { error } = await supabase
        .from('admin_roles')
        .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id' });

      if (error) {
        console.error('[admin/permissions] 授权失败:', error);
        return NextResponse.json({ error: '授权失败：' + error.message }, { status: 500 });
      }

      await logAdminAction({
        admin_id: admin.userId,
        action: AdminActions.GRANT_ADMIN,
        target_type: 'user',
        target_id: user.id,
        details: { email: user.email },
      });

      return NextResponse.json({ success: true, message: `${user.email} 已设为管理员` });
    }

    if (action === 'remove_admin') {
      const user = await resolveUser();
      if (!user) return NextResponse.json({ error: '找不到这个用户' }, { status: 404 });

      // 不能撤销自己，否则一失手就没人能进后台了
      if (user.id === admin.userId) {
        return NextResponse.json({ error: '不能移除自己的管理员权限' }, { status: 400 });
      }

      // 撤销时两个来源都要清，否则旧的 user_settings.is_admin 还会让他进得来
      await supabase.from('admin_roles').delete().eq('user_id', user.id);
      await supabase.from('user_settings').update({ is_admin: false }).eq('user_id', user.id);

      await logAdminAction({
        admin_id: admin.userId,
        action: AdminActions.REVOKE_ADMIN,
        target_type: 'user',
        target_id: user.id,
        details: { email: user.email },
      });

      return NextResponse.json({ success: true, message: `已移除 ${user.email} 的管理员权限` });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error: any) {
    console.error('[admin/permissions] POST 失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
