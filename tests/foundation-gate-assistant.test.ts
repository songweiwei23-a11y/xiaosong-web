// 地基门槛（2026-10-23）：助理派活时，地基没打好的创作板块不列任务、不扣额度，并说清楚先去做哪一步。
// 这里把地基固定成「只有档案、没有账号定位」，逐个看派活工具的反应。
vi.mock('@/lib/foundation-gate', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/foundation-gate')>();
  return {
    ...real,
    foundationGate: vi.fn(async (_userId: string, need: Parameters<typeof real.foundationBlock>[0]) =>
      real.foundationBlock(need, { profileCount: 1, positioningTypes: [] }),
    ),
  };
});

import { describe, it, expect, vi } from 'vitest';
import { createAssistantTools } from '@/lib/assistant/tools';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

function tool(name: string, actions: unknown[] = [], fetchImpl?: typeof fetch) {
  const tools = createAssistantTools({
    userId: 'u-foundation',
    cookie: 'c=1',
    internalBase: 'http://x',
    fetchImpl,
    onAction: (a) => actions.push(a),
  });
  return tools.find((t) => t.name === name)!;
}

describe('地基门槛：助理派活', () => {
  it('没有账号定位时，选题不列任务，告诉先做账号定位', async () => {
    const actions: unknown[] = [];
    const out = await tool('propose_topic', actions).run({ request: '烧烤店晚市怎么做客流' });
    expect(out).toContain('这次不派活');
    expect(out).toContain('还没有做账号定位');
    expect(actions).toHaveLength(0);
  });

  it('没有账号定位时，脚本、创作方向都拦下', async () => {
    const actions: unknown[] = [];
    expect(await tool('propose_script', actions).run({ request: '凌晨收摊的真实夜班' })).toContain('这次不派活');
    expect(await tool('propose_direction', actions).run({ goal: '流量型，让更多人看到' })).toContain('这次不派活');
    expect(actions).toHaveLength(0);
  });

  it('只差档案门槛的账号定位：不被地基拦下，继续走原来的必填项检查', async () => {
    const fetchImpl = (async () => json([{ id: 'p1', profile_name: '测试档案' }])) as unknown as typeof fetch;
    const out = await tool('propose_positioning', [], fetchImpl).run({});
    expect(out).not.toContain('这次不派活');
  });
});
