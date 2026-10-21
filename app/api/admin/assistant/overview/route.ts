import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { feedbackRowsSince, jobRowsSince, type JobStats, type StoredJobStatus } from '@/lib/assistant/job-store';

export const dynamic = 'force-dynamic';

/**
 * 助理概览（升级方案 J1，只读）：最近几天助理跑了多少次、成功率、用了多少 token、
 * 被核对改写的「没有回执的完成说法」次数（目标是 0）、知识库没写出资料名的次数、用户反馈的有用率。
 * 只统计存根里的数字，不含对话内容。
 */
export async function GET(request: Request) {
  const admin = await requireAdminPermission('view_usage');
  if (!admin) return NextResponse.json({ error: '需要用量查看权限' }, { status: 403 });

  const url = new URL(request.url);
  const days = Math.min(30, Math.max(1, Number.parseInt(url.searchParams.get('days') || '7', 10) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [jobs, feedback] = await Promise.all([jobRowsSince(since), feedbackRowsSince(since)]);

    const byStatus: Record<StoredJobStatus, number> = { running: 0, done: 0, error: 0, stopped: 0, interrupted: 0 };
    let calls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheRead = 0;
    let cacheWrite = 0;
    let cheap = 0;
    let rewrittenAnswers = 0;
    let rewrittenSentences = 0;
    let uncited = 0;
    let tools = 0;
    const models: Record<string, number> = {};
    for (const row of jobs) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      const s: JobStats = row.stats ?? {};
      calls += s.calls ?? 0;
      inputTokens += s.inputTokens ?? 0;
      outputTokens += s.outputTokens ?? 0;
      cacheRead += s.cacheRead ?? 0;
      cacheWrite += s.cacheWrite ?? 0;
      tools += s.tools ?? 0;
      if (s.cheap) cheap++;
      if ((s.rewritten ?? 0) > 0) {
        rewrittenAnswers++;
        rewrittenSentences += s.rewritten ?? 0;
      }
      if (s.uncited) uncited++;
      if (s.model) models[s.model] = (models[s.model] ?? 0) + 1;
    }
    const finished = byStatus.done + byStatus.error + byStatus.stopped + byStatus.interrupted;
    const helpful = feedback.filter((f) => f.helpful).length;

    return NextResponse.json({
      days,
      jobs: {
        total: jobs.length,
        byStatus,
        successRate: finished ? Math.round((byStatus.done / finished) * 1000) / 1000 : null,
        modelCalls: calls,
        toolCalls: tools,
        perDone: byStatus.done ? {
          inputTokens: Math.round(inputTokens / byStatus.done),
          outputTokens: Math.round(outputTokens / byStatus.done),
          calls: Math.round((calls / byStatus.done) * 10) / 10,
        } : null,
        tokens: { input: inputTokens, output: outputTokens, cacheRead, cacheWrite },
        cheapRouted: cheap,
        models,
      },
      // 目标是 0：回答里出现了完成说法，但本轮没有对应回执，被改写成「没有完成」的次数
      claimRewrites: { answers: rewrittenAnswers, sentences: rewrittenSentences },
      knowledge: { answersWithoutCitation: uncited },
      feedback: {
        total: feedback.length,
        helpful,
        helpfulRate: feedback.length ? Math.round((helpful / feedback.length) * 1000) / 1000 : null,
      },
    });
  } catch {
    return NextResponse.json({ error: '助理概览暂时读不出来（可能是数据表还没建好）' }, { status: 503 });
  }
}
