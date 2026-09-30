import { NextRequest, NextResponse } from 'next/server';
import { requireUserWithQuota } from '@/lib/api-guard';
import { createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
/** 一段最长 30 秒、16k 单声道 16 位 ≈ 960KB，留点余量 */
const MAX_BYTES = 2 * 1024 * 1024;
/** 一条 3 分钟的视频切 6～15 段；一小时 150 段够拆十条 */
const limited = createRateLimiter(60 * 60_000, 150);

/**
 * 拆解爆款：浏览器切好的一段音频（WAV）→ 文字。转给「开物」的语音转文字（SiliconFlow SenseVoice）。
 *
 * 要登录、要还有拆解次数（不扣——真正扣次数的是最后那次拆解），防止没额度的人拿它当免费转写。
 * 一段一次请求，每次不到 1MB：线上实测几十 KB 以上的请求会被编导那边的网络时不时掐断，
 * 小请求加页面上的自动重发扛得住。
 */
export async function POST(req: NextRequest) {
  const guard = await requireUserWithQuota('breakdown');
  if (!guard.ok) return guard.response!;
  if (limited(guard.userId!)) return NextResponse.json({ error: '识别太频繁了，歇一会儿再来' }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: '没收到音频' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '这段音频太长了' }, { status: 400 });

  const out = new FormData();
  out.append('file', new Blob([await file.arrayBuffer()], { type: 'audio/wav' }), 'segment.wav');
  out.append('user', guard.userId!);
  const res = await fetch(`${DIFY_BASE_URL}/audio-to-text`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` },
    body: out,
  });
  if (!res.ok) {
    console.error('[breakdown] 语音识别失败:', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return NextResponse.json({ error: '语音识别暂时不可用' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ text: typeof data?.text === 'string' ? data.text : '' });
}
