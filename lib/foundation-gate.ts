import { getServiceSupabase } from '@/lib/admin-auth';
import { setupSteps, type SetupInput, type SetupStepKey } from '@/lib/setup-progress';

/**
 * 地基门槛：「先打地基」三步（建档、账号定位、创作简报）没做好之前，不生成创作结果。
 *
 * 2026-10-23 老板定：真人用的时候，没有地基一律不生成，并告诉用户先去做哪一步。
 * 门槛在扣额度之前判断，拦下来不扣额度。这里是唯一的判断口径：
 *   - 生成接口 app/api/dify/stream、深度研究 app/api/research 用 foundationGate 拦截；
 *   - 助理派活 lib/assistant/tools.ts 在列任务之前用它拦截，不让老板确认一个跑不了的任务。
 */

/**
 * 生成前至少要做到哪一步：
 *   profile      建了档案就行（账号定位本身只需要档案）
 *   positioning  账号定位做好了（商业定位、内容定位是它的深挖，以它为地基；创作简报也要它）
 *   brief        三步全做完（选题、脚本等其余创作都要创作简报）
 *   open         不需要地基：自由对话、知识库查询、AI 推荐（只回一段配置）、前采建档（它本身就是在建地基）
 */
export type FoundationNeed = SetupStepKey | 'open';

/** 按任务类型登记需要的地基。没登记的一律按三步全做完算（宁严勿松，新加的板块默认要地基） */
const NEED_BY_TASK: Record<string, FoundationNeed> = {
  自由对话: 'open',
  知识库查询: 'open',
  AI推荐: 'open',
  前采建档: 'open',
  账号定位: 'profile',
  商业定位: 'positioning',
  内容定位: 'positioning',
  创作简报: 'positioning',
};

export function foundationNeedOf(taskType: string | undefined): FoundationNeed {
  return (taskType && NEED_BY_TASK[taskType]) || 'brief';
}

/** 第一步没做时告诉用户的话：写清楚先去哪、做什么，再来生成 */
const NEXT_STEP_TEXT: Record<SetupStepKey, string> = {
  profile: '还没有账号档案。请先去「建一个账号档案」，填好名字、行业、主卖什么，再来生成。',
  positioning: '还没有做账号定位。请先去「做账号定位」，定好以后再来生成。',
  brief: '还没有生成创作简报。请先去「生成创作简报」，做好以后再来生成。',
};

/** 按需要的地基，找出第一步没做的，返回要告诉用户的话；都做好了（或不需要地基）返回 null */
export function foundationBlock(need: FoundationNeed, input: SetupInput): string | null {
  if (need === 'open') return null;
  const steps = setupSteps(input);
  const required = steps.slice(0, steps.findIndex((s) => s.key === need) + 1);
  const missing = required.find((s) => !s.done);
  return missing ? NEXT_STEP_TEXT[missing.key] : null;
}

/**
 * 读这个用户的地基进度：档案数，以及指定档案下已有的定位类型。
 * 读不到就抛错，调用方按「不生成」处理——不拿空数据去猜。
 */
export async function loadFoundationInput(userId: string, profileId: string | null): Promise<SetupInput> {
  const db = getServiceSupabase();
  const { data: profiles, error: profileError } = await db.from('user_profiles').select('id').eq('user_id', userId);
  if (profileError) throw new Error(profileError.message);
  const positioningTypes: string[] = [];
  if (profileId) {
    const { data: rows, error: positioningError } = await db
      .from('account_positioning')
      .select('positioning_type')
      .eq('user_id', userId)
      .eq('profile_id', profileId);
    if (positioningError) throw new Error(positioningError.message);
    for (const row of rows ?? []) {
      if (row.positioning_type) positioningTypes.push(row.positioning_type);
    }
  }
  return { profileCount: profiles?.length ?? 0, positioningTypes };
}

/**
 * 生成前的地基检查。通过返回 null；没通过返回要告诉用户的话。
 * 读不到进度会抛错，调用方要按「不生成」处理。
 */
export async function foundationGate(userId: string, need: FoundationNeed, profileId: string | null): Promise<string | null> {
  if (need === 'open') return null;
  return foundationBlock(need, await loadFoundationInput(userId, profileId));
}
