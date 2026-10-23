/**
 * 需求 → 推荐路线（2026-10-23）：模糊的需求，助理先看账号状态，再推荐该走哪几个板块。
 * 规则是纯函数；工具用假接口。不调用真实模型。
 */
import { describe, it, expect } from 'vitest';
import { adviseRoute } from '@/lib/assistant/route-advice';
import { createAssistantTools } from '@/lib/assistant/tools';

const boards = (steps: { board: string }[]) => steps.map((s) => s.board);
const READY = { hasProfile: true, hasPositioning: true, hasBrief: true, recentResults: 0 };

describe('需求到路线的规则', () => {
  it('没有档案：不推路线，先说要建档', () => {
    const r = adviseRoute('inspiration', { hasProfile: false, hasPositioning: false, hasBrief: false, recentResults: 0 });
    expect(r.steps).toEqual([]);
    expect(r.missing.join('')).toContain('建档');
  });

  it('没灵感：定位和简报都有时，直接「创作方向 → 选题」', () => {
    expect(boards(adviseRoute('inspiration', READY).steps)).toEqual(['direction', 'topic']);
  });

  it('没灵感：还没定位、没简报，先把前置补上，再找方向', () => {
    const r = adviseRoute('inspiration', { hasProfile: true, hasPositioning: false, hasBrief: false, recentResults: 0 });
    expect(boards(r.steps)).toEqual(['positioning', 'brief', 'direction', 'topic']);
    expect(r.steps[0].why).toContain('定位');
  });

  it('没灵感：最近已经有一份创作方向，直接接着它出选题（带上它的编号）', () => {
    const r = adviseRoute('inspiration', { ...READY, recentResults: 1, recentDirectionId: 'd-1' });
    expect(boards(r.steps)).toEqual(['topic']);
    expect(r.steps[0].fromResultId).toBe('d-1');
  });

  it('想更新几期：先排内容，再出选题，挑一条写脚本；缺「几期」就问一句', () => {
    const r = adviseRoute('batch', READY);
    expect(boards(r.steps)).toEqual(['content-plan', 'topic', 'script']);
    expect(r.missing.join('')).toContain('几期');
  });

  it('写脚本：只推脚本，不多绕', () => {
    expect(boards(adviseRoute('script', READY).steps)).toEqual(['script']);
  });

  it('说不清要做什么：不推路线，问清楚', () => {
    const r = adviseRoute('other', READY);
    expect(r.steps).toEqual([]);
    expect(r.missing.length).toBeGreaterThan(0);
  });
});

describe('suggest_path 工具：按账号现在的状态推荐', () => {
  function tools(profiles: unknown[], positioning: unknown[], brief: unknown[], recent: unknown[] = []) {
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      const body = (x: unknown) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });
      if (u.includes('/api/profiles')) return body(profiles);
      if (u.includes('/api/creation-sessions?recent=')) return body(recent);
      // 定位和简报都走 type= 参数，编码后分不出来，按顺序返回：先定位、后简报
      if (u.includes('/api/positioning') && u.includes(encodeURIComponent('创作简报'))) return body(brief);
      if (u.includes('/api/positioning')) return body(positioning);
      return body([]);
    }) as unknown as typeof fetch;
    return createAssistantTools({ userId: 'u-route', cookie: 'c=1', internalBase: 'http://x', fetchImpl });
  }

  it('最近有创作方向：推荐直接接着它出选题，并提示用 propose_continue', async () => {
    const t = tools([{ id: 'p1' }], [{ profile_id: 'p1' }], [{ id: 'b1' }], [{ id: 'd-recent', from: '创作方向', createdAt: '2026-10-23T02:00:00Z', title: '', preview: '凌晨收摊' }]);
    const out = await t.find((x) => x.name === 'suggest_path')!.run({ need: 'inspiration' });
    expect(out).toContain('d-recent');
    expect(out).toContain('propose_continue');
  });

  it('没定位：推荐先做账号定位，再给方向、选题，并说明下一步用 propose_plan 列给老板', async () => {
    const t = tools([{ id: 'p1' }], [], []);
    const out = await t.find((x) => x.name === 'suggest_path')!.run({ need: 'inspiration' });
    expect(out).toContain('账号定位（positioning）');
    expect(out).toContain('创作方向（direction）');
    expect(out).toContain('propose_plan');
  });

  it('没有档案：直接说先建档，不推路线', async () => {
    const t = tools([], [], []);
    const out = await t.find((x) => x.name === 'suggest_path')!.run({ need: 'batch' });
    expect(out).toContain('建一个档案');
  });
});
