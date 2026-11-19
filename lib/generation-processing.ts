import { askDify } from '@/lib/dify-task';
import { planHookRepair, planRouteIssue } from '@/lib/script-route';
import { DEFAULT_SCRIPT_SHARE, normalizeScriptShare } from '@/lib/tactic-mix';
import { checkPlan, monthlyRepairPlan } from '@/lib/content-plan';
import { CONTENT_ROLE_LIST } from '@/lib/content-roles';
import type { ContentMix } from '@/lib/content-mix';
import { reviewVerificationPrompt, combinedReviewUsage, reconcileReviewSpeechStats } from '@/lib/review-verification';
import { saveDifyConversationId } from '@/lib/dify-conversation';
import { loadPriorTopicSections } from '@/lib/topic-library-server';
import { finalizeTopicBatch, prepareTopicDraft, topicRefillPrompt } from '@/lib/topic-delivery';
import { DIRECTION_TOPIC_DELIVERY, anchorDirectionDraft, directionAnglesPrompt, planDirectionTopics } from '@/lib/direction-topic-plan';
import { loadDoneList } from '@/lib/work-insight-load';
import { seasonMisstatements } from '@/lib/time-anchor';
import { sanitizeOutput, stripInternalLeaks } from '@/lib/output-guard';
import { keepStructureBlock } from '@/lib/breakdown-templates';
import { CHUNK_TRIGGER_CHARS, fixInChunks, mergeUsage } from '@/lib/fact-fix-chunks';
import { scriptRepairReason, buildScriptRepairPrompt, acceptScriptRepair, scriptRepairLimited, spokenStep, explicitBudget, trimSpokenStep } from '@/lib/script-repair';
import { holdUnsupported } from '@/lib/evidence-guard';
import { reconcileTitleCounts, hasObviousCutoff } from '@/lib/result-reconciliation';
import { unsupportedFacts } from '@/lib/quality-checks';
import { FACT_AUTO_FIX_TASKS, autoFactFixLimited, buildFactFixPrompt, fixTooBig } from '@/lib/fact-fix';
import { needsSentenceRepair, repairReality, sentenceRepairLimited } from '@/lib/reality-repair';
import { polishScript, scriptPolishLimited, SCRIPT_POLISH_ENABLED } from '@/lib/script-polish';
import { repairYears } from '@/lib/years-repair';
import { cleanRewriteOutput } from '@/lib/canvas';
import { DETAIL_CHECK_TASKS, buildDetailCheckPrompt, parseDetailCheck } from '@/lib/detail-check';
import { SPEAKER_CHECK_TASKS, needsSpeakerCheck, buildSpeakerCheckPrompt, parseSpeakerCheck, buildSpeakerFixPrompt } from '@/lib/speaker-check';
import { boundedResultIssues, boundedRepairPrompt, pendingInterview } from '@/lib/bounded-result-check';
import type { CreationCompletion } from '@/lib/creation-quota';
import type { CreationSettings } from '@/lib/creation-settings';
import type { DirectionTopicContext, TopicAngle } from '@/lib/direction-topic-plan';
import type { TopicSection } from '@/lib/topic-library';

export interface ProcessingInput {
  body: { taskType: string; reviewMaterial?: string; personalRequirements?: string; inputs?: Record<string, unknown>; historyInput?: Record<string, unknown> };
  userId: string;
  profileId: string | null;
  query: string;
  searchQuery: string;
  creationSettings: CreationSettings;
  expectedCount?: unknown;
  boundedIntent: string;
  boundedTask: boolean;
  sourceForReview: string;
  factMaterial: string;
  personaFacts: unknown;
  topicTask: boolean;
  topicPlan: { angles: TopicAngle[] } | null;
  topicContext: DirectionTopicContext | null;
  priorTopics: TopicSection[];
  previousTopic: { topics: TopicSection[] } | null;
  requestedTopics?: number;
  directionSeed: boolean;
  generationConversationId: string;
  creativeWindow: boolean;
  rawResponse: string;
}

