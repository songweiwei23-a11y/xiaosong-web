import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** 给监控用：能响应且数据库可读才算健康。只返回状态，不带任何内部信息 */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const { error } = await getServiceSupabase()
      .from('invitation_codes')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (error) {
      console.error('[health] 数据库不可读:', error.message);
      return NextResponse.json({ ok: false }, { status: 503, headers });
    }
    return NextResponse.json({ ok: true, time: new Date().toISOString() }, { headers });
  } catch (e) {
    console.error('[health] 检查失败:', (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
