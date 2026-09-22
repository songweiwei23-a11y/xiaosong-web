import { NextRequest } from 'next/server';
import { requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard';
import { getDifyConversationId } from '@/lib/dify-conversation';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, conversationId, taskType } = body;

    // 持续对话计入自由对话额度。不传 feature 时只会检查 basic/pro 的总量，
    // 免费版的分功能限额不生效。
    const guard = await requireUserWithQuota('freeChat');
    if (!guard.ok) return guard.response!;

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
    // 工作流的 5 个知识检索节点以 start.search_query 作为检索查询，
    // 此处 query 本身就是用户的原始提问，截断后直接用即可。
    // 若不传，检索节点会拿到空查询导致召回失效。
    const difyBody: any = {
      inputs: {
        query: query,
        search_query: String(query).replace(/\s+/g, ' ').trim().slice(0, 200),
        conversation_history: '',
        dealReasons: ''
      },
      query: query,
      response_mode: 'streaming',
      // 传真实用户 id。此前用 Date.now() 拼接，等于每次请求都是新用户，
      // Dify 无法把同一个人的多轮对话关联起来。
      user: guard.userId!
    };

    // 调用方给了会话就用它，没给就接入这个档案的主工作窗口，
    // 让追问能看见各生成板块刚产出的内容。
    const profileId = body.profileId || null;
    const useConversationId =
      conversationId || (await getDifyConversationId(guard.userId!, profileId));
    if (useConversationId) {
      difyBody.conversation_id = useConversationId;
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
              if (totalChunks > 0 && guard.userId) {
                // featureMap 的 key 是驼峰 freeChat，不是下划线 free_chat。
                // 传错则映射不到列名，扣减被静默跳过，用了不计次。
                await incrementUsageServer(guard.userId, 'freeChat');
              }
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

