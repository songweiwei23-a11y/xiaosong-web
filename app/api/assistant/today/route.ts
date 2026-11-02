import { requireUser } from '@/lib/api-guard';
import { loadSituation, situationItems } from '@/lib/assistant/situation';

/**
 * 工作台首页的「今天」（2026-11-02 产品方：助理要主动、站在老板角度）：
 * 和助理每轮看的是同一份老板现状（lib/assistant/situation），挑出看出来的事给首页显示。
 * 只读，不调模型、不扣额度；读不出就返回空，首页那一行不显示。
 *   GET ?profileId=当前档案
 */

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 4;

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const profileId = new URL(request.url).searchParams.get('profileId') || null;
  try {
    const s = await loadSituation({ userId: guard.userId!, cookie: request.headers.get('cookie') ?? '' }, profileId);
    const items = situationItems(s).slice(0, MAX_ITEMS).map(({ key, label, ask, href }) => ({ key, label, ask, href }));
    return Response.json({ items });
  } catch {
    return Response.json({ items: [] });
  }
}
