import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServerSupabase } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/read-body';
import { CREATION_UUID, readCreationSnapshot } from '@/lib/creation-snapshot';
import { creationSettingsForPersistence } from '@/lib/creation-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !CREATION_UUID.test(id)) return NextResponse.json({ error: '创作编号不正确' }, { status: 400 });
  const db = await getServerSupabase();
  // created_at：恢复时和作品里的新版本比先后（lib/creation-restore）
  const { data, error } = await db.from('creation_sessions').select('id, payload, created_at').eq('id', id).eq('user_id', guard.userId!).maybeSingle();
  if (error) return NextResponse.json({ error: '暂时无法恢复创作需求，请稍后重试' }, { status: 503 });
  if (!data) return NextResponse.json({ error: '没有找到这份创作需求，或当前账号无权限' }, { status: 404 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, guard.userId!); }
  catch { return NextResponse.json({ error: '创作需求格式不正确' }, { status: 400 }); }
  const payload = readCreationSnapshot(body.payload);
  if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !CREATION_UUID.test(body.requestId))) return NextResponse.json({ error: '创作请求编号不正确' }, { status: 400 });
  if (!payload?.sourceContent?.trim()) return NextResponse.json({ error: '请选择要继续创作的内容' }, { status: 400 });
  const db = await getServerSupabase();
  const inputSettings = (body.payload as Record<string, unknown>)?.settings;
  const persistedPayload = inputSettings && typeof inputSettings === 'object' ? { ...payload, settings: creationSettingsForPersistence(payload.settings || {}) } : payload;
  const { data, error } = await db.rpc('save_creation_session', { p_id: body.requestId || randomUUID(), p_payload: persistedPayload, p_branch: body.branch === true });
  if (error) {
    const denied = /profile|permission|ownership|档案|权限/.test(error.message);
    return NextResponse.json({ error: denied ? '作品与当前档案不匹配，请检查选择' : '创作需求未保存，请稍后重试；原内容仍在当前页面' }, { status: denied ? 403 : 503 });
  }
  return NextResponse.json(data?.payload ? { ...data, payload: readCreationSnapshot(data.payload) || data.payload } : data);
}
