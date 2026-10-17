/**
 * 评论区 → 选题（体检 F1）：挑出观众反复问的问题。只看疑问句，同类合并，按次数排。
 */
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import { cleanCommentLine, extractCommentQuestions, questionsAsRequirement } from '@/lib/comment-questions';

describe('清理一行评论', () => {
  it('去掉序号、@某人、表情、时间戳', () => {
    expect(cleanCommentLine('1. @小明 多少钱啊？😍')).toBe('多少钱啊？');
    expect(cleanCommentLine('- 这个能用在小房子里吗 03-12 10:30')).toBe('这个能用在小房子里吗');
  });
});

describe('挑出问题', () => {
  const raw = [
    '这个多少钱啊？',
    '太好看了！',
    '多少钱？',
    '怎么预约呀',
    '能不能上门量尺寸吗',
    '怎么预约？',
    '太短了',
    '',
    '好的好的好的好的',
  ].join('\n');

  it('只留疑问句；同一个问题的不同说法归到一起，次数加起来', () => {
    const q = extractCommentQuestions(raw);
    expect(q.map((x) => x.question)).not.toContain('太好看了！');
    const price = q.find((x) => x.question.includes('多少钱'));
    expect(price?.count).toBe(2);
    const book = q.find((x) => x.question.includes('怎么预约'));
    expect(book?.count).toBe(2);
  });

  it('按次数从多到少排；最多返回 max 类', () => {
    const q = extractCommentQuestions(raw, 2);
    expect(q).toHaveLength(2);
    expect(q[0].count).toBeGreaterThanOrEqual(q[1].count);
  });

  it('没有问句、太短、太长，都不算', () => {
    expect(extractCommentQuestions('很好\n不错的视频\n' + '字'.repeat(130) + '？')).toEqual([]);
  });
});

describe('放进选题要求', () => {
  it('列出挑中的问题；没挑就是空', () => {
    expect(questionsAsRequirement([])).toBe('');
    expect(questionsAsRequirement(['多少钱？', '能上门吗？'])).toBe(
      '【评论区里观众反复问的问题（选题要直接回应其中的一部分）】\n- 多少钱？\n- 能上门吗？',
    );
  });
});

describe('接线：选题页放了评论区提取', () => {
  it('选题页引入了组件，并接到「个人要求」上', () => {
    const page = readCode('app/dashboard/topic/page.tsx');
    expect(page).toMatch(/import \{ CommentQuestions \} from '@\/components\/topic\/CommentQuestions'/);
    expect(page).toMatch(/<CommentQuestions onPick=\{\(text\) => setPersonalRequirement/);
  });
});
