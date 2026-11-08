import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { releaseCreation, reserveCreation, settleCreation } from '@/lib/creation-quota';
import { getServiceSupabase } from '@/lib/admin-auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';
import { parseInsightJson, type WorkInsight } from '@/lib/work-insight';
import { buildWorkInsight, insightPromptFor } from '@/lib/work-insight-build';
import { loadInsightInputs, readStoredInsight } from '@/lib/work-insight-load';
import { keepReviewSlot, type ReviewSlot } from '@/lib/monthly-review';

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
  const { works, settingsOf, materials } = await loadInsightInputs(userId, profileId);

  // 模型：没配置或者出错，都只是少了文字部分，确定的配比和数据照常给出
  const cfg = readAssistantConfig();
  // 调用模型前先预留「自由对话」额度（和别的生成一样）：额度不够直接告诉用户，不调用模型
  const reserved = cfg ? await reserveCreation(userId, 'freeChat', request, { workInsight: profileId }) : null;
  if (reserved && !reserved.ok) return reserved.response;
  const reservation = reserved && reserved.ok ? reserved.reservation : null;
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
      // 模型给了回答才扣次数；没按格式给出的也算一次调用，照常扣
      if (reservation) await settleCreation(reservation, true, '作品洞察').catch(() => undefined);
    } catch {
      if (reservation) await releaseCreation(reservation).catch(() => undefined);
      model = { used: false, parsed: null, notes: ['分析模型暂时没有回应，规划和文件概况暂时没有生成，可以稍后再分析'] };
    }
  }

  // 账号诊断、月度复盘（策略卡、历史版本、长期经验、任务状态）都存在同一行里：重新分析作品概况时保留，不能被冲掉
  const previous = (await readStoredInsight(userId, profileId).catch(() => null)) as (WorkInsight & ReviewSlot) | null;
  const insight = {
    ...buildWorkInsight({ profile, works, settingsOf, materials, model }),
    diagnosis: previous?.diagnosis ?? null,
    ...(previous ? keepReviewSlot(previous) : {}),
  };
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
