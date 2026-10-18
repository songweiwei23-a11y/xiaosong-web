import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { readFormBody } from '@/lib/read-body';
import { attachmentToText } from '@/lib/document-text';
import { ATTACHMENT_TEXT_PER_FILE } from '@/lib/chat-attachments-server';
import { BENCHMARK_LIMITS, classifyMaterial } from '@/lib/benchmark-analysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 对标拆解：把编导上传的文档（TXT、Word、Excel、PPT、CSV）转成文字。
 * 只返回文字，不存原文件；文字在分析时直接放进提示词。
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const form = await readFormBody(req, guard.userId).catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: '没收到文档' }, { status: 400 });
  if (file.size > BENCHMARK_LIMITS.documentBytes) return NextResponse.json({ error: '文档超过 10MB，请拆小一点再传' }, { status: 400 });
  if (classifyMaterial(file.name, file.type) !== 'document') {
    return NextResponse.json({ error: '这个文件不是文档，请用 TXT、Word、Excel、PPT 或 CSV' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const text = attachmentToText(file.name, buf);
  if (text === null || !text.trim()) {
    return NextResponse.json({ error: `「${file.name}」读不出文字，可以截图上传，或者把内容复制粘贴进来` }, { status: 422 });
  }
  const clipped = text.slice(0, ATTACHMENT_TEXT_PER_FILE);
  return NextResponse.json({ name: file.name, text: clipped, chars: clipped.length, clipped: text.length > clipped.length });
}
