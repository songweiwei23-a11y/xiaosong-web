export const FEEDBACK_REASONS = ['不对口', '有编造或事实不对', '太空太套话', '太长或太短', '不像我的口吻'] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export interface FeedbackInput {
  board: string;
  rating: 1 | -1;
  reason: FeedbackReason | null;
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
  return { board, rating, reason: rating === -1 ? reason : null };
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
