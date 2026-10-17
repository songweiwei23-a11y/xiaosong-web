import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServerSupabase } from '@/lib/admin-auth';
import { checkAccount, checkHotTopic, checkVideo, summarizeBenchmark, type BenchmarkVideoRow } from '@/lib/benchmark';

export const dynamic = 'force-dynamic';

/**
 * 对标账号 + 热点线索（整改 C）。全部是编导自己录入的，接口只做存取，不去外部平台抓数据。
 * 每条查询都按登录用户过滤（RLS 也开着，两道都守）。
 */

const UNAVAILABLE = '对标功能暂时不可用，稍后再试，还不行就刷新页面';

function dbError(message: string) {
  const missing = /schema cache|does not exist/i.test(message);
  return NextResponse.json({ error: missing ? UNAVAILABLE : '保存没成功，请稍后再试，还不行就刷新页面' }, { status: missing ? 503 : 500 });
}

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const supabase = await getServerSupabase();
  const uid = guard.userId!;

  const [accRes, vidRes, hotRes] = await Promise.all([
    supabase.from('benchmark_accounts').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
    supabase.from('benchmark_videos').select('*').eq('user_id', uid).order('published_on', { ascending: false, nullsFirst: false }),
    supabase.from('hot_topics').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
  ]);
  const firstErr = accRes.error || vidRes.error || hotRes.error;
  if (firstErr) return dbError(firstErr.message);

  const videos = vidRes.data ?? [];
  const accounts = (accRes.data ?? []).map((a) => {
    const mine = videos.filter((v) => v.account_id === a.id) as (BenchmarkVideoRow & { account_id: string })[];
    return { ...a, videos: mine, summary: summarizeBenchmark(mine) };
  });
  return NextResponse.json({ accounts, hotTopics: hotRes.data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const supabase = await getServerSupabase();
  const uid = guard.userId!;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';

  switch (body.action) {
    case 'addAccount': {
      const c = checkAccount(body);
      if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
      const profileId = typeof body.profileId === 'string' && body.profileId ? body.profileId : null;
      const { data, error } = await supabase.from('benchmark_accounts').insert({ user_id: uid, profile_id: profileId, ...c.value }).select().single();
      if (error) return dbError(error.message);
      return NextResponse.json(data);
    }
    case 'deleteAccount': {
      if (!id) return NextResponse.json({ error: '缺少编号' }, { status: 400 });
      const { error } = await supabase.from('benchmark_accounts').delete().eq('id', id).eq('user_id', uid);
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true });
    }
    case 'addVideo': {
      const accountId = typeof body.accountId === 'string' ? body.accountId : '';
      if (!accountId) return NextResponse.json({ error: '先选对标账号' }, { status: 400 });
      const v = checkVideo(body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      // 先确认这个账号是本人的，再挂作品
      const { data: acc } = await supabase.from('benchmark_accounts').select('id').eq('id', accountId).eq('user_id', uid).maybeSingle();
      if (!acc) return NextResponse.json({ error: '这个对标账号不存在' }, { status: 404 });
      const { data, error } = await supabase.from('benchmark_videos').insert({ user_id: uid, account_id: accountId, ...v.value }).select().single();
      if (error) return dbError(error.message);
      return NextResponse.json(data);
    }
    case 'deleteVideo': {
      if (!id) return NextResponse.json({ error: '缺少编号' }, { status: 400 });
      const { error } = await supabase.from('benchmark_videos').delete().eq('id', id).eq('user_id', uid);
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true });
    }
    case 'addHot': {
      const h = checkHotTopic(body);
      if (!h.ok) return NextResponse.json({ error: h.error }, { status: 400 });
      const { data, error } = await supabase.from('hot_topics').insert({ user_id: uid, ...h.value }).select().single();
      if (error) return dbError(error.message);
      return NextResponse.json(data);
    }
    case 'deleteHot': {
      if (!id) return NextResponse.json({ error: '缺少编号' }, { status: 400 });
      const { error } = await supabase.from('hot_topics').delete().eq('id', id).eq('user_id', uid);
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: '不认识这个操作' }, { status: 400 });
  }
}
