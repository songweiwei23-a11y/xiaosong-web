import { beforeEach, describe, expect, it, vi } from 'vitest';
import { historyProfileFilter, profileHistoryQuery } from '@/lib/profile-history';

const mock = vi.hoisted(() => {
  const calls: Array<[string, ...unknown[]]> = [];
  const query: any = {};
  for (const method of ['select', 'eq', 'order', 'or', 'limit', 'in', 'is', 'range', 'lte']) {
    query[method] = (...args: unknown[]) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
  const db = {
    from: vi.fn(() => query),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'owner' } }, error: null })) },
  };
  return { calls, query, db };
});
vi.mock('@supabase/ssr', () => ({ createServerClient: () => mock.db }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => mock.db, getServerSupabase: async () => mock.db }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: 'owner' }) }));

import { GET as scripts } from '@/app/api/script-history/route';
import { GET as topics } from '@/app/api/topics/route';
import { GET as titles } from '@/app/api/titles/route';
import { GET as chats } from '@/app/api/chat-conversations/route';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
beforeEach(() => {
  mock.calls.length = 0;
  mock.query.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
});

describe('历史按档案查询，保留全局历史与未关联记录', () => {
  it.each([A, B])('兼容两种历史字段 %s', (id) => {
    expect(historyProfileFilter(id)).toBe(`input_data->>profile_id.eq.${id},input_data->>profileId.eq.${id}`);
  });
  it('没有档案的记录必须两个字段都为空', () => {
    expect(historyProfileFilter('default')).toBe('and(input_data->>profile_id.is.null,input_data->>profileId.is.null)');
    expect(profileHistoryQuery(null)).toBe('&profileId=default');
    expect(historyProfileFilter(null)).toBeNull();
  });
  it.each([scripts, topics, titles])('实际路由在用户权限内增加档案过滤', async (get) => {
    const res = await get(new Request(`https://local/api?profileId=${A}&limit=1`));
    expect(res.status).toBe(200);
    expect(mock.calls).toContainEqual(['eq', 'user_id', 'owner']);
    expect(mock.calls).toContainEqual(['or', `input_data->>profile_id.eq.${A},input_data->>profileId.eq.${A}`]);
  });
  it('过滤发生在 limit 之前，避免前 20 条被其他档案挤占', async () => {
    await scripts(new Request(`https://local/api?profileId=${B}&limit=1`));
    expect(mock.calls.findIndex(([method]) => method === 'or')).toBeLessThan(mock.calls.findIndex(([method]) => method === 'limit'));
  });
  it.each([scripts, topics, titles, chats])('非法编号不能拼进数据库过滤表达式', async (get) => {
    const res = await get(new Request('https://local/api?profileId=bad,or(user_id.eq.other)'));
    expect(res.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });
  it('全局历史不传档案时仍能查看全部记录', async () => {
    await scripts(new Request('https://local/api?taskType=all'));
    expect(mock.calls.some(([method]) => method === 'or')).toBe(false);
  });
  it('实际历史接口翻过 1000 条，较旧的记录也返回，不会只剩最新 20 条', async () => {
    const rows = Array.from({ length: 1301 }, (_, id) => ({ id: String(id), task_type: '跨行业二创' }));
    mock.query.then = (resolve: any) => {
      const range = mock.calls.filter(([method]) => method === 'range').at(-1)!;
      return Promise.resolve({ data: rows.slice(Number(range[1]), Number(range[2]) + 1), error: null }).then(resolve);
    };
    const response = await scripts(new Request('https://local/api?taskType=all'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(rows);
    expect(mock.calls.filter(([method]) => method === 'range')).toEqual([['range', 0, 499], ['range', 500, 999], ['range', 1000, 1499]]);
  });
  it('自由对话使用数据库的档案列', async () => {
    await chats(new Request(`https://local/api?kind=free_chat&profileId=${A}`));
    expect(mock.calls).toContainEqual(['eq', 'profile_id', A]);
    mock.calls.length = 0;
    await chats(new Request('https://local/api?kind=free_chat&profileId=default'));
    expect(mock.calls).toContainEqual(['is', 'profile_id', null]);
  });
});
