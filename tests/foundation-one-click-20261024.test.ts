// 地基一键生成（2026-10-24，方案 B）：两条线并行、缺的才生成、简报等定位、额度不够不启动。
import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_TYPES,
  boardFor,
  createFoundation,
  getFoundation,
  missingKeys,
  quotaVerdict,
  runFoundation,
  runningFoundation,
  type FoundationDeps,
} from '@/lib/foundation-job';
import type { BoardAny } from '@/lib/assistant/board-dispatch';
import type { BoardResult } from '@/lib/assistant/boards';

const ADVICE = { purpose: 'staged', stage: 'start' };
const ok = (text: string): BoardResult => ({ ok: true, text, full: text });
const fail = (error: string): BoardResult => ({ ok: false, text: '', error });

/** 记录调用顺序的假依赖。handlers 决定每个板块怎么回 */
function fakeDeps(opts: {
  existing?: string[];
  handlers?: Partial<Record<BoardAny['kind'], () => Promise<BoardResult> | BoardResult>>;
  saveFails?: string[];
}) {
  const calls: string[] = [];
  const saved: { type: string; text: string }[] = [];
  const deps: FoundationDeps = {
    existingTypes: opts.existing ?? [],
    runBoard: async (board) => {
      calls.push(board.kind);
      const handler = opts.handlers?.[board.kind];
      return handler ? await handler() : ok(`${board.kind} 的内容`);
    },
    save: async (key, text) => {
      if (opts.saveFails?.includes(key)) throw new Error('写库失败');
      saved.push({ type: FOUNDATION_TYPES[key], text });
    },
  };
  return { deps, calls, saved };
}

function jobFor(keys: Parameters<typeof createFoundation>[2]) {
  return createFoundation('u-test', 'p-test', keys);
}

describe('地基一键生成：要生成哪些', () => {
  it('缺哪些生成哪些：三项都没有就三项都生成', () => {
    expect(missingKeys([])).toEqual(['positioning', 'brief', 'advice']);
  });

  it('已有的不重复生成', () => {
    expect(missingKeys(['账号定位', '创作简报'])).toEqual(['advice']);
    expect(missingKeys(['账号定位', '创作简报', '行业建议'])).toEqual([]);
  });

  it('板块的输入：行业建议带上目的和阶段', () => {
    expect(boardFor('advice', ADVICE)).toMatchObject({ kind: 'advice', input: { purpose: 'staged', stage: 'start' } });
    expect(boardFor('brief', ADVICE).kind).toBe('brief');
  });
});

describe('地基一键生成：额度', () => {
  it('不限量或够用就放行', () => {
    expect(quotaVerdict(3, -1)).toEqual({ ok: true });
    expect(quotaVerdict(3, 3)).toEqual({ ok: true });
    expect(quotaVerdict(0, 0)).toEqual({ ok: true });
  });

  it('不够就拒绝，并说清楚要几次、还剩几次', () => {
    const v = quotaVerdict(3, 1);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toContain('这次要用 3 次，只剩 1 次');
  });

  it('额度读不到不放行（不猜）', () => {
    expect(quotaVerdict(3, null).ok).toBe(false);
  });
});

