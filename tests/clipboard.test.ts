/**
 * http 访问时复制按钮要能用（2026-10-03 线上实测：http://IP 不是安全连接，浏览器不给 navigator.clipboard，
 * 全站 25 处复制按钮失效，有的还谎报"已复制"）
 */
import { describe, it, expect, afterEach } from 'vitest';
import { copyText, installClipboardFallback } from '@/lib/clipboard';
import { readCode } from './helpers/source';

const g = globalThis as unknown as Record<string, unknown>;
const saved = { navigator: g.navigator, document: g.document };

function fakeDom(execResult: boolean) {
  const copied: string[] = [];
  let current = '';
  const doc = {
    createElement: () => ({ value: '', style: {}, setAttribute() {}, select() { current = (this as { value: string }).value; }, setSelectionRange() {} }),
    body: { appendChild() {}, removeChild() {} },
    getSelection: () => null,
    execCommand: (cmd: string) => { if (cmd === 'copy' && execResult) copied.push(current); return execResult; },
  };
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
  return copied;
}

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', { value: saved.navigator, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: saved.document, configurable: true, writable: true });
});

describe('复制兼容层', () => {
  it('copyText 用临时文本框 + execCommand 复制，成功返回 true', () => {
    const copied = fakeDom(true);
    expect(copyText('一元火锅怎么吃最值')).toBe(true);
    expect(copied).toEqual(['一元火锅怎么吃最值']);
  });

  it('复制失败返回 false（不谎报）', () => {
    fakeDom(false);
    expect(copyText('x')).toBe(false);
  });

  it('浏览器没有剪贴板接口时补上，writeText 能用；失败时 reject，原来的 try/catch 能接住', async () => {
    const copied = fakeDom(true);
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
    installClipboardFallback();
    const nav = globalThis.navigator as Navigator;
    await nav.clipboard.writeText('脚本正文');
    expect(copied).toEqual(['脚本正文']);
    fakeDom(false);
    await expect(nav.clipboard.writeText('y')).rejects.toThrow('复制失败');
  });

  it('浏览器自带接口在（上了 HTTPS 以后）就不动它', () => {
    const native = { writeText: () => Promise.resolve() };
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: native }, configurable: true, writable: true });
    installClipboardFallback();
    expect((globalThis.navigator as Navigator).clipboard).toBe(native);
  });

  it('根布局挂上了兼容层', () => {
    expect(readCode('app/layout.tsx')).toContain('<ClipboardFallback />');
    expect(readCode('components/ui/ClipboardFallback.tsx')).toMatch(/useEffect\(\(\) => \{\s*installClipboardFallback\(\)/);
  });
});
