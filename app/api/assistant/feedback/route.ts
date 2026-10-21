import { requireUser } from '@/lib/api-guard';
import { recordFeedback } from '@/lib/assistant/job-store';

/**
 * 助理回答的反馈（升级方案 I3）：每条回答可以点「有用 / 没用」，并可以写一句原因。
 *   POST {jobId?, helpful, reason?}
 * 表没建好时返回 503，界面不显示反馈结果，不影响回答。
 */

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const body = (await request.json().catch(() => null)) as { jobId?: unknown; helpful?: unknown; reason?: unknown } | null;
  if (typeof body?.helpful !== 'boolean') return Response.json({ error: '请告诉我们有用还是没用' }, { status: 400 });
  const jobId = typeof body.jobId === 'string' && UUID.test(body.jobId) ? body.jobId : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const saved = await recordFeedback(guard.userId!, { jobId, helpful: body.helpful, reason });
  if (!saved) return Response.json({ error: '反馈暂时没有存下来' }, { status: 503 });
  return Response.json({ ok: true });
}
