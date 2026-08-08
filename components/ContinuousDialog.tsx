"use client"

import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2, MessageCircle, Minimize2, Maximize2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (isOpen && initialContent) {
      setMessages([{
        role: 'assistant',
        content: initialContent,
        timestamp: new Date()
      }])
      setConversationId('')
    }
  }, [isOpen, initialContent])

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

    setMessages(prev => [...prev, userMessage])
    const userInput = inputValue
    setInputValue('')
    setIsLoading(true)

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

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                // 处理自定义的 conversation_id 事件
                if (data.event === 'conversation_id' && data.conversation_id) {
                  setConversationId(data.conversation_id)
                  console.log('💾 收到 conversation_id:', data.conversation_id)
                  continue
                }
                
                // 处理消息内容
                if (data.answer) {
                  assistantMessage += data.answer
                  
                  setMessages(prev => {
                    const newMessages = [...prev]
                    const lastMsg = newMessages[newMessages.length - 1]
                    
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.content = assistantMessage
                    } else {
                      newMessages.push({
                        role: 'assistant',
                        content: assistantMessage,
                        timestamp: new Date()
                      })
                    }
                    
                    return newMessages
                  })
                }

                if (data.event === 'message_end') {
                  console.log('✅ 对话完成')
                }
              } catch (e) {
                console.warn('解析 SSE 失败:', e)
              }
            }
          }
        }
      }

      if (assistantMessage && messages[messages.length - 1]?.role !== 'assistant') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date()
        }])
      }

    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      if (isAbort && !isOpen) return // 用户主动关闭，无需提示

      console.error('发送失败:', error)
      const content = isAbort
        ? '⏱️ 请求超时（超过90秒无响应），请检查网络后重试'
        : `❌ 发送失败：${error instanceof Error ? error.message : '未知错误'}`
      setMessages(prev => [...prev, {
        role: 'assistant',
        content,
        timestamp: new Date()
      }])
    } finally {
      abortRef.current = null
      setIsLoading(false)
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
        <div className="flex items-center justify-between p-4 border-b-2 border-border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">持续对话</h3>
              <p className="text-xs text-muted-foreground">
                {conversationId ? '✅ Dify原生记忆' : '🆕 新对话'} • {taskType}
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
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
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
                      msg.role === 'user' ? 'text-purple-100' : 'text-muted-foreground'
                    }`}>
                      {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border-2 border-border rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
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
                  className="flex-1 px-4 py-3 border-2 border-border bg-background text-foreground rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:outline-none resize-none"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg"
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
                💡 Dify原生记忆 + 知识库 • 可以持续追问、展开、优化
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
