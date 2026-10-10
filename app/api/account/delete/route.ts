import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { purgeUser } from '@/lib/admin-delete-user';

export const dynamic = 'force-dynamic';

/*
 * 自助注销。删除逻辑与后台「删除用户」相同（lib/admin-delete-user），
 * 必须输入登录邮箱确认，防止误触；管理员账号不能自助注销，避免把唯一的管理员删掉。
 */
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;

  let body: { confirmEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const [{ data: role }, { data: settings }, { data: userRes }] = await Promise.all([
    supabase.from('admin_roles').select('role').eq('user_id', userId).maybeSingle(),
    supabase.from('user_settings').select('is_admin').eq('user_id', userId).maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);
  if (role?.role || settings?.is_admin === true) {
    return NextResponse.json({ error: '管理员账号不能自助注销，请先联系负责人' }, { status: 403 });
  }

  const email = (userRes?.user?.email || '').trim().toLowerCase();
  const typed = typeof body.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';
  if (!email || typed !== email) {
    return NextResponse.json({ error: '请输入你的登录邮箱，确认注销' }, { status: 400 });
  }

  try {
    const result = await purgeUser(supabase, userId);
    return NextResponse.json({ success: true, files: result.files });
  } catch (e) {
    console.error('[account/delete] 注销失败:', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
