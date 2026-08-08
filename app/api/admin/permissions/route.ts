import { NextResponse } from "next/server";
import { requireAdmin, getServiceSupabase } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    // 获取所有管理员列表
    const { data: adminSettings } = await supabase
      .from("user_settings")
      .select("user_id, is_admin")
      .eq("is_admin", true);

    if (!adminSettings) {
      return NextResponse.json({ admins: [] });
    }

    // 获取管理员用户信息
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const adminUserIds = adminSettings.map(s => s.user_id);

    const admins = users
      .filter(u => adminUserIds.includes(u.id))
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }));

    return NextResponse.json({ admins });

  } catch (error: any) {
    return NextResponse.json({
      error: "服务器错误",
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const body = await request.json();
    const { action, userId } = body;

    // 添加管理员
    if (action === "add_admin") {
      // 检查用户是否存在
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);

      if (!user) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }

      // 更新或创建 user_settings
      const { data: existingSettings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existingSettings) {
        const { error } = await supabase
          .from("user_settings")
          .update({ is_admin: true })
          .eq("user_id", userId);

        if (error) {
          return NextResponse.json({ error: "设置失败", details: error }, { status: 500 });
        }
      } else {
        const { error } = await supabase
          .from("user_settings")
          .insert({
            user_id: userId,
            is_admin: true,
            quota_limit: 5,
            quota_used: 0,
            subscription_tier: "free",
          });

        if (error) {
          return NextResponse.json({ error: "创建失败", details: error }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: true,
        message: `${user.email} 已被设置为管理员`
      });
    }

    // 移除管理员
    if (action === "remove_admin") {
      // 不能移除自己（对比当前登录管理员）
      if (userId === admin.userId) {
        return NextResponse.json({
          error: "不能移除自己的管理员权限"
        }, { status: 400 });
      }

      const { error } = await supabase
        .from("user_settings")
        .update({ is_admin: false })
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "移除失败", details: error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "管理员权限已移除"
      });
    }

    return NextResponse.json({ error: "无效的操作" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      error: "服务器错误",
      details: error.message
    }, { status: 500 });
  }
}
