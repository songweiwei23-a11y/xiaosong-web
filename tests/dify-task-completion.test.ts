import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/admin-auth',()=>({getServiceSupabase:vi.fn()}));
import { askDify } from '@/lib/dify-task';
const stream=(events:unknown[])=>new Response(events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join(''));
afterEach(()=>vi.unstubAllGlobals());
describe('blocking task verifies genuine termination',()=>{
  it('does not accept a nonempty truncated JSON as a completed extraction',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>stream([{event:'message',answer:'{"valid":"JSON"}'}])));
    expect(await askDify('q','owner','search')).toEqual({ok:false,message:'回答没有完整结束，请重试'});
  });
  it('preserves actual optional telemetry and server message ids on success',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>stream([{event:'message',answer:'完整回答',conversation_id:'conversation',message_id:'message'},{event:'message_end',metadata:{usage:{prompt_tokens:8,completion_tokens:4}}}])));
    const answer=await askDify('q','owner','search');expect(answer.ok).toBe(true);
    if(answer.ok)expect(answer.completion).toEqual({terminal:'message_end',conversationId:'conversation',messageId:'message',usage:{prompt_tokens:8,completion_tokens:4}});
  });
  it('upstream error with partial answer and terminal marker still fails',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>stream([{event:'message',answer:'半截'},{event:'error',message:'failed'},{event:'message_end'}])));
    expect((await askDify('q','owner','search')).ok).toBe(false);
  });
  it('末行无换行和 data: 后无空格仍读取完成事件', async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('data:{"event":"message","answer":"完整回答"}\n\ndata:{"event":"message_end"}')));
    expect((await askDify('q','owner','search')).ok).toBe(true);
  });
  it('有结束事件但正文在结构标签处中断时失败', async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>stream([{event:'message',answer:'第3步镜头1【画'},{event:'message_end'}])));
    expect(await askDify('q','owner','search')).toEqual({ok:false,message:'回答在结构标签处中断，请重试'});
  });
  it('断开的上游按原消息续取，不再次提交生成', async () => {
    const encoder = new TextEncoder();
    let sent = false;
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent) return controller.error(new TypeError('terminated'));
        sent = true;
        controller.enqueue(encoder.encode('data: {"event":"message","answer":"半截","conversation_id":"conv","message_id":"msg"}\n\n'));
      },
    }));
    const request = vi.fn().mockResolvedValueOnce(response)
      .mockResolvedValueOnce(Response.json({ data: [{ id: 'msg', answer: '在原会话生成的完整正文' }] }));
    vi.stubGlobal('fetch', request);
    expect(await askDify('q', 'owner', 'search')).toMatchObject({
      ok: true, text: '在原会话生成的完整正文', completion: { terminal: 'recovered_message', messageId: 'msg' },
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1].method).toBe('POST');
    expect(request.mock.calls[1][0]).toContain('/messages?conversation_id=conv&user=owner');
  });
});
