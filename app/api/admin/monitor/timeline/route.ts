import { NextResponse } from 'next/server';
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth';
import { hasPermission } from '@/lib/admin-permissions';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { UUID_RE } from '@/lib/admin-users';
import { generationResults } from '@/lib/admin-monitor-data';
import {
  activityEvents,
  buildDirectory,
  generationRequestIdOf,
  maskEmail,
  redactSnapshot,
  whoIs,
  type ActivityContent,
  type ActivityRow,
  type RawSubscription,
  type RawUser,
} from '@/lib/monitor';

export const dynamic = 'force-dynamic';

/** 时间线的范围：最近 14 天，最多 300 条（超出的截断并标出来） */
const DAYS = 14;
const LIMIT = 300;

/**
 * 按人追踪：某个用户最近 14 天做了什么（登录、生成、对话、保存定位、充值）。
 * 大屏选中一个人时用它，动态区显示的是这个人的完整时间线，而不是全站最近几条里筛出来的。
 * 每次查看都写入操作日志。
 */
export async function GET(request: Request) {
  const admin = await requireAdminPermission('view_monitor');
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const userId = new URL(request.url).searchParams.get('userId') ?? '';
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: '用户编号不正确' }, { status: 400 });

  const db = getServiceSupabase();
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();
  const { data, error } = await db
    .from('user_activity')
    .select('id, user_id, kind, label, ref_kind, ref_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIMIT);
  if (error) {
    const missing = /user_activity/.test(error.message);
    return NextResponse.json(
      { error: missing ? '用户动态流水还没建：请先运行 supabase/migrations/20261024_user_activity.sql' : '动态读取失败：' + error.message },
      { status: missing ? 503 : 500 },
    );
  }
  const rows = (data ?? []) as ActivityRow[];

  // 生成的输入、结果开头、对话的问答，只给有查看内容权限的人
  const canContent = hasPermission(admin.role, 'view_content');
  const contents = new Map<string, ActivityContent>();
  if (canContent) {
    const historyIds = rows.filter((r) => r.ref_kind === 'history' && r.ref_id).map((r) => String(r.ref_id));
    const usageIds = rows.filter((r) => r.ref_kind === 'usage' && r.ref_id).map((r) => String(r.ref_id));
    if (historyIds.length) {
      const res = await db.from('script_history').select('id, input_data, result').in('id', historyIds);
      for (const h of res.data ?? []) contents.set(`history:${h.id}`, { input: h.input_data, result: h.result });
    }
    if (usageIds.length) {
      // detail 列是后加的：迁移没跑时只是没有对话内容，不影响时间线本身
      const res = await db.from('usage_events').select('id, detail').in('id', usageIds);
      if (!res.error) {
        // 生成类的用量行：detail 里记着这次生成的编号，全文在完成记录里（creation_completion_evidence）
        const genOf = new Map<string, string>();
        for (const u of res.data ?? []) {
          const d = (u.detail ?? {}) as { question?: string; answer?: string };
          if (d.question || d.answer) contents.set(`usage:${u.id}`, { question: d.question ?? null, answer: d.answer ?? null });
          const gid = generationRequestIdOf(u.detail);
          if (gid) genOf.set(String(u.id), gid);
        }
        if (genOf.size) {
          let results: Map<string, string>;
          try {
            results = await generationResults(db, userId, [...genOf.values()]);
          } catch (e) {
            return NextResponse.json({ error: '生成结果读取失败：' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
          }
          for (const [usageId, gid] of genOf) {
            const text = results.get(gid);
            if (text) contents.set(`usage:${usageId}`, { result: text.slice(0, 600) });
          }
        }
      }
    }
    // 保存定位的正文：流水只记了 account_positioning 的 id，正文在那张表里
    const positioningIds = rows.filter((r) => r.kind === 'positioning' && r.ref_id).map((r) => String(r.ref_id));
    if (positioningIds.length) {
      const res = await db.from('account_positioning').select('id, full_content').in('id', positioningIds);
      if (res.error) return NextResponse.json({ error: '保存的定位读取失败：' + res.error.message }, { status: 500 });
      for (const p of res.data ?? []) contents.set(`positioning:${p.id}`, { result: String(p.full_content ?? '') });
    }
  }

  const [userRes, subRes] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.from('subscriptions').select('user_id, plan, status, end_date').eq('user_id', userId),
  ]);
  const dir = buildDirectory({
    users: userRes.data?.user ? [userRes.data.user as RawUser] : [],
    subscriptions: (subRes.data ?? []) as RawSubscription[],
  });
  const canUsers = hasPermission(admin.role, 'view_users');
  const who = whoIs(userId, dir);
  const header = who && canUsers ? who : who ? { ...who, email: maskEmail(who.email) } : undefined;

  const events = redactSnapshot(
    { active: [], events: activityEvents(rows, { dir, contents }) },
    { content: canContent, users: canUsers },
  ).events;

  await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.VIEW_USER_CONTENT,
    target_type: 'user',
    target_id: userId,
    details: { timeline: true, days: DAYS, count: rows.length },
  });

  return NextResponse.json({
    user: header,
    days: DAYS,
    events,
    truncated: rows.length >= LIMIT,
  });
}
