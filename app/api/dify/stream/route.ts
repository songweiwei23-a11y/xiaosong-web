import { NextRequest } from 'next/server';
import { askDify } from '@/lib/dify-task';
import { reviewSource, reviewVerificationPrompt, combinedReviewUsage, reconcileReviewSpeechStats } from '@/lib/review-verification';
import { reserveCreation, releaseCreation, recordCreationCompletion, completionUsage, type CreationCompletion, type CreationReservation } from '@/lib/creation-quota';
import { requireUser, requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard';
import { readJsonBody, BodyError } from '@/lib/read-body';
import { buildSearchQuery } from '@/lib/search-query';
import { getFeatureFromTaskType } from '@/lib/task-type';
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
  wantsNewTopics,
} from '@/lib/topic-library';
import { loadPriorTopicTitles } from '@/lib/topic-library-server';
import { difyErrorCode, difyEventError, friendlyDifyError, isContextOverflowError } from '@/lib/dify-errors';
import { waitForDifyMessage } from '@/lib/dify-recover';
import { getServiceSupabase } from '@/lib/admin-auth';
import { DURABLE_CREATIVE_TASKS, loadCreativeMemory, ownsCreativeProfile, persistCreativeHistory } from '@/lib/creative-history';
import { PROFILE_UUID } from '@/lib/profile-history';
import { prepareWebSearch } from '@/lib/web-search-quota';
import { difyWebStatus } from '@/lib/dify-web-status';
import { mergeCreationSettings, creationSettingsBlock, hasExplicitCreationContext } from '@/lib/creation-settings';
import { profileFactsBlock, factGuardTail, userDonts } from '@/lib/fact-guard';

