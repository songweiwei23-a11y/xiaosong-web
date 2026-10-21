import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';
import { parseInsightJson, type WorkInsight } from '@/lib/work-insight';
import { buildWorkInsight, insightPromptFor, type InsightMaterial, type InsightWork, type SettingsOf } from '@/lib/work-insight-build';

export const dynamic = 'force-dynamic';

/**
 * 账号作品概况（lib/work-insight）。
 *   GET  ?profileId=   取最近一次的分析（没有就是 null）
 *   POST {profileId}   重新分析：读作品记录、创作设置、录入的数据和导入的文件，算出配比和反馈，
 *                      再让模型给出规划和文件概况，最后存下来给所有规划类板块用。
 * 模型不可用时仍然给出能确定的部分（配比、三类数据），并说明缺的是什么。
 */

const analyzeLimit = createRateLimiter(60_000, 4);
const MODEL_TIMEOUT_MS = 90_000;

async function ownedProfile(userId: string, profileId: string): Promise<Record<string, unknown> | null> {
  const { data } = await getServiceSupabase()
    .from('user_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const profileId = new URL(request.url).searchParams.get('profileId') ?? '';
  if (!profileId || !(await ownedProfile(guard.userId!, profileId))) {
    return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });
  }
  const { data, error } = await getServiceSupabase()
    .from('account_work_insights')
    .select('insight, updated_at')
    .eq('user_id', guard.userId!)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) return NextResponse.json({ insight: null, unavailable: true });
  return NextResponse.json({ insight: (data?.insight as WorkInsight | undefined) ?? null, updatedAt: data?.updated_at ?? null });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  if (analyzeLimit(userId)) return NextResponse.json({ error: '分析太频繁了，过一分钟再试' }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { profileId?: unknown } | null;
  const profileId = typeof body?.profileId === 'string' ? body.profileId : '';
  const profile = profileId ? await ownedProfile(userId, profileId) : null;
  if (!profile) return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });

  const db = getServiceSupabase();
  const { data: workRows } = await db
    .from('works')
    .select('*')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(300);
  const works = ((workRows ?? []) as InsightWork[]).map((w) => ({
    id: w.id,
    title: w.title,
    is_done: w.is_done,
    shoot_status: w.shoot_status,
    published_at: w.published_at,
    metrics: w.metrics,
  }));

  // 每条作品当时的创作设置：优先脚本那一步的，没有就用选题的（和数据回流同一口径）
  const settingsOf: SettingsOf = new Map();
  if (works.length) {
    const { data: items } = await db
      .from('script_history')
      .select('work_id, task_type, input_data, created_at')
      .eq('user_id', userId)
      .in('work_id', works.map((w) => w.id))
      .in('task_type', ['脚本生成', '选题策划'])
      .order('created_at', { ascending: false });
    const fromScript = new Map<string, boolean>();
    for (const it of items ?? []) {
      const s = (it.input_data as Record<string, unknown> | null)?.creationSettings as Record<string, unknown> | undefined;
      if (!s || !it.work_id) continue;
      const isScript = it.task_type === '脚本生成';
      if (!settingsOf.has(it.work_id) || (isScript && !fromScript.get(it.work_id))) {
        settingsOf.set(it.work_id, s);
        fromScript.set(it.work_id, isScript);
      }
    }
  }

  const { data: materialRows, error: materialError } = await db
    .from('account_materials')
    .select('filename, status, content')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(60);
  const materials: InsightMaterial[] = materialError
    ? []
    : ((materialRows ?? []) as InsightMaterial[]);

  // 模型：没配置或者出错，都只是少了文字部分，确定的配比和数据照常给出
  const cfg = readAssistantConfig();
  let model: { used: boolean; parsed: ReturnType<typeof parseInsightJson>; notes: string[] };
  if (!cfg) {
    model = { used: false, parsed: null, notes: ['分析模型还没有配置，规划和文件概况暂时没有生成'] };
  } else {
    try {
      const prompt = insightPromptFor({ profile, works, settingsOf, materials });
      const res = await callAssistantLlm(
        cfg,
        { system: prompt.system, messages: [{ role: 'user', content: prompt.user }], tools: [], maxTokens: 3000 },
        { signal: AbortSignal.timeout(MODEL_TIMEOUT_MS) },
      );
      const text = res.content
        .filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const parsed = parseInsightJson(text);
      model = {
        used: true,
        parsed,
        notes: parsed ? [] : ['模型这次没有按格式给出分析，规划和反馈暂时没有生成，可以再分析一次'],
      };
    } catch {
      model = { used: false, parsed: null, notes: ['分析模型暂时没有回应，规划和文件概况暂时没有生成，可以稍后再分析'] };
    }
  }

  const insight = buildWorkInsight({ profile, works, settingsOf, materials, model });
  const { error } = await db
    .from('account_work_insights')
    .upsert({ profile_id: profileId, user_id: userId, insight, updated_at: insight.generatedAt }, { onConflict: 'profile_id' });
  if (error) {
    return NextResponse.json(
      { error: '分析做完了，但暂时没有保存下来，请稍后再试', insight },
      { status: 503 },
    );
  }
  return NextResponse.json({ insight, saved: true });
}
