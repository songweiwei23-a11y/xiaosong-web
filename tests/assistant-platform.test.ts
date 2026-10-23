/**
 * 管理员新补的部分（2026-10-23）：成交理由板块、作品进度、素材库查看和删除确认，以及档案类说法的规则。
 * 全部用假接口，不调用真实模型。
 */
import { describe, it, expect, vi } from 'vitest';
import { missingFields, summaryOf } from '@/lib/assistant/board-dispatch';
import { runAnyBoard } from '@/lib/assistant/board-dispatch';
import { createAssistantTools } from '@/lib/assistant/tools';
import { checkClaims } from '@/lib/assistant/receipts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const LONG = `成交理由一：价格透明，现场就能看到。${'这里是一段具体的判断和拍法，说清楚为什么成立、怎么拍。'.repeat(8)}`;

describe('成交理由板块', () => {
  it('缺店铺名称或店铺特色：要先问，不派活', () => {
    expect(missingFields({ kind: 'deal-reason', input: { storeName: '', storeFeatures: '现炒' } }).join('')).toContain('店铺名称');
    expect(missingFields({ kind: 'deal-reason', input: { storeName: '老张火锅', storeFeatures: '' } }).join('')).toContain('店铺特色');
    expect(missingFields({ kind: 'deal-reason', input: { storeName: '老张火锅', storeFeatures: '每天现拉黄牛' } })).toEqual([]);
    expect(summaryOf({ kind: 'deal-reason', input: { storeName: '老张火锅', storeFeatures: '每天现拉黄牛' } })).toContain('店铺：老张火锅');
  });

  it('走同一个生成接口，taskType 是「成交理由」，提示词里带着店铺信息', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/dify/stream')) {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return sse(LONG);
      }
      return json([]);
    }) as unknown as typeof fetch;
    const r = await runAnyBoard({ userId: 'u-deal', cookie: 'c=1', internalBase: 'http://x', fetchImpl }, {
      kind: 'deal-reason',
      input: { storeName: '老张火锅', storeType: '火锅店', storeFeatures: '每天早上六点现拉黄牛', targetCustomer: '附近上班族' },
    });
    expect(r.ok).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].taskType).toBe('成交理由');
    expect(String(bodies[0].topic)).toContain('老张火锅');
    expect(String(bodies[0].topic)).toContain('每天早上六点现拉黄牛');
  });

  it('派活工具：缺店铺名称先问，齐了才列任务', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({ userId: 'u-deal-tool', cookie: 'c=1', internalBase: 'http://x', onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_deal_reason')!.run({ storeName: '', storeFeatures: '现炒' });
    expect(out).toContain('还缺');
    expect(actions).toHaveLength(0);
    await tools.find((t) => t.name === 'propose_deal_reason')!.run({ storeName: '老张火锅', storeFeatures: '每天现拉黄牛' });
    expect(actions[0]).toMatchObject({ name: 'board.run', args: { board: 'deal-reason', feature: '成交理由' } });
  });
});

describe('作品进度：只列出来，老板确认后才改', () => {
  it('没找到作品：不列任务', async () => {
    const fetchImpl = vi.fn(async () => json([{ id: 'w1', title: '老作品' }]));
    const actions: unknown[] = [];
    const tools = createAssistantTools({ userId: 'u-work', cookie: 'c=1', internalBase: 'http://x', fetchImpl: fetchImpl as never, onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_work_progress')!.run({ title: '不存在的作品', done: true });
    expect(out).toContain('没有找到要改的作品');
    expect(actions).toHaveLength(0);
  });

  it('找到了：列出来，文字里说明等确认', async () => {
    const fetchImpl = vi.fn(async () => json([{ id: 'w1', title: '老作品' }]));
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({ userId: 'u-work-2', cookie: 'c=1', internalBase: 'http://x', fetchImpl: fetchImpl as never, onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_work_progress')!.run({ workId: 'w1', done: true });
    expect(out).toContain('等老板点确认');
    expect(actions[0]).toMatchObject({ name: 'work.progress', args: { id: 'w1', done: true } });
  });
});

describe('素材库：能看，删除要确认', () => {
  it('没选档案：先问', async () => {
    const tools = createAssistantTools({ userId: 'u-mat', cookie: 'c=1', internalBase: 'http://x' });
    expect(await tools.find((t) => t.name === 'list_materials')!.run({})).toContain('还没有选账号档案');
  });

  it('列出素材：文件名和状态都带上', async () => {
    const fetchImpl = vi.fn(async () => json({ materials: [{ id: 'm1', filename: '门店视频.mp4', status: 'ready' }] }));
    const tools = createAssistantTools({ userId: 'u-mat-2', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fetchImpl as never });
    const out = await tools.find((t) => t.name === 'list_materials')!.run({});
    expect(out).toContain('门店视频.mp4');
  });

  it('删除：找不到文件名就不列；找到了只列出来，不直接删', async () => {
    const fetchImpl = vi.fn(async () => json({ materials: [{ id: 'm1', filename: '门店视频.mp4' }] }));
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({ userId: 'u-mat-3', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fetchImpl as never, onAction: (a) => actions.push(a) });
    expect(await tools.find((t) => t.name === 'propose_delete_material')!.run({ filename: '别的.mp4' })).toContain('没有');
    expect(actions).toHaveLength(0);
    const out = await tools.find((t) => t.name === 'propose_delete_material')!.run({ filename: '门店视频.mp4' });
    expect(out).toContain('等老板点「确定删除」');
    expect(actions[0]).toMatchObject({ name: 'material.delete', args: { id: 'm1', profileId: 'p1' } });
    // 只列出来：没有发出删除请求
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit | undefined][];
    expect(calls.every((c) => !String(c[1]?.method ?? '').includes('DELETE'))).toBe(true);
  });
});

describe('说法规则：档案和作品的各种说法都要拦住', () => {
  it('「已改为」「已建好」「已生效」这些说法：算声称做完了，要改写', () => {
    expect(checkClaims('已改为川菜号的档案名称。', []).rewritten).toEqual(['profile-update']);
    expect(checkClaims('档案已建好。', []).rewritten).toEqual([]);
    expect(checkClaims('已建好新档案，名称是川菜号。', []).rewritten).toEqual(['profile-update']);
    expect(checkClaims('已改成餐饮行业。', []).rewritten).toEqual(['profile-update']);
  });

  it('「记住了」这种句首的说法：没有记忆回执就改写；反问不算', () => {
    expect(checkClaims('记住了：你主要做川菜和烧烤两个内容方向。', []).rewritten).toEqual(['memory-add']);
    expect(checkClaims('你记住了吗？', []).rewritten).toEqual([]);
  });

  it('作品标记做完：要有作品进度的确认，否则改写', () => {
    expect(checkClaims('已把这条作品标记为做完了。', []).rewritten).toEqual(['work-progress']);
    expect(checkClaims('已把这条作品标记为做完了。', [{ kind: 'work.progress', ok: true, text: '已列出' }]).rewritten).toEqual([]);
  });
});
