import { describe, it, expect } from 'vitest';
import {
  normalizeTimestamp,
  sanitizeMessages,
  matchesGeneration,
  MAX_MESSAGES,
} from '@/lib/chat-message-utils';

describe('normalizeTimestamp', () => {
  it('数字原样返回', () => {
    expect(normalizeTimestamp(1758441600000)).toBe(1758441600000);
  });

  it('ISO 字符串转成毫秒数', () => {
    // 持续对话弹窗存的是 Date 序列化后的字符串，读回时必须转回数字，
    // 否则界面上 timestamp.toLocaleTimeString() 会直接抛错
    const iso = '2026-09-21T10:00:00.000Z';
    expect(normalizeTimestamp(iso)).toBe(Date.parse(iso));
  });

  it('非法值兜底为当前时间而不是 NaN', () => {
    const before = Date.now();
    for (const bad of [undefined, null, 'abc', {}, NaN, Infinity]) {
      const out = normalizeTimestamp(bad);
      expect(Number.isFinite(out)).toBe(true);
      expect(out).toBeGreaterThanOrEqual(before);
    }
  });
});

describe('sanitizeMessages', () => {
  it('非数组一律返回空数组', () => {
    expect(sanitizeMessages(null)).toEqual([]);
    expect(sanitizeMessages('hi')).toEqual([]);
    expect(sanitizeMessages({ role: 'user' })).toEqual([]);
  });

  it('丢弃角色非法的条目', () => {
    const out = sanitizeMessages([
      { role: 'user', content: '你好' },
      { role: 'system', content: '越权内容' },
      { role: 'assistant', content: '在的' },
      null,
      'not an object',
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('content 非字符串时归一为空串，不写入 undefined', () => {
    const out = sanitizeMessages([{ role: 'user', content: { nested: true } }]);
    expect(out[0].content).toBe('');
  });

  it('timestamp 数字与字符串都原样保留', () => {
    const out = sanitizeMessages([
      { role: 'user', content: 'a', timestamp: 123 },
      { role: 'assistant', content: 'b', timestamp: '2026-09-21T10:00:00Z' },
    ]);
    expect(out[0].timestamp).toBe(123);
    expect(out[1].timestamp).toBe('2026-09-21T10:00:00Z');
  });

  it('超长会话只保留最近的部分，且保的是末尾不是开头', () => {
    const many = Array.from({ length: MAX_MESSAGES + 30 }, (_, i) => ({
      role: 'user' as const,
      content: String(i),
    }));
    const out = sanitizeMessages(many);
    expect(out).toHaveLength(MAX_MESSAGES);
    // 末尾必须是最后一条，否则用户看到的会是被截断的旧上下文
    expect(out[out.length - 1].content).toBe(String(MAX_MESSAGES + 29));
  });
});

describe('matchesGeneration 认回追问对话', () => {
  const content = '这是一条生成出来的脚本正文'.repeat(30);

  it('同一次生成能认回', () => {
    expect(matchesGeneration({ role: 'assistant', content }, content)).toBe(true);
  });

  it('长度不同直接判否', () => {
    expect(matchesGeneration({ role: 'assistant', content: content + '尾巴' }, content)).toBe(false);
  });

  it('开头不同判否', () => {
    const other = '完全不同的开头' + content.slice(7);
    expect(matchesGeneration({ role: 'assistant', content: other }, content)).toBe(false);
  });

  it('首条不是 assistant 判否', () => {
    // 第一条必须是生成结果本身；若是用户消息说明这不是追问对话的开头
    expect(matchesGeneration({ role: 'user', content }, content)).toBe(false);
  });

  it('空记录判否而不是抛错', () => {
    expect(matchesGeneration(undefined, content)).toBe(false);
    expect(matchesGeneration({ role: 'assistant' }, content)).toBe(false);
  });
});
