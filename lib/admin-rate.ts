import { createRateLimiter } from '@/lib/rate-limit';

/**
 * 管理员写操作的频率限制（后台扩展方案 P2-4）：同一个管理员每分钟最多 60 次写操作。
 * 防的是误操作和脚本刷接口，不是为了限制正常的审单节奏。进程内计数，重启后清零。
 */
const limited = createRateLimiter(60_000, 60);

export function adminWriteLimited(adminUserId: string): boolean {
  return limited(adminUserId);
}
