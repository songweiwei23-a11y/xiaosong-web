import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * 检查“当前登录用户”是否为管理员（基于 Cookie，不接受前端传入的 userId）。
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    return NextResponse.json({ isAdmin: !!admin, role: admin?.role ?? null });
  } catch (error) {
    console.error("Admin check error:", error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
