import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { APP_BUILD, touchPresence } from '@/lib/presence';

export const dynamic = 'force-dynamic';

/**
 * 工作台心跳（见 lib/presence）：告诉大屏「这个人正在用、停在哪一页、用的是哪个版本」。
 * 只记在服务进程内存里，不写数据库。返回服务器的版本号，页面据此判断自己是不是旧代码。
 */
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  let body: { path?: unknown; build?: unknown } | null = null;
  try {
    body = (await request.json()) as { path?: unknown; build?: unknown } | null;
  } catch {
    // 没带正文也没关系：只记下「在线」，页面路径和版本留空
  }
  touchPresence(guard.userId!, body?.path ?? '', Date.now(), body?.build ?? '');
  return NextResponse.json({ ok: true, build: APP_BUILD }, { headers: { 'Cache-Control': 'no-store' } });
}
