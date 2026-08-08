import { NextRequest } from 'next/server'
import { requireUserWithQuota } from '@/lib/api-guard'

const DIFY_CHATBOT_API_KEY = process.env.DIFY_CHATBOT_API_KEY || ''
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1'

export async function POST(request: NextRequest) {
  try {
    const guard = await requireUserWithQuota();
    if (!guard.ok) return guard.response!;

    const body = await request.json()
    const { query, conversationId, profileData, initialContent } = body

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
      user: 'webapp-user-fixed'
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

          while (true) {
            const { done, value } = await reader!.read()
            if (done) {
              console.log('✅ 对话流结束，有内容:', hasContent)
              controller.close()
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim())

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6)
                  const data = JSON.parse(jsonStr)

                  // 提取 conversation_id（首次对话时）
                  if (data.conversation_id && !conversationIdFromResponse) {
                    conversationIdFromResponse = data.conversation_id
                    console.log('💾 获得 conversation_id:', conversationIdFromResponse)
                    
                    // 发送自定义事件
                    const customEvent = {
                      event: 'conversation_id',
                      conversation_id: conversationIdFromResponse
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(customEvent)}\n\n`))
                  }

                  // 检查是否有内容
                  if (data.answer) {
                    hasContent = true
                  }

                  // 转发原始事件
                  controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`))
                } catch (e) {
                  controller.enqueue(value)
                }
              }
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
