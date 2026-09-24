import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * 生成不中断、不"点了没反应"。
 *
 * 【线上实测 9/24】
 * - 内容定位 13:14、13:15、13:19 连续三次，Dify 记录全是
 *   "Input exceeds the model's context window"：所有板块共用一个会话，
 *   里面攒了 60 条、单条两三万字的问答。Dify 在流里报错，我们的接口把报错事件丢了，
 *   页面收到空内容、一句提示都没有。
 * - 账号定位 12:05、12:22 两次，Dify 那边都完整写完（1.4 万、1.2 万字），
 *   我们这边一条都没存上：五分钟的长流半路断了。
 *
 * 这里不扫源码，真的把接口跑起来，用假的 Dify 流喂它，看页面最终拿到什么。
 */

vi.mock('@/lib/api-guard', () => ({
  requireUser: vi.fn(async () => ({ ok: true, userId: 'u1' })),
  requireUserWithQuota: vi.fn(async () => ({ ok: true, userId: 'u1' })),
  incrementUsageServer: vi.fn(async () => {}),
}));
vi.mock('@/lib/dify-conversation', () => ({
  getDifyConversationId: vi.fn(async () => 'shared-conv'),
  saveDifyConversationId: vi.fn(async () => {}),
  clearDifyConversationId: vi.fn(async () => {}),
  isInvalidConversationError: vi.fn(() => false),
}));
vi.mock('@/lib/topic-library-server', () => ({
  loadPriorTopicTitles: vi.fn(async () => []),
}));
vi.mock('@/lib/dify-recover', () => ({
  waitForDifyMessage: vi.fn(),
  fetchDifyMessage: vi.fn(async () => ({ status: 'done', answer: '全文' })),
}));

import { POST } from '@/app/api/dify/stream/route';
import { incrementUsageServer } from '@/lib/api-guard';
import { clearDifyConversationId, saveDifyConversationId } from '@/lib/dify-conversation';
import { waitForDifyMessage } from '@/lib/dify-recover';
import { readDifyStream, recoverDifyAnswer, DifyStreamError } from '@/lib/sse-stream';
import { isContextOverflowError, difyEventError, friendlyDifyError } from '@/lib/dify-errors';
import { readCode } from './helpers/source';

/** 线上那条报错的原文开头 */
const OVERFLOW = `Run failed: req_id: 4c543e8c61 PluginInvokeError: {"args":{"description":"[models] Error: API request failed with status code 400: {\\"error\\":{\\"message\\":\\"Input exceeds the model's context window. Please reduce`;

const ev = (o: object) => `data: ${JSON.stringify(o)}\n\n`;
const msg = (answer: string) => ev({ event: 'message', answer, conversation_id: 'c1', message_id: 'm1' });

