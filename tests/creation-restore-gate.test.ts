import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { NETWORK_ERROR_HINT } from '@/lib/api-error';

const ID = '00000000-0000-4000-8000-000000000001';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effectCursor: 0,
  effectsMounted: false,
  effectDeps: [] as unknown[][],
  cleanups: [] as Array<() => void>,
  pending: [] as Array<() => void | (() => void)>,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const slot = harness.cursor++;
      if (!(slot in harness.slots)) harness.slots[slot] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [harness.slots[slot], (value: unknown) => {
        harness.slots[slot] = typeof value === 'function' ? (value as (prev: unknown) => unknown)(harness.slots[slot]) : value;
      }];
    },
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
      const index = harness.effectCursor++;
      const prev = harness.effectDeps[index];
      const changed = !deps || !prev || deps.length !== prev.length || deps.some((item, i) => !Object.is(item, prev[i]));
      if (!harness.effectsMounted || changed) {
        harness.effectDeps[index] = deps ?? [];
        harness.pending.push(effect);
      }
    },
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/script',
  useSearchParams: () => ({ get: (key: string) => (key === 'creation' ? ID : null) }),
}));

import { CreationRestoreGate } from '@/components/workspace/CreationRestoreGate';

type Node = { type: unknown; props: { children?: ReactNode; onClick?: () => void; role?: string } };
let tree: ReactNode;

const memory = new Map<string, string>();
const fetchMock = vi.fn();

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && node && 'props' in node) return textOf((node as Node).props.children);
  return '';
}

function findButton(label: string): Node {
  const visit = (node: ReactNode): Node | undefined => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) return found;
      }
      return;
    }
    if (node && typeof node === 'object' && 'props' in node) {
      const element = node as Node;
      if (element.type === 'button' && textOf(element.props.children).includes(label)) return element;
      return visit(element.props.children);
    }
  };
  const found = visit(tree);
  if (!found) throw new Error(`找不到按钮：${label}`);
  return found;
}

function render() {
  harness.cursor = 0;
  harness.effectCursor = 0;
  harness.pending = [];
  tree = CreationRestoreGate({ children: createElement('span', null, '创作表单') });
}

function runPending() {
  const effects = harness.pending.splice(0);
  if (harness.effectsMounted && effects.length) {
    harness.cleanups.forEach((cleanup) => cleanup());
    harness.cleanups = [];
  }
  for (const effect of effects) {
    const cleanup = effect();
    if (typeof cleanup === 'function') harness.cleanups.push(cleanup);
  }
  harness.effectsMounted = true;
}

const payload = { from: '选题策划', target: '/dashboard/script', sourceContent: '口播正文' };
const okResponse = { ok: true, status: 200, json: async () => ({ payload, created_at: '2026-11-11T00:00:00.000Z' }) };

beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
  harness.effectCursor = 0;
  harness.effectsMounted = false;
  harness.effectDeps = [];
  harness.cleanups = [];
  harness.pending = [];
  memory.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  harness.cleanups.forEach((cleanup) => cleanup());
  harness.cleanups = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('恢复创作链接', () => {
  it('第一次 Failed to fetch、第二次返回快照时放行，页面不出现英文原文', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(okResponse);
    render();
    runPending();
    await vi.advanceTimersByTimeAsync(2_000);
    render();
    const text = textOf(tree);
    expect(text).toContain('创作表单');
    expect(text).not.toMatch(/Failed to fetch|Load failed|NetworkError/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('连续失败超过 2 次重试后显示中文提示，重新恢复还会再请求', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render();
    runPending();
    await vi.advanceTimersByTimeAsync(2_000);
    render();
    expect(textOf(tree)).toContain(NETWORK_ERROR_HINT);
    expect(textOf(tree)).not.toMatch(/Failed to fetch/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    findButton('重新恢复').props.onClick?.();
    render();
    runPending();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(3);
  });

  it('离开页面引起的 AbortError 不重试', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    }));
    render();
    runPending();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    harness.cleanups.forEach((cleanup) => cleanup());
    harness.cleanups = [];
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(textOf(tree)).not.toMatch(/Failed to fetch/i);
  });
});
