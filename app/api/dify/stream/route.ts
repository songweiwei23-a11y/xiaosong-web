import { queueGenerationWork } from '@/lib/generation-worker';
import { streamAcceptedGeneration, UPSTREAM_GENERATION_TIMEOUT_MS } from '@/lib/generation-response';
import { scopedGenerationTaskType } from '@/lib/generation-scope';
import { processGeneration, type ProcessingInput, type ProcessingState } from '@/lib/generation-processing';
import { NextRequest } from 'next/server';
import { reviewSource } from '@/lib/review-verification';
import { reserveCreation, releaseCreation, recordCreationCompletion, completionUsage, creationRequestFingerprint, type CreationCompletion, type CreationReservation } from '@/lib/creation-quota';
import { acquireSlot, slotOptionsFromEnv } from '@/lib/generation-slots';
import { acquireCreationWindow } from '@/lib/creation-window-lock';
import { requireUser, requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard';
import { readJsonBody, BodyError } from '@/lib/read-body';
import { buildSearchQuery } from '@/lib/search-query';
import { getFeatureFromTaskType } from '@/lib/task-type';
import { recordGenerationSignal } from '@/lib/learning-signals';
import {
  getDifyConversationId,
  saveDifyConversationId,
  clearDifyConversationId,
  isInvalidConversationError,
} from '@/lib/dify-conversation';
import {
  buildNoRepeatBlock,
  NO_REPEAT_LIMIT,
  NO_REPEAT_TASKS,
  ISOLATED_TASKS,
  CURRENT_CREATIVE_TASKS,
  CREATIVE_WINDOW_TASKS,
  wantsNewTopics,
} from '@/lib/topic-library';
import { loadLatestTopicCompletion, loadPriorTopicSections } from '@/lib/topic-library-server';
import { continueTopicPrompt, TOPIC_BATCH_MAX } from '@/lib/topic-delivery';
import { isTopicDirectionSource } from '@/lib/creation-continuation';
import { DIRECTION_TOPIC_DELIVERY, directionAnglesPrompt, directionTopicContext, planDirectionTopics } from '@/lib/direction-topic-plan';
import { industryKeysOf } from '@/lib/viral-elements';
import { difyErrorCode, difyEventError, friendlyDifyError, isContextOverflowError } from '@/lib/dify-errors';
import { waitForDifyMessage } from '@/lib/dify-recover';
import { getServiceSupabase } from '@/lib/admin-auth';
import { DURABLE_CREATIVE_TASKS, loadCreativeMemory, ownsCreativeProfile, persistCreativeHistory } from '@/lib/creative-history';
import { CREATIVE_WINDOW_RULES, loadCreativeWindowHistory } from '@/lib/creative-window';
import { PROFILE_UUID } from '@/lib/profile-history';
import { prepareWebSearch } from '@/lib/web-search-quota';
import { difyWebStatus } from '@/lib/dify-web-status';
import { mergeCreationSettings, creationSettingsBlock, hasExplicitCreationContext } from '@/lib/creation-settings';
import { timeAnchor } from '@/lib/time-anchor';
import { profileFactsBlock, factGuardTail, userDonts } from '@/lib/fact-guard';
import { keepStructureBlock } from '@/lib/breakdown-templates';
import { foundationGate, foundationNeedOf } from '@/lib/foundation-gate';

/** 不是生成给用户拿去用的内容：分镜参数推荐只回一段配置，前采提取有自己的规则 */
const NO_FACT_GUARD_TASKS = new Set(['AI推荐', '前采建档']);
/**
 * 不属于某个账号档案的任务：知识库检索、自由对话、前采建档（它本身就是在建档）、AI 推荐（只回一段配置）。
 * 其余创作任务，只要这个用户已经有档案，就必须带上档案 id（见下面的 profileId 检查）。
 */
const PROFILE_OPTIONAL_TASKS = new Set(['知识库查询', '自由对话', '前采建档', 'AI推荐']);
import { ensureGenerationTask, refreshGenerationHeartbeat, saveGenerationVersion, updateGenerationTask } from '@/lib/generation-task';

export const maxDuration = 60;
export const runtime = 'nodejs';

const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Dify 应用设置里每条消息最多 6 个文件 */
const MAX_IMAGE_FILES = 6;

/**
 * 随消息发给模型看的图（拆解爆款的截图拼图）。
 * 图先经 /api/breakdown/upload 传到 Dify，这里只收那边返回的文件 id：
 * 格式不对的一律丢掉，最多 6 张——请求体是浏览器发来的，不能原样转给 Dify。
 */
function difyImageFiles(ids: unknown): { files?: { type: 'image'; transfer_method: 'local_file'; upload_file_id: string }[] } {
  if (!Array.isArray(ids)) return {};
  const ok = ids.filter((x): x is string => typeof x === 'string' && UPLOAD_ID_RE.test(x)).slice(0, MAX_IMAGE_FILES);
  return ok.length ? { files: ok.map((id) => ({ type: 'image', transfer_method: 'local_file', upload_file_id: id })) } : {};
}

export async function POST(req: NextRequest) {
  let reservation: CreationReservation | undefined;
  let generationCompleted = false;
  // 生成并发名额（默认不限制，见 lib/generation-slots）：所有结束路径都要归还
  let releaseSlot: () => void = () => {};
  let releaseWindow: () => void = () => {};
  try {
    /*
     * 请求体可能是压缩 / 分块发来的（lib/safe-post：用户线路差时超过约 8KB 的 POST 会被切断）。
     * 分块的要先知道是谁才能取，所以这种情况先验一次登录
     */
    let owner: string | null = null;
    if (req.headers.get('x-body-ref')) {
      const who = await requireUser();
      if (!who.ok) return who.response!;
      owner = who.userId!;
    }
    let body: any;
    try { body = await readJsonBody(req, owner); }
    catch (e) { return Response.json({ error: e instanceof BodyError ? e.message : '请求格式不正确' }, { status: 400 }); }

    // 必须按具体功能校验额度。requireUserWithQuota() 不传 feature 时只会
    // 检查 basic/pro 的总量，免费版的分功能限额（各板块次数见 lib/config/plans）
    // 完全不生效——用量照常累加却拦不住，等于免费用户可以无限使用。
    const guard = await requireUserWithQuota(getFeatureFromTaskType(body.taskType));
    if (!guard.ok) return guard.response!;
    if (body.historyOwnerId && body.historyOwnerId !== guard.userId) return Response.json({ error: '账号已经切换，请回原账号生成' }, { status: 403 });
    /*
     * 有档案的用户，创作请求必须说清归属哪个档案（2026-10-11 企业商用检测 P5：103 条生成记录没有档案 id，
     * 落到共享的 default 范围，可能串档）。没有任何档案的用户不受影响（没建档也能生成，见 2026-10-05 的说明）。
     */
    if (!(body.profileId || body.profile_id) && !PROFILE_OPTIONAL_TASKS.has(body.taskType)) {
      const { data: anyProfile } = await getServiceSupabase().from('user_profiles').select('id').eq('user_id', guard.userId!).limit(1);
      if (Array.isArray(anyProfile) && anyProfile.length) {
        return Response.json({ error: '请先选择一个账号档案，再生成内容，内容需要归属到具体档案' }, { status: 400 });
      }
    }
    // 地基没打好不生成（2026-10-23 老板定）：拦在扣额度之前，告诉用户先去做哪一步。规则见 lib/foundation-gate.ts
    let foundationNote: string | null;
    try {
      foundationNote = await foundationGate(guard.userId!, foundationNeedOf(body.taskType), body.profileId || body.profile_id || null);
    } catch {
      return Response.json({ error: '暂时没有读到你的地基进度，请稍后再试' }, { status: 503 });
    }
    if (foundationNote) return Response.json({ error: foundationNote, code: 'foundation_missing' }, { status: 400 });
    // 新版拆解/二创由服务端落库，关页不会阻止保存。旧版客户端仍走原保存流程。
    const creativeTask = DURABLE_CREATIVE_TASKS.has(body.taskType);
    const durableHistory = creativeTask && typeof body.historyId === 'string' && PROFILE_UUID.test(body.historyId);
    const historyProfileId = body.profileId ?? body.profile_id ?? null;
    const historyDb = creativeTask ? getServiceSupabase() : null;
    if (historyDb && !await ownsCreativeProfile(historyDb, guard.userId!, historyProfileId)) {
      return Response.json({ error: '不能使用其他账号的档案' }, { status: 403 });
    }
    let query = '';
    // 事实核对的已知素材（档案全文、定位、简报）；没有档案时为空，回退到查询（见下面的 factKnown）
    let factMaterial = '';
    // 档案的人设事实卡（年限修复用）：没有档案时为空
    let personaFacts: unknown = null;

    // 原始用户输入必须在任何改写之前固定下来。
    // 之前只在“已有历史”分支里赋值，导致会话首轮的用户消息永远不入库，
    // 对话记忆无法从第一轮开始累积。
    const originalQuery: string = body.query || '';

    /*
     * 这里原来有选题、审稿、分镜、账号定位四套「没传 query 时」的兜底模板，
     * 三百多行 parts.push。所有页面早就在前端拼好完整提示词放进 query 发过来，
     * 这些兜底一次都走不到，而且内容过时——账号定位那套写着
     * "起号期 流量型60% + 人设型30% + 变现型10%"，知识库里根本没有这个数。
     * 留着迟早有人照着抄，删掉，统一以页面发来的 query 为准。
     */
    if (body.taskType === '知识库查询' || body.taskType === '成交理由') {
      // 这两个页面都在前端拼好了完整提示词，放在 topic 字段里。
      // 成交理由此前也发 '知识库查询'，导致它的用量被记成知识库（无限额度），
      // 等于这个功能从不计费；现在按自己的名字发，计费才落到 dealReason 上。
      query = body.topic || body.query || '请提供具体问题';
    } else {
      query = body.query || '你好';
    }

    console.log('Calling Dify API...');

    // 知识库检索用的短查询，与发给模型的长指令分离，
    // 由 Dify 工作流的 5 个知识检索节点消费（start.search_query）
    const creationSettings = mergeCreationSettings(body.creationSettings || body.historyInput?.creationSettings);
    const explicitCreation = hasExplicitCreationContext(creationSettings);
    const profileId = body.profileId || body.profile_id || null;
    const creativeWindow = CREATIVE_WINDOW_TASKS.has(body.taskType);
    const topicTask = NO_REPEAT_TASKS.has(body.taskType);
    const textInput = (value: unknown) => typeof value === 'string' ? value.trim() : '';
    const sourceReference = textInput(body.inputs?.sourceReference);
    const sourceFrom = textInput(body.inputs?.sourceFrom);
    const directionReference = isTopicDirectionSource(sourceFrom, sourceReference);
    const requestedTopicTactic = textInput(body.inputs?.tactic) || creationSettings.tactic;
    const topicTactic = !sourceReference || directionReference ? requestedTopicTactic : undefined;
    /*
     * 前端历史版本曾丢掉 sourceFrom；此时若只靠来源标签，方向请求会静默退回
     * 普通选题链路，既不生成角度策划也不经过方向交付验收。方向正文和已选策略
     * 都是同一层地基信号，任一存在都要走方向链路。带具体脚本时仍保持原来的
     * 优先级，不能把脚本续写误判成方向选题。
     */
    const carriesDirectionSeed = /(?:【方向种子|(?:创作方向(?:与思路)?|(?:当月)?内容规划|内容策划)|南北\s*\/\s*地域差异|地域差异)/.test(`${sourceFrom}\n${sourceReference}\n${requestedTopicTactic}`);
    const directionSeed = topicTask && !creationSettings.workingScript
      && (directionReference || Boolean(topicTactic) || carriesDirectionSeed);
    const searchQuery = directionSeed ? '' : buildSearchQuery(body.taskType, body, originalQuery);
    const topicCount = typeof body.inputs?.topicCount === 'number' ? body.inputs.topicCount : 0;
    const requestedTopics = Number.isInteger(topicCount) && topicCount > 0 ? Math.min(topicCount, TOPIC_BATCH_MAX) : undefined;
    const priorTopics = topicTask ? await loadPriorTopicSections(guard.userId!, profileId) : [];
    if (historyDb && !explicitCreation) query += await loadCreativeMemory(historyDb, guard.userId!, body.taskType, historyProfileId);
    if (creativeWindow) {
      query += await loadCreativeWindowHistory(guard.userId!, profileId, body.taskType);
      query += CREATIVE_WINDOW_RULES;
    }

    /*
     * 选题：把"已经出过的"明明白白告诉模型，禁止重出。
     *
     * 线上实测：同样的输入连生成两次，10 条里 6 条是同一个选题，
     * 只是换了顺序、把全角标点换成了半角。原因在下面的会话记忆——
     * 模型看到"上次同样的问题我答了这 10 条"，就照着再写一遍。
     * 光靠记忆防不了重复，反而会制造重复。
     *
     * 清单从数据库取，覆盖这个账号出过的**所有**选题，
     * 不受 Dify 那个 100 轮记忆窗口的限制——这才是真正的"记得"。
     * 拼在检索短查询算好之后，不污染知识库检索。
     */
    if (topicTask) {
      // 按档案取：只防这个号自己出过的，别的号的选题不相干
      const prior = priorTopics.map((topic) => topic.title);
      const source = body.inputs?.sourceReference;
      const developSelected = !directionSeed && typeof source === 'string' && !!source.trim()
        && !wantsNewTopics(typeof body.inputs?.personalRequirement === 'string' ? body.inputs.personalRequirement : '');
      query += buildNoRepeatBlock(prior, { developSelected });
      console.log(`[no-repeat] ${body.taskType}：${developSelected ? '落实已选方向' : `附上已出过的选题 ${Math.min(prior.length, NO_REPEAT_LIMIT)} 条`}`);
    }

    const settingsBlock = creationSettingsBlock(creationSettings, directionSeed ? 'topic' : 'chain');
    if (Object.keys(creationSettings).length && !query.includes(settingsBlock.trim())) query += settingsBlock + '\n本轮以当前带入的原稿、当前版本和这些设置为准；历史中的其他选题、方案、人群和时长不得替换本轮选择。旧 AI 稿不是已核实经营事实。';
    // 今天的日期与季节（lib/time-anchor）。模型自己不知道今天几号；自带日期的板块（内容规划）不重复加
    if (!/今天是\s*\d{4}\s*年/.test(query)) query += '\n\n' + timeAnchor();

    /*
     * 事实护栏（lib/fact-guard，2026-10-09 全板块实测）：档案关键事实原话 + 拼在最末尾的「别把设想写成真事」。
     * 只给生成内容的板块；只读这个用户自己的档案
     */
    let profileIndustryKeys: string[] = [];
    let topicProfileFacts = '';
    if (!NO_FACT_GUARD_TASKS.has(body.taskType)) {
      const pid = body.profileId || body.profile_id || historyProfileId;
      let profileRow: Record<string, unknown> | null = null;
      if (typeof pid === 'string' && PROFILE_UUID.test(pid)) {
        const { data } = await getServiceSupabase().from('user_profiles').select('product_category,account_track,competitive_advantage,unique_selling_point,team_structure').eq('id', pid).eq('user_id', guard.userId!).maybeSingle();
        profileRow = data as Record<string, unknown> | null;
        profileIndustryKeys = industryKeysOf(profileRow);
        // 事实核对的已知素材：档案全文 + 这个号的账号定位和创作简报（访谈在档案里）
        const db = getServiceSupabase();
        const [{ data: full }, { data: positioning }] = await Promise.all([
          db.from('user_profiles').select('*').eq('id', pid).eq('user_id', guard.userId!).maybeSingle(),
          db.from('account_positioning').select('positioning_type,is_active,full_content').eq('profile_id', pid).eq('user_id', guard.userId!),
        ]);
        const pos = (positioning as Array<{ positioning_type?: string; is_active?: boolean; full_content?: string }> | null) ?? [];
        const active = pos.find((x) => x.is_active && x.positioning_type === '账号定位')?.full_content ?? '';
        const brief = pos.find((x) => x.positioning_type === '创作简报')?.full_content ?? '';
        factMaterial = [JSON.stringify(full ?? {}), active, brief].join('\n');
        const profile = full as Record<string, unknown> | null;
        if (profile) {
          const facts = ['product_category', 'account_track', 'competitive_advantage', 'unique_selling_point', 'team_structure', 'content_restrictions', 'avoid_content', 'persona_facts']
            .map((key) => [key, profile[key]]).filter(([, value]) => Boolean(value));
          topicProfileFacts = JSON.stringify(Object.fromEntries(facts));
        }
        personaFacts = (full as { persona_facts?: unknown } | null)?.persona_facts ?? null;
      }
      query += profileFactsBlock(profileRow);
      const said = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : '');
      // 用户原话可能在连续设置、个人要求，或页面带来的最初原话里（自由对话 → 方向 → 选题这条链上就是后者）
      query += factGuardTail(userDonts([creationSettings.userIntent, creationSettings.notes, said(body.inputs?.personalRequirement), said(body.inputs?.originContent), said(body.historyInput?.originContent)]));
    }

    const topicContext = directionSeed ? directionTopicContext(
      sourceReference, topicTactic,
      [textInput(body.inputs?.personalRequirement), creationSettings.userIntent, creationSettings.notes,
        body.inputs?.withHook === false ? '关闭开篇钩子。' : '',
        textInput(body.inputs?.topicRole) && `本轮视频目的：${textInput(body.inputs?.topicRole)}`, topicProfileFacts].filter(Boolean).join('\n'),
      creationSettings.elements ?? textInput(body.inputs?.elements).split(/[、,，]/),
      profileIndustryKeys,
      [textInput(body.inputs?.personalRequirement), creationSettings.userIntent, creationSettings.notes].filter(Boolean).join('\n'),
    ) : null;
    // 【方案6：工作流 + 手动记忆】
    // 构建 Dify 请求体：query 在顶层，conversation_history 在 inputs
    const difyRequestBody: any = {
      inputs: {
        query: query, // 工作流变量
        search_query: searchQuery, // 知识库检索专用（短查询）
        conversation_history: body.conversationHistory || '', // 传递对话历史
        dealReasons: body.dealReasons || '' // 成交理由（如果有的话）
      },
      query: query, // API 必需的顶层字段
      ...difyImageFiles(body.imageFileIds),
      response_mode: 'streaming',
      // 传真实用户 id：Dify 以此隔离会话与统计用量。
      // 此前写死为固定值，所有用户在 Dify 侧是同一个人，
      // 会话历史与用量全部混在一起，多账号场景下无法区分。
      user: guard.userId!
    };

    console.log('📤 发送给 Dify (方案6):', {
      query_length: query.length,
      search_query: searchQuery,
      search_query_length: searchQuery.length,
      has_history: !!body.conversationHistory,
      history_length: body.conversationHistory?.length || 0
    });
    
    // 创作板块共用档案的创作窗口。其余任务继续沿用原来的作用域。
    const isolated = ISOLATED_TASKS.has(body.taskType) || explicitCreation;

    /*
     * 每一步的调用和耗时（2026-11-01，整改方案阶段 0.3）：只记录，不改变生成。
     * 跟着用量写进 creation_completion_evidence.usage_metadata 的 stages 字段，用来统计一次生成到底调了几次模型、各花多久。
     */
    const stages: { stage: string; ms: number; ok: boolean }[] = [];
    let mainCalls = 0;
    const traced = async <T>(stage: string, run: () => Promise<T>): Promise<T> => {
      const t0 = Date.now();
      const r = await run();
      stages.push({ stage, ms: Date.now() - t0, ok: !!(r && (r as { ok?: unknown }).ok) });
      return r;
    };

    let webSession: Awaited<ReturnType<typeof prepareWebSearch>>;
    const callDify = async () => {
      mainCalls += 1;
      /*
       * 这里的 originalQuery 是各板块拼好的整段提示词，不是用户的一句话。
       * 拿它做「按需联网」判断，提示词里出现「热点」「最新」就会触发付费搜索、扣联网额度。
       * 这些板块界面上都没有联网开关，所以不传就是不联网（2026-10-02）。
       */
      webSession = await prepareWebSearch(guard.userId!, originalQuery, body.webSearchMode ?? 'off');
      Object.assign(difyRequestBody.inputs, webSession.inputs);
      const result = await fetch(`${process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1'}/chat-messages`, {
        method: 'POST',
        signal: AbortSignal.timeout(UPSTREAM_GENERATION_TIMEOUT_MS),
        headers: {
          'Authorization': 'Bearer ' + process.env.DIFY_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(difyRequestBody)
      });
      if (!result.ok) await webSession.rejected(result.status);
      return result;
    };

    const reserved = await reserveCreation(guard.userId!, getFeatureFromTaskType(body.taskType), req, body);
    if (!reserved.ok) return reserved.response;
    reservation = reserved.reservation;
    // 生成任务是恢复与版本的事实来源。迁移尚未执行时静默退回旧链路，不能阻断用户生成。
    const generationTask = await ensureGenerationTask({
      userId: guard.userId!,
      requestId: reservation.requestId,
      profileId,
      feature: getFeatureFromTaskType(body.taskType),
      taskType: scopedGenerationTaskType(body.taskType, body.recoveryScope),
      payload: {
        taskType: body.taskType,
        profileId,
        historyId: durableHistory ? body.historyId : null,
        historyInput: durableHistory && body.historyInput && typeof body.historyInput === 'object' && !Array.isArray(body.historyInput) ? body.historyInput : {},
      },
    });
    // 同一请求被网络重试时，已经有终态任务就让页面恢复它，绝不重复调用 Dify 或扣费。
    if (generationTask?.existing && ['completed', 'partial_saved', 'recoverable_failed', 'permanent_failed', 'canceled'].includes(generationTask.status)) {
      await releaseCreation(reservation);
      return new Response(JSON.stringify({
        error: '这次生成已处理，请恢复原来的任务结果',
        code: 'GENERATION_TASK_EXISTS',
        taskId: generationTask.id,
        status: generationTask.status,
      }), { status: 409, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    const early = generationTask && req.headers.get('x-generation-resume') === '1' ? generationTask : null;
    const generationSignal = early ? new AbortController().signal : req.signal;
    const run = async () => {
    if (generationTask) await updateGenerationTask({ taskId: generationTask.id, status: 'queued', stage: 'queue' });
    // 排队等名额：等太久或队列满就明确失败（额度同步释放），不让请求无限挂着
    try {
      if (creativeWindow) releaseWindow = await acquireCreationWindow(guard.userId!, profileId, generationSignal);
      releaseSlot = await acquireSlot(guard.userId!, slotOptionsFromEnv(), 0);
    } catch (err) {
      await releaseCreation(reservation);
      releaseWindow();
      const code = (err as { code?: string }).code;
      if (generationTask) await updateGenerationTask({ taskId: generationTask.id, status: 'recoverable_failed', stage: 'queue', errorCode: code || 'QUEUE_FAILED', errorMessage: '生成排队未完成，可重新提交。' });
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : '生成排队失败', code }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      });
    }
    const existingConversationId = creativeWindow
      ? await getDifyConversationId(guard.userId!, profileId, 'creation')
      : isolated ? null : await getDifyConversationId(guard.userId!, profileId);
    if (existingConversationId) difyRequestBody.conversation_id = existingConversationId;
    const previousTopic = topicTask && existingConversationId
      ? await loadLatestTopicCompletion(guard.userId!, existingConversationId)
      : null;
    const mixAllocation = query.match(/^这 \d+ 条按：\*\*[^\n]+/m)?.[0] ?? '';
    const candidateCount = Math.min(TOPIC_BATCH_MAX, (requestedTopics ?? 5) + (mixAllocation ? 0 : 2));
    const topicPlan = topicContext
      ? await traced('topic_plan', async () => {
        const angles = await planDirectionTopics(topicContext, candidateCount, [...(previousTopic?.topics ?? []), ...priorTopics], generationSignal);
        return { ok: Boolean(angles.length), angles };
      })
      : null;
    if (topicContext && topicPlan) {
      const scope = [textInput(body.inputs?.contentTypes), textInput(body.inputs?.styles), textInput(body.inputs?.keywords)]
        .filter(Boolean).join('、');
      query = [
        directionAnglesPrompt(topicContext, topicPlan.angles, candidateCount, requestedTopics ?? 5),
        scope ? '本轮显式选择的创作要求：' + scope : '',
        mixAllocation,
        settingsBlock,
        '历史只用于避重。补充候选也必须逐条经过同样的事实和拍法核对。',
        DIRECTION_TOPIC_DELIVERY,
      ].filter(Boolean).join('\n\n');
    }
    difyRequestBody.query = query;
    difyRequestBody.inputs.query = query;
    let continuedWithSameSettings = false;
    let windowRestart: 'expired' | 'context' | undefined;
    if (topicTask && existingConversationId) {
      continuedWithSameSettings = !!requestedTopics && !!previousTopic
        && previousTopic.fingerprint === creationRequestFingerprint(body);
      const nextQuery = topicContext ? query : continueTopicPrompt(previousTopic?.topics ?? [], requestedTopics ?? 0, continuedWithSameSettings ? undefined : query, directionSeed);
      difyRequestBody.query = nextQuery;
      difyRequestBody.inputs.query = nextQuery;
    }
    const restartWindow = (reason: 'expired' | 'context') => {
      windowRestart = reason;
      delete difyRequestBody.conversation_id;
      const recoveredQuery = previousTopic && !topicContext
        ? query + buildNoRepeatBlock(previousTopic.topics.map((topic) => topic.title))
        : query;
      difyRequestBody.query = recoveredQuery;
      difyRequestBody.inputs.query = recoveredQuery;
    };
    const clearAttemptedConversation = (id: string) => creativeWindow
      ? clearDifyConversationId(guard.userId!, profileId, id, 'creation')
      : clearDifyConversationId(guard.userId!, profileId, id);
    const generateStart = Date.now();
    let response = await callDify();

    // 会话可能因过期、被删或应用重建而失效。若不处理，本地存着的旧 id
    // 会让该作用域的生成永久报错。此时清除记录并以新会话重试一次，
    // 代价是丢失上下文，但功能可以自愈。
    if (!response.ok && existingConversationId) {
      const errText = await response.clone().text();
      if (isInvalidConversationError(response.status, errText) || isContextOverflowError(errText)) {
        console.warn('⚠️ 会话已失效，清除后以新会话重试:', errText.slice(0, 160));
        await clearAttemptedConversation(existingConversationId);
        restartWindow(isContextOverflowError(errText) ? 'context' : 'expired');
        response = await callDify();
      }
    }

    console.log('Dify response status:', response.status);

    if (!response.ok) {
      await releaseCreation(reservation);
      releaseSlot();
      releaseWindow();
      if (generationTask) await updateGenerationTask({ taskId: generationTask.id, status: 'recoverable_failed', stage: 'generate', errorCode: 'UPSTREAM_HTTP_' + response.status, errorMessage: '生成服务暂时不可用，可稍后重试。' });
      const err = await response.text();
      console.error('Dify Error:', err);
      return new Response(JSON.stringify({ error: 'API调用失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let totalChunks = 0;
    let fullResponse = ''; // 收集完整回复用于保存
    let shownText = ''; // 页面上已经显示的全文：和 fullResponse 不一致时要用 message_replace 补齐
    let capturedConversationId = '';
    let capturedMessageId = '';
    let completionTerminal: CreationCompletion['terminal'] | undefined;
    let usageMetadata: Record<string,unknown> = {};
    const userId = guard.userId!;
    const sourceForReview = body.taskType === '审稿优化' ? reviewSource(body) : '';
    const boundedTask = body.taskType === '标题封面' || body.taskType === '跨行业二创';
    // 需要事后校对/修复的任务：正文照样边生成边显示，结束后若被改过，用 message_replace 整篇替换
    const needsCheck = !!sourceForReview || boundedTask || topicTask ||
      (['内容规划', '创作方向'].includes(body.taskType) && !!(body.historyInput?.count || body.inputs?.count));
    const expectedCount = body.taskType === '标题封面' ? creationSettings.titleCount : body.historyInput?.count ?? body.inputs?.count;
    // 兼容尚未刷新页面的旧客户端：主题是用户直接输入，不能扫描含通用规则的query。
    const boundedIntent = creationSettings.userIntent || creationSettings.topic || '';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        /*
         * 浏览器那头断了（切走、锁屏、网络抖动）也要把上游读完：
         * Dify 照样会写完，这边读完才能扣次数、记下会话；
         * 用户回来后页面会按消息 id 把全文取回（见 lib/dify-recover.ts）。
         * 所以往浏览器写失败不抛错，只记一下"对面已经不在了"。
         */
        let clientGone = false;
        let lastSent = Date.now();
        const write = (chunk: string) => {
          if (clientGone) return;
          try {
            controller.enqueue(encoder.encode(chunk));
            lastSent = Date.now();
          } catch {
            clientGone = true;
          }
        };
        const send = (obj: Record<string, unknown>) => write(`data: ${JSON.stringify(obj)}\n\n`);
        const taskEvent = (obj: Record<string, unknown>) => generationTask ? { ...obj, taskId: generationTask.id, requestId: reservation!.requestId } : obj;
        const sendTask = (obj: Record<string, unknown>) => send(taskEvent(obj));
        const sendProgress = (message: string, stage = 'post_processing') => {
          sendTask({ event: 'status', message });
          sendTask({ event: 'stage', stage, status: stage === 'generate' ? 'generating' : 'post_processing', message });
        };
        if (early) sendTask({ event: 'stage', status: 'generating', stage: 'generate' });
        else if (generationTask) sendTask({ event: 'task_accepted', status: 'generating', stage: 'generate' });
        /** 把页面上的全文整篇换成 answer（页面端按 message_replace 整篇替换，见 lib/sse-stream.ts） */
        const showFullText = (answer: string) => {
          shownText = answer;
          send({ event: 'message_replace', answer, ...(topicTask ? { topic_draft: true } : { conversation_id: capturedConversationId, message_id: capturedMessageId }) });
        };

        /*
         * 心跳。开头检索知识库有十几秒一个字都不出，长文中途模型也会停顿；
         * 链路上任何一层（Nginx、运营商、浏览器）见连接长时间没动静就可能掐掉。
         * Dify 自己会发 ping，原来被这里过滤掉了，所以这边自己补。
         * 以冒号开头的是 SSE 注释行，页面解析时直接跳过。
         */
        let lastTaskHeartbeat = Date.now();
        const heartbeat = setInterval(() => {
          if (Date.now() - lastSent >= 8_000) write(': ping\n\n');
          if (generationTask && Date.now() - lastTaskHeartbeat >= 45_000) {
            lastTaskHeartbeat = Date.now();
            void updateGenerationTask({ taskId: generationTask.id, status: 'generating', stage: 'generate', expectedStatus: 'generating' });
          }
        }, 5_000);

        /** 读一次上游。返回：正常结束 / Dify 报错 / 连接断了 */
        const pump = async (
          res: Response
        ): Promise<{ kind: 'done' } | { kind: 'error'; message: string } | { kind: 'broken'; error: unknown }> => {
          const reader = res.body?.getReader();
          if (!reader) return { kind: 'broken', error: new Error('无法读取响应') };
          const decoder = new TextDecoder();
          let buffer = '';
          let receivedEnd = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              buffer += done ? decoder.decode() + '\n' : decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.trim() || !line.startsWith('data:')) continue;
                let data: any;
                try {
                  data = JSON.parse(line.slice(5).trim());
                } catch (e) {
                  console.warn('Parse error:', e);
                  continue;
                }

                // 记下本轮的会话 id，下次同作用域的请求带上它以延续对话。
                // 新会话时 Dify 在首个事件里就会返回，这里只取一次。
                if (data.conversation_id && !capturedConversationId) {
                  capturedConversationId = data.conversation_id;
                }
                // 消息 id：断线后凭它去 Dify 取回全文
                if (data.message_id && !capturedMessageId) {
                  capturedMessageId = data.message_id;
                }

                const failure = difyEventError(data);
                await webSession.observe(data);
                const webStatus = difyWebStatus(data);
                if (webStatus) send({ event: 'web_search', ...webStatus, quota: webSession.quota });
                if (failure) return { kind: 'error', message: failure };
                if (data.event === 'message_end' || data.event === 'workflow_finished') {
                  receivedEnd = true; completionTerminal = data.event;
                  usageMetadata = {...usageMetadata,...completionUsage(data)};
                }

                // 支持两种事件类型：Chatbot 的 message 和工作流的 text_chunk
                const text = typeof data.answer === 'string' ? data.answer : typeof data.text === 'string' ? data.text : '';
                const isContent = (data.event === 'message' || data.event === 'text_chunk') && text;
                if (isContent) {
                  totalChunks++;
                  fullResponse += text;
                  if (totalChunks === 1) {
                    console.log('✅ 开始接收内容，事件类型:', data.event);
                  }
                  shownText += text;
                  send({
                    answer: text,
                    // 草稿可实时看。断线恢复不能直接把 Dify 的未查重原稿当成最终结果。
                    ...(topicTask ? { topic_draft: true } : {
                      conversation_id: capturedConversationId || data.conversation_id,
                      message_id: capturedMessageId || undefined,
                    }),
                  });
                }
              }
              if (done) return totalChunks > 0 && !receivedEnd ? { kind: 'broken', error: new Error('上游缺少完成标记') } : { kind: 'done' };
            }
          } catch (error) {
            return { kind: 'broken', error };
          } finally {
            reader.releaseLock();
          }
        };

        let draftVersionSaved = false;
        try {
          if (webSession.initialEvent) send(webSession.initialEvent);
          if (generationTask) await updateGenerationTask({ taskId: generationTask.id, status: 'generating', stage: 'generate', expectedStatus: 'queued' });
          let outcome = await pump(response);
          await webSession.finish();

          /*
           * 会话塞满了（超出模型上下文）：一个字还没出，就换新会话重来一次。
           * 线上 9/24 内容定位连续三次就是这样失败的，页面上"点了没反应"。
           * 旧会话 id 清掉，其他板块下次也会从新窗口开始，不会接着撞。
           */
          if (
            outcome.kind === 'error' &&
            totalChunks === 0 &&
            difyRequestBody.conversation_id &&
            isContextOverflowError(outcome.message)
          ) {
            console.warn('⚠️ 会话超出模型上下文，换新会话重试:', outcome.message.slice(0, 160));
            await clearAttemptedConversation(difyRequestBody.conversation_id);
            restartWindow('context');
            capturedConversationId = '';
            capturedMessageId = '';
            const retry = await callDify();
            if (webSession.initialEvent) send(webSession.initialEvent);
            outcome = retry.ok
              ? await pump(retry)
              : { kind: 'error', message: `重试失败 ${retry.status}: ${(await retry.text()).slice(0, 200)}` };
            await webSession.finish();
          }

          /*
           * 和 Dify 之间的连接断了，但它那边多半照样写完了：等它写完，取回全文。
           * 用 message_replace 整篇替换，页面上已经显示的半截会被补全。
           */
          if (outcome.kind === 'broken' && capturedConversationId && capturedMessageId) {
            console.warn('⚠️ 与 Dify 的连接中断，等待并取回全文:', String(outcome.error).slice(0, 160));
            const got = await waitForDifyMessage(capturedConversationId, capturedMessageId, userId);
            if (got.status === 'done') {
              fullResponse = got.answer;
              totalChunks = Math.max(totalChunks, 1);
              showFullText(got.answer);
              outcome = { kind: 'done' };
              completionTerminal = 'recovered_message';
            } else if (got.status === 'error') {
              outcome = { kind: 'error', message: got.message };
            }
          }

          // 后续校对会有自己的会话 id，不能拿它替换创作窗口。
          const generationConversationId = capturedConversationId || difyRequestBody.conversation_id;
          stages.push({ stage: 'generate', ms: Date.now() - generateStart, ok: outcome.kind === 'done' });
          /*
           * 正文写完了（2026-11-03 产品方选 A）：先告诉页面，按钮马上停转；下面的核对、修正照样一道不少，
           * 做完有改动会用 message_replace 整篇换掉，最后照常发 message_end。
           * 审稿这类要校对通过才算数的（needsCheck）不发：没通过时草稿会被清掉，不能先当成写完。
           */
          if (outcome.kind === 'done' && !needsCheck && fullResponse.trim()) {
            send({ event: 'draft_done' });
            sendProgress('正文已生成，正在保存并核对细节，页面可以继续查看当前结果');
          }
          // 模型原始输出：后面的整理可能把结构块改坏，拆解要拿它来还原（见 keepStructureBlock）
          const rawResponse = fullResponse;
          if (outcome.kind === 'done' && fullResponse.trim() && (generationTask || (historyDb && durableHistory))) {
            sendProgress('正在保存刚生成的正文，避免页面切换后丢失');
            const historySave = historyDb && durableHistory ? persistCreativeHistory(historyDb, userId, {
                id: body.historyId, taskType: body.taskType, profileId: historyProfileId,
                inputData: body.historyInput && typeof body.historyInput === 'object' && !Array.isArray(body.historyInput) ? body.historyInput : {},
                result: fullResponse,
                status: 'draft',
              }).catch((error) => {
              // 草稿保存是防丢保护，不能因为数据库暂时异常把已经生成的正文判成失败。
              console.error('[creative-history] 草稿存档异常', error instanceof Error ? error.message : 'unknown');
              return false;
            }) : Promise.resolve(false);
            const version = generationTask ? await saveGenerationVersion({
              taskId: generationTask.id, kind: 'draft', stage: 'draft_save', result: fullResponse,
            }) : null;
            sendTask({ event: 'draft_saved', saved: generationTask ? version !== null : await historySave, version, stage: 'draft_save' });
            if (generationTask && version !== null) {
              draftVersionSaved = await updateGenerationTask({ taskId: generationTask.id, status: 'draft_saved', stage: 'draft_save' });
            }
            await historySave;
          }
          if (outcome.kind === 'done' && rawResponse.trim()) {
            const input: ProcessingInput = {
              body: { taskType: body.taskType, personalRequirements: body.personalRequirements, reviewMaterial: body.reviewMaterial,
                inputs: { personalRequirement: body.inputs?.personalRequirement, originContent: body.inputs?.originContent },
                historyInput: { originContent: body.historyInput?.originContent, count: body.historyInput?.count ?? body.inputs?.count,
                  contentMix: body.historyInput?.contentMix ?? body.inputs?.contentMix, scriptsShare: body.historyInput?.scriptsShare ?? body.inputs?.scriptsShare,
                  pickedRoutes: body.historyInput?.pickedRoutes, routeManual: body.historyInput?.routeManual } },
              userId, profileId, query, searchQuery, creationSettings, expectedCount, boundedIntent,
              boundedTask, sourceForReview, factMaterial, personaFacts, topicTask, topicPlan, topicContext,
              priorTopics, previousTopic, requestedTopics, directionSeed, generationConversationId: generationConversationId || '', creativeWindow, rawResponse,
            };
            const state: ProcessingState = { fullResponse, capturedConversationId, capturedMessageId, completionTerminal, usageMetadata, outcome, nextStep: 0 };
            if (generationTask && draftVersionSaved && req.headers.get('x-generation-resume') === '1') {
              const freeSlot = releaseSlot;
              const freeWindow = releaseWindow;
              const release = () => { freeSlot(); freeWindow(); };
              releaseSlot = () => {};
              releaseWindow = () => {};
              try {
                await queueGenerationWork(generationTask.id, {
                  input, state, reservation: reservation!, timings: stages,
                  history: durableHistory && historyDb ? { id: body.historyId, taskType: body.taskType, profileId: historyProfileId,
                    inputData: body.historyInput && typeof body.historyInput === 'object' ? body.historyInput : {} } : undefined,
                  conversationScope: creativeWindow ? 'creation' : (!isolated || CURRENT_CREATIVE_TASKS.has(body.taskType)) ? 'shared' : undefined,
                  telemetry: { main_calls: mainCalls, ...(creativeWindow ? { creation_window: {
                    mode: windowRestart ? 'recovered' : existingConversationId ? 'continued' : 'started',
                    restart: windowRestart, same_settings: !windowRestart && continuedWithSameSettings } } : {}) },
                }, release);
                sendTask({ event: 'processing_detached', status: 'post_processing', stage: 'worker_ready' });
              } catch {
                release();
                sendTask({ event: 'error', message: '后台交接未确认，草稿已保存，请重新查看任务。' });
              } finally {
                clearInterval(heartbeat);
                if (!clientGone) { try { controller.close(); } catch { /* disconnected */ } }
              }
              return;
            }
            const processed = await processGeneration(input, state, traced, send);
            ({ fullResponse, capturedConversationId, capturedMessageId, completionTerminal, usageMetadata, outcome } = processed);
          }
          // 失败时保留已经生成的正文：用户可以复制、刷新后从历史恢复，不能因为后处理暂时失败而把整批清空。
          if (outcome.kind !== 'done' && needsCheck && shownText) {
            if (topicTask && fullResponse.trim() && fullResponse !== shownText) showFullText(fullResponse);
            const message = draftVersionSaved
              ? '后续核对暂未完成，已保存草稿，可稍后恢复'
              : '生成或核对未完成，可先复制页面上已显示的正文';
            sendTask({ event: 'partial_saved', message });
            if (generationTask) await updateGenerationTask({ taskId: generationTask.id, status: draftVersionSaved ? 'partial_saved' : 'recoverable_failed', stage: draftVersionSaved ? 'post_processing' : 'generate', errorCode: 'GENERATION_INCOMPLETE', errorMessage: message });
          } else if (generationTask && (outcome.kind !== 'done' || totalChunks === 0 || !fullResponse.trim())) {
            await updateGenerationTask({
              taskId: generationTask.id, status: draftVersionSaved ? 'partial_saved' : 'recoverable_failed',
              stage: draftVersionSaved ? 'post_processing' : 'generate', errorCode: 'GENERATION_INCOMPLETE',
              errorMessage: draftVersionSaved ? '处理未完成，已保存草稿。' : '正文未完整生成，可重新提交。',
            });
          }
          if (outcome.kind === 'error') {
            console.error('Dify 生成失败:', outcome.message.slice(0, 300));
            if (['审稿校对未完成，请重试','回答在结构标签处中断，请重试','结果未满足本轮数量或事实状态要求，请重试','这次没有生成可交付的新选题，请调整要求后再试','选题核对暂未完成，请重试','选题核对暂未完成，已保留可用草稿','脚本打法配比未达标，已保留草稿，请重试'].includes(outcome.message)) send({ event: 'error', message: outcome.message });
            else send({ event: 'error', message: friendlyDifyError(outcome.message), code: difyErrorCode(outcome.message) });
          } else if (outcome.kind === 'broken') {
            console.error('Stream error:', outcome.error);
            send({ event: 'error', message: '和 AI 的连接断了，请重试' });
          } else if (totalChunks === 0 || !fullResponse.trim()) {
            // 正常结束却一个字没有：原来页面上就是"点了没反应"，现在明说
            console.warn('Dify 正常结束但没有任何正文');
            send({ event: 'error', message: '这次没有生成出内容，请重试' });
          } else {
            console.log('Stream done. Total chunks:', totalChunks);
            // 校对或修复改动过正文（或断线后取回了全文）时，整篇替换页面上的草稿
            if (fullResponse !== shownText) showFullText(fullResponse);
            if (historyDb && durableHistory) {
              let saved = false;
              try {
                saved = await persistCreativeHistory(historyDb, userId, {
                  id: body.historyId, taskType: body.taskType, profileId: historyProfileId,
                  inputData: body.historyInput && typeof body.historyInput === 'object' && !Array.isArray(body.historyInput) ? body.historyInput : {},
                  result: fullResponse,
                  status: 'completed',
                });
              } catch (error) { console.error('[creative-history] 存档异常', error instanceof Error ? error.message : 'unknown'); }
              sendTask({ event: 'history_saved', saved });
            }
            if (generationTask) {
              const version = await saveGenerationVersion({ taskId: generationTask.id, kind: 'final', stage: 'final_save', result: fullResponse, metadata: { postChanged: rawResponse !== fullResponse } });
              if (version !== null) {
                await updateGenerationTask({ taskId: generationTask.id, status: 'completed', stage: 'final_save', completed: true });
                sendTask({ event: 'final_saved', version, saved: true, stage: 'final_save' });
              } else {
                await updateGenerationTask({ taskId: generationTask.id, status: 'partial_saved', stage: 'final_save', errorCode: 'VERSION_SAVE_FAILED', errorMessage: '最终版本暂未同步，草稿仍可使用' });
                sendTask({ event: 'partial_saved', message: '最终版本暂未同步，草稿仍可使用' });
              }
            }
            // Commit before completion: ambiguous commit failure must not release a successful generation.
            generationCompleted = true;
            try {
              const telemetry = {
                stages, main_calls: mainCalls, extra_calls: stages.filter((s) => s.stage !== 'generate').length, post_changed: rawResponse !== fullResponse,
                ...(creativeWindow ? { creation_window: { mode: windowRestart ? 'recovered' : existingConversationId ? 'continued' : 'started', restart: windowRestart, same_settings: !windowRestart && continuedWithSameSettings } } : {}),
              };
              await recordCreationCompletion(reservation!, { result: fullResponse, terminal: completionTerminal!, conversationId: capturedConversationId, messageId: capturedMessageId, usage: { ...usageMetadata, ...telemetry, ...(topicContext ? { direction_topic: topicContext } : {}) } }, body.taskType);
              await incrementUsageServer(userId, getFeatureFromTaskType(body.taskType), body.taskType, undefined, reservation);
              // 学习信号：这次生成是不是对照组、结果开头的指纹（尽力而为，不影响结果）
              void recordGenerationSignal({ userId: userId!, profileId: profileId ?? null, board: getFeatureFromTaskType(body.taskType), result: fullResponse }); }
            catch { send({ event: 'quota_warning', message: '内容已生成，额度同步稍有延迟，请保留结果' }); }
            if (creativeWindow && generationConversationId) {
              await saveDifyConversationId(userId, generationConversationId, profileId, body.taskType, 'creation');
            } else if (!creativeWindow && (!isolated || CURRENT_CREATIVE_TASKS.has(body.taskType)) && capturedConversationId) {
              await saveDifyConversationId(userId, capturedConversationId, profileId, body.taskType || '未知');
            }
            // 窗口先存下来，收到完成事件后立即再生成也能接上。
            send({ event: 'message_end', conversation_id: capturedConversationId, message_id: capturedMessageId });
          }

          clearInterval(heartbeat);
          if (!clientGone) {
            try {
              controller.close();
            } catch {
              /* 对面已经关了 */
            }
          }

          if (!generationCompleted) await releaseCreation(reservation);
          releaseSlot();

        } catch (err) {
          clearInterval(heartbeat);
          if (!generationCompleted) await releaseCreation(reservation);
          releaseSlot();
          console.error('Stream error:', err);
          if (!generationCompleted && generationTask) {
            await updateGenerationTask({
              taskId: generationTask.id, status: draftVersionSaved ? 'partial_saved' : 'recoverable_failed',
              stage: draftVersionSaved ? 'post_processing' : 'generate', errorCode: 'STREAM_INTERRUPTED',
              errorMessage: draftVersionSaved ? '核对未完成，已保存草稿。' : '生成连接中断，可重新提交。',
            });
          }
          sendTask({ event: 'error', message: fullResponse.trim() ? '处理未完成，页面上已生成的正文可以先保留' : '生成连接中断，请重试' });
          if (!clientGone) controller.close();
        } finally {
          releaseWindow();
        }
      }
    });

    return new Response(stream, {
      headers: {
        // 必须是 event-stream：Nginx 的 gzip 会把 text/plain 攒起来压缩，攒够了才往下发
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        // 告诉 Nginx 别缓冲，来一段转一段
        'X-Accel-Buffering': 'no',
        'X-Generation-Id': reservation!.requestId,
      }
    });
    };
    if (!early) return await run();
    return streamAcceptedGeneration(early, reservation.requestId, async () => {
      try {
        return await run();
      } catch (error) {
        await releaseCreation(reservation);
        releaseSlot();
        releaseWindow();
        await updateGenerationTask({ taskId: early.id, status: 'recoverable_failed', stage: 'generate', errorCode: 'GENERATION_START_FAILED', errorMessage: '生成未能启动，请稍后重试。' });
        console.error('[dify/stream] 生成启动失败', error instanceof Error ? error.name : 'unknown');
        throw error;
      }
    }, () => { void refreshGenerationHeartbeat(early.id); });
  } catch (error) {
    if (!generationCompleted) await releaseCreation(reservation);
    releaseSlot();
    releaseWindow();
    if (error instanceof Error && error.name === 'CreationConversationUnavailable') {
      return Response.json({ error: error.message }, { status: 503 });
    }
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}







































