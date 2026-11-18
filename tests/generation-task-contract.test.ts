import { describe, expect, it, vi } from 'vitest';
import { generationInputHash, taskIsRecoverable } from '@/lib/generation-task';
import { readCode } from './helpers/source';

describe('统一生成任务契约', () => {
  it('输入指纹稳定，状态只把可恢复的中间态标为可恢复', () => {
    expect(generationInputHash({ a: 1, b: 'x' })).toBe(generationInputHash({ a: 1, b: 'x' }));
    for (const state of ['queued', 'generating', 'post_processing', 'partial_saved', 'recoverable_failed'] as const) expect(taskIsRecoverable(state)).toBe(true);
    for (const state of ['accepted', 'draft_saved', 'completed', 'permanent_failed', 'canceled'] as const) expect(taskIsRecoverable(state)).toBe(false);
  });

  it('迁移把请求、任务和版本绑定，并约束终态和版本类别', () => {
    const sql = readCode('supabase/migrations/20261118_generation_tasks.sql');
    for (const token of ['generation_tasks', 'generation_result_versions', 'UNIQUE(user_id, request_id)', "'draft','processed','final'", 'kaiwu_create_generation_task', 'kaiwu_claim_generation_task']) expect(sql).toContain(token);
  });

  it('流式接口先创建任务，草稿和最终稿都记录版本，失败保持可恢复草稿', () => {
    const route = readCode('app/api/dify/stream/route.ts');
    expect(route.indexOf('ensureGenerationTask')).toBeGreaterThan(route.indexOf('reserveCreation'));
    expect(route).toContain("event: 'task_accepted'");
    expect(route).toContain("kind: 'draft'");
    expect(route).toContain("kind: 'final'");
    expect(route).toContain("status: 'partial_saved'");
    expect(route).toContain("status: 'completed'");
  });

  it('陈旧任务恢复只标记可恢复状态，不重放模型或重新结算额度', () => {
    const runner = readCode('lib/generation-task-runner.ts');
    const instrumentation = readCode('instrumentation.ts');
    expect(runner).toContain("status: 'recoverable_failed'");
    expect(runner).not.toContain('askDify');
    expect(runner).not.toContain('incrementUsageServer');
    expect(instrumentation).toContain('startGenerationTaskRecovery()');
  });

  it('任务恢复接口按用户隔离并返回最新版本', () => {
    const route = readCode('app/api/generation-tasks/[id]/route.ts');
    expect(route).toContain('requireUser');
    expect(route).toContain('readGenerationTask(guard.userId!, id)');
    expect(route).toContain("Cache-Control': 'private, no-store'");
  });

  it('草稿状态不能进入选题长期避重清单', () => {
    const topics = readCode('lib/topic-library-server.ts');
    expect(topics).toContain("input_data->>_kaiwuStatus.eq.completed");
  });
});