export interface ProcessingState {
  fullResponse: string;
  capturedConversationId: string;
  capturedMessageId: string;
  completionTerminal?: CreationCompletion['terminal'];
  usageMetadata: Record<string, unknown>;
  outcome: { kind: 'done' } | { kind: 'error'; message: string };
  nextStep: number;
}

type Trace = <T>(stage: string, run: () => Promise<T>) => Promise<T>;

export async function processGeneration(
  input: ProcessingInput, state: ProcessingState, traced: Trace, send: (data: Record<string, unknown>) => void,
  checkpoint?: (step: string, state: ProcessingState, entering: boolean) => Promise<void>,
): Promise<ProcessingState> {
  const { body, userId, profileId, query, searchQuery, creationSettings, expectedCount,
    boundedIntent, boundedTask, sourceForReview, factMaterial, personaFacts, topicTask, topicPlan,
    topicContext, priorTopics, previousTopic, requestedTopics, directionSeed, generationConversationId,
    creativeWindow, rawResponse } = input;
  let { fullResponse, capturedConversationId, capturedMessageId, completionTerminal, usageMetadata, outcome } = state;
  const tidy = (t: string) => (body.taskType === '审稿优化' ? stripInternalLeaks(t, body.taskType) : sanitizeOutput(t, body.taskType));
  const userSaid = [creationSettings.userIntent, creationSettings.notes, body.inputs?.personalRequirement, body.inputs?.originContent, body.historyInput?.originContent, sourceForReview, JSON.stringify(creationSettings)]
    .filter((x) => typeof x === 'string' && x.trim()).join('\n');
  const factKnown = topicContext ? `${topicContext.constraints}\n${userSaid}`
    : factMaterial ? `${factMaterial}\n${userSaid}` : sourceForReview ? `${query}\n${sourceForReview}` : query;
  // 采访类的问题只在用户确实还没采访时才算（同上面的 boundedIntent：通用规则里的「尚未采访」不能当成用户状态）
  const factIssues = (t: string) => [...unsupportedFacts(t, factKnown), ...seasonMisstatements(t, Date.now(), factKnown)]
    .filter((i) => pendingInterview(boundedIntent) || !/^采访(?:经历|结果)/.test(i));
  const snapshot = (nextStep: number): ProcessingState => ({
    fullResponse, capturedConversationId, capturedMessageId, completionTerminal, usageMetadata, outcome, nextStep,
  });
  // 阶段下标属于持久化检查点。保留位置，只跳过当前板块用不到的阶段及其数据库往返。
  const steps: Array<[string, () => Promise<void>, boolean?]> = [
    ['editorial_review', async () => {
      if (outcome.kind === 'done' && topicPlan?.angles.length) {
        fullResponse = anchorDirectionDraft(fullResponse, topicPlan.angles);
      }
      if (outcome.kind === 'done' && sourceForReview && fullResponse.trim()) {
        const requirements = typeof body.personalRequirements === 'string' ? body.personalRequirements : '';
        // 本轮材料（档案、相关方案参考）是事实依据；原稿不是（2026-10-19）
        const material = typeof body.reviewMaterial === 'string' ? body.reviewMaterial : '';
        const verified = await traced('review_verify', () => askDify(reviewVerificationPrompt(sourceForReview, requirements, fullResponse, material), userId, '审稿 原稿事实校对', { signal: AbortSignal.timeout(180_000) })
          .catch(() => ({ ok: false as const, message: '审稿校对未完成' })));
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
          const corrected = await traced('result_check', () => askDify(boundedRepairPrompt(query, fullResponse, issues, boundedIntent), userId, searchQuery, {signal:AbortSignal.timeout(180_000)})
            .catch(() => ({ok:false as const,message:'交付校对未完成'})));
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
      /*
       * 生成后整理（lib/output-guard）：
       * 1. 去掉内部提示词痕迹（「校对编辑」「本轮校对指令」「节奏自检」）和模型写的自检清单；换掉平台敏感词与绝对化用语。
       *    审稿优化只去提示词痕迹：它的原稿要被引用、比对，不能改动原稿用语。
       * 2. 查出没有出处的价格、顾客见证、经营做法、客户故事、作息，以及时令错配，按 lib/fact-fix 的同一套提示词修正一次。
       *    页面上「这几处请核对」只提醒、不改；这里直接改掉编出来的说法。和「按资料修正」共用每人每天 20 次的额度。
       *    审稿优化的已知素材 = 查询 + 原稿：原稿里写过的说法不算编的。
       */
      if (outcome.kind === 'done' && fullResponse.trim()) {
        const tidied = tidy(fullResponse);
        if (tidied.trim()) fullResponse = tidied;
      }
    }],
    ['script_repair', async () => {
      const repairReason = body.taskType === '脚本生成' && outcome.kind === 'done' && fullResponse.trim() ? scriptRepairReason(fullResponse, creationSettings.duration) : null;
      if (repairReason && !scriptRepairLimited(userId)) {
        console.log('[script-repair] 触发:', repairReason, '口播字数:', spokenStep(fullResponse), '时长:', creationSettings.duration || '（未设）');
        const repaired = await traced('script_repair', () => askDify(buildScriptRepairPrompt({ text: fullResponse, reason: repairReason, spoken: spokenStep(fullResponse), duration: creationSettings.duration }), userId, searchQuery, { signal: AbortSignal.timeout(180_000) })
          .catch(() => ({ ok: false as const, message: '脚本修复未完成' })));
        const text = repaired.ok ? tidy(cleanRewriteOutput(repaired.text)) : '';
        const accepted = !!text && acceptScriptRepair(text, creationSettings.duration, spokenStep(fullResponse));
        console.log('[script-repair] 结果:', repaired.ok ? '返回' : `失败（${repaired.message}）`, '口播字数:', text ? spokenStep(text) : null, '采用:', accepted);
        if (accepted && repaired.ok) {
          usageMetadata = combinedReviewUsage(usageMetadata, repaired.completion.usage ?? {}, 'script_repair_steps');
          fullResponse = text;
        }
      }
      // 修复后口播仍超上限：本地按句裁到预算以内（只删句子，不改字，不新增事实）
      const budgetNow = explicitBudget(creationSettings.duration);
      const spokenNow = body.taskType === '脚本生成' && fullResponse.trim() ? spokenStep(fullResponse) : null;
      if (budgetNow && spokenNow !== null && spokenNow > budgetNow * 1.1) {
        fullResponse = trimSpokenStep(fullResponse, budgetNow);
        console.log('[script-trim] 口播', spokenNow, '字，裁到', budgetNow, '字以内，现为', spokenStep(fullResponse));
      }
    }, body.taskType === '脚本生成'],
    ['script_polish', async () => {
      if (outcome.kind === 'done' && body.taskType === '脚本生成' && SCRIPT_POLISH_ENABLED && fullResponse.trim() && !scriptPolishLimited(userId)) {
        const polish = await polishScript({
          draft: fullResponse,
          query,
          known: factKnown,
          ask: async (prompt) => {
            const r = await traced('script_polish', () => askDify(prompt, userId, '', { signal: AbortSignal.timeout(180_000) })).catch(() => null);
            if (!r || !r.ok) return null;
            usageMetadata = combinedReviewUsage(usageMetadata, r.completion.usage ?? {}, 'script_polish_steps');
            return r.text;
          },
          onStatus: (message) => send({ event: 'status', message }),
          retryDelayMs: 8000,
        });
        console.log('[script-polish]', '调用', polish.calls, '次；', polish.reviewFailed ? '体检没出结果；' : `体检问题 ${polish.firstIssues.length} 条；`, polish.rounds.map((r) => `第${r.round}轮 ${r.applied}/${r.replacements} 处 ${r.scoreBefore}→${r.scoreAfter ?? '-'} ${r.accepted ? '采用' : '未采用'}（${r.reason}）`).join('；'));
        if (polish.changed) fullResponse = tidy(polish.text);
      }
    }, body.taskType === '脚本生成' && SCRIPT_POLISH_ENABLED],
    ['fact_check', async () => {
      if (outcome.kind === 'done' && FACT_AUTO_FIX_TASKS.has(body.taskType) && fullResponse.trim()) {
        const found = factIssues(fullResponse);
        // 限额只计一次：长文分段修正（lib/fact-fix-chunks），短稿整篇修正（原来的做法）
        const may = found.length > 0 && !autoFactFixLimited(userId);
        if (may && fullResponse.length > CHUNK_TRIGGER_CHARS) {
          let chunkUsage: Record<string, unknown> = {};
          const r = await fixInChunks(fullResponse, factIssues, async (prompt) => {
            const f = await traced('fact_fix_chunk', () => askDify(prompt, userId, searchQuery, { signal: AbortSignal.timeout(180_000) }).catch(() => null));
            if (!f || !f.ok) return null;
            chunkUsage = mergeUsage(chunkUsage, f.completion.usage ?? {});
            return tidy(cleanRewriteOutput(f.text));
          }, query);
          console.log('[fact-fix 分段]', body.taskType, '需修段', r.tried, '采用', r.accepted);
          if (r.accepted) {
            usageMetadata = combinedReviewUsage(usageMetadata, chunkUsage, 'fact_fix_steps');
            fullResponse = tidy(r.text);
          }
        } else if (may) {
          const fixed = await traced('fact_fix', () => askDify(buildFactFixPrompt({ text: fullResponse, issues: found, context: query }), userId, searchQuery, { signal: AbortSignal.timeout(180_000) })
            .catch(() => ({ ok: false as const, message: '按资料修正未完成' })));
          const text = fixed.ok ? tidy(cleanRewriteOutput(fixed.text)) : '';
          console.log('[fact-fix]', body.taskType, '问题', found.length, '返回', fixed.ok, '修正后问题', text ? factIssues(text).length : '-', '过度改写', text ? fixTooBig(fullResponse, text, found) : '-');
          // 只采用真的少了问题、又没有借机重写全文的版本
          if (fixed.ok && text && !fixTooBig(fullResponse, text, found) && factIssues(text).length < found.length) {
            usageMetadata = combinedReviewUsage(usageMetadata, fixed.completion.usage ?? {}, 'fact_fix_steps');
            fullResponse = text;
          }
        }
      }
    }, FACT_AUTO_FIX_TASKS.has(body.taskType)],
    ['detail_check', async () => {
      if (outcome.kind === 'done' && DETAIL_CHECK_TASKS.has(body.taskType) && fullResponse.trim()) {
        const detail = await traced('detail_check', () => askDify(buildDetailCheckPrompt(fullResponse, factKnown), userId, searchQuery, { signal: AbortSignal.timeout(180_000) }).catch(() => null));
        if (detail && detail.ok) usageMetadata = combinedReviewUsage(usageMetadata, detail.completion?.usage ?? {}, 'detail_check_steps');
        const found = detail && detail.ok ? parseDetailCheck(detail.text) : [];
        const may = found.length > 0 && !autoFactFixLimited(userId);
        if (may) {
          const fixed = await traced('detail_fix', () => askDify(buildFactFixPrompt({ text: fullResponse, issues: found, context: query }), userId, searchQuery, { signal: AbortSignal.timeout(180_000) })
            .catch(() => ({ ok: false as const, message: '按资料修正未完成' })));
          const text = fixed.ok ? tidy(cleanRewriteOutput(fixed.text)) : '';
          const accepted = !!text && !fixTooBig(fullResponse, text, found);
          console.log('[detail-check]', body.taskType, '找到', found.length, '采用', accepted);
          if (accepted && fixed.ok) {
            usageMetadata = combinedReviewUsage(usageMetadata, fixed.completion.usage ?? {}, 'detail_fix_steps');
            fullResponse = text;
          }
        }
      }
    }, DETAIL_CHECK_TASKS.has(body.taskType)],
    ['speaker_check', async () => {
      if (outcome.kind === 'done' && SPEAKER_CHECK_TASKS.has(body.taskType) && needsSpeakerCheck(fullResponse)) {
        const speaker = await traced('speaker_check', () => askDify(buildSpeakerCheckPrompt(fullResponse, factKnown), userId, searchQuery, { signal: AbortSignal.timeout(180_000) }).catch(() => null));
        if (speaker && speaker.ok) usageMetadata = combinedReviewUsage(usageMetadata, speaker.completion?.usage ?? {}, 'speaker_check_steps');
        const found = speaker && speaker.ok ? parseSpeakerCheck(speaker.text) : [];
        const may = found.length > 0 && !autoFactFixLimited(userId);
        if (may) {
          const fixed = await traced('speaker_fix', () => askDify(buildSpeakerFixPrompt({ text: fullResponse, issues: found }), userId, searchQuery, { signal: AbortSignal.timeout(180_000) })
            .catch(() => ({ ok: false as const, message: '说话人修正未完成' })));
          const text = fixed.ok ? tidy(cleanRewriteOutput(fixed.text)) : '';
          const accepted = !!text && !fixTooBig(fullResponse, text, found);
          console.log('[speaker-check]', body.taskType, '找到', found.length, '采用', accepted);
          if (accepted && fixed.ok) {
            usageMetadata = combinedReviewUsage(usageMetadata, fixed.completion.usage ?? {}, 'speaker_fix_steps');
            fullResponse = text;
          }
        }
      }
      // 仍然没有出处的句子直接换成【待确认】占位（确定性，不再让模型改写；标准 E3 允许这种写法）
      if (outcome.kind === 'done' && FACT_AUTO_FIX_TASKS.has(body.taskType) && fullResponse.trim()) {
        const held = holdUnsupported(fullResponse, factIssues);
        if (held.held) {
          console.log('[evidence] 占位', body.taskType, '句数', held.held);
          fullResponse = held.text;
        }
      }
    }, SPEAKER_CHECK_TASKS.has(body.taskType) || FACT_AUTO_FIX_TASKS.has(body.taskType)],
    ['years_repair', async () => {
      if (outcome.kind === 'done' && needsSentenceRepair(body.taskType) && fullResponse.trim()) {
        const years = await repairYears(fullResponse, async (prompt) => {
          const f = await traced('years_repair', () => askDify(prompt, userId, searchQuery, { signal: AbortSignal.timeout(180_000) }).catch(() => null));
          if (!f || !f.ok) return null;
          usageMetadata = combinedReviewUsage(usageMetadata, f.completion?.usage ?? {}, 'years_repair_steps');
          return f.text;
        }, personaFacts, `${body.taskType}；用户原意：${(creationSettings.userIntent ?? '').slice(0, 200)}`, () => !sentenceRepairLimited(userId));
        console.log('[years-repair]', body.taskType, '尝试', years.tried, '采用', years.accepted);
        if (years.accepted) fullResponse = years.text;
      }
    }],
    ['reality_repair', async () => {
      if (outcome.kind === 'done' && needsSentenceRepair(body.taskType) && fullResponse.trim()) {
        const reality = await repairReality(fullResponse, async (prompt) => {
          const f = await traced('reality_repair', () => askDify(prompt, userId, searchQuery, { signal: AbortSignal.timeout(180_000) }).catch(() => null));
          if (!f || !f.ok) return null;
          usageMetadata = combinedReviewUsage(usageMetadata, f.completion?.usage ?? {}, 'reality_repair_steps');
          return f.text;
        }, `${body.taskType}；用户原意：${(creationSettings.userIntent ?? '').slice(0, 200)}`, () => !sentenceRepairLimited(userId));
        console.log('[reality-repair]', body.taskType, '尝试', reality.tried, '采用', reality.accepted);
        if (reality.accepted) fullResponse = reality.text;
      }
      // 拆解的变现方向是 JSON：按行的整理改坏了就换回模型原文里的结构块（2026-10-15）
    }],
    ['structure_check', async () => {
      if (outcome.kind === 'done' && body.taskType === '拆解爆款' && fullResponse.trim()) {
        fullResponse = keepStructureBlock(rawResponse, fullResponse);
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
    }],
    ['topic_review', async () => {
      if (outcome.kind === 'done' && topicTask && (fullResponse.trim() || topicPlan?.angles.length)) {
        send({ event: 'status', message: '正在逐条核对选题，撞题会自动补写' });
        const polishSignal = AbortSignal.timeout(35_000);
        const polish = (text: string) => prepareTopicDraft(text, async (prompt) => {
          const reply = await traced('topic_polish', () => askDify(prompt, userId, '', { signal: polishSignal })).catch(() => null);
          if (!reply?.ok) return null;
          usageMetadata = combinedReviewUsage(usageMetadata, reply.completion.usage ?? {}, 'topic_polish_steps');
          return reply.text;
        });
        const [freshTopics, done, draft] = await Promise.all([
          loadPriorTopicSections(userId, profileId),
          profileId ? loadDoneList(userId, profileId) : [],
          topicContext ? Promise.resolve(topicPlan?.angles.length ? fullResponse : '') : polish(fullResponse),
        ]);
        const prior = freshTopics.length ? freshTopics : priorTopics;
        const result = await finalizeTopicBatch(draft, [...(previousTopic?.topics ?? []), ...prior, ...done.map(({ title }) => ({ title, body: '' }))], requestedTopics, async (refill) => {
          if (!generationConversationId) return '';
          const angles = topicContext ? await planDirectionTopics(topicContext, refill.count, refill.avoid, undefined, refill.preferredElements, refill.blocked) : [];
          if (topicContext && !angles.length) return '';
          const refillInstructions = topicRefillPrompt(refill, directionSeed);
          const prompt = topicContext
            ? [directionAnglesPrompt(topicContext, angles, refill.count), refillInstructions, DIRECTION_TOPIC_DELIVERY].join('\n\n')
            : refillInstructions;
          const repair = await traced('topic_refill', () => askDify(prompt, userId, searchQuery, {
            conversationId: generationConversationId, signal: AbortSignal.timeout(150_000),
          }));
          if (!repair.ok) return '';
          usageMetadata = combinedReviewUsage(usageMetadata, repair.completion.usage ?? {}, 'topic_refill_steps');
          return holdUnsupported(tidy(anchorDirectionDraft(repair.text, angles)), factIssues).text;
        }, { directionSeed, topicContext });
        if (result.requested) {
          const { text, ...batch } = result;
          if (result.count) {
            fullResponse = text;
            send({ event: 'topic_batch', ...batch });
            if (topicContext && !result.checked) outcome = { kind: 'error', message: '选题核对暂未完成，已保留可用草稿' };
          } else {
            if (creativeWindow && generationConversationId) {
              await saveDifyConversationId(userId, generationConversationId, profileId, body.taskType, 'creation');
            }
            const planUnavailable = topicContext && !topicPlan?.angles.length;
            outcome = { kind: 'error', message: planUnavailable ? '选题核对暂未完成，已保留可用草稿' : result.checked ? '这次没有生成可交付的新选题，请调整要求后再试' : '选题核对暂未完成，请重试' };
          }
        }
      }
    }, topicTask],
    ['plan_route_check', async () => {
      const settings = body.historyInput ?? body.inputs ?? {};
      const total = Number(settings.count);
      if (!Number.isSafeInteger(total) || total <= 0) return;
      const monthly = body.taskType === '内容规划';
      const share = normalizeScriptShare(settings.scriptsShare ?? DEFAULT_SCRIPT_SHARE);
      const picked = settings.routeManual && Array.isArray(settings.pickedRoutes)
        ? settings.pickedRoutes.filter((key: unknown): key is string => typeof key === 'string') : [];
      const mix = settings.contentMix as ContentMix | undefined;
      const check = (text: string) => {
        const issue = planRouteIssue(text, total, share, monthly, picked, factKnown);
        if (issue || !monthly || !mix || !CONTENT_ROLE_LIST.every(role => Number.isFinite(mix[role]))) return issue;
        const purpose = checkPlan(text, { mix, source: 'override', label: '本轮设置' }, total);
        return purpose.ok ? '' : '按视频目的核对，本月需要' + purpose.expected + '，实际为' + purpose.summary;
      };
      const issue = check(fullResponse);
      if (!issue) return;
      send({ event: 'status', message: '正在按所选脚本打法核对条数并调整内容' });
      const fillHooks = async (text: string) => {
        const hooks = planHookRepair(text);
        if (!hooks) return text;
        const fill = await traced('plan_hook_repair', () => askDify(hooks.prompt, userId, '', {
          conversationId: generationConversationId || undefined, signal: AbortSignal.timeout(120_000),
        })).catch(() => null);
        if (!fill?.ok) return text;
        usageMetadata = combinedReviewUsage(usageMetadata, fill.completion.usage ?? {}, 'plan_route_repair');
        return tidy(holdUnsupported(hooks.apply(fill.text), factIssues).text);
      };
      if (issue.includes('缺少爆款元素')) {
        const patched = await fillHooks(fullResponse);
        if (!check(patched)) { fullResponse = patched; return; }
      }
      const monthlyRepair = monthly && total <= 100 && mix && CONTENT_ROLE_LIST.every(r => Number.isFinite(mix[r]) && mix[r] >= 0) &&
        CONTENT_ROLE_LIST.reduce((sum, r) => sum + mix[r], 0) === 100 ? monthlyRepairPlan(total, mix, share, picked, query) : null;
      const prompt = monthlyRepair?.prompt ?? [query, '校正刚才的完整方案。' + issue,
        '同步改写受影响方向的内容、爆款元素、拍摄建议及汇总。保留用户的目的配比、事实与拍摄限制。输出整份可直接使用的修正版。',
        fullResponse].join('\n\n');
      const fixed = await traced('plan_route_repair', () => askDify(prompt, userId, '', {
        conversationId: generationConversationId || undefined, signal: AbortSignal.timeout(300_000),
      })).catch(() => null);
      if (fixed?.ok) {
        usageMetadata = combinedReviewUsage(usageMetadata, fixed.completion.usage ?? {}, 'plan_route_repair');
        let candidate = monthlyRepair?.render(fixed.text) ?? fixed.text;
        if (monthlyRepair && candidate === fixed.text && check(candidate)) {
          const missing = await traced('plan_route_missing', () => askDify(monthlyRepair.remainingPrompt(), userId, '', {
            conversationId: generationConversationId || undefined, signal: AbortSignal.timeout(180_000),
          })).catch(() => null);
          if (missing?.ok) {
            usageMetadata = combinedReviewUsage(usageMetadata, missing.completion.usage ?? {}, 'plan_route_repair');
            candidate = monthlyRepair.render(missing.text) ?? candidate;
          }
        }
        candidate = tidy(holdUnsupported(candidate, factIssues).text);
        if (check(candidate).includes('缺少爆款元素')) candidate = await fillHooks(candidate);
        const remaining = check(candidate);
        if (!remaining) { fullResponse = candidate; return; }
        console.warn('[plan-route]', body.taskType, '修正后', remaining.split('。')[0]);
      } else {
        console.warn('[plan-route]', body.taskType, '修正返回', fixed?.message ?? '调用失败');
      }
      outcome = { kind: 'error', message: '脚本打法配比未达标，已保留草稿，请重试' };
    }, body.taskType === '内容规划' || body.taskType === '创作方向'],
  ];
  for (let i = state.nextStep; i < steps.length && outcome.kind === 'done'; i++) {
    const [name, run, applicable = true] = steps[i];
    if (!applicable) continue;
    await checkpoint?.(name, snapshot(i), true);
    await run();
    await checkpoint?.(name, snapshot(i + 1), false);
  }
  return snapshot(steps.length);
}
