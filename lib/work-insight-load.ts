import { getServiceSupabase } from '@/lib/admin-auth';
import type { InsightMaterial, InsightWork, SettingsOf } from '@/lib/work-insight-build';
import type { WorkInsight } from '@/lib/work-insight';

/**
 * 「账号作品概况」要读的东西（服务端）：作品记录、每条作品当时的创作设置、导入的文件。
 * 作品概况（app/api/work-insights）和账号诊断（app/api/account-diagnosis）共用，口径一致。
 */
export async function loadInsightInputs(userId: string, profileId: string): Promise<{ works: InsightWork[]; settingsOf: SettingsOf; materials: InsightMaterial[] }> {
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
    // 月度复盘按月份挑作品用（lib/monthly-review 的 worksInMonth）
    created_at: w.created_at ?? null,
    shot_at: w.shot_at ?? null,
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
  const materials: InsightMaterial[] = materialError ? [] : ((materialRows ?? []) as InsightMaterial[]);
  return { works, settingsOf, materials };
}

/** 这个档案现存的那一行概况（没有返回 null） */
export async function readStoredInsight(userId: string, profileId: string): Promise<WorkInsight | null> {
  const { data } = await getServiceSupabase()
    .from('account_work_insights')
    .select('insight')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .maybeSingle();
  return (data?.insight as WorkInsight | undefined) ?? null;
}