/** 假的 Dify 流：按给定片段逐块吐出；breakAfter 为 true 时最后网络断掉 */
function difyStream(parts: string[], { breakAfter = false } = {}) {
  const enc = new TextEncoder();
  const queue = [...parts];
  // 读一次给一块，给完了再断——在 start 里直接 error 会把没读走的块一起丢掉
  return new Response(
    new ReadableStream({
      pull(c) {
        const p = queue.shift();
        if (p !== undefined) c.enqueue(enc.encode(p));
        else if (breakAfter) c.error(new TypeError('terminated'));
        else c.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
}

let difyCalls: any[] = [];
function mockDify(...responses: Response[]) {
  difyCalls = [];
  const queue = [...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      difyCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return queue.shift()!;
    })
  );
}

const call = (taskType: string) =>
  POST(
    new Request('http://x/api/dify/stream', {
      method: 'POST',
      body: JSON.stringify({ taskType, query: '写点东西', profileId: 'p1' }),
    }) as any
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('流式接口：报错要说出来，不能一声不吭', () => {
  it('会话塞满了：换新会话重来一次，用户照样拿到结果', async () => {
    mockDify(
      difyStream([ev({ event: 'error', message: OVERFLOW, conversation_id: 'shared-conv' })]),
      difyStream([msg('新会话'), msg('写出来了'), ev({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })])
    );
    const res = await call('脚本生成');
    expect(await readDifyStream(res)).toBe('新会话写出来了');

    expect(difyCalls).toHaveLength(2);
    expect(difyCalls[0].body.conversation_id).toBe('shared-conv');
    expect(difyCalls[1].body.conversation_id).toBeUndefined();
    // 旧的共用会话清掉，别的板块下次也不会接着撞
    expect(clearDifyConversationId).toHaveBeenCalledWith('u1', 'p1');
    expect(incrementUsageServer).toHaveBeenCalledTimes(1);
  });

  it('报错不是会话太长：不重试，把能看懂的话告诉用户', async () => {
    mockDify(difyStream([ev({ event: 'error', message: 'rate limit exceeded (429)' })]));
    const res = await call('脚本生成');
    await expect(readDifyStream(res)).rejects.toThrow('AI 这会儿太忙了');
    expect(difyCalls).toHaveLength(1);
    expect(incrementUsageServer).not.toHaveBeenCalled();
  });

  it('工作流节点失败也算报错', async () => {
    mockDify(difyStream([ev({ event: 'workflow_finished', data: { status: 'failed', error: 'node timeout' } })]));
    await expect(readDifyStream(await call('脚本生成'))).rejects.toThrow('超时');
  });

  it('正常结束却一个字没有：明说，不再"点了没反应"', async () => {
    mockDify(difyStream([ev({ event: 'workflow_started' })]));
    await expect(readDifyStream(await call('脚本生成'))).rejects.toThrow('没有生成出内容');
  });

  it('三份定位不接共用会话，也不写回去（它们会把共用会话撑爆）', async () => {
    for (const t of ['账号定位', '商业定位', '内容定位']) {
      mockDify(difyStream([msg('定位'), ev({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })]));
      expect(await readDifyStream(await call(t))).toBe('定位');
      expect(difyCalls[0].body.conversation_id).toBeUndefined();
    }
    expect(saveDifyConversationId).not.toHaveBeenCalled();
  });

  it('普通板块照旧接共用会话、写完记下来', async () => {
    mockDify(difyStream([msg('脚本'), ev({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })]));
    expect(await readDifyStream(await call('脚本生成'))).toBe('脚本');
    expect(difyCalls[0].body.conversation_id).toBe('shared-conv');
    expect(saveDifyConversationId).toHaveBeenCalledWith('u1', 'c1', 'p1', '脚本生成');
  });
});

describe('流式接口：和 Dify 之间断了，把全文取回来', () => {
  it('半路断线：等 Dify 写完，整篇补给页面', async () => {
    vi.mocked(waitForDifyMessage).mockResolvedValue({ status: 'done', answer: '完整的一万字' });
    mockDify(difyStream([msg('完整的')], { breakAfter: true }));
    const res = await call('账号定位');
    expect(await readDifyStream(res)).toBe('完整的一万字');
    expect(waitForDifyMessage).toHaveBeenCalledWith('c1', 'm1', 'u1');
    expect(incrementUsageServer).toHaveBeenCalledTimes(1);
  });

  it('取不回来：告诉用户断了，不装作写完', async () => {
    vi.mocked(waitForDifyMessage).mockResolvedValue({ status: 'pending' });
    mockDify(difyStream([msg('半截')], { breakAfter: true }));
    await expect(readDifyStream(await call('账号定位'))).rejects.toThrow('连接断了');
    expect(incrementUsageServer).not.toHaveBeenCalled();
  });

  it('浏览器半路走了：服务端照样把上游读完，扣次数、记会话（用户回来能取回）', async () => {
    mockDify(
      difyStream([msg('一'), msg('二'), msg('三'), ev({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })])
    );
    const res = await call('脚本生成');
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(incrementUsageServer).toHaveBeenCalledTimes(1));
    expect(saveDifyConversationId).toHaveBeenCalledWith('u1', 'c1', 'p1', '脚本生成');
  });

  it('响应头关掉 Nginx 缓冲，按事件流下发', async () => {
    mockDify(difyStream([msg('x'), ev({ event: 'message_end' })]));
    const res = await call('脚本生成');
    expect(res.headers.get('X-Accel-Buffering')).toBe('no');
    expect(res.headers.get('Content-Type')).toMatch(/^text\/event-stream/);
    await readDifyStream(res);
  });
});

/** 页面收到的流（已经是我们接口的格式） */
function pageStream(parts: string[], { breakAfter = false } = {}) {
  return difyStream(parts, { breakAfter });
}

describe('页面读流：和服务器之间断了，也能取回', () => {
  it('心跳行跳过，正文照常拼', async () => {
    const got = await readDifyStream(pageStream([': ping\n\n', msg('甲'), ': ping\n\n', msg('乙'), ev({ event: 'message_end' })]));
    expect(got).toBe('甲乙');
  });

  it('message_replace 整篇替换', async () => {
    const got = await readDifyStream(
      pageStream([msg('半'), ev({ event: 'message_replace', answer: '全文' }), ev({ event: 'message_end' })])
    );
    expect(got).toBe('全文');
  });

  it('没有结束标记就断了：按消息 id 去取回全文', async () => {
    const f = vi.fn(async (_url: string) => new Response(JSON.stringify({ status: 'done', answer: '一万字全文' })));
    vi.stubGlobal('fetch', f);
    const onRecovering = vi.fn();
    const onChunk = vi.fn();
    const got = await readDifyStream(pageStream([msg('一万')], { breakAfter: true }), { onRecovering, onChunk });
    expect(got).toBe('一万字全文');
    expect(onRecovering).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenLastCalledWith('', '一万字全文');
    expect(f.mock.calls[0][0]).toBe('/api/dify/recover?conversationId=c1&messageId=m1');
  });

  it('流"正常"关掉但没有结束标记，同样当断线处理', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'done', answer: '全' }))));
    expect(await readDifyStream(pageStream([msg('半')]))).toBe('全');
  });

  it('没有消息 id 的老格式：流结束就算写完，不去续取', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const got = await readDifyStream(pageStream([ev({ answer: '老格式' })]));
    expect(got).toBe('老格式');
    expect(f).not.toHaveBeenCalled();
  });

  it('报错事件：抛出给用户看的话，不去续取', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(
      readDifyStream(pageStream([msg('x'), ev({ event: 'error', message: '这次要处理的内容太长了' })]))
    ).rejects.toBeInstanceOf(DifyStreamError);
    expect(f).not.toHaveBeenCalled();
  });

  it('续取：还在写就接着等，写完再返回；网络没恢复也接着等', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        n++;
        if (n === 1) throw new TypeError('Failed to fetch');
        if (n === 2) return new Response(JSON.stringify({ status: 'pending' }));
        return new Response(JSON.stringify({ status: 'done', answer: 'ok' }));
      })
    );
    expect(await recoverDifyAnswer('c', 'm', { intervalMs: 1 })).toBe('ok');
    expect(n).toBe(3);
  });

  it('续取：等到超时就放弃，页面提示已显示的部分可以先复制', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'pending' }))));
    expect(await recoverDifyAnswer('c', 'm', { timeoutMs: 20, intervalMs: 5 })).toBeNull();
  });

  it('续取：Dify 那边也失败了，直接报错不再等', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'error', message: 'x' }))));
    await expect(recoverDifyAnswer('c', 'm', { intervalMs: 1 })).rejects.toBeInstanceOf(DifyStreamError);
  });
});

