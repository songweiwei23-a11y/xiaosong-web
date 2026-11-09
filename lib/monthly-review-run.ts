import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';
import { buildProfileSummary } from '@/lib/profile-summary';
import { metricsLine, performancePromptBlock, readMetrics, summarizePerformance } from '@/lib/performance';
import { performanceRowsOf, workInsightPromptBlock, type WorkInsight } from '@/lib/work-insight';
import { buildWorkInsight, purposeOfWork, workStatusLabel, type InsightWork } from '@/lib/work-insight-build';
import { loadInsightInputs, readStoredInsight } from '@/lib/work-insight-load';
import { diagnosisSection } from '@/lib/account-diagnosis';
import { todayCN } from '@/lib/web-query';
import {
  buildReviewPrompt, installReview, JOB_STALE_MS, keepInferredFor, reviewDataStatus, type ReviewDataStatus, monthKeyCN, parseReviewJson, reviewMonthLabel, reviewToMarkdown, worksInMonth,
  type MonthlyReview, type ReviewJob, type ReviewSlot, type ReviewWork,
} from '@/lib/monthly-review';

/**
 * 跑一次月度复盘（服务端）：读材料 → 调模型 → 存进作品概况那一行（当前卡 + 最近 6 版）→ 另存一份永久存档。
 * 手动（创作进度页）和每月 1 号的定时任务都走这里。复盘不扣用户额度（2026-11-08 产品方定）。
 */

export const REVIEW_TASK_TYPE = '月度复盘';
export const DIAGNOSIS_ARCHIVE_TASK = '账号诊断';
const MODEL_TIMEOUT_MS = 150_000;
const NO_MODEL = { used: false, parsed: null, notes: [] as string[] };

type Row = WorkInsight & ReviewSlot;

/** 这个进程里正在跑的档案（pm2 单进程，够用；进程重启后由 reviewJob 的时间判断断没断） */
const running = new Set<string>();
export const reviewRunning = (profileId: string) => running.has(profileId);

