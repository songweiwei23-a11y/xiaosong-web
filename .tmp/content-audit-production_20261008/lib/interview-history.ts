/**
 * 前采建档的历史记录（表 interview_imports，见 20260929_interview_imports.sql）。只在服务端用。
 *
 * 每次提取成功就存一行：原文 + 提取结果。编导可以回来接着核对、改、写入；
 * 提取中途切走了页面，结果也在这里，不会白花一次次数。
 *
 * 表还没建（迁移没跑）时，所有写入只记日志、不报错——历史记录是锦上添花，
 * 不能因为它让提取和写入档案失败。
 */
import { getServiceSupabase } from './admin-auth';
import type { Extraction } from './interview-import';

const TABLE = 'interview_imports';

export async function recordImport(row: {
  userId: string;
  source: string;
  extraction: Extraction;
  targetProfileId: string | null;
  profileName: string;
}): Promise<string | null> {
  const { data, error } = await getServiceSupabase()
    .from(TABLE)
    .insert({
      user_id: row.userId,
      source: row.source,
      extraction: row.extraction,
      target_profile_id: row.targetProfileId,
      profile_name: row.profileName,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[interview-history] 存历史失败:', error.message);
    return null;
  }
  return data.id as string;
}

/** 更新一条历史（对话改过、写入了档案）。只动自己的 */
export async function updateImport(
  userId: string,
  id: string,
  patch: { extraction?: Extraction; profileName?: string; savedProfileId?: string }
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.extraction) row.extraction = patch.extraction;
  if (patch.profileName) row.profile_name = patch.profileName;
  if (patch.savedProfileId) {
    row.saved_profile_id = patch.savedProfileId;
    row.saved_at = new Date().toISOString();
  }
  const { error } = await getServiceSupabase().from(TABLE).update(row).eq('id', id).eq('user_id', userId);
  if (error) console.error('[interview-history] 更新历史失败:', error.message);
  return !error;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
