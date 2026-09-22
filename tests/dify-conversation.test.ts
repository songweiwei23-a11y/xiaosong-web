import { describe, it, expect } from 'vitest';
import { buildScopeKey, isInvalidConversationError } from '@/lib/dify-conversation';

describe('会话作用域键：一个账号档案 = 一个工作窗口', () => {
  it('不同档案互不串记忆——代运营管多个号时这是硬边界', () => {
    expect(buildScopeKey('profile-a')).toBe('profile-a');
    expect(buildScopeKey('profile-b')).not.toBe(buildScopeKey('profile-a'));
  });

  /**
   * 早先的键是 `功能:档案`，九个板块各一个会话，隔离得很干净，
   * 代价是板块之间互相不认识：在选题里定了方向，去脚本页它不知道。
   * 现在同一档案下所有板块共用一个窗口，前后才能承接。
   */
  it('同一档案下，所有板块落在同一个窗口里', () => {
    const 脚本 = buildScopeKey('p1');
    const 选题 = buildScopeKey('p1');
    const 自由对话 = buildScopeKey('p1');
    expect(脚本).toBe(选题);
    expect(选题).toBe(自由对话);
  });

  it('无档案时归入 default，键始终非空', () => {
    expect(buildScopeKey(null)).toBe('default');
    expect(buildScopeKey('')).toBe('default');
    expect(buildScopeKey('   ')).toBe('default');
    expect(buildScopeKey()).toBe('default');
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
