import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';
import { validateNewPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

/**
 * 登录用户修改自己的密码。
 *
 * 【必须先验旧密码】只凭登录态就能改，意味着谁借用了一下没锁屏的电脑，
 * 就能把密码改掉、把主人锁在外面——而这个系统没有发信服务，
 * 主人连"找回"都没法自助，只能再找客服。
 *
 * 【为什么在服务端改】浏览器里的 updateUser({ password }) 受 Supabase
 * 控制台「安全改密码」开关影响：打开时要走邮件二次确认，而这里发不了信，
 * 结果就是点了没反应。用 service_role 的 admin.updateUserById 不受这个开关影响，
 * 行为是确定的。
 */
export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const next = body.newPassword;
  if (!current) return NextResponse.json({ error: '请填写当前密码' }, { status: 400 });

  const invalid = validateNewPassword(next, current);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  /*
   * 验旧密码：用一个不落盘的独立客户端试登一次。
   * 验完只注销**这一次**的会话（scope: 'local'）——supabase-js 的 signOut
   * 默认是 global，会把用户浏览器里正在用的登录也一起踢掉。
   */
  const probe = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: wrong } = await probe.auth.signInWithPassword({ email: user.email, password: current });
  if (wrong) {
    return NextResponse.json({ error: '当前密码不对' }, { status: 400 });
  }
  await probe.auth.signOut({ scope: 'local' }).catch(() => {});

  const { error } = await getServiceSupabase().auth.admin.updateUserById(user.id, {
    password: next,
  });
  if (error) {
    console.error('[account/password] 修改失败:', error.message);
    return NextResponse.json({ error: '修改失败：' + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
