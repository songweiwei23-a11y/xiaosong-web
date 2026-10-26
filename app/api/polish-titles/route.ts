import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { askDify } from '@/lib/dify-task';
import { polishTitles } from '@/lib/title-polish';
import { polishReality } from '@/lib/reality-check';
import { dedupeTitles } from '@/lib/title-dedupe';

/**
 * 标题后处理（2026-10-25）：生成完的正文里如果有「别只…」这类万能模板标题，
 * 只让模型重写那几条，其余一字不动。页面生成完调它，拿回修好的正文再显示。
 */

/** 正文长度上限，防止把整篇长稿都发过来 */
const MAX_TEXT_CHARS = 20_000;

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text : '';
  const context = typeof body.context === 'string' ? body.context.slice(0, 500) : '';
  if (!text.trim() || text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: '内容为空或太长' }, { status: 400 });
  }
  const ask = async (prompt: string): Promise<string | null> => {
    try {
      const r = await askDify(prompt, userId, '', { signal: AbortSignal.timeout(60_000) });
      return r.ok ? r.text : null;
    } catch {
      return null;
    }
  };
  const titles = await polishTitles(text, ask, context);
  // 标题改完再查现实：「收腰就能换风格」这类说法，只改那一句
  const reality = await polishReality(titles.text, ask, context);
  // 重复的标题（选题之间撞题）：第二次及以后出现的那一行只重写它，并避开已有标题
  const dedupe = await dedupeTitles(reality.text, ask, context);
  return NextResponse.json({
    text: dedupe.text,
    tried: titles.tried + reality.tried + dedupe.tried,
    accepted: titles.accepted + reality.accepted + dedupe.accepted,
  });
}
