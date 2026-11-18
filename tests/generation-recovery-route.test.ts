import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/generation-tasks/[id]/route';
import { GET as findTask } from '@/app/api/generation-tasks/route';

const mocks = vi.hoisted(() => ({ guard: vi.fn(), read: vi.fn() }));
vi.mock('@/lib/api-guard', () => ({ requireUser: mocks.guard }));
vi.mock('@/lib/generation-task', () => ({ readGenerationTask: mocks.read }));

const taskId = '11111111-1111-4111-8111-111111111111';
const request = (id = taskId) => GET(new Request('http://localhost/api/generation-tasks/' + id), {
  params: Promise.resolve({ id }),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, userId: 'current-user' });
});

describe('生成任务恢复接口', () => {
  it('登录账号只查询自己的任务，并返回最近保存的草稿', async () => {
    const task = {
      id: taskId, status: 'post_processing',
      latest: { version: 2, kind: 'processed', result: '后台已保存的中间稿' },
    };
    mocks.read.mockResolvedValue(task);
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual(task);
    expect(mocks.read).toHaveBeenCalledWith('current-user', taskId);
  });

  it('未登录或任务编号不合法时不读取数据库', async () => {
    mocks.guard.mockResolvedValueOnce({ ok: false, response: Response.json({ error: '未登录' }, { status: 401 }) });
    expect((await request()).status).toBe(401);
    expect((await request('not-a-task')).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('任务查不到返回 404，数据库临时错误返回可重试的 503', async () => {
    mocks.read.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('database unavailable'));
    expect((await request()).status).toBe(404);
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('重试') });
  });

  it('未收到任务编号仍可按登录用户、档案与子板块恢复', async () => {
    const params = new URLSearchParams({ taskType: '起号方案#tactic-candidates', profileId: taskId, preferredId: taskId });
    mocks.read.mockResolvedValue({ id: taskId, status: 'generating' });
    const response = await findTask(new Request('http://localhost/api/generation-tasks?' + params));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: taskId, status: 'generating' });
    expect(mocks.read).toHaveBeenCalledWith('current-user', {
      taskType: '起号方案#tactic-candidates', profileId: taskId, preferredId: taskId, requestId: undefined,
    });
  });

  it('拒绝非法标识或未登录的查找请求', async () => {
    const lookup = () => findTask(new Request('http://localhost/api/generation-tasks?taskType=test&preferredId=bad'));
    mocks.guard.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await lookup()).status).toBe(401);
    expect((await lookup()).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
