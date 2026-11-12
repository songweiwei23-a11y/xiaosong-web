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

/*
 * ── 文件上传的分段暂存（2026-10-03）──────────────────────────────
 * 图片、文档、录音动辄几百 KB 到 10MB，线路差时整包发会被切断。浏览器端（lib/safe-upload）先整包试，
 * 断了就把整个表单按字节切段送到 /api/body-chunks，段的大小随线路自己调（断了就减半），
 * 所以不能按"第几块、共几块"存（块数一开始定不下来），按字节位置存。
 */
const UPLOAD_MAX = 12 * 1024 * 1024; // 自由对话附件 10MB + 表单头
const UPLOAD_PER_OWNER = 4; // 一个人同时最多 4 个没传完的
const UPLOAD_GLOBAL = 96 * 1024 * 1024; // 全站暂存总量（服务器 2G 内存，留足）

interface PendingUpload { owner: string; total: number; buf: Buffer; covered: [number, number][]; got: number; at: number }
const uploads: Map<string, PendingUpload> = ((globalThis as any).__kaiwuUploadRanges ??= new Map());

function sweepUploads(now = Date.now()) {
  for (const [k, v] of uploads) if (now - v.at > TTL_MS) uploads.delete(k);
}

/** 把区间并进已收到的范围，返回新收到的字节数 */
function mergeRange(covered: [number, number][], start: number, end: number): number {
  let added = end - start;
  for (const [s, e] of covered) added -= Math.max(0, Math.min(e, end) - Math.max(s, start));
  covered.push([start, end]);
  covered.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of covered) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  covered.splice(0, covered.length, ...merged);
  return Math.max(0, added);
}

/** 存一段（offset 起、data 长）。返回错误说明或 null */
export function putRange(owner: string, id: string, offset: number, total: number, data: Buffer): string | null {
  sweepUploads();
  if (!/^[0-9a-f]{32}$/.test(id)) return '编号不正确';
  if (!Number.isInteger(total) || total < 1 || total > UPLOAD_MAX) return '文件太大';
  if (!Number.isInteger(offset) || offset < 0 || offset + data.length > total || data.length === 0) return '分段位置不正确';
  const key = `${owner}:${id}`;
  let p = uploads.get(key);
  if (!p) {
    const mine = [...uploads.values()].filter((u) => u.owner === owner).length;
    if (mine >= UPLOAD_PER_OWNER) return '同时上传的文件太多，请等前面的传完';
    const used = [...uploads.values()].reduce((n, u) => n + u.total, 0);
    if (used + total > UPLOAD_GLOBAL) return '服务器正忙，请稍后再试';
    p = { owner, total, buf: Buffer.alloc(total), covered: [], got: 0, at: Date.now() };
    uploads.set(key, p);
  }
  if (p.total !== total) return '文件大小对不上';
  data.copy(p.buf, offset);
  p.got += mergeRange(p.covered, offset, offset + data.length);
  p.at = Date.now();
  return null;
}

/** 取出拼好的整段（只能取一次）；没收齐返回 null */
function takeRange(owner: string, id: string): Buffer | null {
  const key = `${owner}:${id}`;
  const p = uploads.get(key);
  if (!p || p.covered.length !== 1 || p.covered[0][0] !== 0 || p.covered[0][1] !== p.total) return null;
  uploads.delete(key);
  return p.buf;
}

/**
 * 读表单请求体（文件上传）。整包发来的照常读；分段发来的（X-Body-Ref + X-Body-Content-Type）拼回原来的表单再读，
 * 后面的逻辑不用改。owner 不传时自己验一次登录。
 */
export async function readFormBody(req: Request, owner?: string | null): Promise<FormData> {
  const ref = req.headers.get('x-body-ref');
  if (!ref) return req.formData();
  if (!owner) {
    const { requireUser } = await import('@/lib/api-guard');
    const who = await requireUser();
    owner = who.ok ? who.userId ?? null : null;
  }
  if (!owner) throw new BodyError('请先登录');
  const contentType = req.headers.get('x-body-content-type') || '';
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) throw new BodyError('上传格式不正确，请重试');
  const buf = takeRange(owner, ref);
  if (!buf) throw new BodyError('文件没有传完整，请重试');
  return new Request('http://local/upload', { method: 'POST', headers: { 'content-type': contentType }, body: new Uint8Array(buf) }).formData();
}

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
