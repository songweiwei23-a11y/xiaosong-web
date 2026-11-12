import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        limit: async () => ({ error: null }),
      }),
    }),
  }),
}));

import { GET } from '@/app/api/health/route';

describe('/api/health 进程身份', () => {
  afterEach(() => {
    delete process.env.KAIWU_BOOT_ID;
  });

  it('返回这次进程的 pid 和 boot，监控仍能靠 ok 判断', async () => {
    process.env.KAIWU_BOOT_ID = 'boot-abc';
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.pid).toBe(process.pid);
    expect(body.boot).toBe('boot-abc');
  });
});
