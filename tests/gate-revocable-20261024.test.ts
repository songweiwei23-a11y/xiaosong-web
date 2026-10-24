// 门票的可撤销（2026-10-24）：撤销后只挡没有使用记录的人；已注册并有使用记录的账号不受影响；每张门票都有「可撤销」选项。
import { describe, expect, it } from 'vitest';
import { accountBlockedBy, NotRevocableError, ticketRevocable } from '@/lib/gate-tickets';

describe('撤销后拦不拦这个账号', () => {
  it('在拦截名单里、没有使用记录：拦', () => {
    expect(accountBlockedBy({ listed: true, isAdmin: false, hasHistory: false })).toBe(true);
  });

  it('在拦截名单里，但已经有使用记录：不拦（已注册并用过的账号本身不受影响）', () => {
    expect(accountBlockedBy({ listed: true, isAdmin: false, hasHistory: true })).toBe(false);
  });

  it('不在拦截名单里：不拦，不管有没有使用记录', () => {
    expect(accountBlockedBy({ listed: false, isAdmin: false, hasHistory: false })).toBe(false);
    expect(accountBlockedBy({ listed: false, isAdmin: false, hasHistory: true })).toBe(false);
  });

  it('管理员永远不拦：管理员撤了自己的门票，也不能把自己锁在门外', () => {
    expect(accountBlockedBy({ listed: true, isAdmin: true, hasHistory: false })).toBe(false);
  });
});

describe('门票能不能撤销', () => {
  it('明确可撤销的：能撤', () => {
    expect(ticketRevocable({ revocable: true })).toBe(true);
  });

  it('明确不可撤销的：撤不掉', () => {
    expect(ticketRevocable({ revocable: false })).toBe(false);
  });

  it('字段没有（迁移没跑、旧数据）：按能撤销处理，不因此挡住撤销', () => {
    expect(ticketRevocable({})).toBe(true);
    expect(ticketRevocable(null)).toBe(true);
    expect(ticketRevocable(undefined)).toBe(true);
  });

  it('不可撤销的错误是单独的类型，接口据此返回 400 而不是 503', () => {
    const e = new NotRevocableError('这张门票是不可撤销的，撤不掉');
    expect(e).toBeInstanceOf(NotRevocableError);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toContain('不可撤销');
  });
});
