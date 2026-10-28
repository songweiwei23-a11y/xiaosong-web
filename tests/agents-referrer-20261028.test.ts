/**
 * 管理员看用户时的「来源代理」（2026-10-28，lib/agent-data 的 referrersOf）：
 * 显示代理的显示名；没填显示名就用代理的账号邮箱；都没有就写「未命名代理」。
 * 没有归属的用户不在结果里（直接注册的）。
 */
import { describe, expect, it } from 'vitest';
import { referrersOf } from '@/lib/agent-data';

type Ref = { user_id: string; agent_id: string; invitation_code: string; bound_at: string };
type Agent = { id: string; user_id: string; display_name: string };

/** 只实现 referrersOf 用到的查询：agent_referrals / agents 按 in() 取，auth 用户按 id 取邮箱 */
function fakeDb(opts: { refs: Ref[]; agents: Agent[]; emails: Record<string, string>; refError?: string }) {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      calls.push(table);
      if (table === 'agent_referrals') {
        return {
          select: () => ({
            in: async () => ({ data: opts.refError ? null : opts.refs, error: opts.refError ? { message: opts.refError } : null }),
          }),
        };
      }
      if (table === 'agents') {
        return { select: () => ({ in: async () => ({ data: opts.agents, error: null }) }) };
      }
      throw new Error(`未预期的表：${table}`);
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: opts.emails[id] ? { email: opts.emails[id] } : null }, error: null }),
      },
    },
  };
}

const ref = (user_id: string, agent_id: string, code = 'XSAAAA1111'): Ref => ({
  user_id,
  agent_id,
  invitation_code: code,
  bound_at: '2026-10-20T04:00:00Z',
});

describe('来源代理的名字', () => {
  it('代理有显示名：显示显示名，并带上它用的码', async () => {
    const db = fakeDb({
      refs: [ref('u1', 'a1', 'XSJ7K2M9PQ')],
      agents: [{ id: 'a1', user_id: 'agent-user', display_name: '小王团队' }],
      emails: { 'agent-user': 'wang@example.com' },
    });
    const m = await referrersOf(db as never, ['u1']);
    expect(m.get('u1')).toEqual({
      agent_id: 'a1',
      agent_name: '小王团队',
      invitation_code: 'XSJ7K2M9PQ',
      bound_at: '2026-10-20T04:00:00Z',
    });
  });

  it('代理没有显示名：用代理的账号邮箱代替', async () => {
    const db = fakeDb({
      refs: [ref('u1', 'a1')],
      agents: [{ id: 'a1', user_id: 'agent-user', display_name: '' }],
      emails: { 'agent-user': 'wang@example.com' },
    });
    const m = await referrersOf(db as never, ['u1']);
    expect(m.get('u1')?.agent_name).toBe('wang@example.com');
  });

  it('代理既没有显示名、账号也查不到邮箱：写「未命名代理」', async () => {
    const db = fakeDb({
      refs: [ref('u1', 'a1')],
      agents: [{ id: 'a1', user_id: 'agent-user', display_name: '' }],
      emails: {},
    });
    const m = await referrersOf(db as never, ['u1']);
    expect(m.get('u1')?.agent_name).toBe('（未命名代理）');
  });

  it('没有归属的用户（直接注册的）不在结果里', async () => {
    const db = fakeDb({
      refs: [ref('u1', 'a1')],
      agents: [{ id: 'a1', user_id: 'agent-user', display_name: '小王团队' }],
      emails: {},
    });
    const m = await referrersOf(db as never, ['u1', 'u2']);
    expect(m.has('u1')).toBe(true);
    expect(m.has('u2')).toBe(false);
  });

  it('两个代理各拉了一个用户：各自显示各自的名字', async () => {
    const db = fakeDb({
      refs: [ref('u1', 'a1'), ref('u2', 'a2', 'XSBBBB2222')],
      agents: [
        { id: 'a1', user_id: 'agent-1', display_name: '小王团队' },
        { id: 'a2', user_id: 'agent-2', display_name: '小李' },
      ],
      emails: {},
    });
    const m = await referrersOf(db as never, ['u1', 'u2']);
    expect(m.get('u1')?.agent_name).toBe('小王团队');
    expect(m.get('u2')?.agent_name).toBe('小李');
    expect(m.get('u2')?.invitation_code).toBe('XSBBBB2222');
  });

  it('用户列表为空：不查库', async () => {
    const db = fakeDb({ refs: [], agents: [], emails: {} });
    const m = await referrersOf(db as never, []);
    expect(m.size).toBe(0);
    expect(db.calls).toEqual([]);
  });

  it('读归属失败：抛错，由调用方（管理员接口）决定怎么处理', async () => {
    const db = fakeDb({ refs: [], agents: [], emails: {}, refError: 'connection reset' });
    await expect(referrersOf(db as never, ['u1'])).rejects.toThrow('connection reset');
  });
});
