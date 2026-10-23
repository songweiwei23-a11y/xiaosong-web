/**
 * 各个板块接收「带去下一步」的内容：按页面收到时的规则接进提示词（2026-10-23）。
 * 每条都检查提示词里确实有带来的内容，并且放的是页面上放的那一段。全部用假接口，不调用真实模型。
 */
import { describe, it, expect } from 'vitest';
import { buildCreationHandoff } from '@/lib/creation-flow';
import type { HandoffPayload } from '@/lib/handoff';
import { missingFields, runAnyBoard, type BoardAny } from '@/lib/assistant/board-dispatch';
import { applyCarry } from '@/lib/assistant/carry-shape';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const PROFILE = { id: 'p-carry', profile_name: '老张烧烤', account_platform: ['抖音'], account_track: ['本地服务'], product_category: ['川味烧烤'] };
const BODY = [
  '## 脚本：老板凌晨三点的夜班',
  '台词：凌晨三点还在腌肉，每一串都是他自己一根一根穿出来的。',
  `${'这里是脚本的展开，讲收摊后算账、第二天一早又开火的过程。'.repeat(8)}`,
].join('\n');
const ORIGIN = '最初的大方向：讲老板的夜班，流量型，拍老板收摊算账的真实场景';

/** 从某一板块来的内容（和页面 buildCreationHandoff 给的一样） */
function carryFrom(body: string, from: string, target: 'free-chat' | 'remix' | 'breakdown' = 'free-chat', origin?: string): HandoffPayload {
  return buildCreationHandoff(from === '拆解爆款' ? 'breakdown' : from === '创作方向' ? 'direction' : 'script', target, body, { from, originContent: origin }) as HandoffPayload;
}

function stub(bodies: Record<string, unknown>[]) {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/dify/stream')) {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return sse('板块产出，足够长。'.repeat(20));
    }
    if (u.includes('/api/profiles')) return json([PROFILE]);
    return json([]);
  }) as unknown as typeof fetch;
}

const ctxWith = (bodies: Record<string, unknown>[]) => ({ userId: 'u-pages', cookie: 'c=1', internalBase: 'http://x', profileId: PROFILE.id, fetchImpl: stub(bodies) });

describe('脚本带去分镜、审稿、标题、开篇', () => {
  it('分镜：拆的是脚本正文；原始方案和正文不同，就放进「相关方案参考」', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(BODY, '脚本生成', 'free-chat', ORIGIN);
    const board = applyCarry({ kind: 'storyboard', input: { script: '' } }, carry);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    const q = String(bodies[0].query);
    expect(q).toContain('凌晨三点还在腌肉');
    expect(q).toContain('【相关方案参考】');
    expect(q).toContain('最初的大方向');
  });

  it('审稿：待审的是脚本正文，参考照页面放', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(BODY, '脚本生成', 'free-chat', ORIGIN);
    const board = applyCarry({ kind: 'review', input: { draft: '' } }, carry);
    expect(missingFields(board)).toEqual([]);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    expect(String(bodies[0].draftContent)).toContain('凌晨三点还在腌肉');
  });

  it('标题：主题取带来的主题，并带上参考正文', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(BODY, '脚本生成', 'free-chat', ORIGIN);
    const board = applyCarry({ kind: 'title', input: { topic: '', count: 3 } }, carry);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    expect(String(bodies[0].query)).toContain('凌晨三点还在腌肉');
  });

  it('开篇：带来的正文作为「已有创作参考」附在末尾，并标明交稿要求', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(BODY, '脚本生成', 'free-chat', ORIGIN);
    const board = applyCarry({ kind: 'opening', input: { topic: '老板的夜班', count: 3 } }, carry);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    const q = String(bodies[0].query);
    expect(q).toContain('【已有创作参考】');
    expect(q).toContain('凌晨三点还在腌肉');
  });
});

describe('创作方向、定位、简报、成交理由：按页面的规则接入', () => {
  const DIRECTION = ['## 方向一：凌晨收摊的烧烤摊', '- 视频目的：流量型', '- 核心思路：拍老板凌晨收摊、算账的真实场景', '', '这个方向讲的是一个真实的夜班故事。'.repeat(6)].join('\n');

  it('创作方向：带来的方向是「拓展」，放进 expand，并追加桥接段和创作设置', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(DIRECTION, '创作方向');
    const board = applyCarry({ kind: 'direction', input: { goal: '', count: 3 } }, carry);
    expect(missingFields(board)).toEqual([]);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    const q = String(bodies[0].query);
    expect(q).toContain('凌晨收摊的烧烤摊');
    expect(q).toContain('【跨板块带入的完整创作上下文】');
  });

  it('账号定位：带来的内容进补充说明，并追加桥接段', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(DIRECTION, '创作方向');
    const board = applyCarry({ kind: 'positioning', input: {} }, carry);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    const q = String(bodies[0].query);
    expect(q).toContain('来自创作方向的内容');
    expect(q).toContain('【跨板块带入的完整创作上下文】');
  });

  it('创作简报：没有库里的定位时，用带来的内容当定位原文', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(DIRECTION, '创作方向');
    const board = applyCarry({ kind: 'brief', input: {} }, carry);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('创作简报');
    expect(String(bodies[0].query)).toContain('凌晨收摊的烧烤摊');
  });

  it('成交理由：带来的内容进店铺特色，没有特色也不再拦住', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(DIRECTION, '创作方向');
    const board = applyCarry({ kind: 'deal-reason', input: { storeName: '老张烧烤', storeFeatures: '' } }, carry);
    expect(missingFields(board)).toEqual([]);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    expect(String(bodies[0].topic)).toContain('来自创作方向的内容');
  });
});

describe('拆解结果带去二创、拆解', () => {
  it('拆解爆款的结果带去二创：原文用拆解报告，来源按拆解处理', async () => {
    const bodies: Record<string, unknown>[] = [];
    const report = '## 拆解报告\n开头用反问，中段讲故事，结尾引导留言。'.repeat(3);
    const carry = carryFrom(report, '拆解爆款', 'remix');
    const board = applyCarry({ kind: 'remix', input: { text: '' } }, carry) as BoardAny;
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('跨行业二创');
    expect(String(bodies[0].query)).toContain('开头用反问');
  });

  it('把脚本带去拆解：拆的是它的正文', async () => {
    const bodies: Record<string, unknown>[] = [];
    const carry = carryFrom(BODY, '脚本生成');
    const board = applyCarry({ kind: 'breakdown', input: { script: '' } }, carry);
    const r = await runAnyBoard(ctxWith(bodies), board);
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('拆解爆款');
    expect(String(bodies[0].query)).toContain('凌晨三点还在腌肉');
  });
});
