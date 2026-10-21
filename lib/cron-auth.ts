import { timingSafeEqual } from 'node:crypto';

/**
 * 定时任务（服务器 crontab）调用内部接口时的鉴权。
 * 请求头 x-cron-secret 必须等于环境变量里的密钥（至少 16 位，常量时间比较）。
 * 密钥只放服务器的 .env.local，不进代码、不进仓库。
 */
export function cronRequestAuthorized(request: Request, envName: string, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env[envName] || '';
  const got = request.headers.get('x-cron-secret') || '';
  if (secret.length < 16 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}
