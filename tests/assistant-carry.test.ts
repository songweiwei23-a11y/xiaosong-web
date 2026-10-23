/**
 * 板块之间带内容（2026-10-23）：助理跑出来的结果存成创作会话，编号取回后接着给下一个板块，
 * 原方向、目的、创作设置、当前脚本都要跟着过去（和页面「带去下一步」一样）。全部用假接口。
 */
import { describe, it, expect } from 'vitest';
import { buildCreationHandoff } from '@/lib/creation-flow';
import type { HandoffPayload } from '@/lib/handoff';
import { loadCarry, listRecentResults, saveBoardResult } from '@/lib/assistant/carry';
import { applyCarry, rebuildCarry, sourceKeyOf } from '@/lib/assistant/carry-shape';
import { runAnyBoard, type BoardAny } from '@/lib/assistant/board-dispatch';
import { createAssistantTools } from '@/lib/assistant/tools';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const UUID = '6b1d6e1e-6f7a-4c2b-9a51-2f0c1d2e3f40';
const MISSING = '00000000-0000-4000-8000-000000000000';

const DIRECTION = [
  '## 方向一：凌晨收摊的烧烤摊',
  '- 视频目的：流量型',
  '- 核心思路：拍老板凌晨收摊、算账的真实场景',
  '- 怎么拍：口播加后厨镜头，不摆拍',
  '',
  `这个方向讲的是一个真实的夜班故事，老板每天凌晨三点还在腌肉，客人第二天才知道他有多辛苦。${'这里是这个方向的展开说明。'.repeat(10)}`,
].join('\n');

const SCRIPT = [
  '## 脚本：老板凌晨三点的夜班',
  '台词：凌晨三点还在腌肉，每一串都是他自己一根一根穿出来的。',
  '画面：后厨蒸汽、案板、腌料桶，不摆拍。',
  `${'这里是脚本的展开，讲收摊后算账、第二天一早又开火的过程。'.repeat(8)}`,
].join('\n');

/** 一份带过来的内容（和页面 buildCreationHandoff 给的一样） */
function carryOf(body: string, from: string, source: 'direction' | 'script' = 'direction'): HandoffPayload {
  return buildCreationHandoff(source, 'free-chat', body, { from }) as HandoffPayload;
}

/** 按地址给桩：生成接口记下请求体，创作会话按编号给，其余返回空 */
function stub(opts: { bodies?: Record<string, unknown>[]; posted?: Record<string, unknown>[]; payloads?: Record<string, HandoffPayload> } = {}) {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/dify/stream')) {
      opts.bodies?.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return sse('板块产出，足够长。'.repeat(20));
    }
    if (u.includes('/api/creation-sessions') && init?.method === 'POST') {
      opts.posted?.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return json({ id: UUID, payload: {} });
    }
    if (u.includes('/api/creation-sessions?recent=')) {
      return json([{ id: UUID, createdAt: '2026-10-23T02:00:00Z', from: '创作方向', title: '', target: '/dashboard/free-chat', chars: 200, preview: '凌晨收摊' }]);
    }
    const id = /[?&]id=([^&]+)/.exec(u)?.[1];
    if (id && opts.payloads?.[id]) return json({ id, payload: opts.payloads[id] });
    if (id) return json({ error: '没有找到这份创作需求' }, 404);
    return json([]);
  }) as unknown as typeof fetch;
}

const ctxWith = (fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) => ({
  userId: 'u-carry',
  cookie: 'c=1',
  internalBase: 'http://x',
  fetchImpl,
  ...extra,
});

const emptyTopic = (): BoardAny => ({
  kind: 'topic',
  input: { request: '', count: 3, role: '按配比', platform: '', keywords: [], tracks: [], styles: [], elements: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意' },
});

describe('创作方向接选题：原方向、目的、思路要跟着过去', () => {
  it('选题的提示词里有原方向、目的，并标明从这份内容出发', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryOf(DIRECTION, '创作方向');
    const board = applyCarry(emptyTopic(), carry);
    const r = await runAnyBoard(ctxWith(stub({ bodies })), board);
    expect(r.ok).toBe(true);
    const q = String(bodies[0].query);
    expect(q).toContain('这批选题从带来的内容出发');
    expect(q).toContain('凌晨收摊的烧烤摊');
    expect(q).toContain('流量型');
  });

  it('带过来的内容按页面规则归到「创作方向」来源', () => {
    expect(sourceKeyOf(carryOf(DIRECTION, '创作方向'))).toBe('direction');
    expect(sourceKeyOf(carryOf(SCRIPT, '脚本生成', 'script'))).toBe('script');
  });
});

