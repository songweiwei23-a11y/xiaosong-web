import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { VISITOR_RE, isFunnelKind } from '@/lib/funnel';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

/**
 * 记一条匿名的漏斗事件（见 lib/funnel.ts）。不用登录——记的就是还没注册的访客。
 *
 * 公开接口，所以三道闸：事件名只认白名单、访客编号只认固定格式、
 * 同一 IP 一分钟最多 30 条（内存里记，IP 本身不入库）。
 * 任何失败都回 204：这是统计，不能让访客的页面因为它报错。
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { n: number; since: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.since > WINDOW_MS) {
    hits.set(ip, { n: 1, since: now });
    // 顺手清掉过期的，免得这张表越长越大
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.since > WINDOW_MS) hits.delete(k);
    return false;
  }
  h.n += 1;
  return h.n > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  if (limited(clientIp(request))) return new NextResponse(null, { status: 429 });

  let body: { kind?: unknown; vid?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!isFunnelKind(body.kind) || typeof body.vid !== 'string' || !VISITOR_RE.test(body.vid)) {
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await getServiceSupabase().from('funnel_events').insert({ kind: body.kind, visitor_id: body.vid });
  // 表还没建（迁移没跑）时只记日志
  if (error) console.error('[funnel] 记录失败:', error.message);
  return new NextResponse(null, { status: error ? 503 : 204 });
}
