/**
 * 连续创作（2026-10-04）：所有「带去下一步」统一持久保存、刷新恢复最新、作品需求接入作品恢复。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCode } from './helpers/source';

const ID = '00000000-0000-4000-8000-000000000001';
const WORK = '00000000-0000-4000-8000-0000000000aa';

describe('快照白名单', () => {
  it('一批选题里每条各自的打法跟着存（原来漏了，脚本页挑中一条后打法丢失）', async () => {
    const { readCreationSnapshot } = await import('@/lib/creation-snapshot');
    const s = readCreationSnapshot({ from: '选题策划', target: '/dashboard/script', sourceContent: 'x', topicTactics: { '选题A': '反向操作', bad: 3 } });
    expect(s?.topicTactics).toEqual({ '选题A': '反向操作' });
  });
});

describe('刷新恢复最新，而不是回到跳转时的快照', () => {
  it('第一次打开填快照；同一标签页刷新、或作品在这个板块已生成新版本，以作品为准', async () => {
    const { creationRestorePlan } = await import('@/lib/creation-restore');
    const payload = { from: '审稿优化', target: '/dashboard/storyboard', workId: WORK };
    const work = { items: [{ task_type: '分镜脚本', created_at: '2026-10-04T02:00:00Z', result: '新分镜' }] };
    expect(creationRestorePlan({ id: ID, payload, createdAt: '2026-10-04T01:00:00Z', work: { items: [] }, restoredBefore: false })).toBe('snapshot');
    expect(creationRestorePlan({ id: ID, payload, createdAt: '2026-10-04T01:00:00Z', work: null, restoredBefore: true })).toBe('work');
    expect(creationRestorePlan({ id: ID, payload, createdAt: '2026-10-04T01:00:00Z', work, restoredBefore: false })).toBe('work');
    // 别的板块的新版本不算；比快照还早的不算
    expect(creationRestorePlan({ id: ID, payload, createdAt: '2026-10-04T03:00:00Z', work, restoredBefore: false })).toBe('snapshot');
    expect(creationRestorePlan({ id: ID, payload: { ...payload, target: '/dashboard/title' }, createdAt: '2026-10-04T01:00:00Z', work, restoredBefore: false })).toBe('snapshot');
  });

  it('恢复门：恢复过就记下；接口返回保存时间', () => {
    const gate = readCode('components/workspace/CreationRestoreGate.tsx');
    expect(gate).toMatch(/markCreationRestored\(id\)/);
    expect(gate).toMatch(/if \(plan === 'snapshot'\) restore\(payload\);/);
    expect(readCode('app/api/creation-sessions/route.ts')).toMatch(/select\('id, payload, created_at'\)/);
  });
});

describe('作品恢复叠上作品需求', () => {
  it('作品需求里的目的、人群、锁定原文和最初源资料都恢复；生成过的最新设置覆盖在上面', async () => {
    const { workCreationHandoff } = await import('@/lib/creation-work-resume');
    const work = {
      id: WORK, title: '老灶火锅', profile_id: null, is_done: false,
      creation_brief: { from: '审稿优化', sourceContent: '## 优化后的完整脚本\n客人说太辣了，老板递来一碗冰粉。', originContent: '最初的客户原话资料', settings: { purpose: '变现型', audience: '本地上班族', lockedTexts: ['客人说太辣了'] } },
      items: [{ id: 'h1', task_type: '脚本生成', result: '# 脚本\n口播：今天讲火锅', created_at: '2026-10-04T01:00:00Z', input_data: { creationSettings: { audience: '学生党' } } }],
    };
    const p = workCreationHandoff(work as never, 'storyboard');
    expect(p.originContent).toBe('最初的客户原话资料');
    expect(p.settings?.purpose).toBe('变现型');
    expect(p.settings?.lockedTexts).toEqual(['客人说太辣了']);
    expect(p.workId).toBe(WORK);
  });

  it('刚带过来还没生成过就刷新：用作品需求里带过来的内容，不是只剩标题', async () => {
    const { workCreationHandoff } = await import('@/lib/creation-work-resume');
    const work = { id: WORK, title: '老灶火锅', profile_id: null, is_done: false, items: [], creation_brief: { from: '审稿优化', sourceContent: '## 优化后的完整脚本\n客人说太辣了。' } };
    const p = workCreationHandoff(work as never, 'storyboard');
    expect(p.scriptContent).toContain('客人说太辣了');
    expect(p.scriptContent).not.toContain('优化后的完整脚本');
  });

  it('迁移没跑（没有 creation_brief）照旧按生成记录恢复', async () => {
    const { workCreationHandoff } = await import('@/lib/creation-work-resume');
    const p = workCreationHandoff({ id: WORK, title: 'T', profile_id: null, is_done: false, items: [] } as never, 'script');
    expect(p.topic).toBe('T');
  });
});

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/safe-post', async (orig) => ({ ...(await orig<object>()), postSafely: (...a: unknown[]) => post(...a) }));

describe('统一持久跳转（openCreation）', () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    post.mockReset();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  });
  const ok = (payload: unknown) => ({ ok: true, json: async () => ({ id: ID, payload }) });

  it('保存失败后重试沿用同一个请求编号（服务端幂等，不会多建作品）；成功后下一次换新编号；失败不跳转', async () => {
    const { openCreation } = await import('@/lib/creation-session');
    const payload = { from: '脚本生成', target: '/dashboard/storyboard', scriptContent: '口播正文', workId: WORK };
    const push = vi.fn();
    post.mockResolvedValueOnce({ ok: false, json: async () => ({ error: '创作需求未保存' }) });
    await expect(openCreation(payload, push)).rejects.toThrow('创作需求未保存');
    expect(push).not.toHaveBeenCalled();
    post.mockResolvedValueOnce(ok({ ...payload, sourceContent: '口播正文' }));
    await openCreation(payload, push);
    const [first, second] = post.mock.calls.map((c) => JSON.parse((c[1] as { body: string }).body));
    expect(second.requestId).toBe(first.requestId);
    // 只有脚本正文的，补成 sourceContent（服务端要求有可继续的内容）
    expect(first.payload.sourceContent).toBe('口播正文');
    expect(push).toHaveBeenCalledWith(`/dashboard/storyboard?creation=${ID}&work=${WORK}`);
    post.mockResolvedValueOnce(ok({ ...payload, sourceContent: '口播正文' }));
    await openCreation(payload, push);
    expect(JSON.parse((post.mock.calls[2][1] as { body: string }).body).requestId).not.toBe(first.requestId);
  });

  it('所有板块的快捷按钮都走持久跳转，不再只存在本标签页里', () => {
    for (const page of ['topic', 'script', 'review', 'storyboard', 'growth', 'breakdown']) {
      const code = readCode(`app/dashboard/${page}/page.tsx`);
      expect(code, page).not.toMatch(/\bputHandoff\(/);
      expect(code, page).toMatch(/openCreationSafely\(/);
    }
    expect(readCode('components/workspace/CreationLinks.tsx')).toMatch(/await openCreation\(payload, \(url\) => router\.push\(url\), branch \|\| ctx\?\.branch === true\)/);
  });
});
