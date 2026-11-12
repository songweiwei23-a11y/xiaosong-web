// 跨板块链路验证入口：把线上的提示词构造、交接、质检函数导出，供 chain.cjs 调用（与线上同一套代码）。
export { buildDirectionPrompt, PURPOSES } from '../../lib/direction';
export { buildProfileSummary } from '../../lib/profile-summary';
export { buildContextBlock } from '../../lib/creator-context';
export { buildCreationHandoff, CREATION_SOURCES } from '../../lib/creation-flow';
export { resolveCreationSettings, creationSettingsBlock } from '../../lib/creation-settings';
export { creationReference } from '../../lib/creation-continuation';
export { buildAdaptiveScriptPrompt } from '../../lib/script-design';
export { buildReviewPrompt, AI_DURATION } from '../../lib/review-standards';
export { buildStoryboardPrompt } from '../../lib/storyboard-standards';
export { VISUAL_STYLES, CONTENT_TYPES } from '../../lib/content-types';
export { runQualityChecks, reviewedQualityOutput } from '../../lib/quality-checks';
export { readDifyAnswer } from '../../lib/quality-regression';
