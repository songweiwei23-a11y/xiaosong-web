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
// 现在改成按档案分档：同一个账号档案下，选题、脚本、分镜、审稿、标题、
// 定位、自由对话、追问，全都落在同一个 Dify 会话里，前后承接。
// 档案仍然是隔离边界——代运营管多个号时，A 号的内容绝不能串到 B 号。
//
// 代价要说清楚：上下文会随使用累积，请求带的历史越来越长，
// 成本和延迟都会上升，久了还可能串味。所以留了 startNewWindow()
// 让用户能主动开一个干净的窗口。

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
export function buildScopeKey(profileId?: string | null): string {
  const p = (profileId || '').trim();
  return p || 'default';
}

/**
 * 取该作用域上一次的 Dify 会话 id。
 * 查询失败一律返回 null —— 记忆是增强项，不该因为它让生成整体失败。
 */
export async function getDifyConversationId(
  userId: string,
  profileId?: string | null
): Promise<string | null> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('dify_conversations')
      .select('conversation_id')
      .eq('user_id', userId)
      .eq('scope_key', buildScopeKey(profileId))
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
  conversationId: string,
  profileId?: string | null,
  /** 最后写入这个窗口的是哪个板块，仅用于排查，不参与分档 */
  lastTaskType?: string
): Promise<void> {
  if (!conversationId) return;
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from('dify_conversations').upsert(
      {
        user_id: userId,
        scope_key: buildScopeKey(profileId),
        task_type: lastTaskType || null,
        profile_id: profileId || null,
        conversation_id: conversationId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,scope_key' }
    );
    if (error) {
      console.error('[dify-conversation] 保存失败:', error.message);
    } else {
      // 成功也要留痕：只在失败时打日志，会导致"没执行"与"执行成功"
      // 在日志里无法区分，排查时只能靠推理。
      console.log(
        `[dify-conversation] 已保存会话 scope=${buildScopeKey(profileId)} id=${conversationId}`
      );
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
  profileId?: string | null
): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    await supabase
      .from('dify_conversations')
      .delete()
      .eq('user_id', userId)
      .eq('scope_key', buildScopeKey(profileId));
  } catch (e: any) {
    console.error('[dify-conversation] 清除异常:', e?.message);
  }
}

/**
 * 主动开一个干净的工作窗口。
 *
 * 所有板块共用一个会话之后，上下文只会越来越长：成本、延迟都会涨，
 * 而且聊久了容易串味——上一条内容的设定会渗进下一条。用户需要一个
 * 能主动"翻篇"的动作，自由对话页的「新建对话」就绑在这里。
 *
 * 只是删掉本地记的 id，Dify 那边的历史会话仍在，不会丢东西。
 */
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
