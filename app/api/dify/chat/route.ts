import { NextRequest } from 'next/server'
import { requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard'

const DIFY_CHATBOT_API_KEY = process.env.DIFY_CHATBOT_API_KEY || ''
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, conversationId, profileData, initialContent } = body

    // 追问走的是自由对话额度。不传 feature 会导致免费版限额失效，
    // 且下方扣减必须用同一个 key，否则查得到额度却扣不掉。
    const guard = await requireUserWithQuota('freeChat');
    if (!guard.ok) return guard.response!;

    // 环境变量缺失时早点说清楚。默认值是空串，不拦的话会拿着
    // 「Bearer 」去请求 Dify，回来一个 401，用户看到的是「请求失败」，
    // 排查方向完全被带偏。
    if (!DIFY_CHATBOT_API_KEY) {
      console.error('[dify/chat] 缺少环境变量 DIFY_CHATBOT_API_KEY');
      return new Response(
        JSON.stringify({ error: '对话服务未配置，请联系管理员' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('📞 持续对话请求（Chatbot API）:', {
      queryLength: query?.length,
      hasConversationId: !!conversationId,
      hasInitialContent: !!initialContent,
      conversationId: conversationId || '新对话'
    })

    // 构建查询内容
    let fullQuery = query
    
    // 如果是第一次对话（没有conversationId），添加初始内容作为上下文
    if (!conversationId && initialContent) {
      fullQuery = `【刚才生成的内容】\n${initialContent.substring(0, 1500)}\n\n---\n\n【用户的追问】\n${query}`
      console.log('✅ 首次对话，包含初始内容')
    }
    
    // 如果有档案数据，添加到查询中
    if (profileData && profileData.profile_name) {
      fullQuery += `\n\n【用户档案】${profileData.profile_name}`
    }

    // 构建 Dify Chatbot API 请求
    const difyPayload: any = {
      inputs: {},
      query: fullQuery,
      response_mode: 'streaming',
      // 传真实用户 id：Dify 以此隔离会话与统计用量。
      // 此前写死为固定值，所有用户在 Dify 侧是同一个人。
      user: guard.userId!
    }

    // 如果有 conversationId，则传入以启用记忆
    if (conversationId) {
      difyPayload.conversation_id = conversationId
      console.log('✅ 使用对话记忆，conversation_id:', conversationId)
    }

    console.log('📤 发送给 Dify Chatbot:', { 
      queryLength: fullQuery.length,
      queryPreview: fullQuery.substring(0, 200) + '...',
      hasConversationId: !!conversationId 
    })

    // 调用 Dify chat-messages API
    const response = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_CHATBOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyPayload),
    })

    console.log('Dify response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Dify Error:', errorText)
      return new Response(JSON.stringify({ error: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 流式返回
    const reader = response.body?.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let conversationIdFromResponse = ''
          let hasContent = false
          /*
           * 跨数据块的行缓冲。
           *
           * 原实现是 chunk.split('\n')，没有 buffer：一个 SSE 事件被拆在两个
           * 数据块的边界上时，前半行 JSON 解析失败，catch 里又把**整个原始
           * 数据块**重新塞回流里（controller.enqueue(value)），而那一块里的
           * 完整事件上面已经转发过一遍了——于是用户看到重复的文字；
           * 后半行因为不以 "data: " 开头被直接跳过——于是又少一截。
           * 回答越长越容易撞上，这正是各前端页面早就修掉的那个坑。
           */
          let buffer = ''

          while (true) {
            const { done, value } = await reader!.read()
            if (done) {
              console.log('✅ 对话流结束，有内容:', hasContent)
              controller.close()
              if (hasContent && guard.userId) {
                // key 必须与 api-guard 的 featureMap 完全一致（驼峰 freeChat）。
                // 此处曾传 'chat'，映射不到列名，扣减被静默跳过，用了不计次。
                await incrementUsageServer(guard.userId, 'freeChat')
              }
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            // 最后一段可能是半行，留到下一块拼完整再处理
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data: ')) continue

              const jsonStr = trimmed.slice(6)
              let data: any
              try {
                data = JSON.parse(jsonStr)
              } catch {
                // 行是完整的却解析不了，说明这条事件本身有问题，
                // 丢掉它即可——绝不能把整块原始数据重发，那会造成内容重复
                console.warn('[dify/chat] 跳过无法解析的事件:', jsonStr.slice(0, 120))
                continue
              }

              // 提取 conversation_id（首次对话时）
              if (data.conversation_id && !conversationIdFromResponse) {
                conversationIdFromResponse = data.conversation_id
                console.log('💾 获得 conversation_id:', conversationIdFromResponse)

                const customEvent = {
                  event: 'conversation_id',
                  conversation_id: conversationIdFromResponse
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(customEvent)}\n\n`))
              }

              if (data.answer) {
                hasContent = true
              }

              controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`))
            }
          }
        } catch (error) {
          console.error('流处理错误:', error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('API 错误:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
