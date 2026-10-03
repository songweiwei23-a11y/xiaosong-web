import { describe, it, expect } from 'vitest';
import { applyChatAnswer } from '@/lib/chat-stream-answer';
import { freeChatSearchQuery } from '@/lib/free-chat-search';

describe('对话流与联网意图', () => {
  it('完整替换事件不会把整篇回答追加一遍，完成事件不算正文', () => {
    let answer = applyChatAnswer('', { event: 'message', answer: '半段草稿' });
    answer = applyChatAnswer(answer, { event: 'message_replace', answer: '最终答复' });
    answer = applyChatAnswer(answer, { event: 'message_end', answer: '最终答复' });
    expect(answer).toBe('最终答复');
    expect(applyChatAnswer(answer, { event: 'agent_message', answer: '补充' })).toBe('最终答复补充');
  });
  it('读附件的长问题不会淹没后面的联网要求', () => {
    const question = '请读取六个附件并核对颜色、暗号、预算和表格金额。'.repeat(8) + '再联网查 Dify 官方 Document Extractor 文档并提供链接。';
    expect(freeChatSearchQuery(question)).toBe('联网查 Dify 官方 Document Extractor 文档并提供链接。');
    expect(freeChatSearchQuery('今天有什么科技新闻？')).toBe('今天有什么科技新闻？');
  });
});