describe('续取接口', () => {
  it('按登录用户去查，只能取自己的', async () => {
    const { GET } = await import('@/app/api/dify/recover/route');
    const { fetchDifyMessage } = await import('@/lib/dify-recover');
    const res = await GET(new Request('http://x/api/dify/recover?conversationId=c1&messageId=m1'));
    expect(await res.json()).toEqual({ status: 'done', answer: '全文' });
    expect(fetchDifyMessage).toHaveBeenCalledWith('c1', 'm1', 'u1');
  });

  it('缺编号直接 400', async () => {
    const { GET } = await import('@/app/api/dify/recover/route');
    expect((await GET(new Request('http://x/api/dify/recover?conversationId=c1'))).status).toBe(400);
  });

  it('查 Dify：正文非空才算写完；报错就是报错；别人的会话查不到', async () => {
    const real = await vi.importActual<typeof import('@/lib/dify-recover')>('@/lib/dify-recover');
    const reply = (data: object[]) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data }))));

    reply([{ id: 'm1', answer: '', status: 'normal' }]);
    expect(await real.fetchDifyMessage('c1', 'm1', 'u1')).toEqual({ status: 'pending' });

    reply([{ id: 'm0', answer: '别的' }, { id: 'm1', answer: '写完了', status: 'normal' }]);
    expect(await real.fetchDifyMessage('c1', 'm1', 'u1')).toEqual({ status: 'done', answer: '写完了' });

    reply([{ id: 'm1', answer: '', status: 'error', error: 'boom' }]);
    expect(await real.fetchDifyMessage('c1', 'm1', 'u1')).toEqual({ status: 'error', message: 'boom' });

    const f = vi.fn(async () => new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', f);
    expect(await real.fetchDifyMessage('c1', 'm1', 'u1')).toEqual({ status: 'missing' });
    // user 参数就是登录用户——Dify 按它隔离会话
    expect(String((f.mock.calls[0] as any[])[0])).toMatch(/conversation_id=c1&user=u1/);
  });
});

