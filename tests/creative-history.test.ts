import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCreativeMemory, ownsCreativeProfile, persistCreativeHistory, type CreativeHistoryInput } from '@/lib/creative-history';
import { remixHistoryForm } from '@/lib/creative-history-form';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const H = '33333333-3333-4333-8333-333333333333';
const state = vi.hoisted(() => ({ db: null as unknown as SupabaseClient, allowed: true }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => state.allowed ? { ok: true, userId: 'owner' } : { ok: false, response: Response.json({}, { status: 401 }) } }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => state.db }));
import { POST } from '@/app/api/creative-history/route';

function dbWith(rows: any[] = [], profiles = [{ id: A, user_id: 'owner' }]) {
  const calls: any[] = [];
  const db: any = { from: (table: string) => {
    let selected = table === 'user_profiles' ? profiles : rows;
    const q: any = {
      select: () => q, order: () => q, limit: () => q,
      eq: (key: string, value: unknown) => { calls.push(['eq', key, value]); selected = selected.filter((r) => r[key] === value); return q; },
      or: (filter: string) => { calls.push(['or', filter]); selected = selected.filter((r) => filter.includes(A) ? r.input_data?.profileId === A : filter.includes(B) ? r.input_data?.profileId === B : !r.input_data?.profileId); return q; },
      maybeSingle: async () => ({ data: selected[0] || null, error: null }),
      insert: async (row: any) => { calls.push(['insert', row]); if (rows.some((r) => r.id === row.id)) return { error: { code: '23505' } }; rows.push(row); return { error: null }; },
      // update(值).eq(...).eq(...)：等 eq 都过滤完、真正 await 时才改
      update: (patch: any) => { calls.push(['update', patch]); const u: any = { eq: (key: string, value: unknown) => { selected = selected.filter((r) => r[key] === value); return u; }, then: (resolve: any) => { selected.forEach((r) => Object.assign(r, patch)); return Promise.resolve({ error: null }).then(resolve); } }; return u; },
      then: (resolve: any) => Promise.resolve({ data: selected, error: null }).then(resolve),
    }; return q;
  } };
  return { db: db as SupabaseClient, rows, calls };
}
const input: CreativeHistoryInput = { id: H, taskType: '跨行业二创', profileId: A, inputData: { source: '汽车', profileId: B }, result: '完整二创内容' };
beforeEach(() => { state.allowed = true; state.db = dbWith().db; });
describe('持久化与隔离', () => {
  // 2026-11-08：原来重复补存不覆写正文——服务端先存润色前的，页面润色完再存同一条就被跳过，历史里一直是润色前的。
  // 现在同账号、同板块、同档案的同一条，正文更新成最终版本；别人的、别的档案的照旧不动
  it('保存固定归属并幂等；重复补存不会再插一条，同一条换成最终版本，别人的不动', async () => {
    const { db, rows } = dbWith();
    expect(await persistCreativeHistory(db, 'owner', input)).toBe(true);
    expect(rows[0]).toMatchObject({ user_id: 'owner', task_type: '跨行业二创', input_data: { profileId: A, profile_id: A }, result: input.result });
    expect(await persistCreativeHistory(db, 'owner', { ...input, result: '润色后的最终版' })).toBe(true);
    expect(rows).toHaveLength(1); expect(rows[0].result).toBe('润色后的最终版');
    expect(await persistCreativeHistory(db, 'other', { ...input, result: '别人的' })).toBe(false);
    expect(await persistCreativeHistory(db, 'owner', { ...input, profileId: B, result: '别的档案' })).toBe(false);
    expect(rows[0].result).toBe('润色后的最终版');
  });
  it('档案必须是当前账号的；没有档案的范围也能保存', async () => {
    expect(await ownsCreativeProfile(state.db, 'owner', A)).toBe(true);
    expect(await ownsCreativeProfile(state.db, 'owner', B)).toBe(false);
    expect(await ownsCreativeProfile(state.db, 'other', A)).toBe(false);
    expect(await ownsCreativeProfile(state.db, 'owner', null)).toBe(true);
  });
  it('实际 API 在插入前拒绝其他档案、已切换的账号、未登录请求', async () => {
    const send = (body: any) => POST(new Request('https://local/api/creative-history', { method: 'POST', body: JSON.stringify(body) }));
    expect((await send({ ...input, profileId: B })).status).toBe(403);
    expect((await send({ ...input, ownerId: 'other' })).status).toBe(403);
    expect((await send(input)).status).toBe(200);
    state.allowed = false;
    expect((await send(input)).status).toBe(401);
  });
  it('历史产出不回灌进生成：任何账号、任何档案的历史都不进提示词（2026-10-31）', async () => {
    const { db } = dbWith([
      { id: '1', user_id: 'owner', task_type: '跨行业二创', input_data: { profileId: A }, result: 'A 的内容', created_at: '2026-09-30' },
      { id: '2', user_id: 'owner', task_type: '跨行业二创', input_data: { profileId: B }, result: 'B 的内容' },
      { id: '3', user_id: 'other', task_type: '跨行业二创', input_data: { profileId: A }, result: '其他账号内容' },
    ]);
    expect(await loadCreativeMemory(db, 'owner', '跨行业二创', A)).toBe('');
  });
});
describe('恢复二创设置', () => {
  it('原片、数量、补充要求都能找回，脏值不会成为选项', () => {
    const form = remixHistoryForm({ sourceData: { kind: 'paste', text: '原片完整文本', title: '原片' }, count: 5, notes: '不要出镜', layers: ['opening', 'bad'], depth: 'bad' });
    expect(form.source?.text).toBe('原片完整文本'); expect(form.notes).toBe('不要出镜');
    expect(form.count).toBe(5); expect(form.layers).not.toContain('bad'); expect(form.depth).toBe('full');
    expect(remixHistoryForm(null).source).toBeNull();
  });
});
