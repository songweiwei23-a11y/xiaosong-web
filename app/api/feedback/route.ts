import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { parseFeedback } from '@/lib/result-feedback';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const dailyLimited = createRateLimiter(24 * 3600_000, 300);

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;

  if (dailyLimited(userId)) {
    return NextResponse.json({ error: '今天反馈的次数太多了，明天再来' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }
  const input = parseFeedback(body);
  if (!input) return NextResponse.json({ error: '反馈内容不正确' }, { status: 400 });

  const { error } = await getServiceSupabase().from('result_feedback').insert({
    user_id: userId,
    board: input.board,
    rating: input.rating,
    reason: input.reason,
  });
  if (error) {
    console.error('[feedback] 写入失败:', error.message);
    const missing = /schema cache|does not exist|Could not find the table/i.test(error.message);
    return NextResponse.json(
      { error: missing ? '结果反馈功能尚未启用' : '反馈没有保存，请稍后再试' },
      { status: missing ? 503 : 500 }
    );
  }
  return NextResponse.json({ success: true });
}
