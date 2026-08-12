import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { code, userId } = await request.json();

    if (!code || !userId) {
      return NextResponse.json(
        { error: "邀请码和用户ID必填" },
        { status: 400 }
      );
    }

    // 1. 验证邀请码
    const { data: invitation, error: fetchError } = await supabase
      .from("invitation_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: "邀请码不存在" },
        { status: 404 }
      );
    }

    // 2. 检查邀请码状态
    if (invitation.status === "used") {
      return NextResponse.json(
        { error: "邀请码已被使用" },
        { status: 400 }
      );
    }

    if (invitation.status === "expired") {
      return NextResponse.json(
        { error: "邀请码已过期" },
        { status: 400 }
      );
    }

    // 3. 检查是否过期
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // 标记为过期
      await supabase
        .from("invitation_codes")
        .update({ status: "expired" })
        .eq("code", code.toUpperCase());

      return NextResponse.json(
        { error: "邀请码已过期" },
        { status: 400 }
      );
    }

    // 4. 标记邀请码为已使用
    const { error: updateError } = await supabase
      .from("invitation_codes")
      .update({
        status: "used",
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("code", code.toUpperCase());

    if (updateError) {
      console.error("标记邀请码失败:", updateError);
      return NextResponse.json(
        { error: "使用邀请码失败" },
        { status: 500 }
      );
    }

    // 5. 创建邀请关系记录
    const { error: relationError } = await supabase
      .from("invitation_relationships")
      .insert({
        inviter_id: invitation.created_by,
        invitee_id: userId,
        invitation_code: code.toUpperCase(),
      });

    if (relationError) {
      console.error("创建邀请关系失败:", relationError);
      // 不返回错误，因为主要功能已完成
    }

    // 6. 更新用户配置文件（设置会员等级）
    const planType = invitation.plan_type || "free";
    
    // 根据邀请码的plan_type设置用户的subscription_plan
    const { error: profileError } = await supabase
      .from("user_profiles")
      .update({
        subscription_plan: planType,
        is_legacy_user: false, // 新用户不是老用户
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("更新用户配置失败:", profileError);
      // 不影响主流程
    }

    return NextResponse.json({
      success: true,
      message: "邀请码使用成功",
      planType: planType,
    });
  } catch (error) {
    console.error("使用邀请码错误:", error);
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}
