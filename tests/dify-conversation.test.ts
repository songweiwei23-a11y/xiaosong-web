import { describe, it, expect } from 'vitest';
import { buildScopeKey, isInvalidConversationError } from '@/lib/dify-conversation';

describe('会话作用域键', () => {
  it('按 功能 + 档案 组合，保证不同档案互不串记忆', () => {
    expect(buildScopeKey('脚本生成', 'profile-a')).toBe('脚本生成:profile-a');
    expect(buildScopeKey('脚本生成', 'profile-b')).not.toBe(buildScopeKey('脚本生成', 'profile-a'));
  });

  it('同一档案下不同功能各自独立', () => {
    expect(buildScopeKey('脚本生成', 'p1')).not.toBe(buildScopeKey('选题策划', 'p1'));
  });

  it('无档案时归入 default，键始终非空', () => {
    expect(buildScopeKey('脚本生成', null)).toBe('脚本生成:default');
    expect(buildScopeKey('脚本生成', '')).toBe('脚本生成:default');
    expect(buildScopeKey('脚本生成', '   ')).toBe('脚本生成:default');
    expect(buildScopeKey('脚本生成')).toBe('脚本生成:default');
  });

  it('任务类型缺失也不会产出空键', () => {
    expect(buildScopeKey('', null)).toBe('unknown:default');
  });
});

describe('会话失效判定', () => {
  it('404 视为失效', () => {
    expect(isInvalidConversationError(404, '')).toBe(true);
  });

  it('400 且提示会话不存在时视为失效', () => {
    expect(isInvalidConversationError(400, '{"message":"Conversation does not exist"}')).toBe(true);
    expect(isInvalidConversationError(400, 'conversation not found')).toBe(true);
    expect(isInvalidConversationError(400, 'Invalid conversation id')).toBe(true);
  });

  it('其它 400 不误判为失效，避免把真实错误当成会话问题重试', () => {
    expect(isInvalidConversationError(400, '{"message":"quota exceeded"}')).toBe(false);
    expect(isInvalidConversationError(400, 'invalid api key')).toBe(false);
  });

  it('5xx 不视为会话失效', () => {
    expect(isInvalidConversationError(500, 'internal error')).toBe(false);
    expect(isInvalidConversationError(503, 'unavailable')).toBe(false);
  });
});
