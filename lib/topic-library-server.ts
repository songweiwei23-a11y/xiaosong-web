import { getServiceSupabase } from '@/lib/admin-auth';
import { batchBelongsToProfile, collectTopics, deletedTopicsOf, NO_REPEAT_LIMIT, splitTopicSections, topicKey, type TopicSection } from '@/lib/topic-library';
import { historyProfileFilter } from '@/lib/profile-history';

/** 只读取同用户、同一个原生会话上一次实际交付的内容。 */
export async function loadLatestTopicCompletion(userId: string, conversationId: string): Promise<{ fingerprint: string; topics: TopicSection[] } | null> {
  try {
    const { data, error } = await getServiceSupabase().from('creation_completion_evidence')
      .select('task_type,request_fingerprint,result')
      .eq('user_id', userId)
      .eq('dify_conversation_id', conversationId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || data?.task_type !== '选题策划' || !data.request_fingerprint) return null;
    const topics = splitTopicSections(data.result || '');
    return topics.length ? { fingerprint: data.request_fingerprint, topics } : null;
  } catch {
    return null;
  }
}

/**
 * 追问里"再来 10 条"出的选题，也存进选题库。
 *
 * 不存的话，这些选题只躺在那一次对话里：选题库里找不到、不能单独送去写脚本，
 * 下次生成时防重复清单里也没有它们——又会被原样再出一遍。
 * 调用方已识别为新批次并完成查重。保留所有通过核对的选题。
 */
export async function saveFollowUpTopics(
  userId: string,
  request: string,
  answer: string,
  profileId: string | null
): Promise<boolean> {
  if (!splitTopicSections(answer).length) return false;
  const { error } = await getServiceSupabase()
    .from('script_history')
    .insert({
      user_id: userId,
      task_type: '选题策划',
      input_data: { source: '追问', request: request.slice(0, 200), profile_id: profileId },
      result: answer,
    });
  if (error) {
    console.error('[no-repeat] 追问出的选题存档失败:', error.message);
    return false;
  }
  return true;
}

/**
 * 这个账号出过的选题标题，新的在前、已去重。服务端用（要读数据库）。
 * 生成选题的接口和追问对话的接口共用这一份。
 *
 * 用户删掉的排在最前面：删掉多半是不喜欢，不能让 AI 再推回来；
 * 而清单有上限，排后面会被截掉。
 *
 * 取不到就当没有，不挡生成——防重复是加分项，不该让生成因此失败。
 */
export async function loadPriorTopicSections(userId: string, profileId?: string | null): Promise<TopicSection[]> {
  try {
    const db = getServiceSupabase();
    const { data: all, error } = await db
      .from('script_history')
      .select('id, result, input_data, created_at')
      .eq('user_id', userId)
      .eq('task_type', '选题策划')
      .or(historyProfileFilter(profileId || 'default') + (profileId ? ',and(input_data->>profile_id.is.null,input_data->>profileId.is.null)' : ''))
      .order('created_at', { ascending: false })
      .order('id')
      .limit(80);
    if (error) {
      console.error('[no-repeat] 读取历史选题失败:', error.message);
      return [];
    }

    // 只看这个档案出过的——别的号的选题跟它无关，混进来只会挤掉它自己的
    let profileName: string | null = null;
    if (profileId) {
      const { data: prof } = await db
        .from('user_profiles')
        .select('profile_name')
        .eq('id', profileId)
        .eq('user_id', userId)
        .maybeSingle();
      profileName = prof?.profile_name ?? null;
    }
    const data = (all ?? []).filter((b) => batchBelongsToProfile(b.input_data, profileId ?? null, profileName, false));

    const out: TopicSection[] = [];
    const seen = new Set<string>();
    const add = (topic: TopicSection) => {
      const k = topicKey(topic.title);
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(topic);
      }
    };
    for (const b of data) deletedTopicsOf(b.input_data).forEach((title) => add({ title, body: '' }));
    for (const t of collectTopics(data)) add({ title: t.title, body: t.body });
    return out.slice(0, NO_REPEAT_LIMIT);
  } catch (e: any) {
    console.error('[no-repeat] 读取历史选题异常:', e?.message);
    return [];
  }
}
