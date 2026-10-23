import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServerSupabase } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/read-body';
import { CREATION_UUID, readCreationSnapshot } from '@/lib/creation-snapshot';
import { creationSettingsForPersistence } from '@/lib/creation-settings';

export const dynamic = 'force-dynamic';

/** 「最近的创作」列表里一条只给摘要：完整内容用编号再取（避免列表一次返回几十份长稿） */
function summarizeSession(row: { id: string; payload: unknown; created_at: string }) {
  const p = (row.payload ?? {}) as { from?: unknown; sourceTitle?: unknown; sourceContent?: unknown; target?: unknown };
  const body = typeof p.sourceContent === 'string' ? p.sourceContent : '';
  return {
    id: row.id,
    createdAt: row.created_at,
    from: typeof p.from === 'string' ? p.from : '',
    title: typeof p.sourceTitle === 'string' ? p.sourceTitle.slice(0, 80) : '',
    target: typeof p.target === 'string' ? p.target : '',
    chars: body.length,
    preview: body.replace(/\s+/g, ' ').slice(0, 120),
  };
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const params = new URL(request.url).searchParams;
  const db = await getServerSupabase();
  // 助理用：列出这个账号最近的创作（页面带去下一步的、助理板块的结果都在里面），按时间从新到旧
  if (params.has('recent')) {
    const limit = Math.min(Math.max(Number(params.get('recent')) || 10, 1), 30);
    const { data, error } = await db.from('creation_sessions').select('id, payload, created_at').eq('user_id', guard.userId!).order('created_at', { ascending: false }).limit(limit);
    if (error) return NextResponse.json({ error: '暂时无法读取最近的创作，请稍后重试' }, { status: 503 });
    return NextResponse.json((data ?? []).map(summarizeSession), { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const id = params.get('id');
  if (!id || !CREATION_UUID.test(id)) return NextResponse.json({ error: '创作编号不正确' }, { status: 400 });
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
