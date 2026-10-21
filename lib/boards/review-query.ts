import { AI_DURATION, buildReviewPrompt, personalRequirementsReminder } from '@/lib/review-standards';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';
import {
  creationSettingsBlock,
  mergeCreationSettings,
  resolveCreationSettings,
  REVIEW_SCRIPT_TYPES,
  scriptTypeForLabel,
  type CreationSettings,
} from '@/lib/creation-settings';

/**
 * 审稿优化板块的提示词拼装。审稿页面和开物助理共用这一份，保证两边给模型的内容一致。
 *
 * 页面自己负责「勾了哪些检查项」（那依赖页面的选项表），拼好的文字传进来；
 * 其余（账号背景、创作设置、相关方案参考、审稿提示词本体）都在这里拼。
 */

export interface ReviewBoardInput {
  /** 账号档案、定位等上下文（页面用客户端的 useCreatorContext，助理用服务端读出来的） */
  creatorContext: CreatorContext;
  currentSettings: CreationSettings;
  /** 相关方案参考（没有就空串） */
  sourceReference: string;
  draftContent: string;
  platform: string;
  /** 页面算好的时长文字，例如「60秒」或 AI 推荐的占位 */
  effectiveDuration: string;
  scriptType: string;
  personalRequirements: string;
  /** 页面勾选的检查项，已经拼成文字（助理没有勾选，传空串） */
  reviewDimensions: string;
  optimizationGoals: string;
  benchmarkScript: string;
  compareMode: boolean;
  severityLabels: boolean;
}

export interface ReviewBoardQuery {
  /** 发给 /api/dify/stream 的 query（已含个人要求的提醒） */
  query: string;
  /** 事实核对的依据材料：账号背景、创作设置、相关方案参考（不含原稿） */
  reviewMaterial: string;
}

export function buildReviewBoardQuery(input: ReviewBoardInput): ReviewBoardQuery {
  const reviewMaterial =
    buildContextBlock(input.creatorContext, 'review') +
    creationSettingsBlock(input.currentSettings) +
    (input.sourceReference
      ? `\n【相关方案参考】\n${input.sourceReference}\n以上仅为背景资料。只审下方待审脚本，不把迁移说明、拍摄清单算作口播。`
      : '');
  const query =
    buildReviewPrompt({
      contextBlock: reviewMaterial,
      draftContent: input.draftContent,
      platform: input.platform,
      duration: input.effectiveDuration,
      scriptType: input.scriptType,
      personalRequirements: input.personalRequirements,
      reviewDimensions: input.reviewDimensions,
      optimizationGoals: input.optimizationGoals,
      benchmarkScript: input.benchmarkScript,
      compareMode: input.compareMode,
      severityLabels: input.severityLabels,
    }) + personalRequirementsReminder(input.personalRequirements);
  return { query, reviewMaterial };
}

export interface ReviewSettingsInput {
  draftContent: string;
  platform: string;
  /** 页面上时长输入的原文：纯数字按秒算，空或「AI 推荐」就是交给 AI */
  duration: string;
  /** 页面上选的脚本类型标签，没选是空串 */
  scriptType: string;
  /** 从原稿带过来的设置（没有就是空对象） */
  autoSettings: CreationSettings;
  creatorContext: CreatorContext | null;
}

/**
 * 审稿板块的创作设置。审稿页面和开物助理都用这一个算法，同样的输入得到同样的设置。
 * AI 推荐时时长不写进连续设置（见审稿页面的说明：写了会被当成"时长不得更换"）。
 */
export function reviewCreationSettings(input: ReviewSettingsInput): CreationSettings {
  const effectiveDuration = /^\d+$/.test(input.duration.trim()) ? `${input.duration.trim()}秒` : input.duration.trim() || AI_DURATION;
  const resolved = resolveCreationSettings({
    from: '审稿优化',
    sourceContent: input.draftContent,
    settings: mergeCreationSettings(input.autoSettings, {
      platform: input.platform,
      duration: effectiveDuration,
      scriptType: REVIEW_SCRIPT_TYPES[input.autoSettings.scriptType!] === input.scriptType
        ? input.autoSettings.scriptType
        : scriptTypeForLabel(input.scriptType),
    }),
  }, input.creatorContext);
  if (effectiveDuration !== AI_DURATION) return { ...resolved, duration: effectiveDuration };
  const withoutDuration = { ...resolved };
  delete withoutDuration.duration;
  return withoutDuration;
}
