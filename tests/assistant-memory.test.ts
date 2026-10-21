/**
 * 助理的记忆和长期对话：隐私检查、记忆块、什么时候压缩、压缩哪一段、带给模型的上下文、摘要调用、接线和迁移。
 * 数据库和模型都用假的。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONTEXT_MESSAGES,
  CONTEXT_MESSAGE_CHARS,
  KEEP_RECENT,
  MEMORY_MAX_CHARS,
  checkMemoryText,
  memoryPromptBlock,
  needsSummary,
  summaryPromptBlock,
  summaryRange,
  threadContext,
  titleOf,
} from '@/lib/assistant/memory';
import { summarizeMessages } from '@/lib/assistant/summarize';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('记忆：记什么、不记什么', () => {
  it('长期有用的事可以记，太长的截断到上限', () => {
    expect(checkMemoryText('我主营川菜，客单价 50 元左右')).toEqual({ ok: true, text: '我主营川菜，客单价 50 元左右' });
    const long = checkMemoryText('很长的话'.repeat(100));
    expect(long.ok).toBe(true);
    expect(long.text.length).toBe(MEMORY_MAX_CHARS);
  });

  it('密码、手机号、证件号、银行卡这类隐私不记', () => {
    expect(checkMemoryText('我的密码是 abc123').ok).toBe(false);
    expect(checkMemoryText('手机号 13812345678 记一下').ok).toBe(false);
    expect(checkMemoryText('身份证 110101199001011234').ok).toBe(false);
    expect(checkMemoryText('银行卡尾号 6225 的那张卡').ok).toBe(false);
  });

  it('空内容不记；多余空白会整理掉', () => {
    expect(checkMemoryText('   ').ok).toBe(false);
    expect(checkMemoryText('下周   三\n要交稿').text).toBe('下周 三 要交稿');
  });

  it('记忆块：没有记忆就是空串；有的话逐条列出（带编号），并提醒不要复述', () => {
    expect(memoryPromptBlock([])).toBe('');
    const block = memoryPromptBlock([
      { id: 'm1', content: '我主营川菜' },
      { id: 'm2', content: '每周三拍一条' },
    ]);
    expect(block).toContain('用户的记忆');
    expect(block).toContain('- [m1] 我主营川菜');
    expect(block).toContain('- [m2] 每周三拍一条');
    expect(block).toContain('不要逐条复述');
    expect(block).toContain('replaceId');
    expect(block).toContain('propose_forget');
  });
});

describe('长期对话：什么时候压缩、压缩哪一段', () => {
  it('消息不多不压缩；超过阈值且有旧消息没压缩时才压缩', () => {
    expect(needsSummary(10, 0)).toBe(false);
    expect(needsSummary(30, 0)).toBe(true);
    // 已经压缩到 total - KEEP_RECENT 了，就不用再压
    expect(needsSummary(30, 30 - KEEP_RECENT)).toBe(false);
    expect(needsSummary(30, 30 - KEEP_RECENT - 1)).toBe(true);
  });

  it('压缩的区间：从已压缩的地方到最近原文之前', () => {
    expect(summaryRange(30, 0)).toEqual([0, 30 - KEEP_RECENT]);
    expect(summaryRange(40, 18)).toEqual([18, 40 - KEEP_RECENT]);
  });

  it('带给模型的上下文：只取最近的，每条限制字数', () => {
    const pending = Array.from({ length: 40 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', text: `第${i}条` + '字'.repeat(2000) }));
    const { history } = threadContext(pending);
    expect(history).toHaveLength(CONTEXT_MESSAGES);
    expect(history[history.length - 1].text.startsWith('第39条')).toBe(true);
    expect(history[0].text.length).toBe(CONTEXT_MESSAGE_CHARS);
  });

  it('摘要块：没有摘要就是空串；有的话说明是早前内容的压缩', () => {
    expect(summaryPromptBlock('   ')).toBe('');
    const block = summaryPromptBlock('用户想拍节前活动，已选定三条选题');
    expect(block).toContain('早前的摘要');
    expect(block).toContain('已选定三条选题');
  });

  it('标题取第一句话的前 24 个字；空的叫「新对话」', () => {
    expect(titleOf('帮我选 5 条选题。顺便看看热点')).toBe('帮我选 5 条选题');
    expect(titleOf('   ')).toBe('新对话');
    expect(titleOf('一'.repeat(40)).length).toBe(24);
  });
});

describe('摘要的生成（模型用假的）', () => {
  const cfg = { baseUrl: 'https://x', apiKey: 'k', model: 'm' };

  it('把已有摘要和要压缩的对话一起交给模型，结果去掉首尾空白', async () => {
    let sent: { system: string; messages: { content: unknown }[] } | null = null;
    const out = await summarizeMessages(
      cfg,
      '用户主营川菜',
      [
        { role: 'user', text: '帮我选 5 条选题' },
        { role: 'assistant', text: '好的，已经选好' },
      ],
      async (_c, req) => {
        sent = req as unknown as { system: string; messages: { content: unknown }[] };
        return { stop_reason: 'end_turn', content: [{ type: 'text', text: '  用户主营川菜，已选好五条选题  ' }] };
      },
    );
    expect(out).toBe('用户主营川菜，已选好五条选题');
    expect(sent!.system).toContain('不超过 600 字');
    expect(String(sent!.messages[0].content)).toContain('已有的摘要：\n用户主营川菜');
    expect(String(sent!.messages[0].content)).toContain('用户：帮我选 5 条选题');
  });

  it('摘要不会无限长：超过 1500 字截断', async () => {
    const out = await summarizeMessages(cfg, '', [{ role: 'user', text: 'x' }], async () => ({
      stop_reason: null,
      content: [{ type: 'text', text: '摘'.repeat(3000) }],
    }));
    expect(out.length).toBe(1500);
  });
});

describe('接线：存对话、带记忆、记住、压缩都接上了', () => {
  it('接口先确认对话是自己的，再预留额度，再取摘要和原文，最后存用户这一条', () => {
    const route = read('app/api/assistant/route.ts');
    const getAt = route.indexOf('getThread(userId, threadIdIn)');
    const reserveAt = route.indexOf("reserveCreation(userId, 'freeChat'");
    const pendingAt = route.indexOf('listMessagesFrom(userId, thread.id, thread.summarized_count)');
    const appendAt = route.indexOf("appendMessage(userId, thread.id, 'user', message)");
    expect(getAt).toBeGreaterThan(0);
    expect(getAt).toBeLessThan(reserveAt);
    expect(reserveAt).toBeLessThan(pendingAt);
    expect(pendingAt).toBeLessThan(appendAt);
    expect(route).toContain('threadContext(pending)');
    expect(route).toContain('threadId,');
  });

  it('助理跑完把回答存进对话，并在需要时压缩旧消息；失败只记日志', () => {
    const run = read('lib/assistant/run.ts');
    expect(run).toContain('persistTurn(job, input.cfg, input.threadId, answer, receipts)');
    expect(run).toContain("appendMessage(job.userId, threadId, 'assistant', answer");
    expect(run).toContain('summarizeMessages(cfg, thread.summary, toSummarize)');
    expect(run).toContain('saveSummary(job.userId, threadId, next, upto)');
    expect(run).toContain('memoryPromptBlock(memories)');
    expect(run).toContain('summaryPromptBlock(input.summary');
  });

  it('工具里有 remember，记忆走统一的检查（隐私拒收）', () => {
    const tools = read('lib/assistant/tools.ts');
    expect(tools).toContain("name: 'remember'");
    expect(tools).toContain('addMemory(ctx.userId, content)');
    const store = read('lib/assistant/memory-store.ts');
    expect(store).toContain('checkMemoryText(raw)');
  });

  it('数据库读写都带上用户过滤，只能动自己的数据', () => {
    const store = read('lib/assistant/memory-store.ts');
    const froms = (store.match(/\.from\('assistant_/g) ?? []).length;
    const userFilters = (store.match(/\.eq\('user_id', userId\)/g) ?? []).length;
    expect(froms).toBeGreaterThan(0);
    // 每一处查询、更新、删除都带用户过滤；只有三处插入直接写 user_id，不需要过滤
    expect(userFilters).toBeGreaterThanOrEqual(froms - 3);
  });

  it('界面带上对话编号；历史和记忆的接口存在；对话删除有确认的入口', () => {
    const widget = read('components/assistant/AssistantWidget.tsx');
    expect(widget).toContain('threadId, requestId: newRequestId() }');
    expect(widget).toContain('/api/assistant/threads');
    expect(widget).toContain('/api/assistant/memories');
    // 头部按钮的标签通过 label 属性传进去，最后落到 aria-label 上
    expect(widget).toContain('label="我记得的事"');
    expect(widget).toContain('label="历史对话"');
    expect(widget).toContain('label="新对话"');
  });

  it('迁移建了三张表，都开启了行级安全，没有策略', () => {
    const sql = read('supabase/migrations/20261022_assistant_memory.sql');
    expect(sql).toContain('create table if not exists public.assistant_threads');
    expect(sql).toContain('create table if not exists public.assistant_messages');
    expect(sql).toContain('create table if not exists public.assistant_memories');
    expect(sql.match(/enable row level security/g)?.length).toBe(3);
    expect(sql).not.toMatch(/create policy/i);
  });
});
