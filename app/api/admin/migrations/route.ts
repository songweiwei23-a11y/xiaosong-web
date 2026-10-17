import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { MIGRATION_REGISTRY } from '@/lib/migration-registry';
import { probeAll, summarize, type ProbeDb } from '@/lib/migration-status';

export const dynamic = 'force-dynamic';

/**
 * 迁移状态（管理员）：每个迁移文件，它建的表、加的列是不是都在库里。
 * 功能缺表时用户只会看到「暂时不可用」，运维靠这里知道该执行哪个迁移。
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const statuses = await probeAll(getServiceSupabase() as unknown as ProbeDb, MIGRATION_REGISTRY);
  return NextResponse.json({ summary: summarize(statuses), items: statuses }, { headers: { 'Cache-Control': 'no-store' } });
}
