import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { loadFunnel } from '@/lib/admin-monitor-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const raw = new URL(request.url).searchParams.get('days');
  const days = raw === '30' ? 30 : raw === '7' ? 7 : 1;
  try {
    return NextResponse.json(await loadFunnel(getServiceSupabase(), days), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[admin/funnel] 读取失败', error);
    return NextResponse.json({ error: '漏斗数据读取失败，请检查连接和统计表；当前数字未更新' }, { status: 503 });
  }
}
