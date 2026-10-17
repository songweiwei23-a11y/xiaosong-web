import { beforeEach, describe, expect, it, vi } from 'vitest';
import { briefFactsChanged, profileFactsFingerprint } from '@/lib/creative-brief';

/**
 * 整改 B4：账号定位保存时记下档案事实的指纹；档案事实改了，定位页才提醒「按旧档案写的」。
 * 迁移还没执行（没有 profile_facts 这一列）时，保存照常成功，只是没有指纹。
 */

const mock = vi.hoisted(() => {
  const state = {
    profile: null as Record<string, unknown> | null,
    /** 依次返回的插入错误：先给 profile_facts 列不存在，再给成功 */
    insertErrors: [] as string[],
    inserts: [] as Record<string, unknown>[],
  };
  const chain = (table: string) => {
    const api: Record<string, unknown> = {};
    const self = () => api;
    api.select = self;
    api.eq = self;
    api.maybeSingle = async () => ({ data: table === 'user_profiles' ? state.profile : null, error: null });
    api.insert = (rows: Record<string, unknown>[]) => { state.inserts.push(rows[0]); return api; };
    api.single = async () => {
      const err = state.insertErrors.shift() ?? null;
      return err ? { data: null, error: { message: err } } : { data: { id: 'pos-1', ...state.inserts.at(-1) }, error: null };
    };
    return api;
  };
  const db = {
    from: vi.fn((table: string) => chain(table)),
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
  };
  return { state, db };
});

vi.mock('@supabase/ssr', () => ({ createServerClient: () => mock.db }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));

import { POST } from '@/app/api/positioning/route';

const profile = { id: 'p1', profile_name: '测试号', persona_facts: { experience: '做了9年' }, product_category: ['川味烧烤'] };
const post = (body: Record<string, unknown>) =>
  POST(new Request('https://example.test/api/positioning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => {
  mock.state.profile = profile;
  mock.state.insertErrors = [];
  mock.state.inserts = [];
});

describe('账号定位记下档案事实的指纹（整改 B4）', () => {
  it('保存时带上当前档案的指纹', async () => {
    const res = await post({ profile_id: 'p1', positioning_type: '账号定位', full_content: '正文' });
    expect(res.status).toBe(200);
    expect(mock.state.inserts[0].profile_facts).toBe(profileFactsFingerprint(profile));
  });

  it('迁移还没执行（没有 profile_facts 这一列）：照常保存，不带指纹，不报错', async () => {
    mock.state.insertErrors = ['Could not find the \'profile_facts\' column of \'account_positioning\' in the schema cache'];
    const res = await post({ profile_id: 'p1', positioning_type: '账号定位', full_content: '正文' });
    expect(res.status).toBe(200);
    expect(mock.state.inserts).toHaveLength(2);
    expect(mock.state.inserts[1]).not.toHaveProperty('profile_facts');
  });

  it('其它保存错误不退回，照常报 500', async () => {
    mock.state.insertErrors = ['connection reset'];
    const res = await post({ profile_id: 'p1', positioning_type: '账号定位', full_content: '正文' });
    expect(res.status).toBe(500);
    expect(mock.state.inserts).toHaveLength(1);
  });

  it('档案改了人设年限以后，旧定位提醒；只改了不相关的字段，不提醒', () => {
    const saved = profileFactsFingerprint(profile);
    expect(briefFactsChanged(saved, { ...profile, persona_facts: { experience: '做了12年' } })).toBe(true);
    expect(briefFactsChanged(saved, { ...profile, avatar_note: '换了头像' })).toBe(false);
  });

  it('老定位没有指纹：判断不了，不提醒（不拿更新时间猜）', () => {
    expect(briefFactsChanged(null, profile)).toBe(false);
  });
});
