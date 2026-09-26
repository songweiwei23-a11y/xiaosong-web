import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import {
  buildDirectory,
  inputFields,
  profileOf,
  whoIs,
  type RawProfile,
  type RawSubscription,
  type RawUser,
  type RawWork,
} from '@/lib/monitor';
import { FEATURE_NAMES } from '@/lib/config/plans';

export const dynamic = 'force-dynamic';

/** 一条记录的全文太长时截到这里——大屏上看得完，也不至于一次拉几十 KB */
const RESULT_CAP = 20000;

/**
 * 监控大屏上点开一条动态：这次是谁、哪个档案、输入的每一项、生成的全文。
 *
 * 大屏每 5 秒轮询一次，不能每次都带全文；所以列表只给摘要，
 * 全文在点开时单独取这一条。
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const id = url.searchParams.get('id');
  if ((kind !== 'history' && kind !== 'usage') || !id) {
    return NextResponse.json({ error: '参数不对' }, { status: 400 });
  }

  try {
    const db = getServiceSupabase();

    const row =
      kind === 'history'
        ? (await db
            .from('script_history')
            .select('id, user_id, task_type, created_at, work_id, input_data, result')
            .eq('id', id)
            .maybeSingle()).data
        : await loadUsageRow(db, id);
    if (!row) return NextResponse.json({ error: '这条记录已经不在了（可能被用户删了）' }, { status: 404 });

    const userId = row.user_id as string;
    const [userRes, profileRes, subRes, workRes] = await Promise.all([
      db.auth.admin.getUserById(userId),
      db.from('user_profiles').select('id, user_id, profile_name').eq('user_id', userId),
      db.from('subscriptions').select('user_id, plan, status, end_date').eq('user_id', userId),
      'work_id' in row && row.work_id
        ? db.from('works').select('id, title, profile_id').eq('id', row.work_id as string)
        : Promise.resolve({ data: [] as RawWork[] }),
    ]);

    const dir = buildDirectory({
      users: userRes.data?.user ? [userRes.data.user as RawUser] : [],
      profiles: (profileRes.data ?? []) as RawProfile[],
      subscriptions: (subRes.data ?? []) as RawSubscription[],
      works: (workRes.data ?? []) as RawWork[],
    });

    if (kind === 'history') {
      const workId = (row as { work_id?: string | null }).work_id ?? null;
      const result = String((row as { result?: string }).result ?? '');
      return NextResponse.json({
        kind,
        id,
        at: row.created_at,
        feature: (row as { task_type?: string }).task_type || '未知功能',
        user: whoIs(userId, dir),
        profiles: dir.profilesOf.get(userId) ?? [],
        profile: profileOf((row as { input_data?: unknown }).input_data, workId, dir),
        work: workId ? dir.works.get(workId)?.title ?? '' : '',
        fields: inputFields((row as { input_data?: unknown }).input_data),
        result: result.slice(0, RESULT_CAP),
        truncated: result.length > RESULT_CAP,
      });
    }

    const u = row as { feature?: string; task_type?: string; detail?: Record<string, unknown> | null };
    const answer = String(u.detail?.answer ?? '');
    return NextResponse.json({
      kind,
      id,
      at: row.created_at,
      feature: u.task_type || FEATURE_NAMES[u.feature ?? ''] || u.feature || '未知功能',
      user: whoIs(userId, dir),
      profiles: dir.profilesOf.get(userId) ?? [],
      profile: profileOf(u.detail, null, dir),
      work: '',
      fields: inputFields({ question: u.detail?.question }),
      result: answer.slice(0, RESULT_CAP),
      truncated: answer.length > RESULT_CAP,
      // 老记录（加记录内容之前的）只有"用了一次"，没有内容可看，要说清楚
      note: u.detail ? '' : '这条是加记录内容之前的旧记录，只知道用了一次，没有对话内容',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/monitor/record] 读取失败:', msg);
    return NextResponse.json({ error: '记录读取失败：' + msg }, { status: 500 });
  }
}

/** detail 列是后加的；迁移没跑时退回不带它的查询，否则会误报"记录不在了" */
async function loadUsageRow(db: ReturnType<typeof getServiceSupabase>, id: string) {
  const q = (cols: string) => db.from('usage_events').select(cols).eq('id', id).maybeSingle();
  const full = await q('id, user_id, feature, task_type, created_at, detail');
  if (!full.error) return full.data as unknown as Record<string, unknown> | null;
  return (await q('id, user_id, feature, task_type, created_at')).data as unknown as Record<string, unknown> | null;
}
