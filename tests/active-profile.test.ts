import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * 「选一次，全站都知道」这件事，全靠切换档案时那一次广播。
 *
 * 改造前有三个地方往 localStorage.activeProfileId 写，只有侧边栏那个会
 * 发 profileChanged 事件。于是从档案总览页切了账号，定位页和各创作板块
 * 收不到通知，界面显示的和实际进提示词的档案会悄悄错开——
 * 用户看不出来，只会觉得「AI 怎么答得不对」。
 *
 * 所以这里测的不是存储，是**存储和通知有没有绑在一起**。
 */

class FakeStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

let mod: typeof import('@/lib/active-profile');

beforeEach(async () => {
  const target = new EventTarget();
  (globalThis as any).window = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  (globalThis as any).localStorage = new FakeStorage();
  mod = await import('@/lib/active-profile');
});

afterEach(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});

describe('切换档案', () => {
  it('写进存储的同时把事件发出去', () => {
    const seen: unknown[] = [];
    mod.onActiveProfileChange(() => seen.push(mod.getActiveProfileId()));

    mod.setActiveProfileId('abc');

    expect(mod.getActiveProfileId()).toBe('abc');
    expect(seen).toEqual(['abc']); // 只发一次，且此时存储已经是新值
  });

  it('事件里带着档案对象，监听方不必再查一次', () => {
    // 这条要读 event.detail，所以用原生监听而不是 onActiveProfileChange
    let detail: any = null;
    (globalThis as any).window.addEventListener('profileChanged', (e: any) => { detail = e.detail; });

    const profile = { id: 'abc', profile_name: '言山廷' };
    mod.setActiveProfileId('abc', profile);

    expect(detail).toEqual(profile);
  });

  it('传 null 表示清空，存储里不该留着旧 id', () => {
    mod.setActiveProfileId('abc');
    mod.setActiveProfileId(null);
    expect(mod.getActiveProfileId()).toBeNull();
  });

  it('退订之后不再收到通知', () => {
    let n = 0;
    const off = mod.onActiveProfileChange(() => { n++; });
    mod.setActiveProfileId('a');
    off();
    mod.setActiveProfileId('b');
    expect(n).toBe(1);
  });

  it('localStorage 抛错（隐私模式）也要把事件发出去', () => {
    (globalThis as any).localStorage = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    let fired = false;
    mod.onActiveProfileChange(() => { fired = true; });

    // 存不下也不该把整页拖崩，本次会话内至少各板块是一致的
    expect(() => mod.setActiveProfileId('abc')).not.toThrow();
    expect(fired).toBe(true);
    expect(mod.getActiveProfileId()).toBeNull();
  });
});

describe('服务端渲染时不炸', () => {
  it('没有 window 就安静地返回 null', async () => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
    const ssr = await import('@/lib/active-profile');
    expect(ssr.getActiveProfileId()).toBeNull();
    expect(() => ssr.setActiveProfileId('x')).not.toThrow();
    expect(ssr.onActiveProfileChange(() => {})).toBeTypeOf('function');
  });
});
