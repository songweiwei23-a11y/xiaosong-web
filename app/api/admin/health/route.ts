import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { summarizeHealth, timed } from '@/lib/health';

export const dynamic = 'force-dynamic';

/**
 * 后台概览「系统状态」卡片的数据源。原来那张卡是写死的"运行正常"，
 * 见 lib/health.ts 的说明。
 *
 * 单独一个接口，不塞进 /api/admin/stats：Dify 探活最坏要等到超时，
 * 不能让它拖住概览页上其他数字的加载。
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const checks = await Promise.all([
    timed('数据库', async () => {
      const { error } = await getServiceSupabase()
        .from('subscriptions')
        .select('user_id', { count: 'exact', head: true });
      return error ? error.message : null;
    }),
    timed('Dify', async () => {
      const key = process.env.DIFY_API_KEY;
      if (!key) return '没有配置 DIFY_API_KEY';
      const res = await fetch('https://api.dify.ai/v1/parameters', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });
      if (res.status === 401) return 'API key 无效或已过期';
      return res.ok ? null : `HTTP ${res.status}`;
    }),
  ]);

  return NextResponse.json({ checks, ...summarizeHealth(checks), checkedAt: new Date().toISOString() });
}
