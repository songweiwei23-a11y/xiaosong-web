import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { askDify, sseTask } from '@/lib/dify-task';
import { normalizeSource } from '@/lib/document-text';
import { PROFILE_FIELDS } from '@/lib/profile-fields';
import {
  buildRevisionPrompt,
  parseRevision,
  scrubSensitive,
  MAX_INSTRUCTION_CHARS,
  MAX_SOURCE_CHARS,
  type Revision,
  type RevisionInput,
} from '@/lib/interview-import';

export const runtime = 'nodejs';
export const maxDuration = 180;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/*
 * 同一个人一小时最多改 20 次（内存里记）。
 *
 * 不扣「前采建档」的次数：改的是已经花过一次提取出来的结果，
 * 提取错了还要再花次数去改，等于为 AI 的错买单。
 * 但它每次也是一次真实的模型调用，不能不设上限——一小时 20 次对改一份档案绰绰有余。
 * 另外它只会回档案字段（服务端按档案字段清洗过），拿来当免费聊天机器人也用不了。
 */
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { n: number; since: number }>();

function limited(userId: string): boolean {
  const now = Date.now();
  const h = hits.get(userId);
  if (!h || now - h.since > WINDOW_MS) {
    hits.set(userId, { n: 1, since: now });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.since > WINDOW_MS) hits.delete(k);
    return false;
  }
  h.n += 1;
  return h.n > MAX_PER_WINDOW;
}

const FIELD_KEYS = new Set<string>(PROFILE_FIELDS.map((f) => f.key));

/**
 * 前采建档确认页的"跟 AI 说哪里不对"：编导一句话，AI 改对应的几项。
 * 只回改动（set / remove / highlights / profileName），怎么合进确认页由页面做。
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;

  const body = await req.json().catch(() => null);
  const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
  if (!instruction) return json({ error: '先说说哪里不对' }, 400);
  if (instruction.length > MAX_INSTRUCTION_CHARS) return json({ error: `一次说 ${MAX_INSTRUCTION_CHARS} 字以内，分几次说` }, 400);

  const source = normalizeSource(typeof body?.source === 'string' ? body.source : '').slice(0, MAX_SOURCE_CHARS);

  // 现在的结果：只收档案字段，值一律转成短字符串 / 字符串数组
  const fields: RevisionInput['fields'] = {};
  const rawFields = body?.fields && typeof body.fields === 'object' ? (body.fields as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(rawFields)) {
    if (!FIELD_KEYS.has(k)) continue;
    if (Array.isArray(v)) fields[k as keyof typeof fields] = v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 20);
    else if (typeof v === 'string') fields[k as keyof typeof fields] = v.slice(0, 300);
  }
  const highlights = Array.isArray(body?.highlights)
    ? body.highlights.filter((x: unknown): x is string => typeof x === 'string').map((x: string) => x.slice(0, 150)).slice(0, 12)
    : [];
  const profileName = typeof body?.profileName === 'string' ? body.profileName.slice(0, 30) : '';

  if (limited(userId)) return json({ error: '改得太频繁了，歇一会儿再来（一小时最多 20 次）' }, 429);

  const query = buildRevisionPrompt({ fields, highlights, profileName, instruction: scrubSensitive(instruction) }, source);

  return sseTask(async () => {
    let result: Revision | null = null;
    let lastError = '';
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const answer = await askDify(query, userId, '前采 账号档案 修改');
      if (!answer.ok) {
        lastError = answer.message;
        break;
      }
      try {
        result = parseRevision(answer.text, source);
      } catch (e) {
        lastError = '这次没改成，换个说法再试';
        console.warn(`[interview-revise] 第 ${attempt + 1} 次解析失败:`, (e as Error).message, answer.text.slice(0, 200));
      }
    }
    if (!result) return { event: 'error', message: lastError || '这次没改成，换个说法再试' };
    console.log(`[interview-revise] ${userId} 改了 ${result.set.length} 项、清空 ${result.remove.length} 项`);
    return { event: 'result', revision: result };
  }, 'interview-revise');
}