describe('结果存下来，再按编号取回', () => {
  it('板块结果存成创作会话：来源名、完整正文、目标页、原方向都按页面的规则', async () => {
    const posted: Record<string, unknown>[] = [];
    const id = await saveBoardResult(ctxWith(stub({ posted }), { profileId: 'not-a-uuid' }), { kind: 'direction', input: { goal: '想拍夜宵场景的真实故事', count: 3 } }, DIRECTION);
    expect(id).toBe(UUID);
    const payload = posted[0].payload as Record<string, unknown>;
    expect(payload.from).toBe('创作方向');
    expect(payload.sourceContent).toBe(DIRECTION);
    expect(payload.originContent).toBe(DIRECTION);
    expect(payload.target).toBe('/dashboard/free-chat');
    expect(payload.profileId).toBeNull();
    expect((payload.settings as { userIntent?: string }).userIntent).toBe('想拍夜宵场景的真实故事');
  });

  it('接着做的结果沿用原来的原方向和作品，不会丢', async () => {
    const posted: Record<string, unknown>[] = [];
    const origin = '最初的大方向：讲老板的夜班';
    const first = { ...carryOf(DIRECTION, '创作方向'), originContent: origin, workId: '6b1d6e1e-6f7a-4c2b-9a51-2f0c1d2e3f41' } as HandoffPayload;
    await saveBoardResult(ctxWith(stub({ posted })), { ...emptyTopic(), carry: first }, SCRIPT);
    const payload = posted[0].payload as Record<string, unknown>;
    expect(payload.originContent).toBe(origin);
    expect(payload.workId).toBe(first.workId);
  });

  it('按编号取回：只取到这一份；取不到就返回 null；列表给摘要', async () => {
    const payloads = { [UUID]: carryOf(DIRECTION, '创作方向') };
    const c = ctxWith(stub({ payloads }));
    const got = await loadCarry(c, UUID);
    expect(got?.from).toBe('创作方向');
    expect(got?.sourceContent).toBe(DIRECTION);
    expect(await loadCarry(c, MISSING)).toBeNull();
    expect(await loadCarry(c, 'not-an-id')).toBeNull();
    const list = await listRecentResults(c, 5);
    expect(list[0]).toMatchObject({ id: UUID, from: '创作方向' });
  });
});

describe('派活工具：接着做要先找到结果，找不到就说明', () => {
  it('编号查不到：不列任务；编号查到：列出来，等老板确认', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const payloads = { [UUID]: carryOf(DIRECTION, '创作方向') };
    const tools = createAssistantTools({
      userId: 'u-cont',
      cookie: 'c=1',
      internalBase: 'http://x',
      fetchImpl: stub({ payloads }),
      onAction: (a) => actions.push(a),
    });
    const cont = tools.find((t) => t.name === 'propose_continue')!;
    expect(await cont.run({ fromResultId: MISSING, to: 'topic' })).toContain('没有找到');
    expect(actions).toHaveLength(0);

    const out = await cont.run({ fromResultId: UUID, to: 'topic', request: '写 3 个选题' });
    expect(out).toContain('等他点确认');
    expect(actions[0]).toMatchObject({ name: 'board.run', args: { board: 'topic' } });
    expect(String(actions[0].args.summary)).toContain('写 3 个选题');
  });

  it('不能接着做的板块：直接说明，不去取结果', async () => {
    const tools = createAssistantTools({ userId: 'u-cont-2', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub() });
    expect(await tools.find((t) => t.name === 'propose_continue')!.run({ fromResultId: UUID, to: 'deal-reason' })).toContain('不能接着做');
  });

  it('最近的创作：列出编号和来源；没有就说没有', async () => {
    const tools = createAssistantTools({ userId: 'u-list', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub() });
    const out = await tools.find((t) => t.name === 'list_results')!.run({});
    expect(out).toContain(UUID);
    expect(out).toContain('创作方向');
    const empty = createAssistantTools({
      userId: 'u-list-2',
      cookie: 'c=1',
      internalBase: 'http://x',
      fetchImpl: (async () => json([])) as unknown as typeof fetch,
    });
    expect(await empty.find((t) => t.name === 'list_results')!.run({})).toContain('还没有');
  });
});

describe('其它板块的接续', () => {
  it('脚本接着做：参考内容带进脚本的提示词', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryOf(SCRIPT, '脚本生成', 'script');
    const board = applyCarry({ kind: 'script', input: { request: '改成更适合分镜的口播' } }, carry);
    const r = await runAnyBoard(ctxWith(stub({ bodies })), { ...board, carry });
    expect(r.ok).toBe(true);
    expect(String(bodies[0].query)).toContain('凌晨三点还在腌肉');
  });

  it('审稿接着做：稿子取自带过来的脚本，要求的原文不用重新粘贴', () => {
    const carry = carryOf(SCRIPT, '脚本生成', 'script');
    const next = applyCarry({ kind: 'review', input: { draft: '' } }, carry);
    expect(next.kind === 'review' && next.input.draft).toContain('凌晨三点还在腌肉');
  });

  it('按页面的规则重新组装：目标是选题时，来源内容保留', () => {
    const rebuilt = rebuildCarry(carryOf(SCRIPT, '脚本生成', 'script'), 'topic');
    expect(rebuilt.from).toBe('脚本生成');
    expect(rebuilt.sourceContent).toContain('凌晨三点还在腌肉');
  });
});
