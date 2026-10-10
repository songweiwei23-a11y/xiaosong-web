import { NextResponse } from 'next/server';
import { requireAdmin, mfaPendingForCurrentUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 后台页面进入前确认身份。和所有后台接口用同一套判断（requireAdmin：
 * admin_roles 优先，兼容 user_settings.is_admin），口径不会两样。
 * 非管理员一律 403，页面据此跳回首页。
 * 例外：是管理员但还没通过第二步验证（已绑定验证器）→ 403 + code=mfa_required，页面引导去「账号安全」。
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    if (await mfaPendingForCurrentUser()) {
      return NextResponse.json({ error: '请先完成二次验证', code: 'mfa_required' }, { status: 403 });
    }
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }
  return NextResponse.json({ role: admin.role, email: admin.email, userId: admin.userId });
}
