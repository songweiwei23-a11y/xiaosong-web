/**
 * 首页待办：数据形状、输入清洗、截止时间的说法。前后端共用。
 */

export const TODO_MAX_LEN = 200;

export interface Todo {
  id: string;
  content: string;
  due_at: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
}

/** 接口收到的原始输入 → 能入库的值。内容去空白、截长度；时间认不出就当没填 */
export function normalizeTodoInput(body: unknown): { content: string; dueAt: string | null } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const content = typeof b.content === 'string' ? b.content.trim().slice(0, TODO_MAX_LEN) : '';
  let dueAt: string | null = null;
  if (typeof b.dueAt === 'string' && b.dueAt.trim()) {
    const d = new Date(b.dueAt);
    if (!Number.isNaN(d.getTime())) dueAt = d.toISOString();
  }
  return { content, dueAt };
}

/** 没做完的排前面：有截止时间的按时间先后，没有的排在它们后面、按新建先后 */
export function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.done_at ?? '').localeCompare(a.done_at ?? '');
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at || b.due_at) return a.due_at ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

/**
 * 截止时间怎么说。说人话、分轻重：过期的要看得出来，但不用刺眼的红——
 * 首页是每天打开的地方，满屏报警只会让人不想看。
 */
export function describeDue(dueAt: string | null, now: Date = new Date()): { text: string; tone: 'overdue' | 'soon' | 'normal' } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const hm = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
  const dayMs = 24 * 60 * 60 * 1000;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(now)) / dayMs);

  if (due.getTime() < now.getTime()) {
    return { text: days === 0 ? `今天 ${hm} 已过` : `已过 ${Math.max(1, -days)} 天`, tone: 'overdue' };
  }
  if (days === 0) return { text: `今天 ${hm}`, tone: 'soon' };
  if (days === 1) return { text: `明天 ${hm}`, tone: 'soon' };
  if (days < 7) return { text: `${days} 天后 · ${due.getMonth() + 1}月${due.getDate()}日`, tone: 'normal' };
  return { text: `${due.getMonth() + 1}月${due.getDate()}日 ${hm}`, tone: 'normal' };
}
