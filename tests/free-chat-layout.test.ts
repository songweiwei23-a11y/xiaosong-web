/**
 * 自由对话版面（2026-10-04 产品方：上下太挤）：只改对话页；功能一个不少。
 */
import { describe, expect, it } from 'vitest';
import { readCode } from './helpers/source';

const page = readCode('app/dashboard/free-chat/page.tsx');

describe('上下变宽松', () => {
  it('全站顶栏保持原来的高度（产品方试过收到 56 觉得太挤，改回 72）；对话页高度跟着扣', () => {
    expect(readCode('app/dashboard/layout.tsx')).toMatch(/md:h-\[72px\]/);
    expect(page).toMatch(/h-\[calc\(100dvh-56px\)\] overflow-hidden md:h-\[calc\(100dvh-72px\)\]/);
  });

  it('方案 A：电脑上标题行放进顶栏左边空位（不再单独占一行），手机上留一条细的；别的页面空位是空的', () => {
    const layout = readCode('app/dashboard/layout.tsx');
    expect(layout).toMatch(/<TopBarSlotTarget \/>/);
    expect(layout).toMatch(/<TopBarSlotProvider>/);
    expect(readCode('components/dashboard/TopBarSlot.tsx')).toMatch(/hidden min-w-0 flex-1 items-center md:flex/);
    expect(page).toMatch(/<TopBarPortal><div className="flex min-w-0 flex-1 items-center gap-3 pr-6">\{titleRow\}<\/div><\/TopBarPortal>/);
    expect(page).toMatch(/border-b bg-card px-3 py-1\.5 md:hidden">\{titleRow\}/);
  });

  it('标题和同步状态合成一行；同步失败的原因和重试照常显示', () => {
    expect(page).toMatch(/高阶自由模式/);
    expect(page).toMatch(/记忆已开启/);
    expect(page).toMatch(/aria-label="导出完整历史"/);
    expect(page).toMatch(/onClick=\{retrySync\}/);
    expect(page).toMatch(/getConversationSaveError\(/);
  });

  it('一体式输入框：上传、联网模式、联网剩余、发送 / 停止都在；格式说明在悬停提示；输入框一行起自动长高', () => {
    expect(page).toMatch(/title=\{`上传图片 \/ 文件：\$\{ATTACHMENT_HINT\}`\}/);
    expect(page).toMatch(/attachRef\.current\?\.open\(\)/);
    expect(page).toMatch(/attachRef\.current\?\.upload\(/); // 拖进输入框也能传
    expect(page).toMatch(/aria-label="联网模式"/);
    expect(page).toMatch(/<WebSearchQuota \/>/);
    expect(page).toMatch(/abortRef\.current\?\.abort\(\)/);
    expect(page).toMatch(/rows=\{1\}/);
    expect(page).toMatch(/Math\.min\(el\.scrollHeight, 200\)/);
    expect(page).toMatch(/<AttachmentComposer ref=\{attachRef\} compact/);
    expect(readCode('components/chat/ChatAttachments.tsx')).toMatch(/\{!compact && <div/);
  });

  it('正文和输入框同宽，按屏幕加宽到 1024', () => {
    expect(page).toMatch(/const CHAT_WIDTH = 'max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'/);
    expect(page.match(/\$\{CHAT_WIDTH\}/g)?.length).toBe(2);
  });

  it('左侧：去掉重复的「当前账号背景」；旧对话入口变成底部小字；列表收没收记住', () => {
    expect(page).not.toMatch(/当前账号背景<\/div>/);
    expect(page).toMatch(/查看以前未关联档案的对话/);
    expect(page).toMatch(/返回当前档案的对话/);
    expect(page).toMatch(/localStorage\.setItem\(LIST_KEY/);
  });
});
