"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Send, Loader2, Plus, Trash2, MessageSquare,
  Menu, X, Copy, Check, Bot, User as UserIcon,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  difyConversationId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ActiveProfile {
  id: string;
  profile_name: string;
  account_platform?: string[];
  fans_level?: string;
  content_category?: string[];
  target_audience?: string[];
}

const STORAGE_KEY = "xiaosong_free_chat_v1";

const QUICK_PROMPTS = [
  "帮我头脑风暴3个适合我账号的爆款选题方向",
  "我想拍一条实体店探店视频，先跟我聊聊思路",
  "针对刚才的选题，帮我写一版完整口播脚本",
  "这个开头钩子不够抓人，帮我换3种更狠的写法",
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export default function FreeChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [profile, setProfile] = useState<ActiveProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  // 载入本地会话
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Conversation[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveId(parsed[0].id);
        }
      }
    } catch (e) {
      console.warn("载入会话失败", e);
    }
    setLoaded(true);
  }, []);

  // 载入当前账号档案（作为对话背景）
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/profiles");
        if (!res.ok) return;
        const data: ActiveProfile[] = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
        const savedId = localStorage.getItem("activeProfileId");
        const active = data.find((x) => x.id === savedId) || data[0];
        setProfile(active);
      } catch (e) {
        console.warn("载入档案失败", e);
      }
    };
    loadProfile();
  }, []);

  // 持久化
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.warn("保存会话失败", e);
    }
  }, [conversations, loaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length, isStreaming]);

  const buildProfileContext = useCallback(() => {
    if (!profile) return "";
    const parts: string[] = [];
    if (profile.profile_name) parts.push("账号：" + profile.profile_name);
    if (profile.account_platform?.length) parts.push("平台：" + profile.account_platform.join("、"));
    if (profile.fans_level) parts.push("粉丝量级：" + profile.fans_level);
    if (profile.content_category?.length) parts.push("内容方向：" + profile.content_category.join("、"));
    if (profile.target_audience?.length) parts.push("目标人群：" + profile.target_audience.join("、"));
    return parts.join("；");
  }, [profile]);

  const createConversation = useCallback(() => {
    const conv: Conversation = {
      id: uid(),
      title: "新对话",
      difyConversationId: "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
    return conv;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        setActiveId(next[0]?.id || "");
      }
      return next;
    });
  }, [activeId]);

  const patchConv = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    // 确保有一个当前会话
    let conv = activeConv;
    if (!conv) {
      conv = createConversation();
    }
    const convId = conv.id;
    const isFirstMessage = conv.messages.length === 0;

    const userMsg: ChatMessage = { role: "user", content, timestamp: Date.now() };
    patchConv(convId, (c) => ({
      ...c,
      title: isFirstMessage ? content.slice(0, 18) : c.title,
      messages: [...c.messages, userMsg, { role: "assistant", content: "", timestamp: Date.now() }],
      updatedAt: Date.now(),
    }));
    setInput("");
    setIsStreaming(true);

    // 首次对话把账号档案作为背景带上
    const difyConvId = conv.difyConversationId;
    let query = content;
    if (!difyConvId) {
      const ctx = buildProfileContext();
      if (ctx) {
        query = "【我的账号背景】" + ctx + "\n\n【我的问题】" + content;
      }
    }

    try {
      const res = await fetch("/api/dify/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          conversationId: difyConvId || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("请求失败：" + res.status);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.event === "conversation_id" && data.conversation_id) {
              patchConv(convId, (c) => ({ ...c, difyConversationId: data.conversation_id }));
              continue;
            }
            if (data.answer) {
              assistant += data.answer;
              patchConv(convId, (c) => {
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === "assistant") last.content = assistant;
                return { ...c, messages: msgs, updatedAt: Date.now() };
              });
            }
          } catch {
            // 忽略不完整分片
          }
        }
      }

      if (!assistant.trim()) {
        patchConv(convId, (c) => {
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") last.content = "（没有返回内容，请重试或换个问法）";
          return { ...c, messages: msgs };
        });
      }
    } catch (e) {
      patchConv(convId, (c) => {
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") last.content = "⚠️ 生成失败：" + String(e);
        return { ...c, messages: msgs };
      });
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isStreaming, activeConv, createConversation, patchConv, buildProfileContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-muted">
      {/* 左侧：会话列表 */}
      {sidebarOpen && (
        <div className="flex w-64 flex-col border-r bg-card">
          <div className="p-3">
            <button
              onClick={createConversation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-medium text-white shadow-sm transition-all hover:from-purple-700 hover:to-blue-700"
            >
              <Plus className="h-4 w-4" />
              新建对话
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {conversations.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">还没有对话，点上方新建开始</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  c.id === activeId ? "bg-purple-50 text-purple-700" : "text-foreground hover:bg-muted"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{c.title || "新对话"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  title="删除对话"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
          {profile && (
            <div className="border-t px-3 py-3 text-xs text-muted-foreground">
              <div className="mb-1 font-medium text-muted-foreground">当前账号背景</div>
              <div className="truncate">{profile.profile_name}</div>
            </div>
          )}
        </div>
      )}

      {/* 右侧：对话主区 */}
      <div className="flex flex-1 flex-col">
        {/* 顶部栏 */}
        <div className="flex items-center gap-3 border-b bg-card px-5 py-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            title={sidebarOpen ? "收起列表" : "展开列表"}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">高阶自由模式</div>
              <div className="text-xs text-muted-foreground">
                {activeConv?.difyConversationId ? "✅ 记忆已开启" : "🆕 新对话"} · 选题·脚本·打磨都能聊
              </div>
            </div>
          </div>
        </div>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl">
            {(!activeConv || activeConv.messages.length === 0) && (
              <div className="mt-10 flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-foreground">想聊点什么？</h2>
                <p className="mb-6 max-w-md text-sm text-muted-foreground">
                  这里可以自由输入、连续追问，AI 会记住上下文。无论是找选题、写脚本还是反复打磨，直接开口就行。
                </p>
                <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeConv?.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-5 flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    msg.role === "user" ? "bg-blue-600" : "bg-gradient-to-br from-purple-500 to-blue-500"
                  }`}
                >
                  {msg.role === "user" ? (
                    <UserIcon className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className={`group max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                  <div
                    className={`inline-block rounded-2xl px-4 py-3 text-left ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      msg.content ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                      )
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "assistant" && msg.content && (
                    <button
                      onClick={() => copyMessage(msg.content, idx)}
                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100"
                    >
                      {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedIdx === idx ? "已复制" : "复制"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区 */}
        <div className="border-t bg-card px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="自由输入…（Enter 发送，Shift+Enter 换行）"
              rows={2}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border-2 border-border px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-muted"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-5 font-medium text-white shadow-sm transition-all hover:from-purple-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              发送
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
            💡 对话有记忆，可连续追问；换个话题建议点“新建对话”。内容仅保存在本浏览器。
          </p>
        </div>
      </div>
    </div>
  );
}
