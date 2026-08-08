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

    // 获取所有统计数据
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const { data: settings } = await supabase.from("user_settings").select("*");
    const { data: history } = await supabase.from("script_history").select("*");

    // 统计用户数据
    const totalUsers = users.length;
    const freeUsers = settings?.filter(s => s.subscription_tier === "free").length || 0;
    const proUsers = settings?.filter(s => s.subscription_tier === "pro").length || 0;
    const premiumUsers = settings?.filter(s => s.subscription_tier === "premium").length || 0;

    // 统计功能使用
    const taskStats: Record<string, number> = {};
    history?.forEach(h => {
      taskStats[h.task_type] = (taskStats[h.task_type] || 0) + 1;
    });

    // 活跃用户（最近7天有使用记录）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = new Set(
      history?.filter(h => new Date(h.created_at) > sevenDaysAgo)
        .map(h => h.user_id)
    ).size;

    // 今日新增用户
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = users.filter(u => new Date(u.created_at) >= today).length;

    // 今日使用次数
    const usagesToday = history?.filter(h => new Date(h.created_at) >= today).length || 0;

    // 按日期统计使用量（最近30天）
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const dailyUsage = last30Days.map(date => {
      const count = history?.filter(h =>
        h.created_at.startsWith(date)
      ).length || 0;
      return { date, count };
    });

    // 功能使用排行
    const featureRanking = Object.entries(taskStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 用户增长趋势（最近30天）
    const userGrowth = last30Days.map(date => {
      const count = users.filter(u =>
        u.created_at.split('T')[0] <= date
      ).length;
      return { date, count };
    });

    return NextResponse.json({
      overview: {
        totalUsers,
        freeUsers,
        proUsers,
        premiumUsers,
        activeUsers,
        newUsersToday,
        usagesToday,
        totalUsages: history?.length || 0,
      },
      taskStats,
      featureRanking,
      dailyUsage,
      userGrowth,
    });

  } catch (error: any) {
    return NextResponse.json({
      error: "服务器错误",
      details: error.message
    }, { status: 500 });
  }
}
