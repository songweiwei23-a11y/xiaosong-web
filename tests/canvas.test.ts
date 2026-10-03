/**
 * 自由对话：结果画布 + 消息操作（2026-10-03 产品方："自由对话再上点狠的，达到类似官网的效果"）
 */
import { describe, it, expect } from 'vitest';
import {
  addVersion, buildRewritePrompt, cleanRewriteOutput, lineDiff, quoteForInput, replaceSelection, sanitizeCanvasVersions,
  CANVAS_TASK_TYPE, type CanvasVersion,
} from '@/lib/canvas';
import { sanitizeMessages } from '@/lib/chat-message-utils';
import { ISOLATED_TASKS } from '@/lib/topic-library';
import { readCode } from './helpers/source';

const v = (content: string, note = ''): CanvasVersion => ({ content, at: 1, note });

describe('版本', () => {
  it('和最新一版一样就不加；超过 20 版丢最早的，但保留第一版 AI 原稿', () => {
    let list = [v('原稿', 'AI 原稿')];
    expect(addVersion(list, '原稿', '手动修改')).toBe(list);
    for (let i = 1; i <= 25; i++) list = addVersion(list, `第${i}次`, '手动修改');
    expect(list).toHaveLength(20);
    expect(list[0].note).toBe('AI 原稿');
    expect(list.at(-1)!.content).toBe('第25次');
  });

  it('存储前清洗：乱的丢掉、超长截断', () => {
    expect(sanitizeCanvasVersions([{ content: 'a', at: 5, note: 'x' }, { nope: 1 }, null, { content: 'b'.repeat(50_000) }])).toEqual([
      { content: 'a', at: 5, note: 'x' },
      expect.objectContaining({ content: 'b'.repeat(40_000) }),
    ]);
    expect(sanitizeCanvasVersions('乱写')).toEqual([]);
  });

  it('对话记录存和读都带着画布的各版（刷新后不丢）', () => {
    const [m] = sanitizeMessages([{ role: 'assistant', content: '原稿', timestamp: 1, canvas: [v('原稿', 'AI 原稿'), v('改过', '手动修改')] }]);
    expect(m.canvas).toHaveLength(2);
    expect(readCode('lib/chat-store.ts')).toMatch(/\.\.\.\(m\.canvas \? \{ canvas: m\.canvas \} : \{\}\)/);
  });
});

describe('让 AI 改', () => {
  const doc = '# 一元火锅\n开头：你知道一元火锅能吃到什么吗？\n中段：牛肉现切现穿。\n结尾：快来。';

  it('选中一段：只改这段、只输出这段，给全文只为看上下文', () => {
    const p = buildRewritePrompt({ doc, selection: '中段：牛肉现切现穿。', instruction: '口语一点', context: '## 账号背景' });
    expect(p).toContain('**只改这一段**');
    expect(p).toContain('【要改的这一段】\n中段：牛肉现切现穿。');
    expect(p).toContain('只输出改好的这一段');
    expect(p.startsWith('## 账号背景')).toBe(true);
    expect(p).toMatch(/不要编原文和账号背景里没有的数字/);
  });

  it('不选：整篇改、输出完整稿', () => {
    expect(buildRewritePrompt({ doc, instruction: '压到 30 秒' })).toContain('输出改好后的**完整稿子**');
  });

  it('剥掉开场白和代码块', () => {
    expect(cleanRewriteOutput('好的，改写后的这一段如下：\n中段：牛肉是早上现切的')).toBe('中段：牛肉是早上现切的');
    expect(cleanRewriteOutput('```markdown\n中段：现切\n```')).toBe('中段：现切');
  });

  it('改好的段换回原位；稿子在改写期间被动过（选区对不上）就不替换', () => {
    const start = doc.indexOf('中段');
    const end = doc.indexOf('结尾') - 1;
    const sel = doc.slice(start, end);
    expect(replaceSelection(doc, start, end, sel, '中段：早上现切的牛肉')).toBe(doc.replace(sel, '中段：早上现切的牛肉'));
    expect(replaceSelection(doc, start, end, '别的内容', 'x')).toBeNull();
  });

  it('改写单独开会话：不读也不写这个档案共用的记忆', () => {
    expect(ISOLATED_TASKS.has(CANVAS_TASK_TYPE)).toBe(true);
    expect(readCode('components/chat/ResultCanvas.tsx')).toMatch(/taskType: CANVAS_TASK_TYPE/);
  });
});

describe('对比上一版', () => {
  it('逐行标出增删，没变的原样', () => {
    const d = lineDiff('甲\n乙\n丙', '甲\n乙改\n丙\n丁');
    expect(d).toEqual([
      { type: 'same', text: '甲' },
      { type: 'del', text: '乙' },
      { type: 'add', text: '乙改' },
      { type: 'same', text: '丙' },
      { type: 'add', text: '丁' },
    ]);
  });

  it('特别长的稿子不卡页面：整体标不同', () => {
    const big = Array.from({ length: 700 }, (_, i) => `行${i}`).join('\n');
    const d = lineDiff(big, big + '\n新');
    expect(d.length).toBe(1401);
  });
});

describe('消息操作', () => {
  it('引用追问：选中的话变成引用块，放在输入框原有内容前面', () => {
    expect(quoteForInput('牛肉现切\n现穿', '')).toBe('> 牛肉现切\n> 现穿\n');
    expect(quoteForInput('牛肉现切', '这句能再狠点吗')).toBe('> 牛肉现切\n\n这句能再狠点吗');
  });

  it('自由对话页：停止、重新生成、改一下再问、引用追问、在画布中打开都接上了', () => {
    const page = readCode('app/dashboard/free-chat/page.tsx');
    expect(page).toMatch(/signal: controller\.signal/);
    expect(page).toMatch(/onClick=\{\(\) => abortRef\.current\?\.abort\(\)\}/);
    expect(page).toMatch(/（已停止生成）/);
    expect(page).toMatch(/handleSend\(lastUser\.content, \{ replaceLast: true, regenerate: true, files: lastUser\.attachments \?\? \[\] \}\)/);
    expect(page).toMatch(/handleSend\(input, \{ replaceLast: true, files: lastUser\.attachments \?\? \[\] \}\)/);
    expect(page).toMatch(/quoteForInput\(text, prev\)/);
    expect(page).toMatch(/<ResultCanvas/);
    expect(page).toMatch(/updateRemoteConversation\(activeConv\.remoteId, \{ messages \}\)/);
  });

  it('换掉最后一轮时，存回云端的是截掉那一轮之后的记录（不会留下两份问答）', () => {
    const page = readCode('app/dashboard/free-chat/page.tsx');
    expect(page).toMatch(/const keep = opts\.replaceLast && lastUserIdx >= 0 \? conv\.messages\.slice\(0, lastUserIdx\) : conv\.messages;/);
    expect(page).toMatch(/const baseMessages = keep;/);
    expect(page).toMatch(/messages: \[\.\.\.baseMessages, userMsg, \{ role: "assistant"/);
  });

  it('画布里改好的版本能直接收藏、继续创作（接创作闭环）', () => {
    expect(readCode('components/chat/ResultCanvas.tsx')).toMatch(/<CreationLinks body=\{draft\}/);
  });
});
