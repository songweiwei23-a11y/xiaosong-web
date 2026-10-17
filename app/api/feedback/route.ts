import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { parseFeedback } from '@/lib/result-feedback';
import { controlOfExcerpt } from '@/lib/learning-signals';
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

  const db = getServiceSupabase();
  // 档案必须是本人的，否则不记到档案上（学习只看自己的档案）
  let profileId: string | null = null;
  if (input.profileId) {
    const { data: owned } = await db.from('user_profiles').select('id').eq('id', input.profileId).eq('user_id', userId).maybeSingle();
    profileId = owned ? input.profileId : null;
  }
  // 能对上生成记录，就记下这条是不是对照组生成的（对照组的反馈单独统计，不进偏好学习的主线）
  const control = input.excerpt ? await controlOfExcerpt(userId, input.excerpt) : null;

  const base = { user_id: userId, board: input.board, rating: input.rating, reason: input.reason };
  let { error } = await db.from('result_feedback').insert({ ...base, profile_id: profileId, excerpt: input.excerpt, control });
  // 二期的列还没加（迁移没跑）：照旧只存原来的字段，反馈照常保存，只是暂时学不到
  if (error && /profile_id|excerpt|control/i.test(error.message)) {
    ({ error } = await db.from('result_feedback').insert(base));
  }
  if (error) {
    console.error('[feedback] 写入失败:', error.message);
    const missing = /schema cache|does not exist|Could not find the table|column/i.test(error.message);
    return NextResponse.json(
      { error: missing ? '结果反馈暂时不可用，稍后再试' : '反馈没有保存，请稍后再试，还不行就刷新页面' },
      { status: missing ? 503 : 500 }
    );
  }
  return NextResponse.json({ success: true });
}
