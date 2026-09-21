"use client"

import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2, MessageCircle, Minimize2, Maximize2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { readDifyStream } from '@/lib/sse-stream'
import {
  listConversations,
  createConversation,
  updateConversation,
  matchesGeneration,
  type ChatMessage,
} from '@/lib/chat-store'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/** 云端结构（timestamp 为数字）→ 组件内结构（timestamp 为 Date） */
function toLocalMessages(messages: ChatMessage[]): Message[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
  }))
}

/** 组件内结构 → 云端结构 */
function toStoredMessages(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.getTime(),
  }))
}


interface ContinuousDialogProps {
  isOpen: boolean
  onClose: () => void
  initialContent: string
  conversationId?: string
  taskType: string
  contextData?: any
}

export default function ContinuousDialog({
  isOpen,
  onClose,
  initialContent,
  conversationId: initialConversationId,
  taskType,
  contextData
}: ContinuousDialogProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string>('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** 本次追问对话在 chat_conversations 里的主键，未落库时为空 */
  const remoteIdRef = useRef<string>('')

  // 打开弹窗时先去云端找这次生成是否已经聊过。
  // 以前这里只是把 messages 重置成生成结果，刷新页面后之前的追问全部消失。
  useEffect(() => {
    if (!isOpen || !initialContent) return

    let cancelled = false
    const restore = async () => {
      setIsRestoring(true)
      // 先摆上生成结果，网络慢时也不至于是一片空白
      setMessages([{ role: 'assistant', content: initialContent, timestamp: new Date() }])
      setConversationId('')
      remoteIdRef.current = ''

      const history = await listConversations('continuous', { taskType, limit: 20 })
      if (cancelled) return

      const hit = history.find((c) => matchesGeneration(c.messages[0], initialContent))
      if (hit) {
        remoteIdRef.current = hit.id
        setConversationId(hit.difyConversationId || '')
        if (hit.messages.length > 0) {
          setMessages(toLocalMessages(hit.messages))
        }
      }
      setIsRestoring(false)
    }

    restore()
    return () => { cancelled = true }
  }, [isOpen, initialContent, taskType])

  useEffect(() => {
    // requestAnimationFrame 确保 DOM 已更新，避免 Strict Mode removeChild 竞态
    const raf = requestAnimationFrame(() => {
      if (messagesEndRef.current && isOpen) {
        try {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          // 忽略 DOM 节点不存在错误（Strict Mode 双重渲染）
          console.debug('[ContinuousDialog] scroll skipped:', err);
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  // 卸载/关闭时中断未完成的流式请求，避免内存泄漏与野回调
  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort()
      abortRef.current = null
    }
    return () => {
      abortRef.current?.abort()
    }
  }, [isOpen])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    // 发送前的快照，落库时以它为基准拼接，避免从闭包里读到旧数组
    const baseMessages = messages

    setMessages(prev => [...prev, userMessage])
    const userInput = inputValue
    setInputValue('')
    setIsLoading(true)

    // 用户的问题先落库：回答中途断网或刷新时，问题不会白打一遍。
    // 首轮在这里创建记录，把生成结果原文一并存进去，作为日后认回这次对话的依据。
    if (!remoteIdRef.current) {
      const created = await createConversation({
        kind: 'continuous',
        taskType,
        title: initialContent.slice(0, 18) || taskType,
        difyConversationId: conversationId || '',
        messages: toStoredMessages([...baseMessages, userMessage]),
      })
      if (created) remoteIdRef.current = created.id
    } else {
      void updateConversation(remoteIdRef.current, {
        messages: toStoredMessages([...baseMessages, userMessage]),
      })
    }

    // 在 try 外声明：finally 要用它们把完整记录写回云端
    let assistantText = ''
    let capturedDifyId = conversationId || ''
    let shouldSave = true

    try {
      console.log('📞 持续对话 - 方案B（Chatbot原生记忆）:', {
        hasConversationId: !!conversationId,
        willSendInitialContent: !conversationId && !!initialContent
      })

      const controller = new AbortController()
      abortRef.current = controller
      const timeoutId = setTimeout(() => controller.abort(), 90_000)

      const response = await fetch('/api/dify/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userInput,
          conversationId: conversationId || undefined,
          initialContent: !conversationId ? initialContent : undefined, // ✅ 首次对话时传递
          profileData: contextData?.profileInfo ? {
            profile_name: contextData.profileInfo
          } : undefined
        })
      })

      if (!response.ok) {
        clearTimeout(timeoutId)
        let msg = `服务返回 ${response.status}`
        try {
          const errJson = await response.json()
          if (errJson?.error) msg = errJson.error
        } catch {
          // 响应体非 JSON，保留状态码文案
        }
        if (response.status === 401) msg = '登录已过期，请重新登录'
        if (response.status === 402) msg = msg || '本月生成次数已用完，请升级会员'
        throw new Error(msg)
      }

      clearTimeout(timeoutId)

      // 统一走 readDifyStream：原先手写的 decode(value) 未开 stream 模式，
      // 中文被拆在数据块边界上会解码成乱码，且半行 JSON 会被整行丢弃。
      assistantText = await readDifyStream(response, {
        onConversationId: (id) => {
          capturedDifyId = id
          setConversationId(id)
        },
        onChunk: (_piece, full) => {
          setMessages(prev => {
            const newMessages = [...prev]
            const lastMsg = newMessages[newMessages.length - 1]

            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = full
            } else {
              newMessages.push({
                role: 'assistant',
                content: full,
                timestamp: new Date()
              })
            }

            return newMessages
          })
        },
      })

      if (assistantText && messages[messages.length - 1]?.role !== 'assistant') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: assistantText,
          timestamp: new Date()
        }])
      }

    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      if (isAbort && !isOpen) {
        // 用户主动关掉了弹窗：不提示，也不要把半截回答写进云端
        shouldSave = false
        return
      }

      console.error('发送失败:', error)
      assistantText = isAbort
        ? '⏱️ 请求超时（超过90秒无响应），请检查网络后重试'
        : `❌ 发送失败：${error instanceof Error ? error.message : '未知错误'}`
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantText,
        timestamp: new Date()
      }])
    } finally {
      abortRef.current = null
      setIsLoading(false)

      // 本轮结束后写回完整记录，刷新页面再打开时即可原样恢复
      if (shouldSave && remoteIdRef.current) {
        void updateConversation(remoteIdRef.current, {
          difyConversationId: capturedDifyId,
          messages: toStoredMessages([
            ...baseMessages,
            userMessage,
            { role: 'assistant', content: assistantText, timestamp: new Date() },
          ]),
        })
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-card rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
        isMinimized ? 'w-96 h-16' : 'w-[90vw] max-w-4xl h-[80vh]'
      }`}>
        <div className="flex items-center justify-between p-4 border-b-2 border-border bg-primary/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 brand-gradient rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">持续对话</h3>
              <p className="text-xs text-muted-foreground">
                {isRestoring
                  ? '⏳ 正在载入历史…'
                  : conversationId
                    ? '✅ 记忆已开启 · 已同步云端'
                    : '🆕 新对话'} • {taskType}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={isMinimized ? '展开' : '最小化'}
            >
              {isMinimized ? (
                <Maximize2 className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Minimize2 className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/40">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'brand-gradient text-white'
                        : 'bg-card border-2 border-border text-foreground'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div className={`text-xs mt-2 ${
                      msg.role === 'user' ? 'text-accent' : 'text-muted-foreground'
                    }`}>
                      {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border-2 border-border rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-4 bg-card">
              <div className="flex gap-3">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="继续对话... (Enter发送，Shift+Enter换行)"
                  rows={2}
                  className="flex-1 px-4 py-3 border-2 border-border bg-background text-foreground rounded-xl focus:border-accent/50 focus:ring-2 focus:ring-primary dark:focus:ring-primary focus:outline-none resize-none"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="px-6 py-3 brand-gradient text-white rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  发送
                </button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                💡 记忆 + 知识库 • 可以持续追问、展开、优化 • 内容已存云端，刷新后再打开还在
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
