import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

// 不依赖真实账号或浏览器网络；运行真实页面事件处理器，观察状态与导航。
const harness = vi.hoisted(() => ({
  slots: [] as any[],
  cursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  effectsMounted: false,
  getSession: vi.fn(),
  signIn: vi.fn(),
  assign: vi.fn(),
}));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: any) => {
      harness.slots[slot] = typeof value === 'function' ? value(harness.slots[slot]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useEffect: (effect: () => void | (() => void)) => {
    if (!harness.effectsMounted) harness.effects.push(effect);
  },
}));
vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: harness.getSession, signInWithPassword: harness.signIn } },
}));
vi.mock('@/lib/funnel', () => ({ track: vi.fn() }));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('@/components/brand/Brand', () => ({ BrandSeal: () => null, BrandWordmark: () => null }));
vi.mock('@/components/theme/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/auth/AuthTransition', () => ({ AuthTransition: () => null }));

import LoginPage from '@/app/login/page';
import { authErrorText } from '@/lib/auth-errors';
import { postRegistration } from '@/lib/auth-register-request';

type Node = ReactElement<any>;
let tree: Node;
let cleanup: Array<() => void>;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
function render() {
  harness.cursor = 0;
  tree = LoginPage();
}
function find(predicate: (node: Node) => boolean, value: ReactNode = tree): Node {
  const visit = (child: ReactNode): Node | undefined => {
    if (Array.isArray(child)) {
      for (const item of child) { const result = visit(item); if (result) return result; }
    } else if (child && typeof child === 'object' && 'props' in child) {
      const element = child as Node;
      if (predicate(element)) return element;
      return visit(element.props.children);
    }
  };
  const result = visit(value);
  if (!result) throw new Error('Expected element missing');
  return result;
}
const form = () => find((node) => node.type === 'form');
const submit = () => form().props.onSubmit({ preventDefault: vi.fn() }) as Promise<void>;
const button = () => find((node) => node.props.type === 'submit');
const transition = () => find((node) => typeof node.props.onRetry === 'function');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); render(); };
function mount(search = '') {
  (window.location as any).search = search;
  render();
  cleanup = harness.effects.map((effect) => effect()).filter((effect): effect is () => void => typeof effect === 'function');
  harness.effectsMounted = true;
  render();
}
function enter(type: string, value: string) {
  find((node) => node.type === 'input' && node.props.type === type).props.onChange({ target: { value } });
  render();
}
beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
  harness.effects = [];
  harness.effectsMounted = false;
  harness.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  harness.signIn.mockReset().mockResolvedValue({ error: null });
  harness.assign.mockReset();
  cleanup = [];
  vi.stubGlobal('window', { location: { search: '', assign: harness.assign } });
});
afterEach(() => {
  cleanup.forEach((effect) => effect());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('登录交接行为', () => {
  it('初始已有会话时普通导航一次，无需再次提交密码', async () => {
    harness.getSession.mockResolvedValue({ data: { session: { user: { id: 'synthetic' } } } });
    mount();
    await flush();
    expect(harness.assign).toHaveBeenCalledTimes(1);
    expect(harness.assign).toHaveBeenCalledWith('/dashboard');
    expect(harness.signIn).not.toHaveBeenCalled();
    expect(button().props.disabled).toBe(true);
    expect(transition().props.show).toBe(true);
    await submit();
    expect(harness.assign).toHaveBeenCalledTimes(1);
    expect(harness.signIn).not.toHaveBeenCalled();
  });

  it('连续提交只发一次认证，成功后 finally 仍保持按钮禁用和过渡层', async () => {
    const login = deferred<{ error: null }>();
    harness.signIn.mockReturnValue(login.promise);
    mount();
    enter('email', ' test@example.invalid ');
    enter('password', 'synthetic-test-input');
    const first = submit();
    await submit();
    expect(harness.signIn).toHaveBeenCalledTimes(1);
    expect(harness.signIn.mock.calls[0][0].email).toBe('test@example.invalid');
    login.resolve({ error: null });
    await first;
    render();
    expect(harness.assign).toHaveBeenCalledTimes(1);
    expect(harness.assign).toHaveBeenCalledWith('/dashboard');
    expect(button().props.disabled).toBe(true);
    expect(transition().props.show).toBe(true);
    await submit();
    expect(harness.signIn).toHaveBeenCalledTimes(1);
  });

  it('账号错误解除提交锁，可再次登录；迟到的旧会话探测不会导航', async () => {
    const session = deferred<{ data: { session: unknown } }>();
    harness.getSession.mockReturnValue(session.promise);
    harness.signIn.mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
    mount();
    await submit();
    render();
    expect(button().props.disabled).toBe(false);
    session.resolve({ data: { session: { user: { id: 'synthetic' } } } });
    await flush();
    expect(harness.assign).not.toHaveBeenCalled();
    await submit();
    expect(harness.signIn).toHaveBeenCalledTimes(2);
    expect(harness.assign).toHaveBeenCalledTimes(1);
    expect(harness.assign).toHaveBeenCalledWith('/dashboard');
  });

  it('会话探测失败不阻塞表单，在途登录在卸载后完成也不跳转', async () => {
    harness.getSession.mockRejectedValueOnce(new Error('network failure'));
    mount();
    await flush();
    expect(button().props.disabled).toBe(false);
    expect(harness.assign).not.toHaveBeenCalled();
    const login = deferred<{ error: null }>();
    harness.signIn.mockReturnValue(login.promise);
    const pending = submit();
    cleanup.forEach((effect) => effect());
    cleanup = [];
    login.resolve({ error: null });
    await pending;
    expect(harness.assign).not.toHaveBeenCalled();
  });

  it('会话探测在卸载后成功，不更新页面也不导航', async () => {
    const session = deferred<{ data: { session: unknown } }>();
    harness.getSession.mockReturnValue(session.promise);
    mount();
    cleanup.forEach((effect) => effect());
    cleanup = [];
    session.resolve({ data: { session: { user: { id: 'synthetic' } } } });
    await flush();
    expect(harness.assign).not.toHaveBeenCalled();
    expect(transition().props.show).toBe(false);
  });

  it('注册后导航及过渡层重试都去 onboarding，旧会话探测不会抢先跳工作台', async () => {
    const session = deferred<{ data: { session: unknown } }>();
    harness.getSession.mockReturnValue(session.promise);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: '注册成功' })));
    mount('?mode=register&code=SYNTHETIC');
    await submit();
    render();
    session.resolve({ data: { session: { user: { id: 'synthetic' } } } });
    await flush();
    expect(harness.assign).toHaveBeenCalledTimes(1);
    expect(harness.assign).toHaveBeenCalledWith('/onboarding');
    expect(button().props.disabled).toBe(true);
    transition().props.onRetry();
    expect(harness.assign.mock.calls.map(([target]) => target)).toEqual(['/onboarding', '/onboarding']);
  });
});

