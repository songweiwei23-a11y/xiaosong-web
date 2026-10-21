import { NextResponse } from 'next/server';
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth';
import { readAllRows } from '@/lib/admin-monitor-data';

export const dynamic = 'force-dynamic';

/**
 * 成本看板（后台扩展方案 P2-3，只读）：按功能统计最近几天的生成次数、token 和上游费用。
 * 数据来自 creation_completion_evidence（板块生成的完成记录，含上游返回的用量）。
 *
 * 已知缺口：助理（对话）的模型调用没有记录用量，所以这里不含助理的成本（待补，见方案 P-10）。
 */
export async function GET(request: Request) {
  const admin = await requireAdminPermission('view_usage');
  if (!admin) return NextResponse.json({ error: '需要用量查看权限' }, { status: 403 });

  const url = new URL(request.url);
  const days = Math.min(30, Math.max(1, Number.parseInt(url.searchParams.get('days') || '7', 10) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const rows = await readAllRows<{ feature: string | null; usage_metadata: Record<string, unknown> | null }>((from, to) =>
      getServiceSupabase()
        .from('creation_completion_evidence')
        .select('feature, usage_metadata')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .order('request_id')
        .range(from, to),
    );

    const byFeature = new Map<string, { count: number; tokens: number; price: number; currency: string | null }>();
    let totalTokens = 0;
    let totalPrice = 0;
    let currency: string | null = null;
    for (const r of rows) {
      const name = r.feature || 'unknown';
      const u = r.usage_metadata ?? {};
      const tokens = Number(u.total_tokens) || 0;
      const price = Number(u.total_price) || 0;
      const cur = typeof u.currency === 'string' ? u.currency : null;
      const cell = byFeature.get(name) ?? { count: 0, tokens: 0, price: 0, currency: cur };
      cell.count += 1;
      cell.tokens += tokens;
      cell.price += price;
      byFeature.set(name, cell);
      totalTokens += tokens;
      totalPrice += price;
      if (cur && !currency) currency = cur;
    }

    const features = [...byFeature.entries()]
      .map(([name, c]) => ({ name, count: c.count, tokens: c.tokens, price: Number(c.price.toFixed(4)), currency: c.currency }))
      .sort((a, b) => b.price - a.price || b.count - a.count);

    return NextResponse.json({
      days,
      since,
      total: { count: rows.length, tokens: totalTokens, price: Number(totalPrice.toFixed(4)), currency },
      features,
      note: '只统计板块生成的上游用量；助理对话的成本暂未记录。',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/cost] 读取失败:', msg);
    return NextResponse.json({ error: '成本数据读取失败：' + msg }, { status: 500 });
  }
}
