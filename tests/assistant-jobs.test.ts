/**
 * 助理的后台任务（lib/assistant/jobs.ts）：只能看自己的、一人一条在跑、增量进度、停止、过期清理。
 */
import { describe, it, expect } from 'vitest';
import { createJob, eventsSince, finishJob, getJob, hasRunningJob, pushEvent, requestStop } from '@/lib/assistant/jobs';

const T0 = Date.parse('2026-10-20T04:00:00Z');
const MIN = 60_000;

describe('一个人同一时间只能有一条在跑', () => {
  it('在跑时再提交：能看到有任务在跑；结束后就可以再提交', () => {
    const u = 'user-one-running';
    const job = createJob(u, T0);
    expect(hasRunningJob(u)).toBe(true);
    finishJob(job, 'done', '好', T0 + MIN);
    expect(hasRunningJob(u)).toBe(false);
  });

  it('别人的任务不影响自己', () => {
    const a = createJob('user-a-only', T0);
    expect(hasRunningJob('user-b-only')).toBe(false);
    finishJob(a, 'done', '', T0);
  });
});

describe('只能看自己的任务', () => {
  it('别人拿着任务号也取不到', () => {
    const job = createJob('owner-x', T0);
    expect(getJob(job.id, 'owner-x')).not.toBeNull();
    expect(getJob(job.id, 'someone-else')).toBeNull();
    expect(getJob('no-such-id', 'owner-x')).toBeNull();
    finishJob(job, 'done', '', T0);
  });

  it('别人的任务不能停止', () => {
    const job = createJob('owner-y', T0);
    expect(requestStop(job.id, 'someone-else')).toBe(false);
    expect(job.stopRequested).toBe(false);
    expect(requestStop(job.id, 'owner-y')).toBe(true);
    expect(job.stopRequested).toBe(true);
    finishJob(job, 'stopped', '', T0);
  });

  it('已经结束的任务不能再停止', () => {
    const job = createJob('owner-z', T0);
    finishJob(job, 'done', '好', T0);
    expect(requestStop(job.id, 'owner-z')).toBe(false);
  });
});

describe('增量进度', () => {
  it('从第 N 条开始给出新的事件，界面只追加没见过的', () => {
    const job = createJob('owner-events', T0);
    pushEvent(job, { type: 'step', text: '第一步' });
    pushEvent(job, { type: 'step', text: '第二步' });
    const first = eventsSince(job, 0);
    expect(first.events).toHaveLength(2);
    expect(first.next).toBe(2);
    pushEvent(job, { type: 'step', text: '第三步' });
    const second = eventsSince(job, first.next);
    expect(second.events).toEqual([{ type: 'step', text: '第三步' }]);
    finishJob(job, 'done', '完成了', T0);
  });

  it('任务还在跑时，不把结果提前给出来', () => {
    const job = createJob('owner-partial', T0);
    job.answer = '半成品';
    expect(eventsSince(job, 0).answer).toBe('');
    expect(eventsSince(job, 0).status).toBe('running');
    finishJob(job, 'done', '最终结果', T0);
    expect(eventsSince(job, 0).answer).toBe('最终结果');
  });

  it('坏的 since 当成从头开始', () => {
    const job = createJob('owner-bad-since', T0);
    pushEvent(job, { type: 'step', text: 'a' });
    expect(eventsSince(job, Number.NaN).events).toHaveLength(1);
    expect(eventsSince(job, -5).events).toHaveLength(1);
    finishJob(job, 'done', '', T0);
  });
});

describe('过期清理', () => {
  it('结束超过 30 分钟的任务会被清掉，还在跑的不会', () => {
    const old = createJob('owner-old', T0);
    finishJob(old, 'done', '旧的', T0);
    const running = createJob('owner-running-long', T0);
    // 31 分钟后新建一个任务，会顺带清理过期的
    createJob('owner-fresh', T0 + 31 * MIN);
    expect(getJob(old.id, 'owner-old')).toBeNull();
    expect(getJob(running.id, 'owner-running-long')).not.toBeNull();
    finishJob(running, 'done', '', T0 + 31 * MIN);
  });
});
