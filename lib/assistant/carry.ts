import { randomUUID } from 'node:crypto';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { CREATION_UUID, readCreationSnapshot } from '@/lib/creation-snapshot';
import type { HandoffPayload } from '@/lib/handoff';
import { internalBase, readInternal, type BoardContext } from './boards';
import type { BoardAny } from './board-dispatch';
import { BOARD_SOURCE, boardFromLabel, requestTextOf } from '@/lib/assistant/carry-shape';

/**
 * 助理板块的结果存取（2026-10-23）：每个板块跑成的结果，存成和页面「带去下一步」一样的创作会话，
 * 之后用编号取回，再接到下一个板块上。存的走 /api/creation-sessions（同一张表、同一个 RPC），
 * 不新建表；作品、原方向、创作设置都由 RPC 按页面的规则沿着链路接续。
 */

/** 「最近的创作」列表里一条（接口只给摘要，完整内容用编号再取） */
export interface RecentResult {
  id: string;
  createdAt: string;
  from: string;
  title: string;
  target: string;
  chars: number;
  preview: string;
}

/** 存下来的一份创作：编号，以及服务端返回的完整内容（下一个板块按它接续，和页面带去下一步拿到的一样） */
export interface SavedResult {
  id: string;
  payload: HandoffPayload;
}

/**
 * 板块结果存成创作会话。失败不影响结果本身（只是之后不能按编号带过去），返回编号和内容，失败返回 null。
 * 带着上一步来的（board.carry）：沿用它的原方向和作品，这样链路的「原始创作方案」不会丢。
 */
export async function saveBoardResult(ctx: BoardContext, board: BoardAny, text: string): Promise<SavedResult | null> {
  const body = text.trim();
  if (!body) return null;
  const carry = board.carry;
  const intent = requestTextOf(board).trim();
  const payload = buildCreationHandoff(BOARD_SOURCE[board.kind], 'free-chat', body, {
    from: boardFromLabel(board.kind),
    originContent: carry?.originContent,
    settings: { ...(carry?.settings ?? {}), ...(intent ? { userIntent: intent } : {}) },
    workId: carry?.workId,
  });
  // 档案编号必须是 UUID，否则服务端会整份拒收；认不出就不挂档案（作品就不挂到档案下）
  const profileId = CREATION_UUID.test(ctx.profileId ?? '') ? ctx.profileId : null;
  const doFetch = ctx.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${internalBase(ctx)}/api/creation-sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ requestId: randomUUID(), payload: { ...payload, profileId }, branch: false }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { id?: unknown; payload?: unknown } | null;
    if (typeof data?.id !== 'string') return null;
    // 服务端规范化过的内容优先；认不出就用刚才发出去的那份（内容一样）
    return { id: data.id, payload: readCreationSnapshot(data.payload) ?? { ...payload, profileId } };
  } catch {
    return null;
  }
}

/** 按编号取回一份创作内容（只能取自己的）。取不到返回 null，调用方说明原因 */
export async function loadCarry(ctx: BoardContext, id: string): Promise<HandoffPayload | null> {
  if (!CREATION_UUID.test(id)) return null;
  const doFetch = ctx.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${internalBase(ctx)}/api/creation-sessions?id=${encodeURIComponent(id)}`, {
      headers: { cookie: ctx.cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { payload?: unknown } | null;
    return data ? readCreationSnapshot(data.payload) : null;
  } catch {
    return null;
  }
}

/** 这个账号最近的创作（页面带去下一步的、助理板块跑出来的都有），从新到旧 */
export async function listRecentResults(ctx: BoardContext, limit = 10): Promise<RecentResult[]> {
  try {
    const data = await readInternal(ctx, `/api/creation-sessions?recent=${Math.min(Math.max(limit, 1), 30)}`);
    return Array.isArray(data) ? (data as RecentResult[]) : [];
  } catch {
    return [];
  }
}
