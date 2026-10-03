/**
 * 读请求体，认得浏览器端 lib/safe-post 发来的压缩 / 分块格式。服务器端用。
 *
 * 为什么要有它：用户线路差的时候超过约 8KB 的 POST 会被切断（见 lib/safe-post 的说明），
 * 浏览器端把大请求 gzip 或分块后再发；这里还原成原来的 JSON，后面的逻辑不用改。
 */
import { gunzipSync } from 'node:zlib';

const TTL_MS = 5 * 60_000;
/** 一个请求最多拼多大（解压前）：远大于正常提示词，挡住乱发 */
const MAX_TOTAL = 2 * 1024 * 1024;
const MAX_CHUNKS = 600;

interface Pending { owner: string; total: number; parts: (Buffer | undefined)[]; size: number; at: number }

/** 单进程（pm2 fork 一个实例）放内存里就够；挂在 globalThis 上，开发时热更新不丢 */
const store: Map<string, Pending> = ((globalThis as any).__kaiwuBodyChunks ??= new Map());

function sweep(now = Date.now()) {
  for (const [k, v] of store) if (now - v.at > TTL_MS) store.delete(k);
}

/** 存一块。返回错误说明或 null */
export function putChunk(owner: string, id: string, index: number, total: number, data: Buffer): string | null {
  sweep();
  if (!/^[0-9a-f]{32}$/.test(id)) return '编号不正确';
  if (!Number.isInteger(total) || total < 1 || total > MAX_CHUNKS || !Number.isInteger(index) || index < 0 || index >= total) return '分块序号不正确';
  const key = `${owner}:${id}`;
  const p = store.get(key) ?? { owner, total, parts: new Array(total), size: 0, at: Date.now() };
  if (p.total !== total) return '分块数量对不上';
  if (!p.parts[index]) p.size += data.length;
  p.parts[index] = data;
  p.at = Date.now();
  if (p.size > MAX_TOTAL) { store.delete(key); return '内容太大'; }
  store.set(key, p);
  return null;
}

/** 取出拼好的内容（只能取一次）；缺块返回 null */
function takeChunks(owner: string, id: string): Buffer | null {
  const key = `${owner}:${id}`;
  const p = store.get(key);
  if (!p || p.parts.some((x) => !x)) return null;
  store.delete(key);
  return Buffer.concat(p.parts as Buffer[]);
}

export class BodyError extends Error {}

/**
 * 读 JSON 请求体。owner 是当前用户 id：分块只能取自己存的。
 * 不传 owner 时，碰到分块格式会自己验一次登录——各接口只要把 request.json() 换成它，一行改完。
 */
export async function readJsonBody<T = any>(req: Request, owner?: string | null): Promise<T> {
  const ref = req.headers.get('x-body-ref');
  const gz = req.headers.get('x-body-encoding') === 'gzip';
  let buf: Buffer;
  if (ref) {
    if (!owner) {
      const { requireUser } = await import('@/lib/api-guard');
      const who = await requireUser();
      owner = who.ok ? who.userId ?? null : null;
    }
    if (!owner) throw new BodyError('请先登录');
    const got = takeChunks(owner, ref);
    if (!got) throw new BodyError('内容没有传完整，请重试');
    buf = got;
  } else if (gz || (req.headers.get('content-type') || '').includes('application/octet-stream')) {
    buf = Buffer.from(await req.arrayBuffer());
  } else {
    return req.json();
  }
  try {
    const text = (gz ? gunzipSync(buf, { maxOutputLength: 8 * 1024 * 1024 }) : buf).toString('utf8');
    return JSON.parse(text);
  } catch {
    throw new BodyError('请求内容解析失败，请重试');
  }
}
