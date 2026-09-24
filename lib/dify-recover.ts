/**
 * 断线续取：连接断了，但 Dify 那边其实已经把整篇写完了——去把它取回来。
 *
 * 【线上实测】9/24 12:05、12:22 两次账号定位，Dify 记录里都是完整生成
 * （1.4 万字、1.2 万字，状态正常），我们这边却一条都没存上：一篇五分钟的长文，
 * 中途只要网络抖一下，浏览器这头的流就断了。断了以后 Dify 并不停，照样写完、
 * 照样存档。所以不必让用户重来，按会话 id + 消息 id 去 Dify 取回全文即可。
 *
 * 只在服务端用（要带 Dify 密钥）。
 */

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

export type DifyMessageState =
  | { status: 'done'; answer: string }
  | { status: 'pending' }
  | { status: 'error'; message: string }
  /** 取不到：会话不属于这个用户、已被删、或 Dify 暂时连不上 */
  | { status: 'missing' };

/**
 * 查一条消息现在的状态。
 * Dify 在一条回答全部写完时才把正文存进消息记录，所以正文非空就是写完了。
 */
export async function fetchDifyMessage(
  conversationId: string,
  messageId: string,
  userId: string
): Promise<DifyMessageState> {
  try {
    const url =
      `${DIFY_BASE_URL}/messages?conversation_id=${encodeURIComponent(conversationId)}` +
      `&user=${encodeURIComponent(userId)}&limit=20`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` } });
    if (!res.ok) return { status: 'missing' };
    const j = await res.json();
    const m = (j?.data ?? []).find((x: any) => x?.id === messageId);
    if (!m) return { status: 'pending' };
    if (m.status === 'error' || m.error) return { status: 'error', message: String(m.error || '生成失败') };
    if (typeof m.answer === 'string' && m.answer.trim()) return { status: 'done', answer: m.answer };
    return { status: 'pending' };
  } catch {
    return { status: 'missing' };
  }
}

/** 等到这条消息写完（或出错、或超时）。服务端自己和上游断线时用 */
export async function waitForDifyMessage(
  conversationId: string,
  messageId: string,
  userId: string,
  { timeoutMs = 6 * 60_000, intervalMs = 4000, onTick }: { timeoutMs?: number; intervalMs?: number; onTick?: () => void } = {}
): Promise<DifyMessageState> {
  const deadline = Date.now() + timeoutMs;
  let last: DifyMessageState = { status: 'pending' };
  while (Date.now() < deadline) {
    last = await fetchDifyMessage(conversationId, messageId, userId);
    if (last.status === 'done' || last.status === 'error') return last;
    onTick?.();
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last.status === 'missing' ? last : { status: 'pending' };
}
