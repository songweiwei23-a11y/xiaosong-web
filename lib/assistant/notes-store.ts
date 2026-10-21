import { getServiceSupabase } from '@/lib/admin-auth';

/**
 * 助理的笔记（升级方案 B4）：创意想法、临时记下的要点，比待办更适合放这里。
 * 只用服务端（service role）读写，每个函数都带 userId 过滤。
 */

export const NOTE_MAX_LEN = 1000;

export interface NoteRow {
  id: string;
  content: string;
  created_at: string;
}

const db = () => getServiceSupabase();

/** 去空白、截长度；空的返回 null */
export function normalizeNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().slice(0, NOTE_MAX_LEN);
  return text || null;
}

export async function listNotes(userId: string, limit = 30): Promise<NoteRow[]> {
  const { data, error } = await db()
    .from('assistant_notes')
    .select('id, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NoteRow[];
}

export async function addNote(userId: string, content: string): Promise<NoteRow> {
  const { data, error } = await db()
    .from('assistant_notes')
    .insert({ user_id: userId, content })
    .select('id, content, created_at')
    .single();
  if (error || !data) throw error ?? new Error('note not saved');
  return data as NoteRow;
}

export async function deleteNote(userId: string, id: string): Promise<void> {
  const { error } = await db().from('assistant_notes').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
