import { requireUserWithQuota } from '@/lib/api-guard';
import { readJsonBody } from '@/lib/read-body';
import { askDify, sseTask } from '@/lib/dify-task';
import { cleanRewriteOutput } from '@/lib/canvas';
import { createRateLimiter } from '@/lib/rate-limit';
import { FACT_FIX_MAX_CHARS, FACT_FIX_CONTEXT_MAX_CHARS, buildFactFixPrompt, fixTooBig } from '@/lib/fact-fix';
import { unsupportedFacts } from '@/lib/quality-checks';
import { createHash } from 'node:crypto';

/*
 * 「按资料修正」（2026-10-05 质量整改，lib/fact-fix）：只改结果里没有出处的那几句。
 * 修的是系统自己写出来的问题，不扣用户的次数。每次修正要调一次模型（约 0.5 元），算进了会员成本（docs/开物质量深度研究_20261005/成本与定价测算_20261005.md），
 * 所以要封顶：刚生成完的自动修正每人每天 20 次（它的平均成本已经算进每个创作点里）；
 * 用户手动点的每天 5 次、每 30 天 10 次（成本测算里单独预留了这 10 次）。
 */
export const dynamic = 'force-dynamic';
const autoDay = createRateLimiter(24 * 3600_000, 20);
const manualDay = createRateLimiter(24 * 3600_000, 5);
const manualMonth = createRateLimiter(30 * 24 * 3600_000, 10);
/** 已经自动修正过的稿子（用户 + 正文指纹），一天后清掉 */
const autoFixed = new Map<string, number>();

export async function POST(request: Request) {
  const guard = await requireUserWithQuota();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, userId); } catch { return Response.json({ error: '请求格式不正确' }, { status: 400 }); }
  const text = typeof body.text === 'string' ? body.text : '';
  const issues = (Array.isArray(body.issues) ? body.issues : []).filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 8).map((x) => x.slice(0, 200));
  if (!text.trim() || text.length > FACT_FIX_MAX_CHARS) return Response.json({ error: '稿子是空的或太长了' }, { status: 400 });
  if (!issues.length) return Response.json({ error: '没有要修正的地方' }, { status: 400 });
  const auto = body.auto === true;
  const context = typeof body.context === 'string' ? body.context.slice(0, FACT_FIX_CONTEXT_MAX_CHARS) : '';
  /*
   * 自动通道的资格由服务端核（2026-10-07 体检 C03）：原来「自动」还是「手动」浏览器说了算，
   * 谁都能拿自动通道的 20 次额度去改任意文字。现在：
   *   1. 服务端自己再查一遍，这份稿子确实有「资料里找不到出处」的说法才给自动修
   *   2. 同一份稿子只自动修一次（重复发同一份不再算新的自动修正）
   */
  if (auto) {
    const light = body.taskType === '自由对话';
    const found = unsupportedFacts(text, context, { light });
    const key = `${userId}:${createHash('sha1').update(text).digest('hex')}`;
    if (!found.length && !issues.some((i) => i.startsWith('年限'))) return Response.json({ error: '服务端没查到需要自动修正的地方' }, { status: 400 });
    if (autoFixed.has(key)) return Response.json({ error: '这份稿子已经自动修正过一次了，剩下的请你核对' }, { status: 409 });
    autoFixed.set(key, Date.now());
    for (const [k, at] of autoFixed) if (Date.now() - at > 24 * 3600_000) autoFixed.delete(k);
  }
  if (auto ? autoDay(userId) : manualDay(userId) || manualMonth(userId)) return Response.json({ error: auto ? '今天自动修正的次数用完了，下面这几处请你核对' : '手动修正每月最多 10 次（今天最多 5 次），已经用完了；可以在画布里手动改' }, { status: 429 });
  console.log(`[fact-fix] ${auto ? '自动' : '手动'} user=${userId.slice(0, 8)} issues=${issues.length}`);

  return sseTask(async () => {
    const ans = await askDify(buildFactFixPrompt({ text, issues, context }), userId, '');
    if (!ans.ok) return { event: 'error', message: ans.message };
    const fixed = cleanRewriteOutput(ans.text);
    if (!fixed) return { event: 'error', message: '这次没改出内容，请重试' };
    if (fixTooBig(text, fixed, issues)) return { event: 'error', message: '这次改动太大（不止那几句），没有采用，请重试或在画布里手动改' };
    return { event: 'result', text: fixed };
  }, 'fact-fix');
}
