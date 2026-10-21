import { requireUser } from '@/lib/api-guard';
import { reserveCreation } from '@/lib/creation-quota';
import { createRateLimiter } from '@/lib/rate-limit';
import { readAssistantConfig } from '@/lib/assistant/config';
import { createJob, eventsSince, findJobByRequest, getJob, hasRunningJob, requestStop } from '@/lib/assistant/jobs';
import { runAssistantJob } from '@/lib/assistant/run';
import { markJobInterrupted, readStoredJob, recordJobStart } from '@/lib/assistant/job-store';
import { threadContext, titleOf } from '@/lib/assistant/memory';
import { appendMessage, createThread, getThread, listMessagesFrom, type ThreadRow } from '@/lib/assistant/memory-store';

/**
 * 开物助理的接口。
 *   GET  ?status=1          助理是否已配置（页面据此决定要不要显示入口）
 *   GET  ?job=ID&since=N    取这次对话的进度（增量）和最终回复；服务重启过的任务会告诉用户「没有做完」
 *   POST                    提交一条消息，立刻返回任务号，服务端在后台继续跑
 *   DELETE ?job=ID          请求停止
 * 每条消息按一次「自由对话」额度计算，在 lib/assistant/run.ts 里结算。
 *
 * 长期对话：带 threadId 时，对话记在服务器上（刷新、换设备都还在），模型看到的是摘要加最近的原文。
 * 没有 threadId（或数据库还没建好）时，退回到界面带来的最近几条，和以前一样。
 *
 * 请求编号（requestId）：界面每次提交都带一个新的编号；同一个编号重复提交（网络重试）时返回已有的任务，不再跑一遍、不重复扣额度。
 * 频率限制：每人每分钟最多 12 条，防止脚本刷接口（助理的模型调用比普通接口贵得多）。
 */

export const dynamic = 'force-dynamic';

const MAX_HISTORY = 8;
const MAX_TEXT = 1500;
const rateLimited = createRateLimiter(60_000, 12);

function sanitizeHistory(raw: unknown): { role: 'user' | 'assistant'; text: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is { role: string; text: string } => !!h && typeof h.text === 'string')
    .map((h) => ({ role: h.role === 'assistant' ? 'assistant' as const : 'user' as const, text: h.text.slice(0, MAX_TEXT) }))
    .slice(-MAX_HISTORY);
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  if (url.searchParams.get('status')) {
    return Response.json({ enabled: readAssistantConfig() !== null });
  }

  const userId = guard.userId!;
  const id = url.searchParams.get('job') ?? '';
  const job = getJob(id, userId);
  if (job) return Response.json(eventsSince(job, Number(url.searchParams.get('since') || 0)));

  // 内存里已经没有这个任务：多半是服务重启了。看一眼存根，告诉界面「没有做完」，而不是一直「找不到」
  const stored = await readStoredJob(id, userId);
  if (!stored) return Response.json({ error: '找不到这次对话' }, { status: 404 });
  if (stored.status === 'running') {
    await markJobInterrupted(id, userId);
    return Response.json({
      status: 'error',
      events: [{ type: 'error', text: '服务刚重新启动，这次没有做完。可以再问一次' }],
      next: 1,
      answer: '',
    });
  }
  return Response.json({ status: stored.status === 'interrupted' ? 'error' : stored.status, events: [], next: 0, answer: '' });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const cfg = readAssistantConfig();
  if (!cfg) return Response.json({ error: '开物助理还没有配置，请联系管理员' }, { status: 503 });

  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    history?: unknown;
    profileId?: unknown;
    memoryOn?: unknown;
    threadId?: unknown;
    requestId?: unknown;
  } | null;
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_TEXT) : '';
  const profileId = typeof body?.profileId === 'string' && body.profileId.length <= 64 ? body.profileId : null;
  // 页面默认开着「记忆预填」；界面没带或者带了 true 都按开着处理，只有明确关掉才不预填
  const memoryOn = body?.memoryOn !== false;
  const threadIdIn = typeof body?.threadId === 'string' && body.threadId.length <= 64 ? body.threadId : null;
  const requestId = typeof body?.requestId === 'string' && /^[\w-]{8,64}$/.test(body.requestId) ? body.requestId : null;
  if (!message) return Response.json({ error: '请先输入你想做的事' }, { status: 400 });

  const userId = guard.userId!;
  // 网络重试：同一个请求编号已经在跑（或跑完了还在内存里），直接返回那个任务
  if (requestId) {
    const same = findJobByRequest(userId, requestId);
    if (same) return Response.json({ jobId: same.id, threadId: null, duplicate: true });
  }
  if (rateLimited(userId)) {
    return Response.json({ error: '问得太快了，等一会儿再问' }, { status: 429 });
  }
  if (hasRunningJob(userId)) {
    return Response.json({ error: '上一条还在处理中，等它完成后再问' }, { status: 409 });
  }

  // 先确认这段对话是自己的（找不到就是别人的或已删除）；数据库出错就不存对话，照常聊
  let store = true;
  let thread: ThreadRow | null = null;
  if (threadIdIn) {
    try {
      thread = await getThread(userId, threadIdIn);
    } catch {
      store = false;
    }
    if (store && !thread) return Response.json({ error: '找不到这段对话，可能已经删除了' }, { status: 404 });
  }

  // 先按额度预留：额度不够时直接告诉用户，不启动任何模型调用
  const reserved = await reserveCreation(userId, 'freeChat', request, { assistant: true, message });
  if (!reserved.ok) return reserved.response;

  let threadId: string | null = null;
  let summary = '';
  let history = sanitizeHistory(body?.history);
  if (store) {
    try {
      if (!thread) thread = await createThread(userId, titleOf(message));
      // 模型看到的：摘要 + 摘要之后还没压缩的原文（必须在存这一条之前取，免得重复）
      const pending = await listMessagesFrom(userId, thread.id, thread.summarized_count);
      history = threadContext(pending).history;
      summary = thread.summary;
      await appendMessage(userId, thread.id, 'user', message);
      threadId = thread.id;
    } catch {
      threadId = null;
      summary = '';
      history = sanitizeHistory(body?.history);
    }
  }

  const job = createJob(userId, Date.now(), requestId);
  void recordJobStart({ id: job.id, userId, threadId, requestId });
  // 不等它跑完：后台继续，界面轮询进度
  void runAssistantJob(job, {
    cfg,
    cookie: request.headers.get('cookie') ?? '',
    message,
    history,
    reservation: reserved.reservation,
    profileId,
    memoryOn,
    threadId,
    summary,
  });
  return Response.json({ jobId: job.id, threadId });
}

export async function DELETE(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const id = new URL(request.url).searchParams.get('job') ?? '';
  const stopped = requestStop(id, guard.userId!);
  return Response.json({ stopping: stopped }, { status: stopped ? 200 : 404 });
}
