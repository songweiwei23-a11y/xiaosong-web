import { requireUser } from '@/lib/api-guard';
import { reserveCreation } from '@/lib/creation-quota';
import { readAssistantConfig } from '@/lib/assistant/config';
import { createJob, eventsSince, getJob, hasRunningJob, requestStop } from '@/lib/assistant/jobs';
import { runAssistantJob } from '@/lib/assistant/run';
import { threadContext, titleOf } from '@/lib/assistant/memory';
import { appendMessage, createThread, getThread, listMessagesFrom, type ThreadRow } from '@/lib/assistant/memory-store';

/**
 * 开物助理的接口。
 *   GET  ?status=1          助理是否已配置（页面据此决定要不要显示入口）
 *   GET  ?job=ID&since=N    取这次对话的进度（增量）和最终回复
 *   POST                    提交一条消息，立刻返回任务号，服务端在后台继续跑
 *   DELETE ?job=ID          请求停止
 * 每条消息按一次「自由对话」额度计算，在 lib/assistant/run.ts 里结算。
 *
 * 长期对话：带 threadId 时，对话记在服务器上（刷新、换设备都还在），模型看到的是摘要加最近的原文。
 * 没有 threadId（或数据库还没建好）时，退回到界面带来的最近几条，和以前一样。
 */

export const dynamic = 'force-dynamic';

const MAX_HISTORY = 8;
const MAX_TEXT = 1500;

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

  const job = getJob(url.searchParams.get('job') ?? '', guard.userId!);
  if (!job) return Response.json({ error: '找不到这次对话' }, { status: 404 });
  return Response.json(eventsSince(job, Number(url.searchParams.get('since') || 0)));
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
  } | null;
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_TEXT) : '';
  const profileId = typeof body?.profileId === 'string' && body.profileId.length <= 64 ? body.profileId : null;
  // 页面默认开着「记忆预填」；界面没带或者带了 true 都按开着处理，只有明确关掉才不预填
  const memoryOn = body?.memoryOn !== false;
  const threadIdIn = typeof body?.threadId === 'string' && body.threadId.length <= 64 ? body.threadId : null;
  if (!message) return Response.json({ error: '请先输入你想做的事' }, { status: 400 });

  const userId = guard.userId!;
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

  const job = createJob(userId);
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
