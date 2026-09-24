import { getServiceSupabase } from '@/lib/admin-auth';
import { collectTopics, deletedTopicsOf, splitTopicSections, topicKey } from '@/lib/topic-library';

/** 追问的回答里至少认出这么多条选题，才当成"新的一批"存进选题库 */
export const FOLLOW_UP_MIN_TOPICS = 3;

/**
 * 追问里"再来 10 条"出的选题，也存进选题库。
 *
 * 不存的话，这些选题只躺在那一次对话里：选题库里找不到、不能单独送去写脚本，
 * 下次生成时防重复清单里也没有它们——又会被原样再出一遍。
 * 认不出几条的（比如只是把某一条展开讲讲）不存，免得选题库里混进半截内容。
 */
export async function saveFollowUpTopics(
  userId: string,
  request: string,
  answer: string,
  profileId: string | null
): Promise<boolean> {
  if (splitTopicSections(answer).length < FOLLOW_UP_MIN_TOPICS) return false;
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
export async function loadPriorTopicTitles(userId: string): Promise<string[]> {
  try {
    const { data, error } = await getServiceSupabase()
      .from('script_history')
      .select('id, result, input_data, created_at')
      .eq('user_id', userId)
      .eq('task_type', '选题策划')
      .order('created_at', { ascending: false })
      // 一批 10-20 条，40 批足够凑满清单上限，不必把几百批全拉回来
      .limit(40);
    if (error) {
      console.error('[no-repeat] 读取历史选题失败:', error.message);
      return [];
    }

    const out: string[] = [];
    const seen = new Set<string>();
    const add = (t: string) => {
      const k = topicKey(t);
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(t);
      }
    };
    for (const b of data ?? []) deletedTopicsOf(b.input_data).forEach(add);
    for (const t of collectTopics(data ?? [])) add(t.title);
    return out;
  } catch (e: any) {
    console.error('[no-repeat] 读取历史选题异常:', e?.message);
    return [];
  }
}
