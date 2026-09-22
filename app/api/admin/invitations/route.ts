import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { SUBSCRIPTION_PLANS } from '@/lib/config/plans';

export const dynamic = 'force-dynamic';

/**
 * 邀请码的生成、查看与作废。
 *
 * 全程在服务端，浏览器读不到码表——invitation_codes 上没有任何 RLS 策略，
 * 除 service_role 外一律拒绝。一旦让前端能读这张表，任何人拉一遍就拿到
 * 全部可用码，这个门就白设了。
 */

/** 码的样子：XS + 6 位。去掉了 0/O/1/I/L，口头转述和手抄时最容易认错的就是这几个 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return 'XS' + s;
}

/** 过期与否是查询时算的，不跑定时任务——一个只在注册时用到的状态，不值得为它开个 cron */
function withComputedStatus<T extends { status: string; expires_at: string | null }>(row: T) {
  const expired =
    row.status === 'active' && row.expires_at != null && new Date(row.expires_at) <= new Date();
  return { ...row, status: expired ? 'expired' : row.status };
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const supabase = getServiceSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const keyword = (searchParams.get('q') || '').trim();
  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;

  let query = supabase
    .from('invitation_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all' && status !== 'expired') query = query.eq('status', status);
  if (keyword) query = query.ilike('code', `%${keyword}%`);

  const { data, error } = await query;
  if (error) {
    console.error('[admin/invitations] 查询失败:', error.message);
    return NextResponse.json({ error: '读取邀请码失败' }, { status: 500 });
  }

  let rows = (data ?? []).map(withComputedStatus);
  // expired 是算出来的，没法交给数据库筛，只能在这里过一遍
  if (status === 'expired') rows = rows.filter((r) => r.status === 'expired');

  // 统计用全量算，不受上面的分页和筛选影响，否则「未使用 12 个」会随筛选变化
  const { data: all } = await supabase
    .from('invitation_codes')
    .select('status, expires_at, used_by');

  const stats = { total: 0, active: 0, used: 0, revoked: 0, expired: 0 };
  for (const r of all ?? []) {
    stats.total += 1;
    const s = withComputedStatus(r as any).status as keyof typeof stats;
    if (s in stats) stats[s] += 1;
  }

  // 补上使用者的邮箱。一次 listUsers 内存配对，比逐条查少几十次往返
  const usedIds = new Set(rows.map((r) => r.used_by).filter(Boolean) as string[]);
  const emailById = new Map<string, string>();
  if (usedIds.size > 0) {
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of users?.users ?? []) if (u.email) emailById.set(u.id, u.email);
  }

  return NextResponse.json({
    stats,
    codes: rows.map((r) => ({
      ...r,
      used_by_email: r.used_by ? emailById.get(r.used_by) || '（用户已注销）' : null,
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const body = await request.json();
  const countRaw = Number(body.count);
  const count = Number.isFinite(countRaw) ? Math.min(Math.max(Math.trunc(countRaw), 1), 200) : 10;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 200) : '';
  const planType = body.planType && body.planType in SUBSCRIPTION_PLANS ? body.planType : 'free';

  // 有效期按天数算；不填就是永久有效
  const validDays = Number(body.validDays);
  const expiresAt =
    Number.isFinite(validDays) && validDays > 0
      ? new Date(Date.now() + validDays * 86400_000).toISOString()
      : null;

  const supabase = getServiceSupabase();

  /*
   * 撞码几乎不可能（31^6 ≈ 8.9 亿），但 code 上有唯一索引，
   * 真撞上会整批插入失败。所以按批重试：只把没插进去的补上，
   * 而不是整批推倒重来。
   */
  const created: any[] = [];
  let attempts = 0;
  while (created.length < count && attempts < 5) {
    attempts += 1;
    const need = count - created.length;
    const rows = Array.from({ length: need }, () => ({
      code: generateCode(),
      created_by: admin.userId,
      created_by_admin: true,
      status: 'active',
      plan_type: planType,
      expires_at: expiresAt,
      notes: notes || null,
      is_public: false,
    }));

    const { data, error } = await supabase
      .from('invitation_codes')
      .insert(rows)
      .select();

    if (error) {
      // 唯一索引冲突就再来一轮，其它错误直接报出去
      if (/duplicate key|unique constraint/i.test(error.message)) continue;
      console.error('[admin/invitations] 生成失败:', error.message);
      return NextResponse.json({ error: '生成失败：' + error.message }, { status: 500 });
    }
    created.push(...(data ?? []));
  }

  if (created.length === 0) {
    return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.GENERATE_INVITATIONS,
    target_type: 'invitation_code',
    details: { count: created.length, planType, notes, expiresAt },
  });

  return NextResponse.json({ created: created.length, codes: created });
}

/** 作废。已经用掉的不能作废——那只会把「谁用了这个码」的记录搞乱 */
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { id, ids, action } = await request.json();
  const targets: string[] = ids ?? (id ? [id] : []);
  if (targets.length === 0) return NextResponse.json({ error: '缺少邀请码 ID' }, { status: 400 });

  const nextStatus = action === 'restore' ? 'active' : 'revoked';
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('invitation_codes')
    .update({ status: nextStatus })
    .in('id', targets)
    .is('used_by', null)
    .select('id');

  if (error) {
    console.error('[admin/invitations] 更新失败:', error.message);
    return NextResponse.json({ error: '操作失败：' + error.message }, { status: 500 });
  }

  const changed = data?.length ?? 0;
  if (changed === 0) {
    return NextResponse.json(
      { error: '没有可操作的邀请码——已被使用的码不能作废' },
      { status: 400 }
    );
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.REVOKE_INVITATION,
    target_type: 'invitation_code',
    details: { count: changed, status: nextStatus },
  });

  return NextResponse.json({ changed, status: nextStatus });
}