describe('地基一键生成：运行顺序', () => {
  it('三项都缺：全部生成、全部写库，任务完成', async () => {
    const job = jobFor(['positioning', 'brief', 'advice']);
    const { deps, calls, saved } = fakeDeps({});
    await runFoundation(job, deps, ADVICE);
    expect(job.status).toBe('done');
    expect(calls.sort()).toEqual(['advice', 'brief', 'positioning']);
    expect(saved.map((s) => s.type).sort()).toEqual(['创作简报', '行业建议', '账号定位']);
  });

  it('简报一定排在定位之后（简报要读得到定位）', async () => {
    const job = jobFor(['positioning', 'brief']);
    const order: string[] = [];
    const { deps } = fakeDeps({
      handlers: {
        positioning: async () => { order.push('positioning-start'); await new Promise((r) => setTimeout(r, 5)); order.push('positioning-end'); return ok('定位'); },
        brief: () => { order.push('brief-start'); return ok('简报'); },
      },
    });
    await runFoundation(job, deps, ADVICE);
    expect(order).toEqual(['positioning-start', 'positioning-end', 'brief-start']);
  });

  it('行业建议和定位并行：定位还没结束，行业建议已经开始', async () => {
    const job = jobFor(['positioning', 'advice']);
    let adviceStartedBeforePositioningEnded = false;
    let positioningDone = false;
    const { deps } = fakeDeps({
      handlers: {
        positioning: async () => { await new Promise((r) => setTimeout(r, 20)); positioningDone = true; return ok('定位'); },
        advice: () => { adviceStartedBeforePositioningEnded = !positioningDone; return ok('建议'); },
      },
    });
    await runFoundation(job, deps, ADVICE);
    expect(adviceStartedBeforePositioningEnded).toBe(true);
    expect(job.status).toBe('done');
  });

  it('已有的定位：跳过定位，直接生成简报', async () => {
    const job = jobFor(['brief']);
    const { deps, calls } = fakeDeps({ existing: ['账号定位'] });
    await runFoundation(job, deps, ADVICE);
    expect(calls).toEqual(['brief']);
    expect(job.steps.find((s) => s.key === 'positioning')?.status).toBe('skipped');
    expect(job.status).toBe('done');
  });
});

describe('地基一键生成：失败的影响范围', () => {
  it('定位没完成：简报不硬跑，标成需要先有定位；行业建议照常完成；任务部分完成', async () => {
    const job = jobFor(['positioning', 'brief', 'advice']);
    const { deps, calls } = fakeDeps({ handlers: { positioning: () => fail('模型超时') } });
    await runFoundation(job, deps, ADVICE);
    expect(calls).not.toContain('brief');
    expect(job.steps.find((s) => s.key === 'positioning')).toMatchObject({ status: 'error', error: '模型超时' });
    expect(job.steps.find((s) => s.key === 'brief')).toMatchObject({ status: 'error', error: '需要先有账号定位，定位没完成' });
    expect(job.steps.find((s) => s.key === 'advice')?.status).toBe('done');
    expect(job.status).toBe('partial');
  });

  it('写库失败算没完成，不会显示成完成', async () => {
    const job = jobFor(['advice']);
    const { deps } = fakeDeps({ saveFails: ['advice'] });
    await runFoundation(job, deps, ADVICE);
    expect(job.steps.find((s) => s.key === 'advice')).toMatchObject({ status: 'error', error: '写库失败' });
    expect(job.status).toBe('error');
  });

  it('空内容不算完成', async () => {
    const job = jobFor(['advice']);
    const { deps } = fakeDeps({ handlers: { advice: () => ok('   ') } });
    await runFoundation(job, deps, ADVICE);
    expect(job.status).toBe('error');
  });
});

describe('地基一键生成：任务存储', () => {
  it('同一个用户同一个档案，同一时间只有一次在跑', () => {
    const first = createFoundation('u-a', 'p-a', ['positioning']);
    expect(runningFoundation('u-a', 'p-a')?.id).toBe(first.id);
    expect(runningFoundation('u-a', 'p-b')).toBeNull();
    expect(runningFoundation('u-b', 'p-a')).toBeNull();
  });

  it('只能取自己的任务', () => {
    const job = createFoundation('u-owner', 'p-x', ['advice']);
    expect(getFoundation(job.id, 'u-owner')?.id).toBe(job.id);
    expect(getFoundation(job.id, 'u-other')).toBeNull();
  });

  it('已经有的项一开始就标成跳过', () => {
    const job = createFoundation('u-c', 'p-c', ['brief']);
    expect(job.steps.map((s) => [s.key, s.status])).toEqual([
      ['positioning', 'skipped'],
      ['brief', 'waiting'],
      ['advice', 'skipped'],
    ]);
  });
});
