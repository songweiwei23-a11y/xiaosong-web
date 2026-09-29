import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServerSupabase } from '@/lib/admin-auth';
import { EMPTY_PROFILE, PROFILE_FIELDS, splitToArray } from '@/lib/profile-fields';
import { appendNotes, mergeHighlights, scrubSensitive } from '@/lib/interview-import';

export const dynamic = 'force-dynamic';

const FIELD_KEYS = new Set<string>(PROFILE_FIELDS.map((f) => f.key));

/**
 * 前采建档的最后一步：用户在确认页勾好的字段，写进新档案或已有档案。
 *
 * 只收档案字段 + 名称 + 前采两列，别的一律丢掉——请求体是用户浏览器发来的，
 * 不能像 /api/profiles 那样整个 spread 进库。每个字段按档案的类型强制转换，
 * 数组列收到字符串就拆开，免得把 text[] 列写坏。
 *
 * 前采原文追加不覆盖：同一个客户可能前采好几轮，后一轮不该把前一轮冲掉。
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '请求格式不对' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  const fields = body.fields && typeof body.fields === 'object' ? (body.fields as Record<string, unknown>) : {};
  for (const [key, v] of Object.entries(fields)) {
    if (!FIELD_KEYS.has(key)) continue;
    const wantArray = Array.isArray((EMPTY_PROFILE as Record<string, unknown>)[key]);
    if (wantArray) {
      const arr = Array.isArray(v) ? v : typeof v === 'string' ? splitToArray(v) : [];
      patch[key] = arr.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => scrubSensitive(x.trim()).slice(0, 40)).slice(0, 20);
    } else {
      patch[key] = typeof v === 'string' ? scrubSensitive(v.trim()).slice(0, 1000) : Array.isArray(v) ? v.join('、').slice(0, 1000) : '';
    }
  }

  const profileName = typeof body.profileName === 'string' ? body.profileName.trim().slice(0, 30) : '';
  const notes = typeof body.notes === 'string' ? scrubSensitive(body.notes.trim()) : '';
  const highlights = Array.isArray(body.highlights)
    ? body.highlights.filter((x: unknown): x is string => typeof x === 'string' && !!x.trim()).map((x: string) => scrubSensitive(x.trim()).slice(0, 150))
    : [];

  const supabase = await getServerSupabase();
  const profileId = typeof body.profileId === 'string' && body.profileId ? body.profileId : null;

  let existing: Record<string, unknown> | null = null;
  if (profileId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });
    existing = data;
  } else if (!profileName) {
    return NextResponse.json({ error: '新档案要有个名字' }, { status: 400 });
  }
  if (profileName) patch.profile_name = profileName;

  const interview: Record<string, unknown> = {};
  if (notes) interview.interview_notes = appendNotes(existing?.interview_notes, notes);
  if (highlights.length) interview.interview_highlights = mergeHighlights(existing?.interview_highlights, highlights);

  const write = (row: Record<string, unknown>) =>
    profileId
      ? supabase.from('user_profiles').update(row).eq('id', profileId).eq('user_id', userId).select('id').single()
      : supabase.from('user_profiles').insert([{ ...row, user_id: userId }]).select('id').single();

  let { data, error } = await write({ ...patch, ...interview });
  let notesSaved = Object.keys(interview).length > 0;

  // 前采那两列要跑迁移（20260929_interview_import.sql）才有。没跑时档案字段照样写进去，只是原文存不下
  if (error && /interview_/.test(error.message || '')) {
    console.warn('[interview] 档案表还没有前采列，这次只写档案字段:', error.message);
    ({ data, error } = await write(patch));
    notesSaved = false;
  }
  if (error || !data) {
    console.error('[interview] 写入档案失败:', error);
    return NextResponse.json({ error: '写入档案失败，请重试' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, notesSaved });
}
