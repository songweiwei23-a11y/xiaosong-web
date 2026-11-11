// Dify 原生会话的持久化
//
// Dify 以 conversation_id 串起多轮对话。此前请求体里从不携带它，
// 每次生成都是一次孤立的对话，"再来一条"这类指令无从谈起。
//
// 【会话粒度：一个账号档案 = 一个工作窗口】
//
// 早先的粒度是 用户 + 档案 + 功能，九个板块各自一个会话。隔离得很干净，
// 代价是板块之间互相不认识：在选题里定了方向，去脚本页它不知道；
// 在自由对话里问"刚才那条脚本怎么改"，它根本没见过那条脚本。
// 而这个产品的价值恰恰在于把一条内容的各个环节串起来。
//
// 创作会话与自由对话使用独立指针，后者认领旧窗口时不影响创作。

import { getServiceSupabase } from '@/lib/admin-auth';

/**
 * 组合出会话作用域键。
 *
 * 只按账号档案分，不再按功能分——这正是"同一个窗口"的实现方式。
 * 档案为空时归入 default，保证键始终非空。
 *
 * 注意：改档之前写入的键形如 `脚本生成:default`，改档之后是 `default`。
 * 旧行不会被读到，也不影响新键，留着即可，下次清理时再删。
 */
export function buildScopeKey(profileId?: string | null, window?: 'creation'): string {
  const p = (profileId || '').trim();
  const scope = p || 'default';
  return window === 'creation' ? `creation:${scope}` : scope;
}

/**
 * 取该作用域上一次的 Dify 会话 id。
 * 创作窗口查询失败时不能把已有对话当成首轮。旧用途仍可回退。
 */
export async function getDifyConversationId(
  userId: string,
  profileId?: string | null,
  window?: 'creation'
): Promise<string | null> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('dify_conversations')
      .select('conversation_id')
      .eq('user_id', userId)
      .eq('scope_key', buildScopeKey(profileId, window))
      .maybeSingle();
    if (error) {
      if (window === 'creation') throw error;
      console.error('[dify-conversation] 读取失败:', error.message);
      return null;
    }
    return data?.conversation_id || null;
  } catch (e: any) {
    console.error('[dify-conversation] 读取异常:', e?.message);
    if (window === 'creation') {
      const error = new Error('暂时无法读取这个档案的创作会话，请稍后再试');
      error.name = 'CreationConversationUnavailable';
      throw error;
    }
    return null;
  }
}

/** 记录/更新该作用域的会话 id。失败只记日志，不影响已经产出的内容。 */
export async function saveDifyConversationId(
  userId: string,
  conversationId: string,
  profileId?: string | null,
  /** 最后写入这个窗口的是哪个板块，仅用于排查，不参与分档 */
  lastTaskType?: string,
  window?: 'creation'
): Promise<void> {
  if (!conversationId) return;
  try {
    const supabase = getServiceSupabase();
    const row = {
      user_id: userId,
      scope_key: buildScopeKey(profileId, window),
      task_type: lastTaskType || null,
      profile_id: profileId || null,
      conversation_id: conversationId,
      updated_at: new Date().toISOString(),
    };
    for (let attempt = 0; attempt < (window === 'creation' ? 2 : 1); attempt++) {
      // 并发开首轮时保留先存下的窗口。后到的成稿仍会出现在档案历史里。
      const { error } = await supabase.from('dify_conversations').upsert(row, {
        onConflict: 'user_id,scope_key', ignoreDuplicates: window === 'creation',
      });
      if (!error) return;
      console.error('[dify-conversation] 保存失败:', error.message);
    }
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
  profileId?: string | null,
  expectedConversationId?: string,
  window?: 'creation'
): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    const deletion = supabase
      .from('dify_conversations')
      .delete()
      .eq('user_id', userId)
      .eq('scope_key', buildScopeKey(profileId, window));
    const { error } = await (expectedConversationId
      ? deletion.eq('conversation_id', expectedConversationId)
      : deletion);
    if (error) console.error('[dify-conversation] 清除失败:', error.message);
  } catch (e: any) {
    console.error('[dify-conversation] 清除异常:', e?.message);
  }
}

/**
 * 自由对话的线程接进了主工作窗口：把主窗口认领走（2026-11-01，一个线程一个 Dify 会话）。
 * 只在主窗口还是它接进去的那个会话时才清：这期间脚本等板块写了新的主窗口，不能误删。
 */
export async function claimSharedWindow(userId: string, profileId: string | null | undefined, conversationId: string): Promise<void> {
  await clearDifyConversationId(userId, profileId, conversationId);
}

/** 自由对话的「新建对话」清除自己的入口指针。 */
export async function startNewWindow(userId: string, profileId?: string | null): Promise<void> {
  await clearDifyConversationId(userId, profileId);
  console.log(`[dify-conversation] 已开新窗口 scope=${buildScopeKey(profileId)}`);
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
