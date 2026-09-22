/**
 * 任务类型 ↔ 计费功能 的唯一映射。
 *
 * 这张表原先内嵌在 app/api/dify/stream/route.ts 里，页面发什么、表里认什么，
 * 两边靠人眼对齐，于是长期对不上：
 *   - 知识库页和成交理由页都发 '知识库查询'，表里写的却是 '知识库'
 *   - 分镜页的推荐按钮发 'AI推荐'，表里根本没有
 * 对不上就兜底成 'script'，后果是知识库查询、成交理由分析、分镜的 AI 推荐
 * 统统去扣「脚本生成」的额度——既违背「知识库无限使用」的承诺，
 * 又让用户的脚本次数被别的功能悄悄吃掉。
 *
 * 生产数据的佐证：脚本生成只有 48 条记录，script_used 却是 75。
 *
 * 抽到这里之后，tests/task-type-coverage.test.ts 会校验每个页面发出的
 * taskType 都在本表中，对不上就测试失败，不再靠人眼。
 */

/** 计费功能代码，与 lib/config/plans.ts 的 quotas 键、user_quotas 的列一一对应 */
export type FeatureCode =
  | 'knowledge'
  | 'positioning'
  | 'topic'
  | 'script'
  | 'freeChat'
  | 'storyboard'
  | 'review'
  | 'title'
  | 'dealReason';

export const TASK_TYPE_TO_FEATURE: Record<string, FeatureCode> = {
  脚本生成: 'script',
  选题策划: 'topic',
  分镜脚本: 'storyboard',
  // 分镜页的「AI 智能推荐」：它也是一次真实的 Dify 调用，要计费，
  // 归到分镜名下——用户是在做分镜的过程中用它的。
  AI推荐: 'storyboard',
  审稿优化: 'review',
  标题封面: 'title',
  账号定位: 'positioning',
  成交理由: 'dealReason',
  自由对话: 'freeChat',
  知识库查询: 'knowledge',
};

/**
 * 取任务类型对应的计费功能。
 *
 * 认不出来时仍然兜底为 'script'（宁可记错也不能让用户的生成失败），
 * 但会打一条 error——线上构建保留了 console.error/warn，能在日志里看见。
 */
export function getFeatureFromTaskType(taskType: string | undefined): FeatureCode {
  const feature = taskType ? TASK_TYPE_TO_FEATURE[taskType] : undefined;
  if (!feature) {
    console.error(
      `[task-type] 未登记的任务类型「${taskType ?? '(未传)'}」，` +
        `本次用量已暂记到脚本生成名下。请在 lib/task-type.ts 中补登记。`
    );
    return 'script';
  }
  return feature;
}