describe('追问接口也不再吞报错', () => {
  const chat = readCode('app/api/dify/chat/route.ts');

  it('报错换成能看懂的话转发', () => {
    expect(chat).toMatch(/const failure = difyEventError\(data\)\s*if \(failure\) \{/);
    expect(chat).toMatch(/JSON\.stringify\(\{ event: 'error', message: friendlyDifyError\(failure\) \}\)/);
  });

  it('共用窗口塞满了就清掉，下一句从新窗口开始', () => {
    expect(chat).toMatch(
      /isContextOverflowError\(failure\) &&\s*sharedConversationId &&\s*useConversationId === sharedConversationId\s*\)\s*\{\s*await clearDifyConversationId\(guard\.userId!, profileId\)/
    );
  });

  it('关掉 Nginx 缓冲', () => {
    expect(chat).toMatch(/'X-Accel-Buffering': 'no'/);
  });
});

describe('认出报错', () => {
  it('线上那条"超出上下文"认得出来', () => {
    expect(isContextOverflowError(OVERFLOW)).toBe(true);
    expect(isContextOverflowError('prompt is too long: 210000 tokens > 200000 maximum')).toBe(true);
    expect(isContextOverflowError('rate limit')).toBe(false);
  });

  it('只有报错事件才算报错', () => {
    expect(difyEventError({ event: 'error', message: 'boom' })).toBe('boom');
    expect(difyEventError({ event: 'workflow_finished', data: { status: 'failed', error: 'e' } })).toBe('e');
    expect(difyEventError({ event: 'workflow_finished', data: { status: 'succeeded' } })).toBeNull();
    expect(difyEventError({ event: 'message', answer: 'error' })).toBeNull();
  });

  it('给用户的话不带英文堆栈', () => {
    for (const m of [OVERFLOW, 'rate limit', 'timeout', 'something else']) {
      expect(friendlyDifyError(m)).not.toMatch(/[A-Za-z]{4,}/);
    }
  });
});
