import { NextRequest } from 'next/server';
import { requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard';
import { askDify, sseTask } from '@/lib/dify-task';
import { documentToText, normalizeSource, UnsupportedDocument, MAX_UPLOAD_BYTES } from '@/lib/document-text';
import {
  buildExtractionPrompt,
  parseExtraction,
  INTERVIEW_TASK_TYPE,
  MAX_SOURCE_CHARS,
  MIN_SOURCE_CHARS,
  type Extraction,
} from '@/lib/interview-import';

export const runtime = 'nodejs';
export const maxDuration = 180;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * 前采建档：收一段前采记录（粘贴的文字或上传的 .docx/.txt），让模型提取成档案字段。
 *
 * 只提取、不写库——写进哪个档案、哪几项要、冲突怎么取舍，都由用户在确认页定，
 * 确认后走 /api/interview/save。
 *
 * 实测一次 40 秒上下，所以用 SSE 回（带心跳，见 lib/dify-task 的 sseTask）。
 * 不接共用会话：askDify 不带 conversation_id。
 */
export async function POST(req: NextRequest) {
  const guard = await requireUserWithQuota('interview');
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;

  // ---- 取原文
  let source = '';
  try {
    const type = req.headers.get('content-type') || '';
    if (type.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const text = form.get('text');
      if (file && typeof file !== 'string') {
        if (file.size > MAX_UPLOAD_BYTES) return json({ error: '文件太大了（超过 10MB），请只保留文字部分' }, 400);
        source = documentToText(file.name, Buffer.from(await file.arrayBuffer()));
      } else if (typeof text === 'string') {
        source = text;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      source = typeof body?.text === 'string' ? body.text : '';
    }
  } catch (e) {
    if (e instanceof UnsupportedDocument) return json({ error: e.message }, 400);
    console.error('[interview] 读取前采资料失败:', e);
    return json({ error: '文件读不出来，请直接复制文字粘贴进来' }, 400);
  }

  source = normalizeSource(source);
  if (source.length < MIN_SOURCE_CHARS) return json({ error: '内容太少了，贴一段完整的前采记录再试' }, 400);
  if (source.length > MAX_SOURCE_CHARS) {
    return json({ error: `内容太长（${source.length} 字，上限 ${MAX_SOURCE_CHARS} 字）：删掉寒暄和无关的部分再试` }, 400);
  }

  const query = buildExtractionPrompt(source);

  return sseTask(async () => {
    // 模型偶尔不守格式：解析不了就再来一次，两次都不行才报错
    let result: Extraction | null = null;
    let lastError = '';
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const answer = await askDify(query, userId, '前采 账号档案');
      if (!answer.ok) {
        lastError = answer.message;
        break;
      }
      try {
        result = parseExtraction(answer.text, source);
      } catch (e) {
        lastError = '这次没读出结果，请重试';
        console.warn(`[interview] 第 ${attempt + 1} 次解析失败:`, (e as Error).message, answer.text.slice(0, 200));
      }
    }

    if (!result) return { event: 'error', message: lastError || '这次没读出结果，请重试' };
    if (result.fields.length === 0) {
      // 一项都没提取出来，多半贴的不是前采记录。不扣次数
      return { event: 'error', message: '没从这段内容里找到客户的信息。确认贴的是前采记录（问答、聊天记录或录音转写）再试' };
    }
    await incrementUsageServer(userId, 'interview', INTERVIEW_TASK_TYPE, {
      profileName: result.profileName,
      chars: source.length,
      fields: result.fields.length,
    });
    return { event: 'result', extraction: result, source };
  }, 'interview');
}
