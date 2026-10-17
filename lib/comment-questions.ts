/**
 * 评论区 → 选题（体检 F1）：把贴进来的评论里反复出现的问题挑出来，给选题当素材。
 *
 * 不调模型、不花额度：只看带问号或疑问词的句子，去掉表情、@、序号，按字面相似度归成一类，数次数。
 * 归类用的是 lib/preferences 的 sameMeaning（两个字的重合度），所以「多少钱啊」和「多少钱？」会并到一起。
 */
import { sameMeaning } from './preferences';

const QUESTION = /[?？]|吗|呢|怎么|为什么|为啥|多少|几块|多久|能不能|可不可以|可以吗|是不是|哪里|哪家|哪个|值不值|会不会|有没有|要不要|咋/;

/** 去掉行首的序号、符号、@某人、表情和时间戳 */
export function cleanCommentLine(line: string): string {
  return line
    .replace(/^\s*(\d+[.、)）]|[-*•·>]+)\s*/, '')
    .replace(/@\S+/g, '')
    .replace(/\[[^\]]{1,6}\]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\d{1,2}[-/:]\d{1,2}(\s+\d{1,2}:\d{2})?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CommentQuestion {
  /** 一类问题的代表句（第一次出现的那句） */
  question: string;
  /** 同类问题出现了几次 */
  count: number;
}

/**
 * 从原文里挑出问题句，归类后按次数排序，最多 max 类。
 * 太短（不足 4 字）或太长（超过 120 字）的不算；没有疑问的不算。
 */
export function extractCommentQuestions(raw: string, max = 10): CommentQuestion[] {
  const groups: CommentQuestion[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const q = cleanCommentLine(line);
    if (q.length < 4 || q.length > 120 || !QUESTION.test(q)) continue;
    const hit = groups.find((g) => sameMeaning(g.question, q));
    if (hit) hit.count += 1;
    else groups.push({ question: q, count: 1 });
  }
  return groups.sort((a, b) => b.count - a.count || a.question.length - b.question.length).slice(0, max);
}

/** 放进选题的「个人要求」里时的一段话：列出挑中的问题，让选题照着观众真正在问的来想 */
export function questionsAsRequirement(picked: string[]): string {
  if (!picked.length) return '';
  return `【评论区里观众反复问的问题（选题要直接回应其中的一部分）】\n${picked.map((q) => `- ${q}`).join('\n')}`;
}
