import { NextResponse } from "next/server";
import { requireAdmin, getServiceSupabase } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
    }

    // 获取系统配置（可以从数据库读取，这里先用硬编码）
    const config = {
      defaultQuota: 5,
      features: {
        scriptGeneration: true,
        topicPlanning: true,
        storyboard: true,
        titleCover: true,
        accountPositioning: true,
        dealReasons: true,
        contentReview: true,
      },
      apiKeys: {
        dify: process.env.DIFY_API_KEY ? "已配置" : "未配置",
        supabase: "已配置",
      },
      announcement: "",
    };

    return NextResponse.json({ config });

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
    const { action, data } = body;

    // 批量更新默认配额
    if (action === "update_default_quota") {
      const { error } = await supabase
        .from("user_settings")
        .update({ quota_limit: data.defaultQuota })
        .eq("subscription_tier", "free");

      if (error) {
        return NextResponse.json({ error: "更新失败", details: error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `已将所有免费用户配额设置为 ${data.defaultQuota}`
      });
    }

    // 更新功能开关（这里可以存到专门的配置表）
    if (action === "update_features") {
      return NextResponse.json({
        success: true,
        message: "功能配置已更新",
        note: "此功能需要数据库支持，当前为演示模式"
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
