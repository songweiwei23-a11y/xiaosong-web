import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { updateImport, UUID_RE } from '@/lib/interview-history';
import { sanitizeExtraction } from '@/lib/interview-import';
import { readJsonBody } from '@/lib/read-body';

export const dynamic = 'force-dynamic';

/**
 * 前采建档的历史记录。表只对 service_role 开放，所以每一处都带 .eq('user_id')——只看得到、改得到自己的。
 *
 *   GET            列表（不带原文，原文可能上万字）
 *   GET ?id=       一条的全部（接着核对时用）
 *   PATCH {id, extraction}   对话改完存一下，下次打开是改过的
 *   DELETE ?id=    删一条
 */
export async function GET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const db = getServiceSupabase();
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    if (!UUID_RE.test(id)) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    const { data, error } = await db.from('interview_imports').select('*').eq('id', id).eq('user_id', guard.userId!).maybeSingle();
    if (error || !data) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await db
    .from('interview_imports')
    .select('id, profile_name, target_profile_id, saved_profile_id, saved_at, created_at, extraction')
    .eq('user_id', guard.userId!)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    // 表还没建：当成没有记录，页面照常用
    console.error('[interview-history] 读历史失败:', error.message);
    return NextResponse.json([]);
  }
  // 列表只要"提取了几项"，不把整份结果发下去
  return NextResponse.json(
    (data ?? []).map(({ extraction, ...rest }) => ({
      ...rest,
      field_count: Array.isArray(extraction?.fields) ? extraction.fields.length : 0,
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const body = await readJsonBody(req).catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!UUID_RE.test(id) || !body?.extraction) return NextResponse.json({ error: '请求格式不对' }, { status: 400 });
  const ok = await updateImport(guard.userId!, id, { extraction: sanitizeExtraction(body.extraction) });
  return NextResponse.json({ ok });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  const { error } = await getServiceSupabase().from('interview_imports').delete().eq('id', id).eq('user_id', guard.userId!);
  if (error) return NextResponse.json({ error: '删除失败，请重试' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
