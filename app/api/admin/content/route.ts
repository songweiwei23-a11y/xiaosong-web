import { NextResponse } from "next/server";
import { requireAdmin, getServiceSupabase } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const taskType = searchParams.get("taskType");
    const userId = searchParams.get("userId");

    // 获取内容列表
    if (action === "list") {
      let query = supabase
        .from("script_history")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (taskType) {
        query = query.eq("task_type", taskType);
      }

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error, count } = await query;

      if (error) {
        return NextResponse.json({ error: "查询失败", details: error }, { status: 500 });
      }

      // 获取用户信息
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const userMap = new Map(users.map(u => [u.id, u.email]));

      const contentList = data?.map(item => ({
        ...item,
        user_email: userMap.get(item.user_id) || "未知用户",
      }));

      return NextResponse.json({
        content: contentList,
        total: count,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      });
    }

    // 搜索内容
    if (action === "search") {
      const keyword = searchParams.get("keyword");

      if (!keyword) {
        return NextResponse.json({ error: "缺少搜索关键词" }, { status: 400 });
      }

      const { data } = await supabase
        .from("script_history")
        .select("*")
        .or(`result.ilike.%${keyword}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      return NextResponse.json({ results: data });
    }

    return NextResponse.json({ error: "无效的操作" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      error: "服务器错误",
      details: error.message
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const body = await request.json();
    const { contentId, contentIds } = body;

    // 删除单条内容
    if (contentId) {
      const { error } = await supabase
        .from("script_history")
        .delete()
        .eq("id", contentId);

      if (error) {
        return NextResponse.json({ error: "删除失败", details: error }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "内容已删除" });
    }

    // 批量删除
    if (contentIds && Array.isArray(contentIds)) {
      const { error } = await supabase
        .from("script_history")
        .delete()
        .in("id", contentIds);

      if (error) {
        return NextResponse.json({ error: "批量删除失败", details: error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `已删除 ${contentIds.length} 条内容`
      });
    }

    return NextResponse.json({ error: "无效的参数" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      error: "服务器错误",
      details: error.message
    }, { status: 500 });
  }
}
