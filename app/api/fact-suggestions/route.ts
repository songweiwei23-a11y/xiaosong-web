import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { historyProfileFilter, PROFILE_UUID } from '@/lib/profile-history';
import { FACT_WINDOW, FACT_PROFILE_FIELDS, factKey, factSuggestions, nextProfileValue, specOfProfileField } from '@/lib/fact-memory';

export const dynamic = 'force-dynamic';

/**
 * 事实记忆（二期 C）：生成时反复用到、和档案对不上的拍摄条件，提示「要不要更新档案」。
 *   GET  ?profileId=            → { suggestions }
 *   POST { profileId, action: 'accept' | 'dismiss', field, value }
 *     accept：写进档案（多选追加，单选替换），只允许四个字段
 *     dismiss：忽略，同一字段同一个值不再提示
 * 只读写本人、本档案的数据。
 */
const DISMISS_DAYS = 180;

async function ownedProfile(userId: string, profileId: string) {
  const { data } = await getServiceSupabase().from('user_profiles').select('*').eq('id', profileId).eq('user_id', userId).maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  const profileId = new URL(request.url).searchParams.get('profileId') ?? '';
  if (!PROFILE_UUID.test(profileId)) return NextResponse.json({ error: '档案编号不正确' }, { status: 400 });
  const profile = await ownedProfile(userId, profileId);
  if (!profile) return NextResponse.json({ error: '没有这个档案' }, { status: 404 });

  const db = getServiceSupabase();
  try {
    const { data: rows, error } = await db.from('script_history').select('input_data').eq('user_id', userId).eq('task_type', '脚本生成')
      .is('input_data->>canvasOf', null).or(historyProfileFilter(profileId) ?? '').order('created_at', { ascending: false }).limit(FACT_WINDOW);
    if (error) return NextResponse.json({ error: '读取生成记录失败' }, { status: 500 });
    const records = (rows ?? []).map((r) => {
      const input = r.input_data && typeof r.input_data === 'object' ? r.input_data as Record<string, unknown> : null;
      return input?.creationSettings && typeof input.creationSettings === 'object' ? input.creationSettings as Record<string, unknown> : null;
    });
    const since = new Date(Date.now() - DISMISS_DAYS * 86_400_000).toISOString();
    const { data: dismissRows } = await db.from('user_signals').select('payload').eq('user_id', userId).eq('kind', 'fact_dismiss')
      .eq('profile_id', profileId).gte('created_at', since).limit(200);
    const dismissed = new Set((dismissRows ?? []).map((r) => (r.payload as { key?: unknown } | null)?.key).filter((k): k is string => typeof k === 'string'));
    return NextResponse.json({ suggestions: factSuggestions(records, profile, dismissed) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: '读取事实提示失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }
  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  const field = typeof body.field === 'string' ? body.field : '';
  const value = typeof body.value === 'string' ? body.value.trim().slice(0, 40) : '';
  if (!PROFILE_UUID.test(profileId) || !FACT_PROFILE_FIELDS.has(field) || !value) {
    return NextResponse.json({ error: '这条提示不对，刷新后再试' }, { status: 400 });
  }
  const profile = await ownedProfile(userId, profileId);
  if (!profile) return NextResponse.json({ error: '没有这个档案' }, { status: 404 });
  const spec = specOfProfileField(field)!;

  if (body.action === 'accept') {
    const next = nextProfileValue(profile[field], spec.kind, value);
    const { error } = await getServiceSupabase().from('user_profiles').update({ [field]: next }).eq('id', profileId).eq('user_id', userId);
    if (error) return NextResponse.json({ error: '没有写进档案，请稍后再试，还不行就刷新页面' }, { status: 500 });
    return NextResponse.json({ ok: true, value: next });
  }
  if (body.action === 'dismiss') {
    const { error } = await getServiceSupabase().from('user_signals').insert({
      user_id: userId, profile_id: profileId, kind: 'fact_dismiss', payload: { key: factKey(field, value) },
    });
    if (error) return NextResponse.json({ error: '没记上，请稍后再试，还不行就刷新页面' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: '不认识的操作' }, { status: 400 });
}
