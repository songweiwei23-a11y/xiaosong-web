import { randomUUID } from 'node:crypto';
import { buildContextBlock } from '@/lib/creator-context';
import { isDepth, TOPIC_MAX, type ResearchDepth, type ResearchStatus } from '@/lib/research';
import { internalBase, type BoardContext, type BoardResult } from './boards';
import { loadContext } from './boards-more';

/**
 * 管理员能派的「深度研究」板块（2026-10-23）。
 * 研究本身由服务端的 lib/research-runner 在后台跑；这里只是按页面的流程调研究接口（/api/research），用的是同一个接口：
 *   创建（POST，扣研究额度）→ 计划拟好（plan_ready）→ 老板在派活面板上已经确认过，直接开跑（PATCH start）
 *   → 每隔一段时间看一次进度（GET）→ done 时把报告原文交给验收；failed / canceled 时把原因交回去。
 * 研究要十几分钟，所以有超时上限；老板停下助理时，把后台的研究也停掉（取消，次数由研究接口按它的规则退回）。
 * 额度在创建时由研究接口扣，这里不另扣。
 */

/** 研究主题的最少字数（和研究接口一致） */
export const RESEARCH_TOPIC_MIN = 4;
/** 等研究的上限：25 分钟（深入研究约 12～20 分钟） */
export const RESEARCH_TIMEOUT_MS = 25 * 60_000;
/** 每隔多久看一次进度 */
export const RESEARCH_POLL_MS = 15_000;
/** 连续几次查不到进度就放弃（接口偶尔抖一下不算失败） */
const MAX_READ_FAILURES = 5;

export interface ResearchInput {
  /** 研究主题（4～500 字，必填） */
  topic: string;
  /** 深度：quick 快速、standard 标准（不填按标准）、deep 深入 */
  depth?: ResearchDepth;
  /** 背景资料：老板给的，或者上一步的产出 */
  material?: string;
  /** 返工时带上的修改意见（管理员写的） */
  extraNote?: string;
}

/** 等待的节奏和上限（测试时可以换成假的时钟） */
export interface ResearchTiming {
  timeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** 研究接口 GET 返回的任务（只取用到的字段） */
interface ResearchView {
  status?: ResearchStatus;
  plan?: unknown;
  report?: string | null;
  error?: string | null;
}

type ApiResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

/** 调研究接口。失败时返回接口给的中文原因；连不上只说暂时不可用 */
async function callResearch(ctx: BoardContext, call: { method: 'GET' | 'POST' | 'PATCH'; path?: string; body?: unknown }): Promise<ApiResult> {
  const doFetch = ctx.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${internalBase(ctx)}/api/research${call.path ?? ''}`, {
      method: call.method,
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: '深度研究暂时连接不上，请稍后再试' };
  }
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) return { ok: false, error: typeof data?.error === 'string' ? data.error : '深度研究暂时不可用，请稍后再试' };
  return { ok: true, data: data ?? {} };
}

/**
 * 深度研究：创建 → 等计划 → 开跑 → 轮询到结束，返回报告原文（Markdown，带参考来源）。
 * 主题太短或太长直接返回错误，不调用接口。
 */
export async function runResearchBoard(ctx: BoardContext, input: ResearchInput, timing: ResearchTiming = {}): Promise<BoardResult> {
  const topic = input.topic?.trim() ?? '';
  if (topic.length < RESEARCH_TOPIC_MIN) return { ok: false, text: '', error: `研究主题至少 ${RESEARCH_TOPIC_MIN} 个字` };
  if (topic.length > TOPIC_MAX) return { ok: false, text: '', error: `研究主题最多 ${TOPIC_MAX} 个字` };

  const now = timing.now ?? Date.now;
  const sleep = timing.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = timing.timeoutMs ?? RESEARCH_TIMEOUT_MS;
  const pollMs = timing.pollMs ?? RESEARCH_POLL_MS;
  const deadline = now() + timeoutMs;

  // 档案作为背景（和页面一样放进 profileContext），老板给的资料和返工意见放进 material
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  const profileContext = buildContextBlock(creatorContext, 'direction');
  const material = [input.material?.trim() ?? '', input.extraNote ? `【管理员返工意见】${input.extraNote}` : ''].filter(Boolean).join('\n\n');

  const created = await callResearch(ctx, {
    method: 'POST',
    body: {
      topic,
      depth: isDepth(input.depth) ? input.depth : 'standard',
      requestId: randomUUID(),
      profileId: profile?.id ?? null,
      profileContext: profileContext || undefined,
      material: material || undefined,
    },
  });
  if (!created.ok) return { ok: false, text: '', error: created.error };
  const id = typeof created.data.id === 'string' ? created.data.id : '';
  if (!id) return { ok: false, text: '', error: '深度研究没有创建成功，请稍后再试' };

  let started = false;
  let readFailures = 0;
  while (now() < deadline) {
    // 老板停下助理：后台的研究也停掉，不再等
    if (ctx.isStopped?.()) {
      await callResearch(ctx, { method: 'PATCH', body: { id, action: 'cancel' } });
      return { ok: false, text: '', error: '已经停下来了' };
    }

    const read = await callResearch(ctx, { method: 'GET', path: `?id=${encodeURIComponent(id)}` });
    if (!read.ok) {
      readFailures++;
      if (readFailures >= MAX_READ_FAILURES) return { ok: false, text: '', error: `查不到深度研究的进度：${read.error}` };
    } else {
      readFailures = 0;
      const job = read.data as ResearchView;
      if (job.status === 'done') {
        const report = typeof job.report === 'string' ? job.report.trim() : '';
        return report ? { ok: true, text: report } : { ok: false, text: '', error: '研究已经完成，但报告是空的' };
      }
      if (job.status === 'failed') return { ok: false, text: '', error: job.error || '深度研究没有完成' };
      if (job.status === 'canceled') return { ok: false, text: '', error: '深度研究已经停止' };
      if (job.status === 'plan_ready' && !started) {
        if (!job.plan) return { ok: false, text: '', error: '研究计划没有拟好，请重新派活' };
        // 计划在派活面板上已经给老板确认过，这里直接开跑
        const go = await callResearch(ctx, { method: 'PATCH', body: { id, action: 'start', plan: job.plan } });
        if (!go.ok) return { ok: false, text: '', error: go.error };
        started = true;
        continue; // 刚开跑，马上看一次进度
      }
    }
    await sleep(pollMs);
  }
  return { ok: false, text: '', error: `深度研究超过 ${Math.round(timeoutMs / 60_000)} 分钟还没有完成，已经停止等待。可以到深度研究的历史里查看进度` };
}
