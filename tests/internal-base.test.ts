import { describe, expect, it } from 'vitest';
import { resolveInternalBase } from '@/lib/assistant/internal-base';
import { internalBase } from '@/lib/assistant/boards';

describe('小助理内部地址', () => {
  it('显式地址原样使用，测试桩不会被改端口', () => {
    expect(resolveInternalBase('http://x', { ASSISTANT_INTERNAL_URL: 'http://127.0.0.1:3000', PORT: '3001' })).toBe('http://x');
    expect(internalBase({ userId: 'u', cookie: 'c', internalBase: 'http://x' })).toBe('http://x');
  });

  it('写死的 3000 或 3001 改成当前进程端口', () => {
    expect(resolveInternalBase(undefined, { ASSISTANT_INTERNAL_URL: 'http://127.0.0.1:3000', PORT: '3001' })).toBe('http://127.0.0.1:3001');
    expect(resolveInternalBase(undefined, { ASSISTANT_INTERNAL_URL: 'http://localhost:3001/', PORT: '3000' })).toBe('http://localhost:3000');
  });

  it('留空用当前端口；Nginx 本机入口保持不变', () => {
    expect(resolveInternalBase(undefined, { PORT: '3001' })).toBe('http://127.0.0.1:3001');
    expect(resolveInternalBase(undefined, { ASSISTANT_INTERNAL_URL: 'http://127.0.0.1', PORT: '3001' })).toBe('http://127.0.0.1');
    expect(resolveInternalBase(undefined, { ASSISTANT_INTERNAL_URL: 'https://www.example.com', PORT: '3001' })).toBe('https://www.example.com');
  });
});
