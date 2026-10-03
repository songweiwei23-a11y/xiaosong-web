import { randomUUID } from 'node:crypto';
import { requireUser, requireUserWithQuota } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { chatFileType, FILE_UUID, MAX_CHAT_FILE_BYTES } from '@/lib/chat-attachments';
import { CHAT_FILES_BUCKET, signAttachment } from '@/lib/chat-attachments-server';

export const runtime = 'nodejs';
const limited = createRateLimiter(60 * 60_000, 60);
const base = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
const mimeTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', html: 'text/html', xml: 'text/xml', json: 'application/json',
};

export async function POST(request: Request) {
  const guard = await requireUserWithQuota('freeChat');
  if (!guard.ok) return guard.response!;
  if (!process.env.DIFY_API_KEY) return Response.json({ error: '对话服务未配置' }, { status: 503 });
  if (limited(guard.userId!)) return Response.json({ error: '上传太频繁了，请稍后再试' }, { status: 429 });
  if (Number(request.headers.get('content-length')) > MAX_CHAT_FILE_BYTES + 512 * 1024) {
    return Response.json({ error: '文件不能超过 10 MB' }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return Response.json({ error: '请选择要上传的文件' }, { status: 400 });
  const name = file.name.replace(/[\u0000-\u001f/\\]/g, '_').slice(-180);
  const type = chatFileType(name);
  if (!type) return Response.json({ error: '支持图片、PDF、Word、Excel、PPT 和文本文件；旧版 .doc/.xls/.ppt 请另存为新格式' }, { status: 400 });
  if (!file.size || file.size > MAX_CHAT_FILE_BYTES) return Response.json({ error: '文件不能为空，且不能超过 10 MB' }, { status: 413 });
  const ext = name.split('.').pop()!.toLowerCase();
  const mime = mimeTypes[ext];
  const bytes = Buffer.from(await file.arrayBuffer());
  // 不把改后缀的 HTML/SVG 当作图片交给浏览器。
  const validImage = type !== 'image' ||
    (['jpg', 'jpeg'].includes(ext) && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (ext === 'png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (ext === 'gif' && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())) ||
    (ext === 'webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP');
  if (!validImage) return Response.json({ error: '图片格式与内容不符，请重新导出图片再上传' }, { status: 400 });
  const vision = form?.get('vision');
  let aiBytes = bytes;
  if (type === 'image') {
    if (!vision || typeof vision === 'string' || !vision.size || vision.size > 350 * 1024) {
      return Response.json({ error: '图片处理失败，请通过上传按钮重新上传' }, { status: 400 });
    }
    aiBytes = Buffer.from(await vision.arrayBuffer());
    if (aiBytes[0] !== 0xff || aiBytes[1] !== 0xd8) return Response.json({ error: '图片处理格式错误' }, { status: 400 });
  }
  const db = getServiceSupabase();
  const storagePath = `${guard.userId!}/${randomUUID()}/file.${ext}`;
  try {
    const { error: storeError } = await db.storage.from(CHAT_FILES_BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (storeError) throw new Error('文件保存失败，请稍后重试');
    const out = new FormData();
    out.append('file', new Blob([aiBytes], { type: type === 'image' ? 'image/jpeg' : mime }), type === 'image' ? name.replace(/\.[^.]+$/, '.jpg') : name);
    out.append('user', guard.userId!);
    const response = await fetch(`${base}/files/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` }, body: out,
      signal: AbortSignal.timeout(90_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.id !== 'string' || !FILE_UUID.test(data.id)) throw new Error('AI 文件上传失败，请重试');
    const result = { id: data.id, name, size: file.size, type, storagePath };
    return Response.json({ ...result, token: signAttachment(guard.userId!, result) });
  } catch (error) {
    // 未成功交给用户的本次上传不留下存储副本；路径完全由服务器生成。
    await db.storage.from(CHAT_FILES_BUCKET).remove([storagePath]);
    return Response.json({ error: error instanceof Error && /文件|上传/.test(error.message) ? error.message : '上传超时或网络中断，请重新上传' }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const params = new URL(request.url).searchParams;
  const path = params.get('path') || '';
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/file\.[a-z0-9]+$/i.test(path) || !path.startsWith(`${guard.userId!}/`)) {
    return Response.json({ error: '无权读取这个文件' }, { status: 403 });
  }
  const { data, error } = await getServiceSupabase().storage.from(CHAT_FILES_BUCKET).download(path);
  if (error || !data) return Response.json({ error: '文件不存在或已删除' }, { status: 404 });
  const ext = path.split('.').pop()!;
  const inline = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) && params.get('download') !== '1';
  const name = (params.get('name') || `file.${ext}`).replace(/[\r\n"/\\]/g, '_').slice(0, 180);
  return new Response(data, { headers: {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="file.${ext}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
