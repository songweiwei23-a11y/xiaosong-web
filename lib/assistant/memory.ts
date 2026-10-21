/**
 * 助理的记忆和长期对话：纯逻辑（不碰数据库），服务端和测试都用。
 *   - 记忆：助理记下来的长期有用的事（偏好、账号情况、要做的计划）。隐私信息不记。
 *   - 长期对话：消息很多时，早前的部分压缩成摘要，最近的原文保留，既不断片也不超长。
 */

/** 一条记忆最多多少字 */
export const MEMORY_MAX_CHARS = 200;
/** 每个用户最多保留多少条记忆 */
export const MEMORY_MAX_COUNT = 200;
/** 对话超过这么多条，才开始压缩旧消息 */
export const SUMMARY_THRESHOLD = 24;
/** 压缩后保留的最近原文条数 */
export const KEEP_RECENT = 12;
/** 带给模型的最近消息：条数和每条字数上限 */
export const CONTEXT_MESSAGES = 24;
export const CONTEXT_MESSAGE_CHARS = 1200;

/** 隐私：这些东西不记进记忆 */
const SENSITIVE = [
  /密码|口令|验证码|password|passwd|token|密钥|secret/i,
  /身份证|护照|银行卡|卡号|信用卡|社保号/,
  /(?<!\d)1[3-9]\d{9}(?!\d)/,
  /(?<!\d)\d{15}(\d{2}[\dXx])?(?!\d)/,
];

export interface MemoryCheck {
  ok: boolean;
  text: string;
  reason?: string;
}

/** 记忆内容检查：整理成一句话，超长截断，隐私信息拒收 */
export function checkMemoryText(raw: unknown): MemoryCheck {
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!text) return { ok: false, text: '', reason: '记忆内容是空的' };
  if (SENSITIVE.some((re) => re.test(text))) return { ok: false, text: '', reason: '这类隐私信息（密码、证件号、银行卡、手机号）不记' };
  return { ok: true, text: text.slice(0, MEMORY_MAX_CHARS) };
}

/**
 * 两条记忆是不是同一件事：去掉空白和标点、不分大小写后完全相同。
 * 只做这一层，避免把「我主营川菜」和「我主营川菜、客单价 50」这种不同的事当成重复。
 */
export function sameMemory(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
  const x = norm(a);
  return x.length > 0 && x === norm(b);
}

export interface MemoryForPrompt {
  id: string;
  content: string;
}

/**
 * 写进系统提示的记忆块。每条带上编号，模型要修改或忘掉某一条时用得上。没有记忆就是空串。
 */
export function memoryPromptBlock(memories: MemoryForPrompt[]): string {
  const list = memories.filter((m) => m.content.trim()).slice(0, 60);
  if (!list.length) return '';
  return [
    '',
    '用户的记忆（你之前记下来的长期信息；只在和当前问题相关时用，不要逐条复述给用户）。方括号里是编号：要修改某一条，用 remember 并填 replaceId；用户要忘掉某一条，用 propose_forget 并填 memoryId。',
    ...list.map((m) => `- [${m.id}] ${m.content.trim()}`),
  ].join('\n');
}

/** 对话消息数超过阈值、并且还有没压缩的旧消息时，才需要压缩 */
export function needsSummary(total: number, summarizedCount: number, keepRecent = KEEP_RECENT, threshold = SUMMARY_THRESHOLD): boolean {
  return total > threshold && summarizedCount < total - keepRecent;
}

/** 这一次要压缩的消息区间 [start, end)：已经压缩过的之后、最近原文之前 */
export function summaryRange(total: number, summarizedCount: number, keepRecent = KEEP_RECENT): [number, number] {
  return [summarizedCount, Math.max(summarizedCount, total - keepRecent)];
}

/**
 * 带给模型的上下文：传进来的是「摘要之后还没压缩的消息」（按时间正序），这里只取最近的、并限制每条字数。
 * 更早的内容已经在摘要里了（见 summaryPromptBlock）。
 */
export function threadContext<T extends { role: 'user' | 'assistant'; text: string }>(pending: T[]): { history: { role: 'user' | 'assistant'; text: string }[] } {
  return {
    history: pending.slice(-CONTEXT_MESSAGES).map((m) => ({ role: m.role, text: m.text.slice(0, CONTEXT_MESSAGE_CHARS) })),
  };
}

/** 摘要块：写进系统提示，告诉模型早前聊过什么。没有摘要就是空串 */
export function summaryPromptBlock(summary: string): string {
  const s = summary.trim();
  if (!s) return '';
  return ['', '本次对话早前的摘要（较早的消息已经压缩成这段，参考它理解上下文）：', s].join('\n');
}

/** 对话标题：取第一句话的前 24 个字 */
export function titleOf(text: string): string {
  const first = text.replace(/\s+/g, ' ').trim().split(/[。！？!?\n]/)[0] || '';
  const t = first.slice(0, 24).trim();
  return t || '新对话';
}
