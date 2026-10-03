import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  activeId: 'profile-a' as string | null,
  insert: vi.fn(async (_row: Record<string, unknown>) => ({ error: null })),
  getSession: vi.fn(async () => ({ data: { session: { user: { id: 'owner' } } } })),
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {
  auth: { getSession: mock.getSession }, from: () => ({ insert: mock.insert }),
} }));
vi.mock('@/lib/active-profile', () => ({ getActiveProfileId: () => mock.activeId }));
vi.mock('@/lib/upgrade', () => ({ notifyGenerated: vi.fn() }));
import { saveGenerationHistory } from '@/lib/history';

beforeEach(() => { mock.activeId = 'profile-a'; mock.insert.mockClear(); });
it('异步获取登录状态期间切换档案，记录仍属于开始保存时的档案', async () => {
  const saved = saveGenerationHistory('脚本生成', { topic: 'A 的内容' }, '正文');
  mock.activeId = 'profile-b';
  expect(await saved).toBe(true);
  expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ input_data: { topic: 'A 的内容', profileId: 'profile-a' } }));
});
it('生成开始时显式指定的档案优先于保存时的当前档案', async () => {
  mock.activeId = 'profile-b';
  await saveGenerationHistory('知识库查询', { profileId: 'profile-a' }, '正文');
  expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ input_data: { profileId: 'profile-a' } }));
});
it('保留旧字段和明确的无档案记录，不能重新绑定到当前档案', async () => {
  await saveGenerationHistory('选题策划', { profile_id: 'profile-a' }, '正文');
  expect(mock.insert.mock.calls[0][0]).toEqual(expect.objectContaining({ input_data: { profile_id: 'profile-a' } }));
  await saveGenerationHistory('知识库查询', { profileId: null }, '正文');
  expect(mock.insert.mock.calls[1][0]).toEqual(expect.objectContaining({ input_data: { profileId: null } }));
});
