/**
 * 助理替用户在开物里真的做事：记待办、查待办、播放和停止声音。
 * 待办走的是真实的待办接口（假的 fetch），声音只发出动作，由界面执行。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createAssistantTools, type AssistantToolContext } from '@/lib/assistant/tools';
import { assistantDateLine, ASSISTANT_SYSTEM } from '@/lib/assistant/run';
import { clampMinutes, parseClientAction, resolveSound } from '@/lib/assistant/client-action-spec';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function tools(extra: Partial<AssistantToolContext> = {}) {
  const ctx: AssistantToolContext = { userId: 'u1', cookie: 'c=1', internalBase: 'http://x', ...extra };
  return createAssistantTools(ctx);
}
const tool = (list: ReturnType<typeof tools>, name: string) => list.find((t) => t.name === name)!;

describe('白噪音：认得用户的说法，动作只在合法时发出', () => {
  it('白噪音就是「专注」（棕噪音）；别的说法也认', () => {
    expect(resolveSound('白噪音')).toBe('brown');
    expect(resolveSound('专注')).toBe('brown');
    expect(resolveSound('雨声')).toBe('rain');
    expect(resolveSound('cafe')).toBe('cafe');
    expect(resolveSound('咖啡馆')).toBe('cafe');
    expect(resolveSound('摇滚')).toBeNull();
  });

  it('定时分钟数限制在 1 到 240 之间', () => {
    expect(clampMinutes(25)).toBe(25);
    expect(clampMinutes('30')).toBe(30);
    expect(clampMinutes(999)).toBe(240);
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes('abc')).toBeNull();
  });

  it('界面收到的动作：白名单之外的、声音不认识的都丢弃', () => {
    expect(parseClientAction({ name: 'ambient.play', args: { sound: '白噪音', minutes: 25 } })).toEqual({
      name: 'ambient.play',
      args: { sound: 'brown', minutes: 25 },
    });
    expect(parseClientAction({ name: 'ambient.play', args: { sound: '摇滚' } })).toBeNull();
    expect(parseClientAction({ name: 'pay.now', args: {} })).toBeNull();
    expect(parseClientAction({ name: 'ambient.stop' })).toEqual({ name: 'ambient.stop', args: {} });
  });

  it('play_ambient 发出播放动作（带上时长），说不出的声音就告诉用户有哪些', async () => {
    const seen: unknown[] = [];
    const t = tool(tools({ onAction: (a) => seen.push(a) }), 'play_ambient');
    const out = await t.run({ sound: '白噪音', minutes: 25 });
    expect(seen).toEqual([{ name: 'ambient.play', args: { sound: 'brown', minutes: 25 } }]);
    expect(out).toContain('专注');
    expect(out).toContain('25 分钟');

    const none: unknown[] = [];
    const bad = await tool(tools({ onAction: (a) => none.push(a) }), 'play_ambient').run({ sound: '摇滚' });
    expect(none).toHaveLength(0);
    expect(bad).toContain('开物里有');
  });

  it('stop_ambient 发出停止动作', async () => {
    const seen: unknown[] = [];
    await tool(tools({ onAction: (a) => seen.push(a) }), 'stop_ambient').run({});
    expect(seen).toEqual([{ name: 'ambient.stop', args: {} }]);
  });
});

describe('待办：真的记进开物，到期能查出来', () => {
  it('add_todo 带着日期写进待办接口，日期换算成北京时间的早上 9 点', async () => {
    let body: Record<string, unknown> | null = null;
    const fake = (async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/api/todos')) {
        body = JSON.parse(String(init?.body));
        return json({ id: 't1' });
      }
      return json([]);
    }) as unknown as typeof fetch;
    const out = await tool(tools({ fetchImpl: fake }), 'add_todo').run({ content: '交一版节前脚本', dueDate: '2026-10-22' });
    expect(body).toEqual({ content: '交一版节前脚本', dueAt: '2026-10-22T09:00:00+08:00' });
    expect(out).toContain('已记下待办');
    expect(out).toContain('到期 2026-10-22');
  });

  it('没说日期就不填到期时间；没说要记什么就不写', async () => {
    const calls: unknown[] = [];
    const fake = (async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return json({ id: 't2' });
    }) as unknown as typeof fetch;
    const t = tool(tools({ fetchImpl: fake }), 'add_todo');
    await t.run({ content: '想想选题方向' });
    expect(calls[0]).toEqual({ content: '想想选题方向', dueAt: null });
    expect(await t.run({ content: '  ' })).toContain('还不知道要记什么');
    expect(calls).toHaveLength(1);
  });

  it('list_todos 读出未完成的待办，标出已经到期的；做完的不列', async () => {
    const fake = (async () =>
      json([
        { id: 'a', content: '交稿', due_at: '2020-01-01T01:00:00Z', done: false },
        { id: 'b', content: '拍素材', due_at: null, done: false },
        { id: 'c', content: '已经做完的', due_at: null, done: true },
      ])) as unknown as typeof fetch;
    const out = await tool(tools({ fetchImpl: fake }), 'list_todos').run({});
    expect(out).toContain('未完成的待办 2 条');
    expect(out).toContain('交稿');
    expect(out).toContain('（已到期）');
    expect(out).toContain('拍素材');
    expect(out).not.toContain('已经做完的');
  });
});

describe('日期和边界', () => {
  it('系统提示带着北京时间的今天，「明天」「下周三」才换算得准', () => {
    // 2026-10-21 16:30 UTC = 北京时间 10-22 00:30
    expect(assistantDateLine(new Date('2026-10-21T16:30:00Z'))).toContain('今天是 2026-10-22');
  });

  it('系统提示写明能替用户做什么，也写明不越界的事（付款、删除、发布、改账号）', () => {
    expect(ASSISTANT_SYSTEM).toContain('add_todo');
    expect(ASSISTANT_SYSTEM).toContain('play_ambient');
    expect(ASSISTANT_SYSTEM).toContain('不越界');
    expect(ASSISTANT_SYSTEM).toContain('付款');
    expect(ASSISTANT_SYSTEM).toContain('删除数据');
    expect(ASSISTANT_SYSTEM).toContain('修改账号和密码');
  });
});

describe('界面：收到动作就执行，到期的待办打开时提醒', () => {
  it('widget 处理动作事件，并在打开时读取待办', () => {
    const widget = fs.readFileSync(path.join(process.cwd(), 'components/assistant/AssistantWidget.tsx'), 'utf8');
    expect(widget).toMatch(/e\.type === "action"/);
    expect(widget).toContain('runClientAction(a)');
    expect(widget).toContain('fetch("/api/todos"');
    expect(widget).toContain('到期和今天要做的');
  });

  it('执行函数只做白名单里的两件事，并且把其它声音换掉', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'components/assistant/clientActions.ts'), 'utf8');
    expect(src).toContain('"ambient.play"');
    expect(src).toContain('"ambient.stop"');
    expect(src).toContain('if (id !== sound) await toggleSound(id)');
  });
});
