import { requireUserWithQuota } from '@/lib/api-guard';
import { readWebSearchQuota } from '@/lib/web-search-quota';

export async function GET() {
  const guard = await requireUserWithQuota();
  if (!guard.ok) return guard.response!;
  try {
    return Response.json(await readWebSearchQuota(guard.userId!), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '联网额度暂时无法查询' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
