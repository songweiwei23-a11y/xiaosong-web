// Dify 原生会话的持久化
//
// Dify 以 conversation_id 串起多轮对话。此前请求体里从不携带它，
// 每次生成都是一次孤立的对话，"再来一条"这类指令无从谈起。
//
// 会话粒度取 用户 + 账号档案 + 功能：代运营场景下一个用户会管多个账号，
// 档案 A 的脚本记忆不应混进档案 B；不同功能的上下文也各自独立。

import { getServiceSupabase } from '@/lib/admin-auth';

/** 组合出会话作用域键。档案为空时归入 default，保证键始终非空。 */
export function buildScopeKey(taskType: string, profileId?: string | null): string {
  const t = (taskType || 'unknown').trim();
  const p = (profileId || '').trim();
  return `${t}:${p || 'default'}`;
}

/**
 * 取该作用域上一次的 Dify 会话 id。
 * 查询失败一律返回 null —— 记忆是增强项，不该因为它让生成整体失败。
 */
export async function getDifyConversationId(
  userId: string,
  taskType: string,
  profileId?: string | null
): Promise<string | null> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('dify_conversations')
      .select('conversation_id')
      .eq('user_id', userId)
      .eq('scope_key', buildScopeKey(taskType, profileId))
      .maybeSingle();
    if (error) {
      console.error('[dify-conversation] 读取失败:', error.message);
      return null;
    }
    return data?.conversation_id || null;
  } catch (e: any) {
    console.error('[dify-conversation] 读取异常:', e?.message);
    return null;
  }
}

/** 记录/更新该作用域的会话 id。失败只记日志，不影响已经产出的内容。 */
export async function saveDifyConversationId(
  userId: string,
  taskType: string,
  conversationId: string,
  profileId?: string | null
): Promise<void> {
  if (!conversationId) return;
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from('dify_conversations').upsert(
      {
        user_id: userId,
        scope_key: buildScopeKey(taskType, profileId),
        task_type: taskType,
        profile_id: profileId || null,
        conversation_id: conversationId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,scope_key' }
    );
    if (error) console.error('[dify-conversation] 保存失败:', error.message);
  } catch (e: any) {
    console.error('[dify-conversation] 保存异常:', e?.message);
  }
}

/**
 * 清除失效的会话 id。
 * Dify 的会话可能因过期、被删或应用重建而失效，此时带着旧 id 请求会一直报错。
 * 清掉之后下一次请求会以新会话开始，功能自愈而不是永久卡死。
 */
export async function clearDifyConversationId(
  userId: string,
  taskType: string,
  profileId?: string | null
): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    await supabase
      .from('dify_conversations')
      .delete()
      .eq('user_id', userId)
      .eq('scope_key', buildScopeKey(taskType, profileId));
  } catch (e: any) {
    console.error('[dify-conversation] 清除异常:', e?.message);
  }
}

/**
 * 判定错误是否源于 conversation_id 失效，用于决定是否清除记录后重试。
 *
 * 不用单条正则按词序匹配：Dify 的措辞既有 "Conversation does not exist"
 * 也有 "Invalid conversation id"，失效词在会话词前后都可能出现。
 * 改为要求两类关键词同时命中，与顺序无关。
 *
 * 判定从严：只认 404 与明确指向会话的 400。配额、鉴权等其它 400 若被误判，
 * 会白白清掉有效会话并重试一次，既丢上下文又多花一次调用。
 */
export function isInvalidConversationError(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;
  const text = String(body || '');
  const mentionsConversation = /conversation/i.test(text);
  const mentionsInvalid = /(not\s*exist|not\s*found|invalid|expired|deleted|已失效|不存在)/i.test(text);
  return mentionsConversation && mentionsInvalid;
}
