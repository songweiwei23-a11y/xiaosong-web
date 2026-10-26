/**
 * 方向种子（2026-10-26）：创作方向只给「范围」，选题层才定人群、拍法、标题和细节。
 * 方向原文整段带给选题，会把写死的人群、讲法、标题、第一秒照抄进每一条选题，结果一个模板。
 * 这里从方向原文里只取范围和切入角度，人、货、场、讲法、标题、镜头一概不带。
 */

/** 是不是一条「方向」：有「### 方向N」标题，并且写了内容方向 */
export function isDirectionBlock(text: string): boolean {
  return /^###\s*方向\s*\d+/m.test(text) && /内容方向\**\s*[：:]/.test(text);
}

/** 取一行「**标签**：值」的值，标签前后的加粗符号忽略 */
function fieldOf(text: string, label: string): string {
  const m = text.match(new RegExp(`(?:^|\\n)\\s*[-*]?\\s*\\**${label}\\**\\s*[：:]\\s*([^\\n]+)`));
  return m ? m[1].replace(/\*\*/g, '').trim() : '';
}

/**
 * 只取方向的种子：名字、范围、切入角度、大致目的（目的只是提示，选题层可以调整）。
 * 不是方向原文就返回 null。
 */
export function directionSeedOf(text: string): string | null {
  if (!isDirectionBlock(text)) return null;
  const name = text.match(/^###\s*方向\s*\d+[：:]\s*(.+?)\s*$/m)?.[1]?.replace(/\*\*/g, '').trim() ?? '';
  const scope = fieldOf(text, '内容方向');
  const angle = fieldOf(text, '为什么');
  const purpose = fieldOf(text, '视频目的') || fieldOf(text, '对应目的');
  const lines = [
    name && `方向：${name}`,
    scope && `范围：${scope}`,
    angle && `切入角度：${angle}`,
    purpose && `大致目的（可调整，选题层决定）：${purpose}`,
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

/** 选题页用的标题：种子的说明文字，告诉选题层哪些是它自己定的 */
export const DIRECTION_SEED_HEAD = '【方向种子（只定范围和切入角度；人群、拍法、标题、细节由选题层决定，每条选题各自不同）】';
