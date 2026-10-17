/**
 * 功能暂时不可用时，给用户看的话（体检 P0-1）。
 *
 * 原来的写法是「请先在 Supabase 执行 xxx.sql」「数据库还没升级，请联系管理员」——这是运维的话，
 * 普通用户看了既不知道怎么办，也暴露了内部结构。现在：
 *   - 用户看到的：「<功能>暂时不可用，稍后再试」
 *   - 服务端日志：记下缺的是哪张表、该执行哪个迁移
 *   - 管理后台「迁移状态」页：一眼看到哪些迁移还没执行（lib/migration-registry）
 * 管理员页面本身仍然可以写细节，这里只管用户侧。
 */

export const PAUSED_SUFFIX = '暂时不可用，稍后再试';

/** 用户看到的一句话，例如 pausedMessage('素材库') → 「素材库暂时不可用，稍后再试」 */
export function pausedMessage(feature: string): string {
  return `${feature}${PAUSED_SUFFIX}`;
}

/** 服务端记日志，给运维看（不返回给用户）。detail 里可以写表名、迁移文件名 */
export function logPaused(feature: string, detail: string): void {
  console.warn(`[feature-paused] ${feature}: ${detail.slice(0, 200)}`);
}

/** 判断一个数据库错误是不是「表或列还不存在（迁移没跑）」 */
export function isMissingSchemaError(message: string | null | undefined): boolean {
  return /schema cache|does not exist|Could not find the table|column .* does not exist/i.test(message || '');
}
