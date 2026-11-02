import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { buildWorkInsight } from '@/lib/work-insight-build';
import { workInsightPromptBlock } from '@/lib/work-insight';
import { loadInsightInputs, readStoredInsight } from '@/lib/work-insight-load';
import type { AccountDiagnosis } from '@/lib/account-diagnosis';

export const dynamic = 'force-dynamic';

/**
 * 账号诊断（lib/account-diagnosis，创作进度「诊断我的账号」）。
 *   GET  ?profileId=  诊断要用的材料：导入文件读出的文字、作品记录的配比和数据；以及上一次的诊断
 *   POST {profileId, report, materials}  存下诊断：放进 account_work_insights 同一行的 insight.diagnosis，
 *        规划类板块、地基板块、开物助理按各自的需要读它。还没有作品概况时，先按作品记录算出确定的部分（不调模型）再挂上诊断。
 * 生成本身走 /api/dify/stream（任务类型「账号诊断」），和对标拆解一样在页面上流式出来。
 */

const FILE_CHARS = 12_000;
const MAX_FILES = 12;

async function ownedProfile(userId: string, profileId: string): Promise<Record<string, unknown> | null> {
  const { data } = await getServiceSupabase().from('user_profiles').select('*').eq('id', profileId).eq('user_id', userId).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

const NO_MODEL = { used: false, parsed: null, notes: [] as string[] };

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  const profileId = new URL(request.url).searchParams.get('profileId') ?? '';
  const profile = profileId ? await ownedProfile(userId, profileId) : null;
  if (!profile) return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });

  const [inputs, stored] = await Promise.all([loadInsightInputs(userId, profileId), readStoredInsight(userId, profileId).catch(() => null)]);
  const insight = stored ?? buildWorkInsight({ profile, ...inputs, model: NO_MODEL });
  const files = inputs.materials
    .filter((m) => m.status === 'ok' && m.content?.trim())
    .slice(0, MAX_FILES)
    .map((m) => ({ name: m.filename, text: m.content.slice(0, FILE_CHARS) }));
  return NextResponse.json({
    files,
    insightBlock: workInsightPromptBlock({ ...insight, diagnosis: null }),
    overview: insight.overview,
    diagnosis: stored?.diagnosis ?? null,
  });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  const body = (await request.json().catch(() => null)) as { profileId?: unknown; report?: unknown; materials?: unknown } | null;
  const profileId = typeof body?.profileId === 'string' ? body.profileId : '';
  const report = typeof body?.report === 'string' ? body.report.trim() : '';
  if (report.length < 200) return NextResponse.json({ error: '诊断报告太短，没有保存' }, { status: 400 });
  const profile = profileId ? await ownedProfile(userId, profileId) : null;
  if (!profile) return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });

  const diagnosis: AccountDiagnosis = {
    report: report.slice(0, 60_000),
    generatedAt: new Date().toISOString(),
    materials: (Array.isArray(body?.materials) ? body.materials : []).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 200)).slice(0, 20),
  };
  const stored = await readStoredInsight(userId, profileId).catch(() => null);
  const base = stored ?? buildWorkInsight({ profile, ...(await loadInsightInputs(userId, profileId)), model: NO_MODEL });
  const { error } = await getServiceSupabase()
    .from('account_work_insights')
    .upsert({ profile_id: profileId, user_id: userId, insight: { ...base, diagnosis }, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
  if (error) return NextResponse.json({ error: '诊断做完了，但暂时没有保存下来，请先复制报告，稍后再试' }, { status: 503 });
  return NextResponse.json({ ok: true, diagnosis });
}
