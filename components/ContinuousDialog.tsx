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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

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

      const response = await fetch('/api/dify/chat', {
        method: 'POST',
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
        const errorText = await response.text()
        throw new Error(`请求失败: ${errorText}`)
      }

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
      console.error('发送失败:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ 发送失败：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date()
      }])
    } finally {
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
      <div className={`bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
        isMinimized ? 'w-96 h-16' : 'w-[90vw] max-w-4xl h-[80vh]'
      }`}>
        <div className="flex items-center justify-between p-4 border-b-2 border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">持续对话</h3>
              <p className="text-xs text-gray-600">
                {conversationId ? '✅ Dify原生记忆' : '🆕 新对话'} • {taskType}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title={isMinimized ? '展开' : '最小化'}
            >
              {isMinimized ? (
                <Maximize2 className="w-5 h-5 text-gray-600" />
              ) : (
                <Minimize2 className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                        : 'bg-white border-2 border-gray-200 text-gray-900'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div className={`text-xs mt-2 ${
                      msg.role === 'user' ? 'text-purple-100' : 'text-gray-400'
                    }`}>
                      {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border-2 border-gray-200 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="flex gap-3">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="继续对话... (Enter发送，Shift+Enter换行)"
                  rows={2}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none resize-none"
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
              
              <p className="text-xs text-gray-500 mt-2">
                💡 Dify原生记忆 + 知识库 • 可以持续追问、展开、优化
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
