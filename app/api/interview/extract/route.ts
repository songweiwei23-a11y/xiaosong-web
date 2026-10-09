import { NextRequest } from 'next/server';
import { reserveCreation, releaseCreation, recordCreationCompletion, type CreationCompletion } from '@/lib/creation-quota';
import { requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard';
import { askDify, sseTask } from '@/lib/dify-task';
import { recordImport, UUID_RE } from '@/lib/interview-history';
import { documentToText, normalizeSource, UnsupportedDocument, MAX_UPLOAD_BYTES } from '@/lib/document-text';
import {
  applyCheck,
  buildCheckPrompt,
  buildExtractionPrompt,
  parseExtraction,
  INTERVIEW_TASK_TYPE,
  MAX_SOURCE_CHARS,
  MIN_SOURCE_CHARS,
  type Extraction,
} from '@/lib/interview-import';
import { readJsonBody, readFormBody } from '@/lib/read-body';

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

  // ---- 取原文（顺带取"写进哪个档案"，存进历史，回来接着做时默认还是它）
  let source = '';
  let targetProfileId: string | null = null;
  try {
    const type = req.headers.get('content-type') || '';
    // 分段传来的表单（lib/safe-upload）带 X-Body-Content-Type；文字请求分块（lib/safe-post）不带，走下面 JSON
    if (type.includes('multipart/form-data') || req.headers.get('x-body-content-type')) {
      // 线路差时浏览器分段传来（lib/safe-upload），这里拼回原表单
    const form = await readFormBody(req, userId);
      const file = form.get('file');
      const text = form.get('text');
      const target = form.get('profileId');
      if (typeof target === 'string' && UUID_RE.test(target)) targetProfileId = target;
      if (file && typeof file !== 'string') {
        if (file.size > MAX_UPLOAD_BYTES) return json({ error: '文件太大了（超过 10MB），请只保留文字部分' }, 400);
        source = documentToText(file.name, Buffer.from(await file.arrayBuffer()));
      } else if (typeof text === 'string') {
        source = text;
      }
    } else {
      const body = await readJsonBody(req).catch(() => ({}));
      source = typeof body?.text === 'string' ? body.text : '';
      if (typeof body?.profileId === 'string' && UUID_RE.test(body.profileId)) targetProfileId = body.profileId;
      /*
       * 文件也可以编码进 JSON 发来（2026-10-02）：Word 文档几十上百 KB，直接上传在用户线路差时会被切断
       * （超过约 8KB 的请求，见 lib/safe-post）。前端把文件转成 base64，走压缩 / 分块通道
       */
      if (typeof body?.fileBase64 === 'string' && typeof body?.fileName === 'string') {
        const buf = Buffer.from(body.fileBase64, 'base64');
        if (buf.length > MAX_UPLOAD_BYTES) return json({ error: '文件太大了（超过 10MB），请只保留文字部分' }, 400);
        source = documentToText(body.fileName, buf);
      }
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
  const reserved = await reserveCreation(userId, 'interview', req, { source, targetProfileId });
  if (!reserved.ok) return reserved.response;
  const reservation = reserved.reservation;
  let generationCompleted = false;

  const response = sseTask(async () => {
    try {
    // 模型偶尔不守格式：解析不了就再来一次，两次都不行才报错
    let result: Extraction | null = null;
    let lastError = '';
    let extractionCompletion: Omit<CreationCompletion, 'result'> | undefined;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const answer = await askDify(query, userId, '前采 账号档案');
      if (!answer.ok) {
        lastError = answer.message;
        break;
      }
      try {
        result = parseExtraction(answer.text, source);
        extractionCompletion = answer.completion;
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

    // 逐项核对：再让模型当一遍严格的核对员（见 buildCheckPrompt）。
    // 核对没跑成不耽误结果——页面上照旧按"依据对不对得上"标需核对，只是少了这一层
    const check = await askDify(buildCheckPrompt(result, source), userId, '前采 账号档案 核对');
    if (check.ok) {
      try {
        result = applyCheck(result, check.text);
      } catch (e) {
        console.warn('[interview] 核对结果解析失败，不带核对给结果:', (e as Error).message);
      }
    } else {
      console.warn('[interview] 核对没跑成，不带核对给结果:', check.message);
    }
    generationCompleted = true;
    try {
      await recordCreationCompletion(reservation, { ...extractionCompletion, result: JSON.stringify(result), terminal: 'structured_result', usage: { extraction: extractionCompletion?.usage ?? {}, verification: check.ok ? check.completion?.usage ?? {} : {} } }, INTERVIEW_TASK_TYPE);
      await incrementUsageServer(userId, 'interview', INTERVIEW_TASK_TYPE, {
      profileName: result.profileName,
      chars: source.length,
      fields: result.fields.length,
    }, reservation); } catch { console.warn('[interview] generated result awaiting quota sync'); }
    // 存进历史。浏览器那头就算已经切走了，这一步照样会跑完（sseTask 往外写失败不中断任务），
    // 回来在历史记录里点开就能接着核对——花了的次数不白花
    const importId = await recordImport({ userId, source, extraction: result, targetProfileId, profileName: result.profileName });
    return { event: 'result', extraction: result, source, importId };
    } finally { if (!generationCompleted) await releaseCreation(reservation); }
  }, 'interview');
  response.headers.set('X-Generation-Id', reservation.requestId);
  return response;
}
