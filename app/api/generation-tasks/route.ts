import { requireUser } from '@/lib/api-guard';
import { readGenerationTask } from '@/lib/generation-task';
import { PROFILE_UUID } from '@/lib/profile-history';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const params = new URL(request.url).searchParams;
  const taskType = params.get('taskType') || '';
  const profileId = params.get('profileId') || null;
  const preferredId = params.get('preferredId') || undefined;
  const requestId = params.get('requestId') || undefined;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!taskType.trim() || taskType.length > 160 || (profileId && !PROFILE_UUID.test(profileId))
    || (preferredId && !PROFILE_UUID.test(preferredId)) || (requestId && !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId))) {
    return Response.json({ error: '任务范围不正确' }, { status: 400, headers });
  }
  try {
    return Response.json(await readGenerationTask(guard.userId!, { taskType, profileId, preferredId, requestId }), { headers });
  } catch {
    return Response.json({ error: '暂时无法查询未完成的任务，请稍后重试' }, { status: 503, headers });
  }
}
