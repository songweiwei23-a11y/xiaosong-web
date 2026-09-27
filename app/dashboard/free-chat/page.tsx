"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { throwApiError } from "@/lib/api-error";
import { notifyGenerated } from "@/lib/upgrade";
import { Markdown } from "@/components/markdown";
import { getActiveProfileId } from '@/lib/active-profile';
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { buildContextBlock } from '@/lib/creator-context';
import {
  Sparkles, Send, Loader2, Plus, Trash2, MessageSquare,
  PanelLeft, X, Copy, Check, Bot, User as UserIcon,
} from "lucide-react";
import {
  listConversations,
  createConversation as createRemoteConversation,
  updateConversation as updateRemoteConversation,
  deleteConversation as deleteRemoteConversation,
  type ChatMessage,
} from "@/lib/chat-store";

interface Conversation {
  /** 本地标识，用作列表 key 与选中态；新建时为 pending- 前缀 */
  id: string;
  /**
   * 数据库里的主键。未落库时为空。
   * 单独留一个字段而不是直接改写 id，是为了让已经挂在界面上的
   * patchConv(id) 调用在落库前后都指向同一个会话。
   */
  remoteId?: string;
  title: string;
  difyConversationId: string;
  /**
   * 这条线程是用户点「新建对话」开的，第一句话要从干净的窗口开始，
   * 而不是接着该档案的主工作窗口往下说。仅在发出第一句话时有意义，
   * 之后这条线程就有自己的 difyConversationId 了。
   */
  wantsFreshWindow?: boolean;
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

// 旧版本把整个会话列表存在这里。现在改存云端，此键仅用于一次性迁移，
// 迁移成功后清掉，避免换设备时看到两份不同步的历史。
const STORAGE_KEY = "xiaosong_free_chat_v1";

// 尚未落库的新会话用此前缀标记：点「新建对话」只在本地开一个空壳，
// 等用户真正发出第一条消息时才写数据库，否则反复点击会攒下一堆空记录。
const PENDING_PREFIX = "pending-";

const QUICK_PROMPTS = [
"帮我头脑风暴3个适合我账号的爆款选题方向",
"我想拍一条实体店探店视频，先跟我聊聊思路",
"针对刚才的选题，帮我写一版完整口播脚本",
"这个开头钩子不够抓人，帮我换3种更狠的写法",
];

function uid() {
  return PENDING_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 把旧版存在浏览器里的会话搬到云端，成功后清掉本地副本。
 *
 * 只要有一条没搬成功就保留本地数据不删——宁可下次重试（云端为空才会触发，
 * 不会重复上传），也不能让用户的历史对话在迁移途中丢掉。
 */
async function migrateLocalConversations(): Promise<Conversation[]> {
  let local: Conversation[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    local = parsed;
  } catch (e) {
    console.warn("读取本地会话失败", e);
    return [];
  }

  const uploaded: Conversation[] = [];
  let allOk = true;

  for (const conv of local) {
    const created = await createRemoteConversation({
      kind: "free_chat",
      title: conv.title || "新对话",
      difyConversationId: conv.difyConversationId || "",
      messages: conv.messages || [],
    });
    if (created) {
      uploaded.push({
        id: created.id,
        remoteId: created.id,
        title: created.title,
        difyConversationId: created.difyConversationId,
        messages: created.messages,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
    } else {
      allOk = false;
    }
  }

  if (allOk) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 清理失败无妨，云端已有数据，下次不会再触发迁移
    }
  }

  return uploaded;
}
export default function FreeChatPage() {
  // 账号背景走统一清单，不再手拼那 5 个字段
  const { context: creatorContext } = useCreatorContext();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [profile, setProfile] = useState<ActiveProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // 手机上会话列表默认收起：它浮在对话上面，一进来就挡住对话不合适
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  // 载入云端会话；首次打开时把旧的浏览器本地会话一次性搬上去
  useEffect(() => {
    const load = async () => {
      const remote = await listConversations("free_chat");

      // 仅在云端确实为空时才迁移，避免把已经搬过的旧数据重复上传
      let migrated: Conversation[] = [];
      if (remote.length === 0) {
        migrated = await migrateLocalConversations();
      }

      const all: Conversation[] = [
        ...migrated,
        ...remote.map((c) => ({
          id: c.id,
          remoteId: c.id,
          title: c.title,
          difyConversationId: c.difyConversationId,
          messages: c.messages,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      ];
      setConversations(all);
      setActiveId(all[0]?.id || "");
      setLoaded(true);
    };
    load();
  }, []);

  // 载入当前账号档案（作为对话背景）
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/profiles");
        if (!res.ok) return;
        const data: ActiveProfile[] = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
        const savedId = getActiveProfileId();
        const active = data.find((x) => x.id === savedId) || data[0];
        setProfile(active);
      } catch (e) {
        console.warn("载入档案失败", e);
      }
    };
    loadProfile();
  }, []);

  // 会话内容改为在 handleSend 里按轮次写云端（见下方），
  // 这里不再镜像一份到 localStorage：两份数据一旦不同步，
  // 用户在另一台设备上看到的就会是过期内容。

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length, isStreaming]);

  /**
   * 账号背景。
   *
   * 原来这里是手拼的 5 个字段（账号名、平台、粉丝量级、内容方向、目标人群），
   * 连成一行。问题是自由对话什么都可能问——"帮我改改这段文案"
   * 却不知道这个号的口吻，"这个选题行不行"却不知道禁忌是什么。
   * 改成走 lib/context-manifest 的清单，拿到的是简报里那七段，
   * 包括人设与口吻、凭什么信你、绝对不能说。
   */
  const buildProfileContext = useCallback(
    () => buildContextBlock(creatorContext, 'freeChat'),
    [creatorContext]
  );

  /**
   * @param fresh true = 用户主动点「新建对话」，要一个干净的窗口；
   *   false/省略 = 系统自动开的第一条线程，接着该档案的主工作窗口说，
   *   这样它才知道各生成板块刚产出了什么。
   */
  const createConversation = useCallback((fresh = false) => {
    const conv: Conversation = {
      id: uid(),
      title: fresh ? "新对话" : "接着上次",
      difyConversationId: "",
      wantsFreshWindow: fresh,
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
    let remoteId: string | undefined;
    setConversations((prev) => {
      remoteId = prev.find((c) => c.id === id)?.remoteId;
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        setActiveId(next[0]?.id || "");
      }
      return next;
    });
    // 界面先删，云端随后删：删除失败也不该把已经消失的条目再弹回来
    if (remoteId) {
      void deleteRemoteConversation(remoteId);
    }
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
    const title = isFirstMessage ? content.slice(0, 18) : conv.title;
    // 发送前的消息快照。保存时以它为基准拼出完整记录，
    // 避免从 state 闭包里读到上一轮的旧数组。
    const baseMessages = conv.messages;

    patchConv(convId, (c) => ({
      ...c,
      title,
      messages: [...c.messages, userMsg, { role: "assistant", content: "", timestamp: Date.now() }],
      updatedAt: Date.now(),
    }));
    setInput("");
    setIsStreaming(true);

    // 用户的问题先落库：万一回答中途断网或刷新，至少问题不会丢。
    // 新会话到这一步才真正创建，点了「新建对话」却没说话不会留下空记录。
    let remoteId = conv.remoteId;
    if (!remoteId) {
      const created = await createRemoteConversation({
        kind: "free_chat",
        profileId: profile?.id || null,
        title,
        difyConversationId: conv.difyConversationId || "",
        messages: [...baseMessages, userMsg],
      });
      if (created) {
        remoteId = created.id;
        patchConv(convId, (c) => ({ ...c, remoteId: created.id }));
      }
    } else {
      void updateRemoteConversation(remoteId, {
        title,
        messages: [...baseMessages, userMsg],
      });
    }

    // 首次对话把账号档案作为背景带上
    const difyConvId = conv.difyConversationId;
    let query = content;
    if (!difyConvId) {
      const ctx = buildProfileContext();
      if (ctx) {
        query = ctx + "\n\n【我的问题】" + content;
      }
    }

    // 在 try 外声明：finally 要用它们拼出完整记录写回云端
    let assistantText = "";
    let capturedDifyId = difyConvId || "";

    try {
      const res = await fetch("/api/dify/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          conversationId: difyConvId || undefined,
          // 没有自己的会话时，服务端会把这条线程接入该档案的主工作窗口，
          // 于是「刚才那条脚本怎么改」这类问题它是真的知道指的是哪条
          profileId: profile?.id || null,
          // 这条线程是用户点「新建对话」开的，明确要求从干净的窗口开始
          freshWindow: !difyConvId && conv.wantsFreshWindow === true,
        }),
      });

      // 额度用完时服务端会说明原因，直接显示给用户；
      // 只报状态码等于让用户去猜
      if (!res.ok) await throwApiError(res, "请求失败");
      if (!res.body) throw new Error("服务端没有返回内容，请重试");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
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
              capturedDifyId = data.conversation_id;
              patchConv(convId, (c) => ({ ...c, difyConversationId: data.conversation_id }));
              continue;
            }
            if (data.answer) {
              assistantText += data.answer;
              patchConv(convId, (c) => {
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === "assistant") last.content = assistantText;
                return { ...c, messages: msgs, updatedAt: Date.now() };
              });
            }
          } catch {
            // 忽略不完整分片
          }
        }
      }

      if (!assistantText.trim()) {
        assistantText = "（没有返回内容，请重试或换个问法）";
        patchConv(convId, (c) => {
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") last.content = assistantText;
          return { ...c, messages: msgs };
        });
      }
    } catch (e) {
      assistantText = "⚠️ " + ((e as Error)?.message || "生成失败，请重试");
      patchConv(convId, (c) => {
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") last.content = assistantText;
        return { ...c, messages: msgs };
      });
    } finally {
      setIsStreaming(false);

      // 本轮结束后把完整记录写回云端。以发送前的快照为基准拼接，
      // 而不是从 state 里取，后者在闭包中可能仍是上一轮的数组。
      if (remoteId) {
        void updateRemoteConversation(remoteId, {
          title,
          difyConversationId: capturedDifyId,
          messages: [
            ...baseMessages,
            userMsg,
            { role: "assistant", content: assistantText, timestamp: Date.now() },
          ],
        });
      }

      // 这一轮真有回答才算用了一次：快用完了就轻轻提醒一次（见 lib/upgrade）
      if (assistantText) notifyGenerated();

      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isStreaming, activeConv, createConversation, patchConv, buildProfileContext, profile]);

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
    /*
     * 高度扣掉顶栏（手机 56px、电脑 72px）；用 dvh：手机浏览器的地址栏会伸缩，100vh 会多出一截，输入框被顶到屏幕外。
     * 会话列表：电脑上并排；手机上浮在对话上面（原来并排占 256px，手机屏幕才 375，
     * 对话区被挤得只剩一条缝，字都被切掉）。
     */
    <div className="relative flex h-[calc(100dvh-56px)] overflow-hidden md:h-[calc(100dvh-72px)]">
      {/* 手机上列表打开时，点对话区空白处收起 */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      {/* 左侧：会话列表 */}
      {sidebarOpen && (
        <div className="absolute inset-y-0 left-0 z-30 flex w-64 max-w-[80%] flex-col border-r bg-card shadow-xl md:static md:z-auto md:max-w-none md:shadow-none">
          <div className="p-3">
            <button
              onClick={() => createConversation(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3 font-medium text-white shadow-sm transition-all"
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
                onClick={() => {
                  setActiveId(c.id);
                  // 手机上选完就收起，直接看对话
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                  c.id === activeId ? "bg-accent/10 text-accent" : "text-foreground hover:bg-muted"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{c.title || "新对话"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  // 有鼠标的悬停才出现；手机没有悬停，一直显示
                  className="transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  title="删除对话"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶部栏 */}
        <div className="flex items-center gap-3 border-b bg-card px-3 py-3 sm:px-5">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted"
            title={sidebarOpen ? "收起列表" : "展开列表"}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">高阶自由模式</div>
              <div className="text-xs text-muted-foreground">
                {activeConv?.difyConversationId
          ? "✅ 记忆已开启"
          : activeConv?.wantsFreshWindow
            ? "🆕 从头开始"
            : "🔗 接着各板块刚做的内容"} · 选题·脚本·打磨都能聊
              </div>
            </div>
          </div>
        </div>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-6">
          <div className="mx-auto max-w-3xl">
            {(!activeConv || activeConv.messages.length === 0) && (
              <div className="mt-10 flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient">
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
                      className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-all hover:border-accent/30 hover:bg-accent/10"
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
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    msg.role === "user" ? "bg-primary" : "brand-gradient"
                  }`}
                >
                  {msg.role === "user" ? (
                    <UserIcon className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className={`group min-w-0 max-w-[88%] sm:max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                  <div
                    className={`inline-block max-w-full break-words rounded-2xl px-3.5 py-3 text-left sm:px-4 ${
                      msg.role === "user"
                        ? "bg-primary text-white"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    {/*
                      下面那段 prose 必须带 dark:prose-invert。
                      typography 插件的 prose 会把正文颜色写死成深灰
                      （#374151），深色主题下就是深灰字配深灰底——
                      消息正文几乎看不见，只有加粗和引用还能勉强辨认。
                      ResultPanel 和 ContinuousDialog 早就带了，
                      唯独自由对话和历史面板漏掉，所以只有这两处发灰。
                    */}
                    {msg.role === "assistant" ? (
                      msg.content ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none
                          prose-p:text-[14px] prose-p:leading-[1.8]
                          prose-li:text-[14px] prose-strong:text-foreground
                          prose-headings:text-foreground prose-headings:font-semibold
                          prose-hr:border-border/60">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      )
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "assistant" && msg.content && (
                    <button
                      onClick={() => copyMessage(msg.content, idx)}
                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground [@media(hover:hover)]:opacity-0 transition-opacity hover:text-muted-foreground [@media(hover:hover)]:group-hover:opacity-100"
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
        <div className="border-t bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 sm:gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="自由输入…（Enter 发送，Shift+Enter 换行）"
              rows={2}
              disabled={isStreaming}
              className="min-w-0 flex-1 resize-none rounded-xl glass-panel px-3 py-2.5 text-sm sm:px-4 sm:py-3 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="flex h-12 shrink-0 items-center gap-2 rounded-xl brand-gradient px-4 font-medium sm:px-5 text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              发送
            </button>
          </div>
          <p className="mx-auto mt-2 hidden max-w-3xl text-center text-xs text-muted-foreground sm:block">
            💡 这里和选题、脚本、分镜共用同一段记忆——刚生成的内容可以直接接着聊。
        想彻底换个话题就点「新建对话」，会开一个干净的窗口。内容已同步云端，换设备也能接着聊。
          </p>
        </div>
      </div>
    </div>
  );
}
