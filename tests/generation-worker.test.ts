import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runGenerationWork, scanGenerationWork, type GenerationWork } from '@/lib/generation-worker';
import type { ProcessingInput } from '@/lib/generation-processing';

const mocks = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  process: vi.fn(),
  version: vi.fn(),
  record: vi.fn(),
  settle: vi.fn(),
  release: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      expect(table).toBe('generation_tasks');
      let matches = mocks.rows.slice();
      let patch: Record<string, unknown> | undefined;
      const read = () => {
        if (patch) matches.forEach(row => Object.assign(row, structuredClone(patch)));
        return { data: structuredClone(matches), error: null };
      };
      const query = {
        select: () => query,
        update: (next: Record<string, unknown>) => { patch = next; return query; },
        eq: (key: string, value: unknown) => { matches = matches.filter(row => row[key] === value); return query; },
        is: (key: string, value: null) => query.eq(key, value),
        not: (key: string, _operator: string, value: null) => {
          matches = matches.filter(row => row[key] !== value);
          return query;
        },
        lt: (key: string, value: string) => { matches = matches.filter(row => String(row[key]) < value); return query; },
        order: () => query,
        limit: (size: number) => { matches = matches.slice(0, size); return query; },
        maybeSingle: async () => ({ data: read().data[0] ?? null, error: null }),
        then: (resolve: (value: ReturnType<typeof read>) => unknown) => Promise.resolve(read()).then(resolve),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/generation-processing', () => ({ processGeneration: mocks.process }));
vi.mock('@/lib/generation-task', () => ({ saveGenerationVersion: mocks.version }));
vi.mock('@/lib/creation-quota', () => ({
  recordCreationCompletion: mocks.record, settleCreation: mocks.settle, releaseCreation: mocks.release,
}));
vi.mock('@/lib/generation-slots', () => ({
  slotOptionsFromEnv: () => ({}), acquireSlot: async () => () => {},
}));
vi.mock('@/lib/learning-signals', () => ({ recordGenerationSignal: async () => {} }));

function job(stage = 'worker_ready', runToken: string | null = null, nextStep = 0) {
  const work: GenerationWork = {
    input: { userId: 'qa-user', profileId: 'qa-profile', body: { taskType: '内容规划' }, rawResponse: '草稿', creativeWindow: false } as ProcessingInput,
    state: {
      fullResponse: '草稿', capturedConversationId: 'c1', capturedMessageId: 'm1', completionTerminal: 'message_end',
      usageMetadata: {}, outcome: { kind: 'done' }, nextStep,
    },
    reservation: { userId: 'qa-user', requestId: 'qa-request', feature: 'direction' },
    telemetry: {}, timings: [],
  };
  const row = {
    id: 'qa-task', user_id: 'qa-user', request_id: 'qa-request', feature: 'direction',
    status: 'post_processing', stage, run_token: runToken, retry_count: 0,
    heartbeat_at: '2000-01-01T00:00:00.000Z', payload: { work },
  };
  mocks.rows.push(row);
  return row;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rows.length = 0;
  mocks.process.mockImplementation(async (_input, state) => ({ ...state, fullResponse: '最终正文' }));
  mocks.version.mockResolvedValue(2);
});

describe('后台生成任务恢复', () => {
  it('并发领取同一任务只执行一次、保存一份最终版并结算一次', async () => {
    const row = job();
    await Promise.all([runGenerationWork(row.id), runGenerationWork(row.id)]);
    await runGenerationWork(row.id);
    expect(row).toMatchObject({ status: 'completed', stage: 'final_save', run_token: null, payload: {} });
    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(mocks.version).toHaveBeenCalledTimes(1);
    expect(mocks.version).toHaveBeenCalledWith(expect.objectContaining({ kind: 'final', result: '最终正文' }));
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.settle).toHaveBeenCalledTimes(1);
  });

  it('租约超时后从已落盘的下一阶段继续', async () => {
    const row = job('worker_checkpoint', 'old-token', 4);
    await scanGenerationWork();
    expect(mocks.process).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ nextStep: 4 }), expect.any(Function), expect.any(Function), expect.any(Function));
    expect(row).toMatchObject({ status: 'completed', retry_count: 1 });
    expect(mocks.settle).toHaveBeenCalledTimes(1);
  });

  it('不重放已开始但结果未知的模型步骤', async () => {
    const row = job('running_fact_check', 'old-token', 4);
    await scanGenerationWork();
    expect(row).toMatchObject({ status: 'recoverable_failed', error_code: 'STAGE_INTERRUPTED' });
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });

  it('后处理审核失败保留草稿，释放预占且不结算', async () => {
    const row = job();
    mocks.process.mockImplementationOnce(async (_input, state) => ({ ...state, outcome: { kind: 'error', message: '审核未完成' } }));
    await runGenerationWork(row.id);
    expect(row).toMatchObject({ status: 'partial_saved', error_message: '审核未完成' });
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.version).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});
