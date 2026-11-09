import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/read-body';
import { createRateLimiter } from '@/lib/rate-limit';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';
import { loadDoneList } from '@/lib/work-insight-load';
import { buildDupPrompt, DUP_TITLES_MAX, parseDupJson } from '@/lib/topic-dup';

export const dynamic = 'force-dynamic';

/**
 * 选题查重（lib/topic-dup）：POST {profileId, titles} → 和这个档案已拍、已发的作品比，返回像的那几条。
 * 选题定稿后页面调一次；不扣次数（和复盘一样算系统服务），每个账号 10 分钟最多 30 次。
 * 判不了（模型没配、超时、没按格式）就返回空，页面什么都不标，不挡任何事。
 */
const limit = createRateLimiter(10 * 60_000, 30);
const TIMEOUT_MS = 40_000;

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, userId); } catch { return NextResponse.json({ hits: [] }); }
  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  const titles = (Array.isArray(body.titles) ? body.titles : []).filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim().slice(0, 120)).slice(0, DUP_TITLES_MAX);
  if (!profileId || !titles.length) return NextResponse.json({ hits: [] });
  const { data: owned } = await getServiceSupabase().from('user_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle();
  if (!owned) return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });
  if (limit(userId)) return NextResponse.json({ hits: [], skipped: 'rate' });

  const done = await loadDoneList(userId, profileId);
  const cfg = readAssistantConfig();
  if (!done.length || !cfg) return NextResponse.json({ hits: [], checked: done.length });
  try {
    const prompt = buildDupPrompt(titles, done);
    const res = await callAssistantLlm(cfg, { system: prompt.system, messages: [{ role: 'user', content: prompt.user }], tools: [], maxTokens: 800 }, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = res.content.filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('');
    return NextResponse.json({ hits: parseDupJson(text, titles, done), checked: done.length });
  } catch {
    return NextResponse.json({ hits: [], checked: done.length, skipped: 'model' });
  }
}
