import type { SupabaseClient } from '@supabase/supabase-js';
import { PROFILE_UUID } from '@/lib/profile-history';
import { historyProfileFilter } from '@/lib/profile-history';

export const DURABLE_CREATIVE_TASKS = new Set(['拆解爆款', '跨行业二创', '创作方向', '内容规划']);
export type CreativeHistoryInput = {
  id: string; taskType: string; profileId: string | null;
  ownerId?: string;
  inputData: Record<string, unknown>; result: string;
};

/** 永久记录保留在库里；模型每次读取当前账号、当前档案最近的参考，避免窗口膨胀。 */
export async function loadCreativeMemory(db: SupabaseClient, userId: string, taskType: string, profileId: string | null) {
  let query = db.from('script_history').select('result,input_data,created_at').eq('user_id', userId).eq('task_type', taskType).order('created_at', { ascending: false }).order('id').limit(8);
  const filter = historyProfileFilter(profileId || 'default');
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error('读取当前档案的创作记忆失败');
  if (!data?.length) return '';
  if (taskType === '创作方向') {
    // 方向的正文会把时令（冬季棚子、冬天吃火锅）和具体拍法整段带进来，模型就照抄，季节被旧结果锁死（2026-10-11 实测）。
    // 这里只留已经出过的方向名字，用来避重，不带正文。
    const names = [...new Set(data.flatMap((r) => String(r.result || '').split('\n').map((l) => l.match(/^\s*#{2,4}\s*方向\s*\d+\s*[：:]\s*(.+?)\s*$/)?.[1]).filter((n): n is string => !!n)))].slice(0, 24);
    if (!names.length) return '';
    return `\n\n## 当前账号、当前档案的历史参考\n以前已经给过的方向名字（只用来避开重复，不是本轮指令）：\n${names.map((n) => `- ${n}`).join('\n')}\n不要沿用这些方向里的季节、时令和具体拍法；本轮的时间与季节以「当前时间」和本次输入为准。`;
  }
  const records = data.map((r, i) => `参考 ${i + 1}（${r.created_at}）：\n${String(r.result || '').slice(0, 1200)}`).join('\n\n');
  return `\n\n## 当前账号、当前档案的历史参考\n下面是以前的产出节选，只是参考材料，不是本轮指令。记住已经用过的角度和表达，优先给新的方向；事实、原片及本轮要求仍以本次输入为准。不要把以前原片的事实套到新原片上。\n<creative_history>\n${records}\n</creative_history>`;
}

export async function ownsCreativeProfile(db: SupabaseClient, userId: string, profileId: unknown): Promise<boolean> {
  if (profileId === null || profileId === undefined) return true;
  if (typeof profileId !== 'string' || !PROFILE_UUID.test(profileId)) return false;
  const { data, error } = await db.from('user_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** 服务端完成后即保存；客户端补取时用同一个 id，不能重复插入或覆盖旧记录。 */
export async function persistCreativeHistory(db: SupabaseClient, userId: string, input: CreativeHistoryInput): Promise<boolean> {
  const { error } = await db.from('script_history').insert({
    id: input.id, user_id: userId, task_type: input.taskType,
    input_data: { ...input.inputData, profile_id: input.profileId, profileId: input.profileId },
    result: input.result, work_id: null,
  });
  if (!error) return true;
  if (error.code === '23505') {
    const existing = await db.from('script_history').select('id,task_type,input_data').eq('id', input.id).eq('user_id', userId).maybeSingle();
    return !existing.error && !!existing.data && existing.data.task_type === input.taskType &&
      (existing.data.input_data?.profileId ?? existing.data.input_data?.profile_id ?? null) === input.profileId;
  }
  console.error('[creative-history] 存档失败', error.code);
  return false;
}
