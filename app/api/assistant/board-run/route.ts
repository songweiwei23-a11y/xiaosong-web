import { requireUser } from '@/lib/api-guard';
import { createRateLimiter } from '@/lib/rate-limit';
import { readAssistantConfig } from '@/lib/assistant/config';
import { createJob, hasRunningJob } from '@/lib/assistant/jobs';
import { takePendingRun } from '@/lib/assistant/pending-runs';
import { runBoardJob, runPlanJob } from '@/lib/assistant/board-job';

/**
 * 老板确认「开跑」一个板块任务或一个多步计划（管理员派活经确认后才会走到这里）。
 *   POST {runId}  → 立刻返回任务号，板块在后台跑，界面用助理同一套进度接口取结果
 * 每次板块调用都按板块自己的额度扣费（在 /api/dify/stream 里）；这里只负责派活、验收和返工。
 */

export const dynamic = 'force-dynamic';

const rateLimited = createRateLimiter(60_000, 10);

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;

  const body = (await request.json().catch(() => null)) as { runId?: unknown } | null;
  const runId = typeof body?.runId === 'string' && /^[0-9a-f-]{36}$/i.test(body.runId) ? body.runId : '';
  if (!runId) return Response.json({ error: '缺少任务编号' }, { status: 400 });

  if (rateLimited(userId)) return Response.json({ error: '开跑太频繁了，等一会儿再试' }, { status: 429 });
  if (hasRunningJob(userId)) return Response.json({ error: '上一件事还在处理中，等它完成后再开跑' }, { status: 409 });

  const run = takePendingRun(userId, runId);
  if (!run) return Response.json({ error: '这个任务已经过期或已经开跑过了，请重新让助理派活' }, { status: 404 });

  const job = createJob(userId);
  const ctx = { userId, cookie: request.headers.get('cookie') ?? '', profileId: run.profileId, memoryOn: run.memoryOn };
  const cfg = readAssistantConfig() ?? undefined;
  if (run.board.kind === 'plan') {
    void runPlanJob(job, { ctx, plan: run.board, maxRuns: run.maxRuns, cfg });
  } else {
    void runBoardJob(job, { ctx, board: run.board, maxRuns: run.maxRuns, cfg });
  }
  return Response.json({ jobId: job.id, label: run.label, maxRuns: run.maxRuns });
}
