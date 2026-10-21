/**
 * 助理记忆的几项优化（2026-10-21）：重复的不再记、已记的可以改、忘掉要用户在页面上确认、
 * 摘要没跟上时界面要提醒。数据库用假的，不碰真实记忆。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const store = vi.hoisted(() => ({
  addMemory: vi.fn(),
  updateMemory: vi.fn(),
  listMemories: vi.fn(),
  deleteMemory: vi.fn(),
}));
vi.mock('@/lib/assistant/memory-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assistant/memory-store')>()),
  addMemory: store.addMemory,
  updateMemory: store.updateMemory,
  listMemories: store.listMemories,
  deleteMemory: store.deleteMemory,
}));

import { createAssistantTools, type AssistantToolContext } from '@/lib/assistant/tools';
import { memoryPromptBlock, sameMemory } from '@/lib/assistant/memory';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

function tool(name: string, extra: Partial<AssistantToolContext> = {}) {
  const list = createAssistantTools({ userId: 'u1', cookie: 'c=1', internalBase: 'http://x', ...extra });
  return list.find((t) => t.name === name)!;
}

beforeEach(() => {
  store.addMemory.mockReset();
  store.updateMemory.mockReset();
  store.listMemories.mockReset();
  store.deleteMemory.mockReset();
});

describe('重复的事不重复记', () => {
  it('同一件事（忽略空白和标点、大小写）算重复；不同的事不算', () => {
    expect(sameMemory('我主营川菜。', '我主营 川菜')).toBe(true);
    expect(sameMemory('Shop A', 'shop a!')).toBe(true);
    expect(sameMemory('我主营川菜', '我主营川菜，客单价 50 元')).toBe(false);
    expect(sameMemory('', '')).toBe(false);
  });

  it('remember 遇到已经记着的事：告诉模型「已经记着了」，不新增', async () => {
    store.addMemory.mockResolvedValue({ ok: true, memory: { id: 'm1', content: '我主营川菜' }, duplicate: true });
    const out = await tool('remember').run({ content: '我主营川菜。' });
    expect(out).toContain('已经记着了');
    expect(out).toContain('不用重复记');
  });

  it('记忆块里每条带编号，模型才能修改或忘掉某一条', () => {
    expect(memoryPromptBlock([{ id: 'm1', content: '我主营川菜' }])).toContain('- [m1] 我主营川菜');
  });
});

describe('已记的可以修改', () => {
  it('remember 填了 replaceId：改写那一条，不新增', async () => {
    store.updateMemory.mockResolvedValue({ ok: true, memory: { id: 'm1', content: '我主营川菜，客单价 60' } });
    const out = await tool('remember').run({ content: '我主营川菜，客单价 60', replaceId: 'm1' });
    expect(store.updateMemory).toHaveBeenCalledWith('u1', 'm1', '我主营川菜，客单价 60');
    expect(store.addMemory).not.toHaveBeenCalled();
    expect(out).toContain('已把这条记忆改成');
  });

  it('要改的编号不存在（或不是自己的）：如实说没改成功', async () => {
    store.updateMemory.mockResolvedValue({ ok: false, reason: '找不到这条记忆' });
    const out = await tool('remember').run({ content: '新内容', replaceId: 'nope' });
    expect(out).toContain('没有改成功');
  });
});

describe('忘掉要用户在页面上确认', () => {
  it('propose_forget：只把这条列给页面确认，不删除', async () => {
    store.listMemories.mockResolvedValue([{ id: 'm1', content: '我主营川菜', created_at: '2026-10-21' }]);
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const out = await tool('propose_forget', { onAction: (a) => actions.push(a) }).run({ memoryId: 'm1' });
    expect(actions).toEqual([{ name: 'memory.forget', args: { id: 'm1', content: '我主营川菜' } }]);
    expect(store.deleteMemory).not.toHaveBeenCalled();
    expect(out).toContain('等用户点确认');
  });

  it('编号找不到：不列出，如实说明', async () => {
    store.listMemories.mockResolvedValue([]);
    const actions: unknown[] = [];
    const out = await tool('propose_forget', { onAction: (a) => actions.push(a) }).run({ memoryId: 'x' });
    expect(actions).toHaveLength(0);
    expect(out).toContain('没有找到这条记忆');
  });

  it('没有编号：直接说缺少编号', async () => {
    const out = await tool('propose_forget').run({ memoryId: '  ' });
    expect(out).toBe('缺少记忆的编号');
    expect(store.listMemories).not.toHaveBeenCalled();
  });
});

describe('接线：提示、界面和对话接口都接上了', () => {
  it('系统提示说明修改、忘掉的用法，并且忘掉要用户确认', () => {
    const run = read('lib/assistant/run.ts');
    expect(run).toContain('propose_forget 不会直接删');
    expect(run).toContain('填 replaceId');
    expect(run).toContain('MEMORY_MAX_COUNT');
  });

  it('界面：提议的忘掉只列出来，点「确定忘掉」才删，删失败留着卡片', () => {
    const src = read('components/assistant/AssistantWidget.tsx');
    expect(src).toContain('if (a.name === "memory.forget") proposeForget(a.args);');
    expect(src).toContain('确定忘掉');
    expect(src).toContain('先留着');
    const confirm = src.slice(src.indexOf('const confirmForget'), src.indexOf('const keepForget'));
    expect(confirm.indexOf('if (!res?.ok)')).toBeLessThan(confirm.indexOf('setForgets((fs) => fs.filter'));
  });

  it('对话接口告诉界面摘要有没有跟上；界面在滞后时提醒用户', () => {
    expect(read('app/api/assistant/threads/route.ts')).toContain('summaryLagging: needsSummary(');
    const src = read('components/assistant/AssistantWidget.tsx');
    expect(src).toContain('setSummaryLag(!!data.summaryLagging)');
    expect(src).toContain('较早的内容没能压缩成摘要');
  });

  it('记忆的写入只在 addMemory 里做查重；修改走 updateMemory，同样只动自己的数据', () => {
    const store2 = read('lib/assistant/memory-store.ts');
    expect(store2).toContain('sameMemory(m.content, check.text)');
    expect(store2).toMatch(/\.update\(\{ content: check\.text \}\)\s*\.eq\('user_id', userId\)/);
  });
});
