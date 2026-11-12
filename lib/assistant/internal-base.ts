/**
 * 小助理回调本站接口用的地址。
 *
 * 发布会在 3000 和 3001 之间换端口。环境变量如果写成 http://127.0.0.1:3000，
 * 切走之后这个进程已经不在 3000 上，内部调用会打空。
 * 回环地址上的 3000 / 3001 一律改成当前进程的 PORT，调用打回自己。
 * 不带这两个端口的地址保持原样：留空走当前端口；写成 http://127.0.0.1 则走本机 Nginx。
 */

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const ROTATING_PORTS = new Set(['3000', '3001']);

export function resolveInternalBase(
  explicit?: string | null,
  env: { ASSISTANT_INTERNAL_URL?: string; PORT?: string } = {
    ASSISTANT_INTERNAL_URL: process.env.ASSISTANT_INTERNAL_URL,
    PORT: process.env.PORT,
  },
): string {
  const given = explicit?.trim();
  if (given) return given;
  const port = (env.PORT || '3000').trim() || '3000';
  const own = `http://127.0.0.1:${port}`;
  const configured = (env.ASSISTANT_INTERNAL_URL || '').trim();
  if (!configured) return own;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return own;
  }
  const stated = url.port || (url.protocol === 'https:' ? '443' : '80');
  if (LOOPBACK.has(url.hostname) && ROTATING_PORTS.has(stated)) {
    url.port = port;
    return url.origin;
  }
  return configured.replace(/\/$/, '');
}