/** 不是生成给用户拿去用的内容：分镜参数推荐只回一段配置，前采提取有自己的规则 */
const NO_FACT_GUARD_TASKS = new Set(['AI推荐', '前采建档']);
import { reconcileTitleCounts, hasObviousCutoff } from '@/lib/result-reconciliation';
import { boundedResultIssues, boundedRepairPrompt } from '@/lib/bounded-result-check';

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
    // 新版拆解/二创由服务端落库，关页不会阻止保存。旧版客户端仍走原保存流程。
    const creativeTask = DURABLE_CREATIVE_TASKS.has(body.taskType);
    const durableHistory = creativeTask && typeof body.historyId === 'string' && PROFILE_UUID.test(body.historyId);
    const historyProfileId = body.profileId ?? body.profile_id ?? null;
    const historyDb = creativeTask ? getServiceSupabase() : null;
    if (historyDb && !await ownsCreativeProfile(historyDb, guard.userId!, historyProfileId)) {
      return Response.json({ error: '不能使用其他账号的档案' }, { status: 403 });
    }
    let query = '';

    // 原始用户输入必须在任何改写之前固定下来。
    // 之前只在“已有历史”分支里赋值，导致会话首轮的用户消息永远不入库，
    // 对话记忆无法从第一轮开始累积。
    const originalQuery: string = body.query || '';

    /*
     * 这里原本还有一套「手动对话记忆」：调用方传 sessionId + saveHistory，
     * 服务端就从 conversation_messages 表读最近 5 轮拼到查询前面，生成完
     * 再把这一轮写回去。
     *
     * 但从来没有任何页面传过这两个参数——生产库里那张表是 0 行。
     * 记忆早已改由 Dify 的 conversation_id 承担（见 lib/dify-conversation.ts），
     * 按「用户 + 档案 + 功能」分档，比手动拼历史更准也更省 token。
     * 留着这段死逻辑只会让人以为记忆是在这里实现的，所以一并删掉。
     */


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
    console.log('Query:', query);

    // 知识库检索用的短查询，与发给模型的长指令分离，
    // 由 Dify 工作流的 5 个知识检索节点消费（start.search_query）
    const searchQuery = buildSearchQuery(body.taskType, body, originalQuery);
    const creationSettings = mergeCreationSettings(body.creationSettings || body.historyInput?.creationSettings);
    const explicitCreation = hasExplicitCreationContext(creationSettings);
    if (historyDb && !explicitCreation) query += await loadCreativeMemory(historyDb, guard.userId!, body.taskType, historyProfileId);

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
    if (NO_REPEAT_TASKS.has(body.taskType)) {
      // 按档案取：只防这个号自己出过的，别的号的选题不相干
      const prior = await loadPriorTopicTitles(guard.userId!, body.profileId || body.profile_id || null);
      const source = body.inputs?.sourceReference;
      const developSelected = typeof source === 'string' && !!source.trim()
        && !wantsNewTopics(typeof body.inputs?.personalRequirement === 'string' ? body.inputs.personalRequirement : '');
      query += buildNoRepeatBlock(prior, { developSelected });
      console.log(`[no-repeat] ${body.taskType}：${developSelected ? '落实已选方向' : `附上已出过的选题 ${Math.min(prior.length, NO_REPEAT_LIMIT)} 条`}`);
    }

    const settingsBlock = creationSettingsBlock(creationSettings);
    if (Object.keys(creationSettings).length && !query.includes(settingsBlock.trim())) query += settingsBlock + '\n本轮以当前带入的原稿、当前版本和这些设置为准；历史中的其他选题、方案、人群和时长不得替换本轮选择。旧 AI 稿不是已核实经营事实。';

    /*
     * 事实护栏（lib/fact-guard，2026-10-09 全板块实测）：档案关键事实原话 + 拼在最末尾的「别把设想写成真事」。
     * 只给生成内容的板块；只读这个用户自己的档案
     */
    if (!NO_FACT_GUARD_TASKS.has(body.taskType)) {
      const pid = body.profileId || body.profile_id || historyProfileId;
      let profileRow: Record<string, unknown> | null = null;
      if (typeof pid === 'string' && PROFILE_UUID.test(pid)) {
        const { data } = await getServiceSupabase().from('user_profiles').select('product_category,account_track,competitive_advantage,unique_selling_point,team_structure').eq('id', pid).eq('user_id', guard.userId!).maybeSingle();
        profileRow = data as Record<string, unknown> | null;
      }
      query += profileFactsBlock(profileRow);
      const said = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : '');
      // 用户原话可能在连续设置、个人要求，或页面带来的最初原话里（自由对话 → 方向 → 选题这条链上就是后者）
      query += factGuardTail(userDonts([creationSettings.userIntent, creationSettings.notes, said(body.inputs?.personalRequirement), said(body.inputs?.originContent), said(body.historyInput?.originContent)]));
    }

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
    
    console.log('📦 完整请求体:', JSON.stringify(difyRequestBody, null, 2));

    // 带上该作用域的历史会话，让 Dify 把多次生成串成一轮对话。
    // 作用域 = 用户 + 账号档案 + 功能，见 lib/dify-conversation.ts。
    const profileId = body.profileId || body.profile_id || null;
    /*
     * 有些任务不接共用会话（名单和理由见 ISOLATED_TASKS）。
     *
     * 选题：共用会话里躺着上一次同样问题的完整回答，模型会被它带着走——
     * 这正是选题撞车的根源。三份定位：篇幅太大，会把共用会话撑爆。
     * 它们需要的背景都已经明确写进这一次的提示词里了，不需要会话来带。
     * 返回的新会话 id 也不存：存了会把其他板块共用的那个窗口顶掉。
     */
    const isolated = ISOLATED_TASKS.has(body.taskType) || explicitCreation;
    const existingConversationId = isolated ? null : await getDifyConversationId(guard.userId!, profileId);
    if (existingConversationId) {
      difyRequestBody.conversation_id = existingConversationId;
      console.log('🔗 延续已有会话:', existingConversationId);
    }

    let webSession: Awaited<ReturnType<typeof prepareWebSearch>>;
    const callDify = async () => {
      /*
       * 这里的 originalQuery 是各板块拼好的整段提示词，不是用户的一句话。
       * 拿它做「按需联网」判断，提示词里出现「热点」「最新」就会触发付费搜索、扣联网额度。
       * 这些板块界面上都没有联网开关，所以不传就是不联网（2026-10-02）。
       */
      webSession = await prepareWebSearch(guard.userId!, originalQuery, body.webSearchMode ?? 'off');
      Object.assign(difyRequestBody.inputs, webSession.inputs);
      const result = await fetch(`${process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1'}/chat-messages`, {
        method: 'POST',
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
    let response = await callDify();

    // 会话可能因过期、被删或应用重建而失效。若不处理，本地存着的旧 id
    // 会让该作用域的生成永久报错。此时清除记录并以新会话重试一次，
    // 代价是丢失上下文，但功能可以自愈。
    if (!response.ok && existingConversationId) {
      const errText = await response.clone().text();
      if (isInvalidConversationError(response.status, errText)) {
        console.warn('⚠️ 会话已失效，清除后以新会话重试:', errText.slice(0, 160));
        await clearDifyConversationId(guard.userId!, profileId);
        delete difyRequestBody.conversation_id;
        response = await callDify();
      }
    }

    console.log('Dify response status:', response.status);

    if (!response.ok) {
      await releaseCreation(reservation);
      const err = await response.text();
      console.error('Dify Error:', err);
      return new Response(JSON.stringify({ error: 'API调用失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let totalChunks = 0;
    let fullResponse = ''; // 收集完整回复用于保存
    let capturedConversationId = '';
    let capturedMessageId = '';
    let completionTerminal: CreationCompletion['terminal'] | undefined;
    let usageMetadata: Record<string,unknown> = {};
    const userId = guard.userId!;
    const sourceForReview = body.taskType === '审稿优化' ? reviewSource(body) : '';
    const boundedTask = body.taskType === '标题封面' || body.taskType === '跨行业二创';
    const holdResponse = !!sourceForReview || boundedTask;
    const expectedCount = body.taskType === '标题封面' ? creationSettings.titleCount : body.historyInput?.count;
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

        /*
         * 心跳。开头检索知识库有十几秒一个字都不出，长文中途模型也会停顿；
         * 链路上任何一层（Nginx、运营商、浏览器）见连接长时间没动静就可能掐掉。
         * Dify 自己会发 ping，原来被这里过滤掉了，所以这边自己补。
         * 以冒号开头的是 SSE 注释行，页面解析时直接跳过。
         */
        const heartbeat = setInterval(() => {
          if (Date.now() - lastSent >= 10_000) write(': ping\n\n');
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
                  if (!holdResponse) send({
                    answer: text,
                    conversation_id: capturedConversationId || data.conversation_id,
                    message_id: capturedMessageId || undefined,
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

        try {
          if (webSession.initialEvent) send(webSession.initialEvent);
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
            if (!isolated) await clearDifyConversationId(userId, profileId);
            delete difyRequestBody.conversation_id;
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
              if (!holdResponse) send({ event: 'message_replace', answer: got.answer, conversation_id: capturedConversationId, message_id: capturedMessageId });
              outcome = { kind: 'done' };
              completionTerminal = 'recovered_message';
            } else if (got.status === 'error') {
              outcome = { kind: 'error', message: got.message };
            }
          }

          if (outcome.kind === 'done' && sourceForReview && fullResponse.trim()) {
            const requirements = typeof body.personalRequirements === 'string' ? body.personalRequirements : '';
            const verified = await askDify(reviewVerificationPrompt(sourceForReview, requirements, fullResponse), userId, '审稿 原稿事实校对', { signal: AbortSignal.timeout(180_000) })
              .catch(() => ({ ok: false as const, message: '审稿校对未完成' }));
            if (!verified.ok) {
              outcome = { kind: 'error', message: '审稿校对未完成，请重试' };
            } else {
              fullResponse = reconcileReviewSpeechStats(verified.text);
              usageMetadata = combinedReviewUsage(usageMetadata, verified.completion.usage ?? {});
              capturedConversationId = verified.completion.conversationId || capturedConversationId;
              capturedMessageId = verified.completion.messageId || capturedMessageId;
              completionTerminal = verified.completion.terminal;
            }
          }

          if (outcome.kind === 'done' && boundedTask && fullResponse.trim()) {
            const issues = boundedResultIssues(fullResponse, body.taskType, expectedCount, boundedIntent);
            if (issues.length) {
              const corrected = await askDify(boundedRepairPrompt(query, fullResponse, issues, boundedIntent), userId, searchQuery, {signal:AbortSignal.timeout(180_000)})
                .catch(() => ({ok:false as const,message:'交付校对未完成'}));
              if (!corrected.ok || boundedResultIssues(corrected.text, body.taskType, expectedCount, boundedIntent).length) {
                outcome = {kind:'error',message:'结果未满足本轮数量或事实状态要求，请重试'};
              } else {
                usageMetadata = combinedReviewUsage(usageMetadata, corrected.completion.usage ?? {}, 'result_check_steps');
                fullResponse = corrected.text;
                capturedConversationId = corrected.completion.conversationId || capturedConversationId;
                capturedMessageId = corrected.completion.messageId || capturedMessageId;
                completionTerminal = corrected.completion.terminal;
              }
            }
          }
          if (outcome.kind === 'done' && hasObviousCutoff(fullResponse)) {
            outcome = { kind: 'error', message: '回答在结构标签处中断，请重试' };
          }
          if (outcome.kind === 'done' && body.taskType === '标题封面') {
            const reconciled = reconcileTitleCounts(fullResponse);
            if (reconciled !== fullResponse) {
              fullResponse = reconciled;
            }
          }
          if (outcome.kind === 'error') {
            console.error('Dify 生成失败:', outcome.message.slice(0, 300));
            if (['审稿校对未完成，请重试','回答在结构标签处中断，请重试','结果未满足本轮数量或事实状态要求，请重试'].includes(outcome.message)) send({ event: 'error', message: outcome.message });
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
            if (holdResponse) send({ answer: fullResponse, conversation_id: capturedConversationId, message_id: capturedMessageId });
            if (historyDb && durableHistory) {
              let saved = false;
              try {
                saved = await persistCreativeHistory(historyDb, userId, {
                  id: body.historyId, taskType: body.taskType, profileId: historyProfileId,
                  inputData: body.historyInput && typeof body.historyInput === 'object' && !Array.isArray(body.historyInput) ? body.historyInput : {},
                  result: fullResponse,
                });
              } catch (error) { console.error('[creative-history] 存档异常', error instanceof Error ? error.message : 'unknown'); }
              send({ event: 'history_saved', saved });
            }
            // Commit before completion: ambiguous commit failure must not release a successful generation.
            generationCompleted = true;
            try {
              await recordCreationCompletion(reservation!, { result: fullResponse, terminal: completionTerminal!, conversationId: capturedConversationId, messageId: capturedMessageId, usage: usageMetadata }, body.taskType);
              await incrementUsageServer(userId, getFeatureFromTaskType(body.taskType), body.taskType, undefined, reservation); }
            catch { send({ event: 'quota_warning', message: '内容已生成，额度同步稍有延迟，请保留结果' }); }
            // 结束标记：页面据此区分"写完了"和"半路断了"
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

          // 持久化会话 id，使下一次同作用域的生成延续本轮对话。
          // 仅在确有内容产出时保存，避免把失败的空会话记下来。
          // 独立会话不写回共用窗口（见上面 isolated 的说明）
          if ((!isolated || CURRENT_CREATIVE_TASKS.has(body.taskType)) && generationCompleted && outcome.kind === 'done' && totalChunks > 0 && capturedConversationId) {
            await saveDifyConversationId(
              userId,
              capturedConversationId,
              profileId,
              body.taskType || '未知'
            );
          } else if (totalChunks > 0 && !capturedConversationId) {
            // 有内容产出却没拿到会话 id，说明 SSE 事件里始终不含 conversation_id。
            // 不记下来的话，表为空时无法判断是没执行还是执行了没拿到值。
            console.warn('[dify-conversation] 本轮未捕获到 conversation_id，会话不会被延续');
          }
        } catch (err) {
          clearInterval(heartbeat);
          if (!generationCompleted) await releaseCreation(reservation);
          console.error('Stream error:', err);
          try {
            controller.error(err);
          } catch {
            /* 对面已经关了 */
          }
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
  } catch (error) {
    if (!generationCompleted) await releaseCreation(reservation);
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}







