async function ownedProfile(userId: string, profileId: string): Promise<Record<string, unknown> | null> {
  const { data } = await getServiceSupabase().from('user_profiles').select('*').eq('id', profileId).eq('user_id', userId).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/** 改作品概况那一行：每次都重新读最新的一行再改，别把这期间存进来的诊断、概况冲掉 */
async function updateRow(userId: string, profileId: string, profile: Record<string, unknown>, patch: (row: Row) => Row): Promise<void> {
  const stored = (await readStoredInsight(userId, profileId).catch(() => null)) as Row | null;
  const base: Row = stored ?? ({ ...buildWorkInsight({ profile, ...(await loadInsightInputs(userId, profileId)), model: NO_MODEL }), diagnosis: null } as Row);
  const next = patch(base);
  const { error } = await getServiceSupabase()
    .from('account_work_insights')
    .upsert({ profile_id: profileId, user_id: userId, insight: next, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
  if (error) throw new Error('复盘做完了，但暂时没有保存下来');
}

/** 每一份都另存一条，永不覆盖（2026-11-08 产品方：「产出的结果要一直保存着，别出现没有记忆的情况」） */
export async function archiveReport(userId: string, profileId: string, taskType: string, result: string, extra: Record<string, unknown>): Promise<boolean> {
  const { error } = await getServiceSupabase().from('script_history').insert({
    id: randomUUID(), user_id: userId, task_type: taskType,
    input_data: { ...extra, profileId, profile_id: profileId },
    result, work_id: null,
  });
  if (error) console.error('[monthly-review] 存档失败', taskType, error.code);
  return !error;
}

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export interface RunReviewInput {
  userId: string;
  profileId: string;
  month: string;
  source: 'auto' | 'manual';
  /** 插件刚采的自己主页（formatCollection 后的文字），手动复盘时才有 */
  collectedText?: string;
  collectedSummary?: string;
  now?: number;
}

export async function runMonthlyReview(input: RunReviewInput): Promise<MonthlyReview> {
  const { userId, profileId, month, source } = input;
  const now = input.now ?? Date.now();
  const profile = await ownedProfile(userId, profileId);
  if (!profile) throw new Error('找不到这个档案');
  const cfg = readAssistantConfig();
  if (!cfg) throw new Error('复盘模型还没有配置');

  const { works, settingsOf, materials } = await loadInsightInputs(userId, profileId);
  const stored = (await readStoredInsight(userId, profileId).catch(() => null)) as Row | null;
  const base: Row = stored ?? ({ ...buildWorkInsight({ profile, works, settingsOf, materials, model: NO_MODEL }), diagnosis: null } as Row);

  const monthWorks = worksInMonth(works as (InsightWork & { created_at?: string | null; shot_at?: string | null })[], month);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const reviewWorks: ReviewWork[] = monthWorks.map((w) => {
    const m = readMetrics(w.metrics);
    return {
      title: w.title, created_at: w.created_at, shot_at: w.shot_at, published_at: w.published_at,
      status: workStatusLabel(w), purpose: purposeOfWork(settingsOf, w.id), tactic: str(settingsOf.get(w.id)?.tactic),
      metrics: m ? metricsLine(m) : null,
    };
  });
  const perf = summarizePerformance(performanceRowsOf(works.map((w) => ({ id: w.id, title: w.title, metrics: w.metrics, published_at: w.published_at ?? null })), settingsOf));
  // 重跑同一个月：拿来判试验的是上一个月的卡，不是这个月自己
  const previous = [base.review, ...(base.reviewHistory ?? [])].find((r) => r && r.month < month) ?? null;
  const files = materials.filter((m) => m.status === 'ok' && m.content?.trim()).map((m) => ({ name: m.filename, text: m.content }));
  const today = todayCN(now);
  const through = month < (monthKeyCN(now) ?? month) ? lastDayOf(month) : today;

  const prompt = buildReviewPrompt({
    month, today, through,
    profileSummary: buildProfileSummary(profile as Record<string, unknown> & { profile_name?: unknown }),
    works: reviewWorks,
    performanceBlock: performancePromptBlock(perf),
    insightBlock: workInsightPromptBlock({ ...base, diagnosis: null }),
    diagnosisKey: base.diagnosis?.report ? diagnosisSection(base.diagnosis.report, /核心诊断/) : '',
    previous,
    memory: base.reviewMemory ?? { verified: [], dropped: [] },
    collectedText: input.collectedText ?? '',
    fileTexts: files,
  });

  const res = await callAssistantLlm(cfg, { system: prompt.system, messages: [{ role: 'user', content: prompt.user }], tools: [], maxTokens: 3500 }, { signal: AbortSignal.timeout(MODEL_TIMEOUT_MS) });
  const text = res.content.filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('');
  const parsed = parseReviewJson(text);
  if (!parsed) throw new Error('模型这次没有按格式给出复盘，可以再试一次');

  const published = monthWorks.filter((w) => w.shoot_status === 'published' || w.published_at).length;
  const withData = reviewWorks.filter((w) => w.metrics).length;
  const review: MonthlyReview = {
    ...parsed, month, through, source,
    inferred: keepInferredFor(parsed.inferred, reviewWorks),
    generatedAt: new Date(now).toISOString(),
    materials: [
      `${reviewMonthLabel(month)}的作品 ${monthWorks.length} 条（已发布 ${published} 条，录了数据 ${withData} 条）`,
      perf.count ? `全部作品里录了数据的 ${perf.count} 条` : '还没有录了数据的作品',
      files.length ? `导入的文件 ${files.length} 个：${files.map((f) => f.name).slice(0, 6).join('、')}` : '没有导入文件',
      input.collectedSummary ? `插件采集：${input.collectedSummary}` : '',
      base.diagnosis?.generatedAt ? `账号诊断（${base.diagnosis.generatedAt.slice(0, 10)}）` : '',
      previous ? `上一张策略卡（${reviewMonthLabel(previous.month)}）` : '第一次复盘',
    ].filter(Boolean),
  };

  await updateRow(userId, profileId, profile, (row) => ({ ...installReview(row, review), reviewJob: { month, startedAt: row.reviewJob?.startedAt ?? review.generatedAt, finishedAt: new Date().toISOString() } }));
  await archiveReport(userId, profileId, REVIEW_TASK_TYPE, reviewToMarkdown(review), { month, source, review });
  return review;
}

/** 后台开跑（页面不用一直连着等）：先记下「正在复盘」，跑完或失败都写回结果 */
export async function startMonthlyReview(input: RunReviewInput): Promise<{ started: boolean; reason?: string }> {
  if (running.has(input.profileId)) return { started: false, reason: '这个档案正在复盘，稍等一会儿' };
  const profile = await ownedProfile(input.userId, input.profileId);
  if (!profile) return { started: false, reason: '找不到这个档案' };
  if (!readAssistantConfig()) return { started: false, reason: '复盘模型还没有配置' };
  running.add(input.profileId);
  const job: ReviewJob = { month: input.month, startedAt: new Date().toISOString() };
  try {
    await updateRow(input.userId, input.profileId, profile, (row) => ({ ...row, reviewJob: job }));
  } catch {
    running.delete(input.profileId);
    return { started: false, reason: '暂时没法开始复盘，请稍后再试' };
  }
  void runMonthlyReview(input)
    .catch(async (e: Error) => {
      console.error('[monthly-review] 复盘失败', input.profileId, e.message);
      await updateRow(input.userId, input.profileId, profile, (row) => ({ ...row, reviewJob: { ...job, finishedAt: new Date().toISOString(), error: e.message || '复盘没有完成' } })).catch(() => undefined);
    })
    .finally(() => running.delete(input.profileId));
  return { started: true };
}

/** 复盘前的数据情况（页面「补数据」提示用）：这个月发布了几条、几条没录数据、几条没记目的 */
export async function loadReviewDataStatus(userId: string, profileId: string, month: string): Promise<ReviewDataStatus | null> {
  try {
    const { works, settingsOf } = await loadInsightInputs(userId, profileId);
    return reviewDataStatus(works.map((w) => ({
      title: w.title, published_at: w.published_at, shoot_status: w.shoot_status, created_at: w.created_at, shot_at: w.shot_at,
      hasData: !!readMetrics(w.metrics), purpose: purposeOfWork(settingsOf, w.id),
    })), month);
  } catch {
    return null;
  }
}

/** 页面上看到的任务状态：进程重启丢了的任务（超过 10 分钟没结束）当作已断 */
export function jobView(job: ReviewJob | null | undefined, profileId: string, now = Date.now()): { state: 'idle' | 'running' | 'failed'; error?: string; month?: string } {
  if (!job) return { state: 'idle' };
  if (!job.finishedAt) {
    if (running.has(profileId) || now - Date.parse(job.startedAt) < JOB_STALE_MS) return { state: 'running', month: job.month };
    return { state: 'failed', error: '上次复盘中途断了（服务重启），重新复盘一次就行', month: job.month };
  }
  return job.error ? { state: 'failed', error: job.error, month: job.month } : { state: 'idle' };
}
