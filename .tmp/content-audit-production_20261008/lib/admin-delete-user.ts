/**
 * 后台「删除用户」（2026-10-04 产品方：清理垃圾用户；删了以后这个人的信息随之删除，想再用只能拿邀请码重新注册）。
 *
 * 为什么要一张张表显式删，而不是只删登录账号：
 * 早期的几张核心表（账号档案、生成历史、定位、成交理由、用户设置）不是从本仓库的迁移建的，
 * 看不到它们是不是「跟着账号级联删除」。只删账号，可能留下一堆没有主人的数据；
 * 外键要是「限制删除」，删账号会直接失败。所以先把下面每张表里这个人的行删掉，再删上传的文件，最后删登录账号。
 *
 * 顺序：子表在前（预占记录在额度账本前、作品引用在作品前），登录账号最后。
 * 任何一张表删失败（表不存在除外）就停下，不删账号——管理员可以原样再点一次（每一步都可以重复执行）。
 * 不能删自己、不能删管理员，这两条在接口里拦。
 */
type Db = {
  from: (t: string) => any;
  storage: { from: (b: string) => any };
  auth: { admin: { deleteUser: (id: string) => Promise<{ error: { message: string } | null }> } };
};

/** 按 user_id 归属本人的表。研究来源跟着研究任务级联删除（它没有 user_id 列） */
export const USER_DATA_TABLES = [
  'research_requests', 'research_jobs', 'research_periods',
  'web_search_requests', 'web_search_periods',
  'creation_completion_evidence', 'creation_requests', 'creation_sessions',
  'creator_preferences', 'creator_presets',
  'library_topic_index', 'material_library',
  'quality_checks', 'usage_events', 'user_todos',
  'launch_plans', 'course_progress', 'interview_imports',
  'chat_conversations', 'dify_conversations',
  'script_history', 'works',
  'deal_reasons', 'account_positioning', 'user_profiles', 'scripts',
  'user_quotas', 'subscriptions', 'payment_orders',
  'user_settings',
] as const;

/** 上传的文件：对话附件（用户编号/随机编号/文件）、付款截图（用户编号/文件） */
export const USER_BUCKETS: { bucket: string; depth: 1 | 2 }[] = [
  { bucket: 'chat-attachments', depth: 2 },
  { bucket: 'payment-proofs', depth: 1 },
];

const missing = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (/schema cache|does not exist|Could not find the table/i.test(e.message || '') || e.code === '42P01' || e.code === 'PGRST205');

export interface DeletePreview { email: string; counts: Record<string, number>; paidOrders: number }

/** 删之前给管理员看：这个人有多少东西（档案、作品、生成记录、对话、订单） */
export async function previewUserData(db: Db, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const t of ['user_profiles', 'works', 'script_history', 'chat_conversations', 'material_library', 'payment_orders']) {
    const { count, error } = await db.from(t).select('user_id', { count: 'exact', head: true }).eq('user_id', userId);
    if (!error) counts[t] = count ?? 0;
  }
  return counts;
}

async function removeFiles(db: Db, bucket: string, prefix: string, depth: 1 | 2): Promise<number> {
  const store = db.storage.from(bucket);
  let removed = 0;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await store.list(prefix, { limit: 1000 });
    if (error) {
      if (/not found|does not exist/i.test(error.message || '')) return removed;
      throw new Error(`${bucket} 文件列表读取失败：${error.message}`);
    }
    const entries = (data ?? []) as { name: string; id: string | null }[];
    if (!entries.length) return removed;
    const paths: string[] = [];
    for (const e of entries) {
      if (depth === 2 && !e.id) {
        // 下一层目录：对话附件是 用户/随机编号/文件
        const { data: inner } = await store.list(`${prefix}/${e.name}`, { limit: 1000 });
        for (const f of (inner ?? []) as { name: string }[]) paths.push(`${prefix}/${e.name}/${f.name}`);
      } else paths.push(`${prefix}/${e.name}`);
    }
    if (!paths.length) return removed;
    const { error: rmError } = await store.remove(paths);
    if (rmError) throw new Error(`${bucket} 文件删除失败：${rmError.message}`);
    removed += paths.length;
  }
  return removed;
}

export interface PurgeResult { deleted: Record<string, number>; skipped: string[]; files: number }

/** 删一个用户的全部数据和登录账号。失败抛出带中文原因的错误，已删的不会恢复，可以再点一次接着删 */
export async function purgeUser(db: Db, userId: string): Promise<PurgeResult> {
  const deleted: Record<string, number> = {};
  const skipped: string[] = [];
  for (const t of USER_DATA_TABLES) {
    const { count, error } = await db.from(t).delete({ count: 'exact' }).eq('user_id', userId);
    if (missing(error)) { skipped.push(t); continue; }
    if (error) throw new Error(`「${t}」里的数据没删掉（${error.message}），账号还没删，可以再点一次删除`);
    deleted[t] = count ?? 0;
  }

  // 用过的邀请码：解开和这个人的关联，码本身仍是「已使用」，不会被别人再用
  const { error: codeError } = await db.from('invitation_codes').update({ used_by: null }).eq('used_by', userId);
  if (codeError && !missing(codeError)) throw new Error(`邀请码记录没处理好（${codeError.message}），账号还没删，可以再点一次删除`);

  let files = 0;
  for (const b of USER_BUCKETS) files += await removeFiles(db, b.bucket, userId, b.depth);

  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError && !/not found/i.test(authError.message)) throw new Error(`数据已删，但登录账号没删掉（${authError.message}），请再点一次删除`);
  return { deleted, skipped, files };
}
