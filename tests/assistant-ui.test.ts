/**
 * 助理界面的接线：右下角的任务卡、首页顶部的一句话条、两者之间的事件。源码检查，不渲染组件。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ASSISTANT_ASK_EVENT, askAssistant } from '@/lib/assistant/ask';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('首页顶部的一句话条和右下角的助理通过同一个事件说话', () => {
  it('事件名只有一个，两边都用它', () => {
    expect(ASSISTANT_ASK_EVENT).toBe('kaiwu:assistant-ask');
    expect(read('components/assistant/AssistantWidget.tsx')).toContain('ASSISTANT_ASK_EVENT');
    expect(read('components/assistant/AssistantHomeBar.tsx')).toContain("askAssistant(t)");
  });

  it('发出去时只派发事件，不在页面里直接调接口', () => {
    const dispatched: { type: string; detail: unknown }[] = [];
    const fakeWindow = { dispatchEvent: (e: { type: string; detail: unknown }) => dispatched.push(e) };
    const original = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = fakeWindow;
    try {
      askAssistant('  帮我选题  ');
      askAssistant('   ');
    } finally {
      (globalThis as { window?: unknown }).window = original;
    }
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe(ASSISTANT_ASK_EVENT);
    expect(dispatched[0].detail).toEqual({ message: '帮我选题' });
  });

  it('首页顶部的条放在问候区下面、第一张卡片之前（首屏第一眼就能看到）', () => {
    const page = read('app/dashboard/page.tsx');
    expect(page).toContain("import { AssistantHomeBar } from '@/components/assistant/AssistantHomeBar';");
    const bar = page.indexOf('<AssistantHomeBar />');
    const headerEnd = page.indexOf('</header>');
    const firstCard = page.indexOf('<GuideCard />');
    expect(bar).toBeGreaterThan(headerEnd);
    expect(bar).toBeLessThan(firstCard);
  });

  it('首页的快捷词都是能直接执行的请求', () => {
    const bar = read('components/assistant/AssistantHomeBar.tsx');
    expect(bar).toContain('"帮我选题"');
    expect(bar).toContain('"审一稿"');
    expect(bar).toContain('"今天有什么热点"');
  });
});

describe('右下角的助理：任务卡', () => {
  const widget = read('components/assistant/AssistantWidget.tsx');

  it('每句话是一张任务卡：有状态、过程、结果和复制，不再是聊天气泡', () => {
    expect(widget).toMatch(/function TaskThread\(/);
    expect(widget).toMatch(/STATUS_LABEL/);
    expect(widget).toMatch(/aria-label="复制结果"/);
    expect(widget).toMatch(/用了 1 次助理对话；板块按各自额度扣费/);
  });

  it('没有配置助理时整个入口不显示；有任务在跑时才轮询', () => {
    expect(widget).toMatch(/if \(!enabled\) return null;/);
    expect(widget).toMatch(/if \(!running\) return;/);
  });

  it('带给助理的上文只取已完成的任务，最多 8 条', () => {
    expect(widget).toMatch(/filter\(\(t\) => t\.status === "done"\)/);
    expect(widget).toMatch(/const HISTORY_LIMIT = 8;/);
  });
});
