/**
 * 生成结果的画布版本（2026-10-04）：真实路由 + 内存数据库。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { readCode } from './helpers/source';

const env = vi.hoisted(() => ({ userId: 'user-a', db: null as any }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: env.userId }) }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => env.db, getServerSupabase: async () => env.db }));
import { POST } from '@/app/api/result-versions/route';

const P1 = '11111111-1111-4111-8111-111111111111';
const W1 = '33333333-3333-4333-8333-333333333333';
const ORIGINAL = '44444444-4444-4444-8444-444444444444';
const v = (...contents: string[]) => contents.map((content, i) => ({ content, at: i + 1, note: i ? '手动修改' : '生成稿' }));
const post = async (body: unknown) => { const r = await POST(new Request('https://local/api/result-versions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };

beforeEach(() => {
  env.userId = 'user-a';
  env.db = createFakeDb({
    works: [{ id: W1, user_id: 'user-a', profile_id: P1 }],
    script_history: [{ id: ORIGINAL, user_id: 'user-a', task_type: '脚本生成', input_data: { topic: '原生成' }, result: '原稿', work_id: W1, created_at: '2026-10-01T00:00:00Z' }],
  });
});

describe('画布版本存取', () => {
  it('第一次保存新建一条改稿记录（result 是最新一版、挂在作品下），之后保存更新同一条；原生成记录不动', async () => {
    const first = await post({ taskType: '脚本生成', workId: W1, profileId: P1, versions: v('原稿', '改过一版'), base: { originContent: '客户原话', creationSettings: { purpose: '变现型' } } });
    expect(first.status).toBe(200);
    const row = env.db.tables.script_history.find((r: any) => r.id === first.body.id);
    expect(row).toMatchObject({ task_type: '脚本生成', result: '改过一版', work_id: W1 });
    expect(row.input_data).toMatchObject({ canvasOf: true, originContent: '客户原话', profileId: P1 });
    expect(row.input_data.creationSettings.purpose).toBe('变现型');
    expect(row.input_data.canvasVersions).toHaveLength(2);
    const second = await post({ id: first.body.id, taskType: '脚本生成', workId: W1, profileId: P1, versions: v('原稿', '改过一版', '第三版') });
    expect(second.body.id).toBe(first.body.id);
    expect(env.db.tables.script_history).toHaveLength(2);
    expect(env.db.tables.script_history.find((r: any) => r.id === first.body.id).result).toBe('第三版');
    expect(env.db.tables.script_history.find((r: any) => r.id === ORIGINAL).result).toBe('原稿');
  });

  it('不能拿这个接口改普通生成记录，也改不了别人的改稿', async () => {
    expect((await post({ id: ORIGINAL, taskType: '脚本生成', versions: v('x', '篡改') })).status).toBe(404);
    const mine = (await post({ taskType: '脚本生成', versions: v('a', 'b') })).body.id;
    env.userId = 'user-b';
    expect((await post({ id: mine, taskType: '脚本生成', versions: v('a', '偷改') })).status).toBe(404);
  });

  it('作品不是本人的、或档案对不上：拒绝，不悄悄挂上去', async () => {
    expect((await post({ taskType: '脚本生成', workId: W1, profileId: null, versions: v('a', 'b') })).status).toBe(403);
    env.userId = 'user-b';
    expect((await post({ taskType: '脚本生成', workId: W1, profileId: P1, versions: v('a', 'b') })).status).toBe(403);
  });

  it('不认识的板块、空内容拒绝；超大明确报错，不偷删旧版本', async () => {
    expect((await post({ taskType: '管理员', versions: v('a', 'b') })).status).toBe(400);
    expect((await post({ taskType: '脚本生成', versions: v('  ') })).status).toBe(400);
    const big = Array.from({ length: 40 }, (_, i) => 'x'.repeat(40_000) + i);
    expect((await post({ taskType: '脚本生成', versions: v(...big) })).status).toBe(413);
  });
});

describe('接入', () => {
  it('结果区有「在画布里改」；改过的版本用于显示、复制、继续创作；生成统计排除改稿记录', () => {
    const panel = readCode('components/workspace/ResultPanel.tsx');
    expect(panel).toMatch(/label=\{adopted \? `画布第 \$\{canvas!\.versions\.length\} 版` : "在画布里改"\}/);
    expect(panel).toMatch(/<CreationLinks body=\{view\} context=\{flowContext\} \/>/);
    expect(panel).toMatch(/onCopy\(view\)/);
    expect(readCode('app/api/admin/monitor/route.ts').match(/\.is\('input_data->>canvasOf', null\)/g)?.length).toBe(3);
  });
});
