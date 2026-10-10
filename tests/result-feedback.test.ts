import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_REASONS, parseFeedback, summarizeFeedback } from '@/lib/result-feedback';

const state = {
  insertError: null as { message: string } | null,
  inserted: [] as Record<string, unknown>[],
};

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: 'user-1' }),
}));

vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        if (table !== 'result_feedback') throw new Error('unexpected table ' + table);
        if (state.insertError) return { error: state.insertError };
        state.inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

const { POST } = await import('@/app/api/feedback/route');

const post = (body: unknown) =>
  POST(new Request('https://example.test/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  state.insertError = null;
  state.inserted = [];
});

describe('结果反馈：输入校验', () => {
  it('有用：不带原因；没用：原因只认白名单', () => {
    expect(parseFeedback({ board: 'script', rating: 1, reason: '太空太套话' })).toEqual({ board: 'script', rating: 1, reason: null });
    expect(parseFeedback({ board: 'script', rating: -1, reason: '太空太套话' })).toEqual({ board: 'script', rating: -1, reason: '太空太套话' });
    expect(parseFeedback({ board: 'script', rating: -1, reason: '随便写的' })).toEqual({ board: 'script', rating: -1, reason: null });
  });

  it('评价只认 1 和 -1；板块名只认小写字母和连字符', () => {
    expect(parseFeedback({ board: 'script', rating: 0 })).toBeNull();
    expect(parseFeedback({ board: 'script', rating: '1' })).toBeNull();
    expect(parseFeedback({ board: 'Script; drop', rating: 1 })).toBeNull();
    expect(parseFeedback({ board: 'deal-reason', rating: 1 })?.board).toBe('deal-reason');
    expect(parseFeedback(null)).toBeNull();
  });

  it('原因白名单非空', () => {
    expect(FEEDBACK_REASONS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('结果反馈汇总', () => {
  it('有用占比、各板块好评差评、没用的原因按次数排', () => {
    const s = summarizeFeedback([
      { board: 'topic', rating: 1, reason: null },
      { board: 'topic', rating: -1, reason: '不对口' },
      { board: 'script', rating: -1, reason: '不对口' },
      { board: 'script', rating: -1, reason: null },
      { board: 'script', rating: 1, reason: null },
    ]);
    expect(s.total).toBe(5);
    expect(s.up).toBe(2);
    expect(s.down).toBe(3);
    expect(s.satisfaction).toBe(40);
    expect(s.byBoard[0]).toEqual({ board: 'script', up: 1, down: 2 });
    expect(s.reasons).toEqual([{ reason: '不对口', count: 2 }]);
  });

  it('没有数据时占比是 null，不算成 0%', () => {
    expect(summarizeFeedback([]).satisfaction).toBeNull();
  });
});

describe('结果反馈接口', () => {
  it('正常写入', async () => {
    const res = await post({ board: 'topic', rating: -1, reason: '不对口' });
    expect(res.status).toBe(200);
    expect(state.inserted).toEqual([{ user_id: 'user-1', board: 'topic', rating: -1, reason: '不对口' }]);
  });

  it('表还没建（迁移没跑）：返回 503 并说明未启用，不假装保存成功', async () => {
    state.insertError = { message: 'Could not find the table public.result_feedback in the schema cache' };
    const res = await post({ board: 'topic', rating: 1 });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/尚未启用/);
  });

  it('其它写入失败：返回 500，告诉用户没保存', async () => {
    state.insertError = { message: 'connection reset' };
    const res = await post({ board: 'topic', rating: 1 });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/没有保存/);
  });

  it('输入不合法：400，不写库', async () => {
    const res = await post({ board: 'topic', rating: 5 });
    expect(res.status).toBe(400);
    expect(state.inserted).toHaveLength(0);
  });
});
