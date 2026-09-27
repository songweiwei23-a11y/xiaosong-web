import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { clampPassed, passLevel } from '@/lib/newbie-course';

export const dynamic = 'force-dynamic';

/**
 * 抖音新手课的闯关进度（规则见 lib/newbie-course.ts）。
 *   GET                              → { passed }
 *   POST { action: 'pass', no }      → 过第 no 关（只能按顺序过）
 *   POST { action: 'reset' }         → 从头再学
 *
 * 表还没建时返回 unavailable，前端改存本机，不影响学。
 */

const missing = (msg: string) => /schema cache|does not exist|relation/i.test(msg);

async function read(userId: string) {
  return getServiceSupabase().from('course_progress').select('passed').eq('user_id', userId).maybeSingle();
}

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const { data, error } = await read(guard.userId!);
  if (error) {
    if (missing(error.message)) return NextResponse.json({ passed: 0, unavailable: true });
    return NextResponse.json({ error: '读取学习进度失败' }, { status: 500 });
  }
  return NextResponse.json({ passed: clampPassed(data?.passed) });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  let body: { action?: string; no?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const userId = guard.userId!;
  const db = getServiceSupabase();
  const now = new Date().toISOString();

  if (body.action === 'reset') {
    const { error } = await db.from('course_progress').upsert({ user_id: userId, passed: 0, updated_at: now }, { onConflict: 'user_id' });
    if (error) {
      if (missing(error.message)) return NextResponse.json({ passed: 0, unavailable: true });
      return NextResponse.json({ error: '操作失败：' + error.message }, { status: 500 });
    }
    return NextResponse.json({ passed: 0 });
  }

  if (body.action === 'pass') {
    const { data, error: readError } = await read(userId);
    if (readError) {
      if (missing(readError.message)) return NextResponse.json({ passed: 0, unavailable: true });
      return NextResponse.json({ error: '读取学习进度失败' }, { status: 500 });
    }
    const passed = passLevel(clampPassed(data?.passed), Number(body.no));
    const { error } = await db.from('course_progress').upsert({ user_id: userId, passed, updated_at: now }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: '保存失败：' + error.message }, { status: 500 });
    return NextResponse.json({ passed });
  }

  return NextResponse.json({ error: '不认识的操作' }, { status: 400 });
}
