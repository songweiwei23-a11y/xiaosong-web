/**
 * 选题一批的条数够不够（2026-10-27）：模型偶尔只写到一半或少写几条，要自动补一次。
 * 数条数用选题库的拆分规则（lib/topic-library），和保存、列表用的是同一套。
 */

import { splitTopicSections } from '@/lib/topic-library';

export function countTopicsIn(markdown: string): number {
  return splitTopicSections(markdown).length;
}

/**
 * 条数不够就补写一次。again 每调一次就是一次生成，会扣一次额度，所以最多补一次。
 * 补的那次出错、或者条数没有比第一次多，都保留第一次的结果，不把它丢掉。
 */
export async function completeBatch(first: string, expected: number, again: () => Promise<string>): Promise<string> {
  if (countTopicsIn(first) >= expected) return first;
  try {
    const second = await again();
    return countTopicsIn(second) > countTopicsIn(first) ? second : first;
  } catch (error) {
    console.warn('选题条数不足，自动补写没有成功，保留第一次的结果', error);
    return first;
  }
}