describe('认证超时与取消', () => {
  it('注册超时实际取消请求，只发送一次并提醒先登录检查账号', async () => {
    vi.useFakeTimers();
    let requestSignal!: AbortSignal;
    const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      requestSignal = options.signal as AbortSignal;
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetcher);
    const request = postRegistration({ email: 'test@example.invalid', password: 'synthetic-test-input', code: 'SYNTHETIC' }, undefined, 100);
    const rejected = expect(request).rejects.toThrow(/账号可能已创建.*先切换到登录/);
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(requestSignal.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('超时也覆盖响应正文，不仅覆盖响应头', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    })));
    const request = postRegistration({ email: 'test@example.invalid', password: 'synthetic-test-input', code: 'SYNTHETIC' }, undefined, 100);
    const rejected = expect(request).rejects.toThrow(/注册响应超时/);
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });

  it('注册页面卸载取消在途请求，取消后不尝试自动登录', async () => {
    let requestSignal!: AbortSignal;
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      requestSignal = options.signal;
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    mount('?mode=register');
    const pending = submit();
    cleanup.forEach((effect) => effect());
    cleanup = [];
    await pending;
    expect(requestSignal.aborted).toBe(true);
    expect(harness.signIn).not.toHaveBeenCalled();
    expect(harness.assign).not.toHaveBeenCalled();
  });

  it('超时与一般取消提示不同，注册超时的账号说明完整保留', () => {
    expect(authErrorText(new DOMException('The operation was aborted.', 'AbortError'))).toBe('登录请求已中断，请重试');
    expect(authErrorText(new DOMException('The operation was aborted.', 'TimeoutError'))).toBe('登录响应超时，请稍后重试');
    const message = '注册响应超时。账号可能已创建，请先切换到登录尝试，避免重复注册。';
    expect(authErrorText(new Error(message))).toBe(message);
  });
});
