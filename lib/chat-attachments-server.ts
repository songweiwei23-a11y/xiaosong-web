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

/** 每份、合计最多放多少字进提问：超了明说截在哪，不悄悄丢 */
export const ATTACHMENT_TEXT_PER_FILE = 15_000;
export const ATTACHMENT_TEXT_TOTAL = 40_000;

/**
 * 附件正文放进提问（2026-10-04）：服务端自己读出 CSV、Excel、Word、PPT、文本的内容，拼成一段直接给模型。
 * 线上出过：文件都传到了工作流，模型却连着几次说「文档正文是空的」——不再只靠工作流的读取节点。
 * 读不了的格式（PDF、图片）不放，交给工作流；某份读坏了写明哪份没读出来，不影响别的。
 * download 由调用方传入（服务端从存储取原文件），方便测试。
 */
export async function attachmentTextBlock(files: ChatAttachment[], download: (file: ChatAttachment) => Promise<Buffer | null>, toText: (name: string, buf: Buffer) => string | null): Promise<string> {
  if (!files.some((f) => f.type === 'document')) return '';
  const parts: string[] = [];
  let used = 0;
  // 编号和提问里「本轮实际提供的附件」清单一致（那份清单图片也编号）
  for (const [i, f] of files.entries()) {
    if (f.type !== 'document') continue;
    let text: string | null = null;
    let failed = '';
    try {
      const buf = await download(f);
      if (!buf) failed = '文件取不到';
      else text = toText(f.name, buf);
    } catch (e) {
      failed = (e as Error).message || '读取失败';
    }
    if (text === null && !failed) continue; // PDF 等交给工作流的「读取文档正文」
    const head = `### 附件${i + 1}：${f.name}`;
    if (failed || !text?.trim()) { parts.push(`${head}\n（这份没读出内容：${failed || '文件里没有文字'}）`); continue; }
    const room = Math.max(0, Math.min(ATTACHMENT_TEXT_PER_FILE, ATTACHMENT_TEXT_TOTAL - used));
    const body = text.length > room ? `${text.slice(0, room)}\n……（这份还有约 ${text.length - room} 字没放进来）` : text;
    used += Math.min(text.length, room);
    parts.push(`${head}\n${body}`);
  }
  if (!parts.length) return '';
  return `\n\n【附件正文（开物服务器已读取，就是用户本轮上传的文件内容）】\n下面就是这些文件的内容，表格已转成 Markdown 表格。直接使用，不要说读不到、不要让用户再发一遍。\n\n${parts.join('\n\n')}`;
}

export function toDifyFiles(files: ChatAttachment[]) {
  return files.map(file => ({ type: file.type, transfer_method: 'local_file', upload_file_id: file.id }));
}
