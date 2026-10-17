export const FEEDBACK_REASONS = ['不对口', '有编造或事实不对', '太空太套话', '太长或太短', '不像我的口吻'] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

/** 带给学习用的结果节选上限（字）。只够看出写法，不存整篇 */
export const FEEDBACK_EXCERPT_MAX = 600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeedbackInput {
  board: string;
  rating: 1 | -1;
  reason: FeedbackReason | null;
  /** 当前档案；没有档案或是默认档案时为 null */
  profileId: string | null;
  /** 这条结果的节选（学习用）；没有时为 null */
  excerpt: string | null;
}

export function parseFeedback(body: unknown): FeedbackInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const board = typeof b.board === 'string' ? b.board : '';
  if (!/^[a-z][a-z-]{1,39}$/.test(board)) return null;
  const rating = b.rating === 1 ? 1 : b.rating === -1 ? -1 : null;
  if (rating === null) return null;
  const reason = typeof b.reason === 'string' && (FEEDBACK_REASONS as readonly string[]).includes(b.reason)
    ? (b.reason as FeedbackReason)
    : null;
  const profileId = typeof b.profileId === 'string' && UUID_RE.test(b.profileId) ? b.profileId : null;
  const excerpt = typeof b.excerpt === 'string' && b.excerpt.trim() ? b.excerpt.trim().slice(0, FEEDBACK_EXCERPT_MAX) : null;
  return { board, rating, reason: rating === -1 ? reason : null, profileId, excerpt };
}

export interface FeedbackRow {
  board: string;
  rating: number;
  reason: string | null;
}

export function summarizeFeedback(rows: FeedbackRow[]) {
  const boards = new Map<string, { board: string; up: number; down: number }>();
  const reasons = new Map<string, number>();
  let up = 0;
  let down = 0;
  for (const r of rows) {
    const cur = boards.get(r.board) ?? { board: r.board, up: 0, down: 0 };
    if (r.rating === 1) {
      up += 1;
      cur.up += 1;
    } else {
      down += 1;
      cur.down += 1;
      if (r.reason) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
    }
    boards.set(r.board, cur);
  }
  return {
    total: rows.length,
    up,
    down,
    satisfaction: rows.length ? Math.round((up / rows.length) * 100) : null,
    byBoard: [...boards.values()].sort((a, b) => b.up + b.down - (a.up + a.down)),
    reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}
