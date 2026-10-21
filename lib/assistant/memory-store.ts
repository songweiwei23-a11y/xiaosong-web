import { getServiceSupabase } from '@/lib/admin-auth';
import { checkMemoryText, MEMORY_MAX_COUNT, sameMemory } from './memory';

/**
 * 助理的对话、摘要和记忆的数据库读写（服务端）。每个函数都带上 userId 过滤，只能动自己的数据。
 * 数据库出错会抛出，由调用方决定怎么办（助理接口会退回到不存对话的老方式，不影响正常对话）。
 */

export interface ThreadRow {
  id: string;
  title: string;
  summary: string;
  summarized_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface MemoryRow {
  id: string;
  content: string;
  created_at: string;
}

const db = () => getServiceSupabase();

export async function listThreads(userId: string, limit = 40): Promise<Pick<ThreadRow, 'id' | 'title' | 'updated_at'>[]> {
  const { data, error } = await db()
    .from('assistant_threads')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getThread(userId: string, id: string): Promise<ThreadRow | null> {
  const { data, error } = await db()
    .from('assistant_threads')
    .select('id, title, summary, summarized_count, created_at, updated_at')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ThreadRow | null) ?? null;
}

export async function createThread(userId: string, title: string): Promise<ThreadRow> {
  const { data, error } = await db()
    .from('assistant_threads')
    .insert({ user_id: userId, title })
    .select('id, title, summary, summarized_count, created_at, updated_at')
    .single();
  if (error || !data) throw error ?? new Error('thread not created');
  return data as ThreadRow;
}

export async function deleteThread(userId: string, id: string): Promise<void> {
  const { error } = await db().from('assistant_threads').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

/** 按时间正序返回最近的 limit 条消息 */
export async function listMessages(userId: string, threadId: string, limit = 200): Promise<MessageRow[]> {
  const { data, error } = await db()
    .from('assistant_messages')
    .select('id, role, text, meta, created_at')
    .eq('user_id', userId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).reverse();
}

/** 从第 offset 条开始（按时间正序）取 limit 条：摘要之后还没压缩的消息就是这样取的 */
export async function listMessagesFrom(userId: string, threadId: string, offset: number, limit = 200): Promise<MessageRow[]> {
  const { data, error } = await db()
    .from('assistant_messages')
    .select('id, role, text, meta, created_at')
    .eq('user_id', userId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function appendMessage(userId: string, threadId: string, role: 'user' | 'assistant', text: string, meta?: Record<string, unknown> | null): Promise<void> {
  const { error } = await db()
    .from('assistant_messages')
    .insert({ user_id: userId, thread_id: threadId, role, text, meta: meta ?? null });
  if (error) throw error;
  await db().from('assistant_threads').update({ updated_at: new Date().toISOString() }).eq('user_id', userId).eq('id', threadId);
}

export async function saveSummary(userId: string, threadId: string, summary: string, summarizedCount: number): Promise<void> {
  const { error } = await db()
    .from('assistant_threads')
    .update({ summary, summarized_count: summarizedCount })
    .eq('user_id', userId)
    .eq('id', threadId);
  if (error) throw error;
}

export async function listMemories(userId: string, limit = 60): Promise<MemoryRow[]> {
  const { data, error } = await db()
    .from('assistant_memories')
    .select('id, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * 记下一条记忆。隐私信息拒收；已经记着的同一件事不重复记（返回 duplicate）；
 * 超过数量上限时，先删最早的那条，保证新的能记进去。
 */
export async function addMemory(
  userId: string,
  raw: unknown,
): Promise<{ ok: true; memory: MemoryRow; duplicate?: boolean } | { ok: false; reason: string }> {
  const check = checkMemoryText(raw);
  if (!check.ok) return { ok: false, reason: check.reason ?? '记不下来' };
  const existing = await listMemories(userId, MEMORY_MAX_COUNT);
  const same = existing.find((m) => sameMemory(m.content, check.text));
  if (same) return { ok: true, memory: same, duplicate: true };
  const { count, error: countError } = await db()
    .from('assistant_memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError) throw countError;
  if ((count ?? 0) >= MEMORY_MAX_COUNT) {
    const { data: oldest } = await db()
      .from('assistant_memories')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    const id = oldest?.[0]?.id;
    if (id) await db().from('assistant_memories').delete().eq('user_id', userId).eq('id', id);
  }
  const { data, error } = await db()
    .from('assistant_memories')
    .insert({ user_id: userId, content: check.text })
    .select('id, content, created_at')
    .single();
  if (error || !data) throw error ?? new Error('memory not saved');
  return { ok: true, memory: data as MemoryRow };
}

/** 修改一条已经记着的记忆（只能改自己的）。找不到这条就返回 not_found */
export async function updateMemory(
  userId: string,
  id: string,
  raw: unknown,
): Promise<{ ok: true; memory: MemoryRow } | { ok: false; reason: string }> {
  const check = checkMemoryText(raw);
  if (!check.ok) return { ok: false, reason: check.reason ?? '记不下来' };
  const { data, error } = await db()
    .from('assistant_memories')
    .update({ content: check.text })
    .eq('user_id', userId)
    .eq('id', id)
    .select('id, content, created_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, reason: '找不到这条记忆' };
  return { ok: true, memory: data as MemoryRow };
}

export async function deleteMemory(userId: string, id: string): Promise<void> {
  const { error } = await db().from('assistant_memories').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
