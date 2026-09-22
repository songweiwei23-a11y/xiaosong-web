import { NextRequest } from 'next/server'
import { requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard'
import { buildSearchQuery } from '@/lib/search-query'
import {
  getDifyConversationId,
  saveDifyConversationId,
  clearDifyConversationId,
  startNewWindow,
  isInvalidConversationError,
} from '@/lib/dify-conversation'

/*
 * 自由对话与所有「追问」都走这个路由。
 *
 * 它此前用的是另一个 Dify 应用 DIFY_CHATBOT_API_KEY（应用名「副助手」）。
 * 那个应用没有配置任何输入变量，也就是说工作流里那 5 个知识检索节点
 * 拿不到 search_query——用户在自由对话里问的问题，实际上检索不到
 * 编导知识库。而八个生成板块用的是「小宋编导文案工作台」，
 * 带 search_query / dealReasons，检索是通的。
 *
 * 同一个产品里两套后端、两套能力、两份记忆，追问时模型甚至不知道
 * 刚才生成过什么。现在统一到主工作流应用上。
 */
const DIFY_API_KEY = process.env.DIFY_API_KEY || ''
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, conversationId, profileData, initialContent, freshWindow } = body
    const profileId = body.profileId || profileData?.id || null

    // 追问走的是自由对话额度。不传 feature 会导致免费版限额失效，
    // 且下方扣减必须用同一个 key，否则查得到额度却扣不掉。
    const guard = await requireUserWithQuota('freeChat');
    if (!guard.ok) return guard.response!;

    // 环境变量缺失时早点说清楚。默认值是空串，不拦的话会拿着
    // 「Bearer 」去请求 Dify，回来一个 401，用户看到的是「请求失败」，
    // 排查方向完全被带偏。
    if (!DIFY_API_KEY) {
      console.error('[dify/chat] 缺少环境变量 DIFY_API_KEY');
      return new Response(
        JSON.stringify({ error: '对话服务未配置，请联系管理员' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 用户明确要求开一个干净的窗口（自由对话页的「新建对话」）
    if (freshWindow) {
      await startNewWindow(guard.userId!, profileId)
    }

    /*
     * 用哪个会话：调用方给了就用它（自由对话的某条线程、某次追问自己的线程），
     * 没给就接入这个档案的主工作窗口——这样在自由对话里问
     * 「刚才那条脚本怎么改」时，模型是真的见过那条脚本的。
     */
    const sharedConversationId = freshWindow
      ? null
      : await getDifyConversationId(guard.userId!, profileId)
    const useConversationId = conversationId || sharedConversationId || ''

    console.log('📞 持续对话请求:', {
      queryLength: query?.length,
      来源: conversationId ? '调用方指定' : sharedConversationId ? '接入主窗口' : '新窗口',
      hasInitialContent: !!initialContent,
    })

    // 构建查询内容
    let fullQuery = query

    // 会话是全新的（既没指定也没主窗口）才需要把刚生成的内容贴进去；
    // 接入主窗口时模型已经见过它了，再贴一遍是白花 token
    if (!useConversationId && initialContent) {
      fullQuery = `【刚才生成的内容】\n${initialContent.substring(0, 1500)}\n\n---\n\n【用户的追问】\n${query}`
      console.log('✅ 全新窗口，附带初始内容')
    }

    // 如果有档案数据，添加到查询中
    if (profileData && profileData.profile_name) {
      fullQuery += `\n\n【用户档案】${profileData.profile_name}`
    }

    /*
     * 主工作流应用有 search_query / dealReasons 两个输入变量，
     * 少传会让工作流里的知识检索节点拿到空查询，召回直接失效。
     * 这也是原先那个「副助手」应用最大的缺陷——它压根没有这个变量。
     */
    const searchQuery = buildSearchQuery('自由对话', { taskType: '自由对话' }, query || '')

    const difyPayload: any = {
      inputs: {
        query: fullQuery,
        search_query: searchQuery,
        conversation_history: '',
        dealReasons: '',
      },
      query: fullQuery,
      response_mode: 'streaming',
      // 传真实用户 id：Dify 以此隔离会话与统计用量。
      // 此前写死为固定值，所有用户在 Dify 侧是同一个人。
      user: guard.userId!
    }

    if (useConversationId) {
      difyPayload.conversation_id = useConversationId
    }

    const callDify = () =>
      fetch(`${DIFY_BASE_URL}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(difyPayload),
      })

    let response = await callDify()

    // 会话可能因过期、被删或应用重建而失效。不处理的话，存着的旧 id
    // 会让这个档案的对话永久报错。清掉记录换新会话重试一次，
    // 代价是丢上下文，但功能能自愈。与 /api/dify/stream 同一套处理。
    if (!response.ok && useConversationId) {
      const errText = await response.clone().text()
      if (isInvalidConversationError(response.status, errText)) {
        console.warn('⚠️ 会话已失效，清除后以新会话重试:', errText.slice(0, 160))
        await clearDifyConversationId(guard.userId!, profileId)
        delete difyPayload.conversation_id
        response = await callDify()
      }
    }

    console.log('Dify response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Dify Error:', errorText)
      return new Response(JSON.stringify({ error: '对话服务暂时不可用，请稍后重试' }), {
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

                // 把这轮的会话记为该档案的主工作窗口，下次别的板块生成时
                // 会接着它——这是「所有板块同一个窗口」的另一半：
                // 不只是读，聊出来的上下文也要能被生成板块继承。
                if (conversationIdFromResponse) {
                  await saveDifyConversationId(
                    guard.userId,
                    conversationIdFromResponse,
                    profileId,
                    '自由对话'
                  )
                }
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
