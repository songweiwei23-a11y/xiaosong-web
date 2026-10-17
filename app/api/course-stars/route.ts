import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { cleanStars, mergeStars, parseStarItems, type StarMap } from '@/lib/newbie-course';

export const dynamic = 'force-dynamic';

/**
 * 抖音新手课每一关的星星（规则见 lib/newbie-course.ts，表见 20261017_course_stars.sql）。
 *   GET                              → { stars: { "1": 3, ... } }
 *   POST { items: [{ no, stars }] }  → 逐关取大后保存，返回合并后的 { stars }
 *
 * 表还没建时返回 unavailable，前端只存本机，不影响学。
 */

const missing = (msg: string) => /schema cache|does not exist|relation/i.test(msg);

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const { data, error } = await getServiceSupabase()
    .from('course_stars')
    .select('lesson_no, stars')
    .eq('user_id', guard.userId!);
  if (error) {
    if (missing(error.message)) return NextResponse.json({ stars: {}, unavailable: true });
    return NextResponse.json({ error: '读取星星失败' }, { status: 500 });
  }
  return NextResponse.json({ stars: rowsToStars(data) });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }
  const items = parseStarItems(body.items);
  if (!items) return NextResponse.json({ error: '星星数据不对' }, { status: 400 });

  const userId = guard.userId!;
  const db = getServiceSupabase();
  const { data, error: readError } = await db.from('course_stars').select('lesson_no, stars').eq('user_id', userId);
  if (readError) {
    if (missing(readError.message)) return NextResponse.json({ stars: {}, unavailable: true });
    return NextResponse.json({ error: '读取星星失败' }, { status: 500 });
  }

  // 只写比库里高的；库里已经更高的不动（星星只升不降）
  const have = rowsToStars(data);
  const up = items.filter((it) => it.stars > (have[String(it.no)] ?? 0));
  if (up.length) {
    const now = new Date().toISOString();
    const { error } = await db.from('course_stars').upsert(
      up.map((it) => ({ user_id: userId, lesson_no: it.no, stars: it.stars, updated_at: now })),
      { onConflict: 'user_id,lesson_no' }
    );
    if (error) {
      if (missing(error.message)) return NextResponse.json({ stars: have, unavailable: true });
      return NextResponse.json({ error: '保存失败：' + error.message }, { status: 500 });
    }
  }

  const merged = mergeStars(have, Object.fromEntries(items.map((it) => [String(it.no), it.stars])));
  return NextResponse.json({ stars: merged });
}

/** 数据库行 → 星表（脏数据丢掉） */
function rowsToStars(rows: { lesson_no: unknown; stars: unknown }[] | null): StarMap {
  return cleanStars(Object.fromEntries((rows ?? []).map((r) => [String(r.lesson_no), r.stars])));
}
