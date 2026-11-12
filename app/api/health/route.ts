import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 给监控和发布脚本用：能响应且数据库可读才算健康。
 * pid、boot 用来区分这次拉起的进程和还在服务的旧进程。
 * boot 只有换端口发布时才有，不是密钥。
 */
function identity() {
  return {
    pid: process.pid,
    boot: process.env.KAIWU_BOOT_ID || null,
  };
}

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const { error } = await getServiceSupabase()
      .from('invitation_codes')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (error) {
      console.error('[health] 数据库不可读:', error.message);
      return NextResponse.json({ ok: false, ...identity() }, { status: 503, headers });
    }
    return NextResponse.json({ ok: true, time: new Date().toISOString(), ...identity() }, { headers });
  } catch (e) {
    console.error('[health] 检查失败:', (e as Error).message);
    return NextResponse.json({ ok: false, ...identity() }, { status: 503, headers });
  }
}
