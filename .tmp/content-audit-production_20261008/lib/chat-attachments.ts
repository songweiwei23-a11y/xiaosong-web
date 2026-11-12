export const MAX_CHAT_FILES = 6;
export const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
export const CHAT_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx,.csv,.pptx,.txt,.md,.html,.xml';
export const CHAT_FILE_EXTENSIONS = new Set(CHAT_FILE_ACCEPT.split(',').map(x => x.slice(1)));
export const FILE_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'document';
  storagePath: string;
  token: string;
}

export function chatFileType(name: string): ChatAttachment['type'] | null {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (!CHAT_FILE_EXTENSIONS.has(ext)) return null;
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? 'image' : 'document';
}

/** 历史 JSON 只保存服务器返回的文件元数据，永不保存浏览器 Blob 或任意远程链接。 */
export function sanitizeAttachments(input: unknown): ChatAttachment[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x): x is ChatAttachment => !!x && typeof x === 'object' &&
    typeof x.id === 'string' && FILE_UUID.test(x.id) &&
    typeof x.name === 'string' && x.name.length > 0 && x.name.length <= 180 &&
    typeof x.size === 'number' && x.size > 0 && x.size <= MAX_CHAT_FILE_BYTES &&
    chatFileType(x.name) === x.type &&
    typeof x.storagePath === 'string' && /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-z0-9.]+$/i.test(x.storagePath) &&
    typeof x.token === 'string' && /^[a-f0-9]{64}$/.test(x.token)
  ).slice(0, MAX_CHAT_FILES).map(x => ({
    id: x.id, name: x.name, size: x.size, type: x.type, storagePath: x.storagePath, token: x.token,
  }));
}

export function chatFileUrl(file: ChatAttachment, download = false): string {
  const params = new URLSearchParams({ path: file.storagePath, name: file.name });
  if (download) params.set('download', '1');
  return `/api/chat-files?${params}`;
}

export function chatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** 新上传文件只读本轮；无新文件时追问最近一批，避免旧图片混入新文档。 */
export function conversationAttachments(messages: Array<{ role: string; attachments?: ChatAttachment[] }>, selected: ChatAttachment[]): ChatAttachment[] {
  const result: ChatAttachment[] = [];
  const seen = new Set<string>();
  const add = (files: ChatAttachment[]) => files.forEach(file => {
    if (!seen.has(file.id) && result.length < MAX_CHAT_FILES) { seen.add(file.id); result.push(file); }
  });
  add(selected);
  if (!selected.length) {
    for (const message of [...messages].reverse()) {
      if (message.role === 'user' && message.attachments?.length) { add(message.attachments); break; }
    }
  }
  return result;
}
