import { NextRequest } from 'next/server';
import { requireUserWithQuota } from '@/lib/api-guard';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUserWithQuota();
    if (!guard.ok) return guard.response!;

    const body = await req.json();
    const { query, conversationId, taskType } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: '缺少 query 参数' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('📞 持续对话请求:', {
      taskType,
      conversationId: conversationId || '新对话',
      hasConversationId: !!conversationId,
      queryLength: query.length
    });

    // 调用 Dify API
    const difyBody: any = {
      inputs: {},
      query: query,
      response_mode: 'streaming',
      user: 'user-' + Date.now()
    };

    // 如果有 conversation_id，传递它以保持对话记忆
    if (conversationId) {
      difyBody.conversation_id = conversationId;
    }

    console.log('📤 发送给 Dify 的数据:', JSON.stringify(difyBody, null, 2));

    const response = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.DIFY_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(difyBody)
    });

    console.log('Dify response status:', response.status);

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ Dify Error:', err);
      return new Response(JSON.stringify({ error: 'Dify API 调用失败' }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应');

    let totalChunks = 0;
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = '';
        let currentConversationId = conversationId;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('✅ 对话完成. Total chunks:', totalChunks);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;

              try {
                const data = JSON.parse(line.slice(6));
                
                // 捕获 conversation_id
                if (data.conversation_id && !currentConversationId) {
                  currentConversationId = data.conversation_id;
                  console.log('✅ 新 Conversation ID:', currentConversationId);
                }

                // 流式返回消息
                if (data.event === 'message' && data.answer) {
                  totalChunks++;
                  const sseData = `data: ${JSON.stringify({ 
                    answer: data.answer,
                    conversation_id: currentConversationId 
                  })}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseData));
                }

                // 对话结束时也返回 conversation_id
                if (data.event === 'message_end') {
                  const sseData = `data: ${JSON.stringify({ 
                    event: 'message_end',
                    conversation_id: currentConversationId 
                  })}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseData));
                }

              } catch (e) {
                console.warn('Parse error:', e);
              }
            }
          }
          controller.close();
        } catch (err) {
          console.error('❌ Stream error:', err);
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      }
    });

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

