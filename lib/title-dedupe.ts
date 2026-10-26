/**
 * 重复标题精准小改（2026-10-26）：一批选题里标题重复的，第二次及以后出现的那一行，
 * 只让模型重写这一个标题，并且避开其他已有的标题。别的行一字不动。
 * 采用标准沿用标题后处理（一行、不超标、不是万能模板、不和已有标题相同）。
 */
import { acceptRepair, repairTitlePrompt, titleOfLine } from './title-polish';

export interface DedupeResult {
  text: string;
  tried: number;
  accepted: number;
}

/** 全文里标题重复的次数（第二次及以后的出现） */
export function duplicateTitleCount(text: string): number {
  const seen = new Set<string>();
  let dup = 0;
  for (const line of text.split('\n')) {
    const title = titleOfLine(line);
    if (!title) continue;
    const key = title.replace(/\s+/g, '');
    if (seen.has(key)) dup++;
    else seen.add(key);
  }
  return dup;
}

/**
 * ask：把修改提示词发给模型，返回一行回答；失败返回 null。
 * 改完的标题如果还和已有标题重复，就保留原行。
 */
export async function dedupeTitles(
  text: string,
  ask: (prompt: string) => Promise<string | null>,
  context = '',
): Promise<DedupeResult> {
  const lines = text.split('\n');
  const seen = new Set<string>();
  let tried = 0;
  let accepted = 0;
  for (let i = 0; i < lines.length; i++) {
    const title = titleOfLine(lines[i]);
    if (!title) continue;
    const key = title.replace(/\s+/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    tried++;
    const avoid = [...seen].join('、');
    const prompt = `${repairTitlePrompt(title, context)}\n不要和下面这些已有标题相同或相近：${avoid}`;
    const next = acceptRepair(title, await ask(prompt));
    if (!next || seen.has(next.replace(/\s+/g, ''))) continue;
    lines[i] = lines[i].replace(title, next);
    seen.add(next.replace(/\s+/g, ''));
    accepted++;
  }
  return { text: lines.join('\n'), tried, accepted };
}
