/**
 * 方向种子（2026-10-26）：创作方向是「一个核心目的下的角度地图」。选题拿到的种子只带：
 * 方向名、核心目的（不能改）、范围、切入角度、题眼池。人群、讲法、标题、第一秒、镜头一概不带，
 * 否则方向原文里写死的人群和写法会被每条选题照抄。
 * 每条选题从题眼池里分到一个题眼（lib/topic-slots），题眼不同，选题才不同。
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
 * 一个字段下面的列表：字段行同一行的值 + 之后的列表行，直到下一个「- **字段**」或标题。
 * 切入角度、题眼池都是这样写的。
 */
function listUnder(text: string, label: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^\\s*[-*]?\\s*\\**${label}\\**\\s*[：:]`).test(l));
  if (start < 0) return [];
  const out: string[] = [];
  const inline = lines[start].replace(new RegExp(`^.*?${label}\\**\\s*[：:]`), '').replace(/\*\*/g, '').trim();
  if (inline) out.push(inline);
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*[-*]\s*\*\*/.test(l) || /^#{1,4}\s/.test(l)) break;
    const t = l.replace(/^\s*[-*]\s*/, '').replace(/\*\*/g, '').trim();
    if (t) out.push(t);
  }
  return out;
}

/**
 * 只取方向的种子：名字、核心目的、范围、切入角度、题眼池。
 * 不是方向原文就返回 null。
 */
export function directionSeedOf(text: string): string | null {
  if (!isDirectionBlock(text)) return null;
  const name = text.match(/^###\s*方向\s*\d+[：:]\s*(.+?)\s*$/m)?.[1]?.replace(/\*\*/g, '').trim() ?? '';
  const purpose = fieldOf(text, '核心目的') || fieldOf(text, '视频目的') || fieldOf(text, '对应目的');
  const scope = fieldOf(text, '内容方向');
  const lines = [
    name && `方向：${name}`,
    purpose && `核心目的（不能改）：${purpose}`,
    scope && `范围：${scope}`,
    ...listUnder(text, '切入角度').map((a) => `角度：${a}`),
    ...listUnder(text, '题眼池').map((h) => `题眼：${h}`),
  ].filter(Boolean) as string[];
  return lines.length ? lines.join('\n') : null;
}

/** 种子里的题眼，按原来的顺序；选题层用它给每条分配一个题眼 */
export function hooksOfSeed(seed: string): string[] {
  return seed
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('题眼：'))
    .map((l) => l.slice('题眼：'.length).trim())
    .filter(Boolean);
}

/** 选题页用的标题：种子的说明文字，告诉选题层哪些是它自己定的 */
export const DIRECTION_SEED_HEAD = '【方向种子（核心目的不能改；每条选题从题眼池里取一个题眼展开，各条题眼不同）】';
