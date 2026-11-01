// 自由对话优先（2026-11-02 产品方定稿）：侧边栏挪到工作台正下方；工作台首页一个大对话框，默认自由对话、可切「让助理去做」；
// 发出去跳到自由对话页接着聊，附件、联网方式、深度研究都带过去，只发一次。
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { putHomeChat, takeHomeChat } from '@/lib/home-chat-handoff';
import { checkHomeFiles } from '@/components/dashboard/HomeChatBox';

const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('入口位置', () => {
  it('侧边栏：自由对话紧跟工作台，「助手与资料」组里不再重复', () => {
    const sidebar = read('components/dashboard/Sidebar.tsx');
    const home = sidebar.indexOf('name: "工作台"');
    const chat = sidebar.indexOf('name: "自由对话"');
    expect(chat).toBeGreaterThan(home);
    expect(sidebar.slice(home + 1, chat)).not.toMatch(/name: "/);
    expect(sidebar.match(/name: "自由对话"/g)).toHaveLength(1);
  });

  it('工作台首页：「更多工具」里不再放自由对话（顶上已经有对话框）', () => {
    const page = read('app/dashboard/page.tsx');
    expect(page).not.toContain('href: "/dashboard/free-chat"');
  });
});

describe('首页对话框', () => {
  const box = read('components/dashboard/HomeChatBox.tsx');

  it('默认自由对话；有助理时才出现「让助理去做」', () => {
    expect(box).toContain('useState<Mode>("chat")');
    expect(box).toMatch(/agentOn \? \[\{ key: "chat", label: "自由对话" \}, \{ key: "agent", label: "让助理去做" \}\] : \[\]/);
  });

  it('自由对话带附件、联网方式、深度研究，发出去跳到自由对话页', () => {
    expect(box).toContain('putHomeChat({ text: t, webMode, research, files })');
    expect(box).toContain('router.push("/dashboard/free-chat")');
    for (const s of ['今天抖音有什么热点', '帮我看看这张截图', '这个行业怎么起号', '发出去后跳到自由对话页接着聊，历史都在那里']) expect(box).toContain(s);
  });

  it('附件按自由对话页的规则先挡：类型、大小、个数', () => {
    expect(checkHomeFiles([{ name: '截图.png', size: 1000 }])).toBeNull();
    expect(checkHomeFiles([{ name: '病毒.exe', size: 1000 }])).toMatch(/支持的图片或文档/);
    expect(checkHomeFiles([{ name: '大图.png', size: 11 * 1024 * 1024 }])).toMatch(/10 MB/);
    expect(checkHomeFiles([{ name: '空.png', size: 0 }])).toMatch(/支持的图片或文档/);
    expect(checkHomeFiles(Array.from({ length: 20 }, (_, i) => ({ name: `${i}.png`, size: 10 })))).toMatch(/最多/);
  });
});

describe('首页 → 自由对话页的交接', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  afterEach(() => { delete (globalThis as { sessionStorage?: unknown }).sessionStorage; });

  it('页面内跳转：文字、联网方式、深度研究、附件原样交过去，取一次就清掉（不会重复发送）', () => {
    const file = new File(['x'], '截图.png', { type: 'image/png' });
    putHomeChat({ text: '帮我看看这张截图', webMode: 'on', research: false, files: [file] });
    const got = takeHomeChat();
    expect(got).toMatchObject({ text: '帮我看看这张截图', webMode: 'on', research: false });
    expect(got?.files[0]).toBe(file);
    expect(takeHomeChat()).toBeNull();
  });

  it('整页刷新（内存没了）：文字和设置从 sessionStorage 接上，附件只能重新选；超过 5 分钟的不再自动发', () => {
    store.set('kaiwu-home-chat', JSON.stringify({ text: '这个行业怎么起号', webMode: 'off', research: true, at: 1_000 }));
    expect(takeHomeChat(1_000 + 60_000)).toEqual({ text: '这个行业怎么起号', webMode: 'off', research: true, files: [] });
    store.set('kaiwu-home-chat', JSON.stringify({ text: '旧的', webMode: 'auto', research: false, at: 1_000 }));
    expect(takeHomeChat(1_000 + 6 * 60_000)).toBeNull();
  });

  it('自由对话页：新开对话、按首页的联网方式；深度研究打开研究卡片并填好问题，不直接开跑', () => {
    const page = read('app/dashboard/free-chat/page.tsx');
    expect(page).toContain('const home = takeHomeChat();');
    expect(page).toContain('createConversation(true)');
    expect(page).toContain('setWebSearchMode(home.webMode)');
    expect(page).toContain('send: !home.research');
    expect(page).toContain('defaultTopic={researchTopic}');
    // 附件等新对话成了当前对话再传（附件框按对话重建，早传会被取消），传完才发
    expect(page).toContain("activeId !== homeJob.convId");
    expect(page).toContain("attachRef.current.upload(homeJob.files)");
    expect(page).toContain("notify('附件没传上，可以重新上传后再发送')");
  });
});
