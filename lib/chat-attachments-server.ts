import { createHmac, timingSafeEqual } from 'node:crypto';
import { sanitizeAttachments, MAX_CHAT_FILES, type ChatAttachment } from './chat-attachments';

export const CHAT_FILES_BUCKET = 'chat-attachments';

export function signAttachment(userId: string, file: Omit<ChatAttachment, 'token'>): string {
  const key = process.env.DIFY_API_KEY;
  if (!key) throw new Error('对话服务未配置');
  return createHmac('sha256', key).update(JSON.stringify([userId, file.id, file.name, file.size, file.type, file.storagePath])).digest('hex');
}

/** 验证服务端上传回执，防止伪造其他用户的 Dify 文件或上传路径。 */
export function verifiedAttachments(input: unknown, userId: string): ChatAttachment[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > MAX_CHAT_FILES) throw new Error(`每次最多发送 ${MAX_CHAT_FILES} 个文件`);
  const files = sanitizeAttachments(input);
  if (files.length !== input.length) throw new Error('附件信息不完整，请重新上传');
  for (const file of files) {
    if (!file.storagePath.startsWith(`${userId}/`) || !timingSafeEqual(Buffer.from(file.token, 'hex'), Buffer.from(signAttachment(userId, file), 'hex'))) {
      throw new Error('不能使用其他账号的附件，请重新上传');
    }
  }
  return files;
}

export function toDifyFiles(files: ChatAttachment[]) {
  return files.map(file => ({ type: file.type, transfer_method: 'local_file', upload_file_id: file.id }));
}
