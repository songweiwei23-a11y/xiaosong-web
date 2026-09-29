import { NextRequest } from 'next/server';
import { requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard';
import { difyEventError, friendlyDifyError } from '@/lib/dify-errors';
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

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * 前采建档：收一段前采记录（粘贴的文字或上传的 .docx/.txt），让模型提取成档案字段。
 *
 * 只提取、不写库——写进哪个档案、哪几项要、冲突怎么取舍，都由用户在确认页定，
 * 确认后走 /api/interview/save。
 *
 * 实测一次 40 秒上下，所以用 SSE 回：中间每 5 秒一个心跳，免得链路上哪一层
 * 见连接长时间没动静就掐掉；最后一条是结果或错误。
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (obj: Record<string, unknown>) => write(`data: ${JSON.stringify(obj)}\n\n`);
      const heartbeat = setInterval(() => write(': ping\n\n'), 5_000);

      try {
        // 模型偶尔不守格式：解析不了就再来一次，两次都不行才报错
        let result: Extraction | null = null;
        let lastError = '';
        for (let attempt = 0; attempt < 2 && !result; attempt++) {
          const answer = await askDify(query, userId);
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

        if (!result) {
          send({ event: 'error', message: lastError || '这次没读出结果，请重试' });
        } else if (result.fields.length === 0) {
          // 一项都没提取出来，多半贴的不是前采记录。不扣次数
          send({ event: 'error', message: '没从这段内容里找到客户的信息。确认贴的是前采记录（问答、聊天记录或录音转写）再试' });
        } else {
          await incrementUsageServer(userId, 'interview', INTERVIEW_TASK_TYPE, {
            profileName: result.profileName,
            chars: source.length,
            fields: result.fields.length,
          });
          send({ event: 'result', extraction: result, source });
        }
      } catch (e) {
        console.error('[interview] 提取失败:', e);
        send({ event: 'error', message: '和 AI 的连接断了，请重试' });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* 对面已经关了 */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * 调一次「开物」，把整段回复收齐。
 * 不带 conversation_id：提取和前后的创作没有关系，接进共用会话只会把会话撑满、
 * 还可能被上一轮的文案带偏。
 */
async function askDify(query: string, userId: string): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { query, search_query: '前采 账号档案', conversation_history: '', dealReasons: '' },
      query,
      response_mode: 'streaming',
      user: userId,
    }),
  });
  if (!res.ok || !res.body) {
    console.error('[interview] Dify 调用失败:', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return { ok: false, message: 'AI 服务暂时不可用，请稍后再试' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      const failure = difyEventError(data);
      if (failure) return { ok: false, message: friendlyDifyError(failure) };
      const chunk = (data.answer || data.text || '') as string;
      if ((data.event === 'message' || data.event === 'text_chunk') && chunk) text += chunk;
    }
  }
  return text ? { ok: true, text } : { ok: false, message: '这次没读出结果，请重试' };
}
