import { NextRequest, NextResponse } from 'next/server';
import { requireUserWithQuota } from '@/lib/api-guard';
import { readFormBody } from '@/lib/read-body';
import { createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
/** Dify 应用设置：图片单张 10MB 以内；拼图 JPEG 一般 300～800KB */
const MAX_BYTES = 8 * 1024 * 1024;
/** 一条视频最多 6 张；一小时 60 张够拆十条 */
const limited = createRateLimiter(60 * 60_000, 60);

/**
 * 拆解爆款：一张截图拼图 → 传到 Dify，拿回文件 id，拆解时随消息发给模型看。
 * 上传时用的 user 必须和发消息时是同一个（Dify 按 user 隔离文件），这里和 /api/dify/stream 都用登录用户 id。
 * 要登录、要还有拆解次数（不扣）。
 */
export async function POST(req: NextRequest) {
  const guard = await requireUserWithQuota('breakdown');
  if (!guard.ok) return guard.response!;
  if (limited(guard.userId!)) return NextResponse.json({ error: '上传太频繁了，歇一会儿再来' }, { status: 429 });

  // 线路差时浏览器分段传来（lib/safe-upload），这里拼回原表单
  const form = await readFormBody(req, guard.userId).catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: '没收到图片' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '图片太大了' }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return NextResponse.json({ error: '只收 JPG/PNG 图片' }, { status: 400 });

  const out = new FormData();
  out.append('file', new Blob([await file.arrayBuffer()], { type: file.type }), 'sheet.jpg');
  out.append('user', guard.userId!);
  const res = await fetch(`${DIFY_BASE_URL}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` },
    body: out,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.id !== 'string') {
    console.error('[breakdown] 截图上传失败:', res.status, JSON.stringify(data).slice(0, 200));
    return NextResponse.json({ error: '截图上传失败，请重试' }, { status: 502 });
  }
  return NextResponse.json({ id: data.id });
}
