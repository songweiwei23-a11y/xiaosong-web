"use client";

import { regenerationPrompt } from "@/lib/script-design";
import { useState, useEffect, useRef, useCallback } from "react";
import { throwApiError, fetchGeneration } from "@/lib/api-error";
import { notifyGenerated } from "@/lib/upgrade";
import { Markdown } from "@/components/markdown";
import { resolveCreationSettings, settingsFromText, mergeCreationSettings, creationSettingsBlock, type CreationSettings } from '@/lib/creation-settings';
import { CreationLinks } from '@/components/workspace/CreationLinks';
import { takeHandoff } from '@/lib/handoff';
import { creationReference, continuationRules } from '@/lib/creation-continuation';
import { AttachmentComposer, AttachmentList, ATTACHMENT_HINT, type AttachmentComposerHandle } from '@/components/chat/ChatAttachments';
import { conversationAttachments, MAX_CHAT_FILES, type ChatAttachment } from '@/lib/chat-attachments';
import { type WebSearchStatus } from '@/lib/dify-web-status';
import { WebSearchQuota } from '@/components/chat/WebSearchQuota';
import { applyChatAnswer } from '@/lib/chat-stream-answer';
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { buildContextBlock } from '@/lib/creator-context';
import {
  Sparkles, Send, Loader2, Plus, Trash2, MessageSquare,
  PanelLeft, X, Copy, Check, Bot, Globe, User as UserIcon,
  PanelRight, RotateCcw, Quote, PencilLine, Square, Download, Paperclip, ClipboardList, FileDown, Printer, Telescope,
} from "lucide-react";
import { ResultCanvas } from '@/components/chat/ResultCanvas';
import { TopBarPortal } from '@/components/dashboard/TopBarSlot';
import { PlanStarter } from '@/components/chat/PlanStarter';
import { ResearchStarter } from '@/components/chat/ResearchStarter';
import { ResearchCard } from '@/components/chat/ResearchCard';
import { PreferenceHint } from '@/components/preferences/PreferenceHint';
import { FactCheckNotice } from '@/components/workspace/FactCheckNotice';
import { stripSelfCert } from '@/lib/self-cert';
import { researchAsk, type ResearchMeta } from '@/lib/research-meta';
import { DEPTHS, type ResearchDepth } from '@/lib/research';
import { PlanOutlineEditor } from '@/components/chat/PlanOutlineEditor';
import { buildContinuePrompt, buildFullPlanPrompt, buildOutlinePrompt, clarifyOptions, looksLikeQuestion, parseOutline, planCompleteness, planDisplayText, type PlanMeta, type PlanSection } from '@/lib/plan-builder';
import { PlanClarify } from '@/components/chat/PlanClarify';
import { downloadDocx, printPdf } from '@/lib/doc-export';
import { reportQuality } from '@/lib/quality-report';
import { CANVAS_MIN_CHARS, addVersion, quoteForInput, type CanvasVersion } from '@/lib/canvas';
import { ChatSyncQueue, readPendingChats, type ChatSyncStatus } from '@/lib/chat-sync';
import { supabase } from '@/lib/supabase/client';
import { createHistoryId } from '@/lib/history-id';
import { notify } from '@/components/ui/feedback';
import { browserDraftStorage } from '@/lib/canvas-draft';
import {
  listConversations,
  createConversation as createRemoteConversation,
  updateConversation as updateRemoteConversation,
  deleteConversation as deleteRemoteConversation,
  getConversationSaveError,
  type ChatMessage,
} from "@/lib/chat-store";

/*
 * 版面（2026-10-04 产品方：上下太挤）：正文和输入框同宽，按屏幕加宽——普通屏 768、宽屏 896、超宽屏 1024。
 */
const CHAT_WIDTH = 'max-w-3xl xl:max-w-4xl 2xl:max-w-5xl';
/** 电脑上会话列表收没收，记住 */
const LIST_KEY = 'kaiwu:free-chat-list-open';
/** 记忆说明的完整版：顶上「记忆已开启」和底部那行小字的悬停提示 */
const MEMORY_TIP = '可以接着最近一次创作聊，也可从各板块点「继续对话」带入指定稿件。想彻底换个话题就点「新建对话」。确认云端同步成功后，换设备也能接着聊。';

interface Conversation {
  /** 本地标识，用作列表 key 与选中态；新建时为 pending- 前缀 */
  id: string;
  /**
   * 数据库里的主键。未落库时为空。
   * 单独留一个字段而不是直接改写 id，是为了让已经挂在界面上的
   * patchConv(id) 调用在落库前后都指向同一个会话。
   */
  remoteId?: string;
  cloudId?: string;
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
  return PENDING_PREFIX + createHistoryId();
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
  const { context: creatorContext, loading: contextLoading } = useCreatorContext();
  const [showLegacy, setShowLegacy] = useState(false);
  const profile = showLegacy ? null : creatorContext.profile as ActiveProfile | null;
  useEffect(() => { setShowLegacy(false); }, [creatorContext.profile?.id]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [webSearchMode, setWebSearchMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const sending = useRef(false);
  // 生成中点「停止」
  const abortRef = useRef<AbortController | null>(null);
  // 改最后一个提问再问（输入框里放着原来的提问，发送时换掉最后一轮）
  const [editingLast, setEditingLast] = useState(false);
  // 结果画布打开的是哪条回答（消息下标）
  const [canvasIdx, setCanvasIdx] = useState<number | null>(null);
  const canvasDirty = useRef(false);
  const trackCanvasDirty = useCallback((dirty: boolean) => { canvasDirty.current = dirty; }, []);
  const syncQueue = useRef<ChatSyncQueue | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, ChatSyncStatus>>({});
  const [historyError, setHistoryError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const historyOffset = useRef(0);
  const [loadRevision, setLoadRevision] = useState(0);
  const [messageWindow, setMessageWindow] = useState(100);
  const pendingCreation = useRef<{ conversationId: string; settings: CreationSettings } | null>(null);
  useEffect(() => { setAttachments([]); }, [activeId, profile?.id, showLegacy]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  // 手机上会话列表默认收起：它浮在对话上面，一进来就挡住对话不合适
  // 电脑上记住上次收没收（2026-10-04）：想要大屏收起一次就行，下次进来保持
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
    else try { if (localStorage.getItem(LIST_KEY) === '0') setSidebarOpen(false); } catch { /* 读不到就展开 */ }
  }, []);
  const toggleList = () => setSidebarOpen((v) => {
    if (window.innerWidth >= 768) try { localStorage.setItem(LIST_KEY, v ? '0' : '1'); } catch { /* 存不了只影响下次 */ }
    return !v;
  });
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const loadedScopeRef = useRef<string>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<AttachmentComposerHandle>(null);
  // 输入框一行起，打字多了自己长高（最高 200px，再多就在框里滚）；发送后清空会缩回一行
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  // 载入云端会话；首次打开时把旧的浏览器本地会话一次性搬上去
  useEffect(() => {
    if (contextLoading) return;
    const scope = profile?.id || "default";
    if (loadedScopeRef.current === scope) return;
    let cancelled = false;
    setLoaded(false);
    setConversations([]);
    setActiveId("");
    setHistoryError('');
    setSyncStatuses({});
    canvasDirty.current = false;
    syncQueue.current = null;
    const load = async () => {
      try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('请登录后读取对话');
      const ownerId = session.user.id;
      const scopeProfile = profile?.id || null;
      let remote: Awaited<ReturnType<typeof listConversations>> = [];
      let cloudLoaded = true;
      try { remote = await listConversations("free_chat", { profileId: scopeProfile, limit: 30, strict: true }); }
      catch { cloudLoaded = false; if (!cancelled) setHistoryError('暂时无法读取云端历史，本机未同步记录仍可恢复'); }
      if (cancelled) return;
      historyOffset.current = remote.length;
      setHasMore(remote.length === 30);
      const queue = new ChatSyncQueue({
        ownerId, profileId: scopeProfile, storage: browserDraftStorage,
        canSync: async () => (await supabase.auth.getSession()).data.session?.user.id === ownerId,
        create: async (snapshot, profileId) => (await createRemoteConversation({
          id: snapshot.cloudId || (snapshot.id.startsWith(PENDING_PREFIX) ? snapshot.id.slice(PENDING_PREFIX.length) : undefined),
          ownerId, kind: 'free_chat', profileId, title: snapshot.title, difyConversationId: snapshot.difyConversationId, messages: snapshot.messages,
        }))?.id || null,
        update: (id, snapshot) => updateRemoteConversation(id, { ownerId, title: snapshot.title, difyConversationId: snapshot.difyConversationId, messages: snapshot.messages }),
        onStatus: (id, status) => { if (syncQueue.current === queue) setSyncStatuses(prev => ({ ...prev, [id]: status })); },
        onSaved: (id, remoteId) => { if (syncQueue.current === queue) setConversations(prev => prev.map(c => c.id === id ? { ...c, remoteId } : c)); },
      });
      syncQueue.current = queue;
      const pending = readPendingChats(browserDraftStorage, ownerId, scopeProfile);

      // 仅在云端确实为空时才迁移，避免把已经搬过的旧数据重复上传
      let migrated: Conversation[] = [];
      if (cloudLoaded && remote.length === 0 && !profile) {
        migrated = await migrateLocalConversations();
      }

      const cloudRows: Conversation[] = [
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
      const pendingRemoteIds = new Set(pending.map(c => c.remoteId || c.cloudId || (c.id.startsWith(PENDING_PREFIX) ? c.id.slice(PENDING_PREFIX.length) : c.id)).filter(Boolean));
      const all: Conversation[] = [...pending, ...cloudRows.filter(c => !pendingRemoteIds.has(c.remoteId || c.id))]
        .sort((a, b) => b.updatedAt - a.updatedAt);
      if (cancelled) return;
      setConversations(all);
      setActiveId(all[0]?.id || "");
      loadedScopeRef.current = scope;
      setLoaded(cloudLoaded || pending.length > 0);
      if (pending.length) {
        notify('已恢复尚未同步的本机对话，正在重试保存');
        for (const snapshot of pending) void queue.enqueue(snapshot);
      }
      } catch (e) {
        if (!cancelled) { setHistoryError((e as Error).message || '读取历史失败，请重试'); setLoaded(false); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [contextLoading, profile?.id, loadRevision]);

  // 本机仅保留未确认同步的快照，云端成功后清除；不会把本机误称为跨设备保存。

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
    if (canvasDirty.current && !confirm('画布修改尚未同步。建议先保存或复制，仍要新建对话吗？')) return null;
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

  const handoffApplied = useRef(false);
  useEffect(() => {
    if (handoffApplied.current || !loaded || contextLoading) return;
    handoffApplied.current = true;
    const data = takeHandoff();
    if (!data?.sourceContent) return;
    const conv = createConversation(true);
    if (!conv) return;
    pendingCreation.current = { conversationId: conv.id, settings: resolveCreationSettings(data, creatorContext) };
    setInput(`【来自${data.from}的创作内容】\n${creationReference(data)}${creationSettingsBlock(resolveCreationSettings(data, creatorContext))}${continuationRules('free-chat')}\n\n请保留以上主题、方向、人群和结构，基于原稿完成一版可直接使用的创作正文；已有事实、已选开头和限制必须承接，不另起炉灶。`);
  }, [loaded, contextLoading, createConversation, creatorContext]);

  const deleteConversation = useCallback(async (id: string) => {
    if (isStreaming || syncStatuses[id]?.state === 'saving') { notify('请等本轮生成和同步结束后再删除'); return; }
    if (!confirm('删除后此对话及其中的画布版本将无法恢复。确定删除吗？')) return;
    const remoteId = conversations.find(c => c.id === id)?.remoteId;
    if (remoteId && !await deleteRemoteConversation(remoteId)) { notify('删除失败，历史已保留，请重试'); return; }
    syncQueue.current?.forget(id);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        setActiveId(next[0]?.id || "");
      }
      return next;
    });
  }, [activeId, conversations, isStreaming, syncStatuses]);

  const patchConv = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  /**
   * @param opts.replaceLast 换掉最后一轮（重新生成、改了提问再问）：把最后一个提问和它的回答拿掉，用这一轮替代
   * @param opts.regenerate  重新生成：同一个问题，要求换个角度答
   * @param opts.files       这一轮带的附件（重新生成时沿用原来那一轮的）
   */
  const handleSend = useCallback(async (text?: string, opts: { replaceLast?: boolean; regenerate?: boolean; files?: ChatAttachment[]; prompt?: string; plan?: PlanMeta } = {}) => {
    const selectedFiles = opts.files ?? (text ? [] : [...attachments]);
    const content = (text ?? input).trim() || (selectedFiles.length ? '请分析我上传的文件，并提炼其中的关键信息。' : '');
    if (!content || sending.current || isStreaming || uploadingFiles || !loaded || contextLoading || showLegacy) return;
    sending.current = true;

    // 确保有一个当前会话
    let conv = activeConv;
    if (!conv) {
      conv = createConversation();
    }
    if (!conv) { sending.current = false; return; }
    const convId = conv.id;
    // 换掉最后一轮：从最后一个提问开始截掉（它和它后面的回答）
    const lastUserIdx = conv.messages.map((m) => m.role).lastIndexOf('user');
    const keep = opts.replaceLast && lastUserIdx >= 0 ? conv.messages.slice(0, lastUserIdx) : conv.messages;
    const isFirstMessage = keep.length === 0;

    const priorSettings = keep.filter(m => m.role === 'user').at(-1)?.creationSettings;
    const inherited = pendingCreation.current?.conversationId === convId ? pendingCreation.current.settings : mergeCreationSettings(priorSettings, settingsFromText(content), {
      userIntent: isFirstMessage || !priorSettings?.userIntent ? content : `${priorSettings.userIntent}\n\n【用户后续要求（后面的明确修改优先）】\n${content}`,
    });
    const creationSettings = resolveCreationSettings({ from: '自由对话', sourceContent: content, settings: inherited }, creatorContext);
    // 出方案（lib/plan-builder）：对话里显示短的说明，真正发给模型的是 opts.prompt；提问和回答都记下 plan，刷新后大纲编辑器还在
    const planTag = opts.plan ? { plan: opts.plan } : {};
    const userMsg: ChatMessage = { role: "user", content, timestamp: Date.now(), creationSettings, ...(selectedFiles.length ? { attachments: selectedFiles } : {}), ...planTag };
    pendingCreation.current = null;
    const title = isFirstMessage ? content.slice(0, 18) : conv.title;
    // 发送前的消息快照。保存时以它为基准拼出完整记录，
    // 避免从 state 闭包里读到上一轮的旧数组。换掉最后一轮时，快照里已经没有那一轮了
    const baseMessages = keep;
    const assistantTimestamp = Date.now();

    patchConv(convId, (c) => ({
      ...c,
      title,
      messages: [...baseMessages, userMsg, { role: "assistant", content: "", timestamp: assistantTimestamp, ...planTag }],
      updatedAt: Date.now(),
    }));
    setInput("");
    setEditingLast(false);
    if (!opts.files) setAttachments([]);
    setIsStreaming(true);
    // 「停止」按钮用它中断
    const controller = new AbortController();
    abortRef.current = controller;

    // 用户的问题先落库：万一回答中途断网或刷新，至少问题不会丢。
    // 新会话到这一步才真正创建，点了「新建对话」却没说话不会留下空记录。
    const queue = syncQueue.current;
    void queue?.enqueue({ ...conv, title, messages: [...baseMessages, userMsg], updatedAt: Date.now() });

    // 首次对话把账号档案作为背景带上
    const difyConvId = conv.difyConversationId;
    // 重新生成提升同一主线的质量；换角度只由用户明确要求。
    const asked = opts.prompt ?? content;
    let query = opts.regenerate ? regenerationPrompt(asked) : asked;
    if (!content.includes('【本条创作的连续设置】')) query += creationSettingsBlock(creationSettings);
    // 深度研究的报告是服务端单独写的，对话记忆里没有：紧接着追问时把报告带上，不然问「第三点展开讲讲」它不知道指什么
    const prevAnswer = keep.at(-1);
    if (prevAnswer?.role === 'assistant' && prevAnswer.research && prevAnswer.content) {
      query = `【刚才的深度研究报告】\n${(prevAnswer.canvas?.at(-1)?.content ?? prevAnswer.content).slice(0, 12000)}\n\n【我的追问】${query}`;
    }
    if (!difyConvId) {
      const ctx = buildProfileContext();
      if (ctx) {
        query = ctx + "\n\n【我的问题】" + query;
      }
    }

    // 在 try 外声明：finally 要用它们拼出完整记录写回云端
    let assistantText = "";
    let capturedDifyId = difyConvId || "";
    let webSearch: WebSearchStatus | undefined;
    let generationSucceeded = false;
    let lastProtectedAt = 0;

    try {
      const res = await fetchGeneration("/api/dify/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          question: content,
          freeChat: true,
          webSearchMode,
          creationSettings,
          files: conversationAttachments(baseMessages, selectedFiles),
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
          let data;
          try { data = JSON.parse(trimmed.slice(6)); } catch { continue; }
            if (data.event === 'error') throw new Error(data.message || data.error || '生成失败，请重试');
            if (data.event === 'web_search') {
              webSearch = { status: data.status, sources: data.sources || [], ...(data.message ? { message: data.message } : {}) };
              window.dispatchEvent(new Event('web-search-quota-updated'));
              patchConv(convId, c => ({ ...c, messages: c.messages.map((m, i) => i === c.messages.length - 1 ? { ...m, webSearch } : m) }));
              continue;
            }
            if (data.event === "conversation_id" && data.conversation_id) {
              capturedDifyId = data.conversation_id;
              patchConv(convId, (c) => ({ ...c, difyConversationId: data.conversation_id }));
              continue;
            }
            if (data.answer && ['message', 'agent_message', 'message_replace'].includes(data.event)) {
              assistantText = applyChatAnswer(assistantText, data);
              if (Date.now() - lastProtectedAt >= 500) {
                queue?.protect({ ...conv, title, difyConversationId: capturedDifyId, updatedAt: Date.now(), messages: [...baseMessages, userMsg, { role: 'assistant', content: assistantText, timestamp: assistantTimestamp, ...(webSearch ? { webSearch } : {}), ...planTag }] });
                lastProtectedAt = Date.now();
              }
              patchConv(convId, (c) => {
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === "assistant") last.content = assistantText;
                return { ...c, messages: msgs, updatedAt: Date.now() };
              });
            }
        }
      }

      // 模型自称「自检通过 / 无虚构」删掉再存（lib/self-cert）：它不可信，真假以「这几处请核对」为准
      if (assistantText.trim()) {
        const cleaned = stripSelfCert(assistantText);
        if (cleaned !== assistantText) {
          assistantText = cleaned;
          patchConv(convId, (c) => { const msgs = [...c.messages]; const last = msgs[msgs.length - 1]; if (last && last.role === "assistant") last.content = assistantText; return { ...c, messages: msgs }; });
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
      } else generationSucceeded = true;
    } catch (e) {
      // 用户点了「停止」：已经写出来的留着，标一句，不当成出错
      assistantText = controller.signal.aborted
        ? `${assistantText.trim()}\n\n（已停止生成）`.trim()
        : `${assistantText.trim()}${assistantText.trim() ? '\n\n' : ''}⚠️ ${((e as Error)?.message || '生成失败，请重试')}`;
      patchConv(convId, (c) => {
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") last.content = assistantText;
        return { ...c, messages: msgs };
      });
    } finally {
      setIsStreaming(false);
      sending.current = false;
      abortRef.current = null;
      if (webSearch?.status === 'searching') webSearch = { status: 'unavailable', sources: [] };

      // 本轮结束后把完整记录写回云端。以发送前的快照为基准拼接，
      // 而不是从 state 里取，后者在闭包中可能仍是上一轮的数组。
      if (queue) {
        void queue.enqueue({
          ...conv,
          title,
          difyConversationId: capturedDifyId,
          updatedAt: Date.now(),
          messages: [
            ...baseMessages,
            userMsg,
            { role: "assistant", content: assistantText, timestamp: assistantTimestamp, ...(webSearch ? { webSearch } : {}), ...planTag },
          ],
        });
      }

      // 这一轮真有回答才算用了一次：快用完了就轻轻提醒一次（见 lib/upgrade）
      if (generationSucceeded) {
        notifyGenerated();
        // 自动质检：这一轮回答体检一遍报给后台（lib/quality-checks）
        reportQuality({ taskType: '自由对话', output: assistantText, profile: creatorContext.profile });
      }

      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, attachments, uploadingFiles, isStreaming, activeConv, createConversation, patchConv, buildProfileContext, profile, loaded, contextLoading, showLegacy, creatorContext]);

  /** 发送：在改最后一个提问时，换掉最后一轮（附件沿用原来那一轮的） */
  const submit = () => {
    if (editingLast && lastUser) void handleSend(input, { replaceLast: true, files: lastUser.attachments ?? [] });
    else void handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    }, () => {});
  };

  const lastUser = activeConv ? [...activeConv.messages].reverse().find((m) => m.role === 'user') : undefined;
  const lastUserIdx = activeConv ? activeConv.messages.lastIndexOf(lastUser as ChatMessage) : -1;

  /** 重新生成最后一条回答：同一个问题（带原来的附件）再问一次，换掉最后一轮 */
  const regenerate = () => {
    if (!lastUser || isStreaming || lastUser.research) return;
    // 出方案的那一轮：按原来的大纲 / 全文要求重新出（显示的只是说明，真正的要求要重新拼）
    if (lastUser.plan) { void handleSend(lastUser.content, { replaceLast: true, regenerate: true, files: lastUser.attachments ?? [], plan: lastUser.plan, prompt: planPrompt(lastUser.plan) }); return; }
    void handleSend(lastUser.content, { replaceLast: true, regenerate: true, files: lastUser.attachments ?? [] });
  };

  /*
   * 出方案（2026-10-04，lib/plan-builder）：第一步出大纲 → 页面上改大纲 → 第二步按确认的大纲写全文；缺章可以补写。
   * 账号背景：这条会话还没和模型说过话时由 handleSend 统一带上；已经聊过的，在方案要求里再带一次，免得聊久了记忆里已经没有
   */
  const [showPlanner, setShowPlanner] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const planContext = () => (activeConv?.difyConversationId ? buildProfileContext() : '');
  const planPrompt = (m: PlanMeta) => (m.stage === 'outline' ? buildOutlinePrompt(m, planContext()) : buildFullPlanPrompt(m, planContext()));
  const startPlan = (m: PlanMeta) => {
    setShowPlanner(false);
    // 资料文件（输入框里已经传好的）跟这一轮一起发；后面写全文、补写不再带，conversationAttachments 会自动沿用最近一次带的文件
    const files = [...attachments];
    void handleSend(planDisplayText(m), { plan: m, prompt: planPrompt(m), files });
    setAttachments([]);
  };
  const confirmOutline = (base: PlanMeta, p: { title: string; sections: PlanSection[]; note: string }) => {
    const m: PlanMeta = { ...base, stage: 'full', outline: p.sections, ...(p.title ? { title: p.title } : {}), ...(p.note ? { note: p.note } : {}) };
    void handleSend(planDisplayText(m), { plan: m, prompt: planPrompt(m), files: [] });
  };
  /** 模型在提问：把它问的（最后一句带问号的）和你的回答一起记下，接着出大纲；资料文件自动沿用 */
  const answerPlan = (m: PlanMeta, question: string, answer: string) => {
    const asked = question.split('\n').map((l) => l.replace(/[*#>]/g, '').trim()).filter((l) => /[？?]/.test(l)).at(-1)?.slice(0, 160) || '你提的确认问题';
    const clarify = [m.clarify, `问：${asked}\n答：${answer}`].filter(Boolean).join('\n').slice(-1500);
    const next: PlanMeta = { ...m, stage: 'outline', clarify };
    void handleSend(planDisplayText(next), { plan: next, prompt: planPrompt(next), files: [] });
  };
  const continuePlan = (m: PlanMeta, missing: string[]) => {
    void handleSend(`📋 出方案（补写缺的 ${missing.length} 章：${missing.join('、')}）`, { plan: m, prompt: buildContinuePrompt(m, missing), files: [] });
  };
  /*
   * 深度研究（2026-10-04 产品方：和出方案一样留在对话页，别弹全屏）。输入框上方一张小卡片开始，
   * 计划、进度、报告都作为这一轮回答出现在对话里（components/chat/ResearchCard）；研究在服务端跑，关掉页面也会继续
   */
  const addResearchTurn = (r: { jobId: string; topic: string; depth: ResearchDepth }, status: ResearchMeta['status']) => {
    setShowResearch(false);
    const conv = activeConv ?? createConversation();
    if (!conv) return;
    const meta: ResearchMeta = { jobId: r.jobId, topic: r.topic, depth: r.depth, ...(status ? { status } : {}) };
    const now = Date.now();
    const title = conv.messages.length ? conv.title : `🔎 ${r.topic}`.slice(0, 18);
    const messages: ChatMessage[] = [...conv.messages,
      { role: 'user', content: researchAsk(r.topic, DEPTHS[r.depth].label), timestamp: now, research: meta },
      { role: 'assistant', content: '', timestamp: now + 1, research: meta }];
    patchConv(conv.id, (c) => ({ ...c, title, messages, updatedAt: now }));
    void syncQueue.current?.enqueue({ ...conv, title, messages, updatedAt: now });
  };
  /** 研究卡片报来的新状态 / 写好的报告：存进那条回答，跟着对话写回云端 */
  const updateResearch = (idx: number, patch: { content?: string; research: ResearchMeta }) => {
    if (!activeConv) return;
    const msg = activeConv.messages[idx];
    if (!msg || (patch.content === undefined || patch.content === msg.content) && JSON.stringify(patch.research) === JSON.stringify(msg.research)) return;
    const messages = activeConv.messages.map((m, i) => (i === idx ? { ...m, ...(patch.content !== undefined ? { content: patch.content } : {}), research: patch.research } : m));
    patchConv(activeConv.id, (c) => ({ ...c, messages, updatedAt: Date.now() }));
    void syncQueue.current?.enqueue({ ...activeConv, messages, updatedAt: Date.now() });
  };

  /** 行业默认值：当前档案的赛道 / 品类，没有就用档案名 */
  const profileIndustry = () => {
    const p = creatorContext.profile as Record<string, unknown> | null;
    const pick = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x !== '餐饮').join('、') : typeof v === 'string' ? v : '');
    return (pick(p?.product_category) || pick(p?.account_track) || String(p?.profile_name ?? '')).slice(0, 80);
  };

  /** 改最后一个提问：放回输入框，发送时换掉最后一轮 */
  const startEditLast = () => {
    if (!lastUser || isStreaming || lastUser.plan || lastUser.research) return;
    setInput(lastUser.content);
    setEditingLast(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  /** 引用追问：选中了这条回答里的一段就引用那段，没选就引用开头一段 */
  const quoteMessage = (idx: number, content: string) => {
    const s = window.getSelection();
    const holder = document.getElementById(`chat-msg-${idx}`);
    const picked = s && !s.isCollapsed && holder && s.anchorNode && holder.contains(s.anchorNode) ? s.toString() : '';
    const text = (picked || content).trim().slice(0, 600);
    setInput((prev) => quoteForInput(text, prev));
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  /** 画布里改了版本：存进那条消息，跟着对话一起写回云端 */
  const saveCanvas = async (idx: number, versions: CanvasVersion[]) => {
    if (!activeConv || !syncQueue.current) return false;
    const messages = activeConv.messages.map((m, i) => (i === idx ? { ...m, canvas: versions } : m));
    patchConv(activeConv.id, (c) => ({ ...c, messages, updatedAt: Date.now() }));
    return syncQueue.current.enqueue({ ...activeConv, messages, updatedAt: Date.now() });
  };

  const saveCanvasLocks = (idx: number, lockedTexts: string[]) => {
    if (!activeConv || !syncQueue.current) return;
    const msg = activeConv.messages[idx];
    if (!msg || JSON.stringify(msg.creationSettings?.lockedTexts || []) === JSON.stringify(lockedTexts)) return;
    const inherited = activeConv.messages.slice(0, idx).filter(m => m.role === 'user').at(-1)?.creationSettings;
    const settings = mergeCreationSettings(inherited, msg.creationSettings, { lockedTexts });
    const messages = activeConv.messages.map((m, i) => i === idx ? { ...m, creationSettings: settings } : m);
    patchConv(activeConv.id, c => ({ ...c, messages, updatedAt: Date.now() }));
    void syncQueue.current.enqueue({ ...activeConv, messages, updatedAt: Date.now() });
  };
  // 换了对话，画布关掉
  useEffect(() => { setCanvasIdx(null); setEditingLast(false); canvasDirty.current = false; setMessageWindow(100); }, [activeId]);

  const retrySync = useCallback(() => {
    if (activeConv) void syncQueue.current?.enqueue(activeConv);
  }, [activeConv]);
  useEffect(() => {
    window.addEventListener('online', retrySync);
    return () => window.removeEventListener('online', retrySync);
  }, [retrySync]);

  const loadMoreConversations = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const scope = profile?.id || 'default';
    try {
      const rows = await listConversations('free_chat', { profileId: profile?.id || null, offset: historyOffset.current, limit: 30, strict: true });
      if (loadedScopeRef.current !== scope) return;
      historyOffset.current += rows.length;
      setHasMore(rows.length === 30);
      setConversations(prev => {
        const ids = new Set(prev.map(c => c.remoteId || c.id));
        return [...prev, ...rows.filter(c => !ids.has(c.id)).map(c => ({ ...c, remoteId: c.id }))];
      });
    } catch { notify('读取更早对话失败，请重试'); }
    finally { setLoadingMore(false); }
  };

  const exportConversation = () => {
    if (!activeConv) return;
    const blob = new Blob([JSON.stringify(activeConv, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${activeConv.title || '对话'}_完整历史.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
              disabled={showLegacy || contextLoading || !loaded}
              className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3 font-medium text-white shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              新建对话
            </button>
          </div>
          {/* 看旧对话时，返回按钮放在顶上显眼处；平时入口是列表底部一行小字 */}
          {creatorContext.profile && showLegacy && (
            <button onClick={() => setShowLegacy(false)} className="mx-3 mb-3 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
              返回当前档案的对话
            </button>
          )}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {conversations.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">还没有对话，点上方新建开始</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  if (c.id !== activeId && canvasDirty.current && !confirm('画布修改尚未同步。建议先保存或复制，仍要切换对话吗？')) return;
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
            {hasMore && <button type="button" disabled={loadingMore} onClick={() => void loadMoreConversations()} className="mt-2 w-full rounded-lg border py-2 text-xs text-muted-foreground disabled:opacity-50">{loadingMore ? '正在读取…' : '加载更早的对话'}</button>}
            {creatorContext.profile && !showLegacy && (
              <button type="button" onClick={() => setShowLegacy(true)} className="mt-3 w-full px-3 text-left text-[11.5px] text-muted-foreground hover:text-foreground hover:underline">
                查看以前未关联档案的对话
              </button>
            )}
          </div>
          {/* 「当前账号背景」去掉了（2026-10-04）：左下角档案卡已经显示同一个档案，这里重复占地方 */}
        </div>
      )}

      {/* 右侧：对话主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          标题行（2026-10-04 产品方选方案 A）：电脑上放进顶栏左边原来空着的位置（components/dashboard/TopBarSlot），
          不再单独占一行——对话区多出 44px，顶栏高度不变。手机上顶栏左边是菜单按钮放不下，仍在这里留一条细的。
          内容一样：收起列表、标题、记忆状态（悬停看完整说明）、同步状态、重试同步、导出。
          同步失败时，失败原因和「重试同步」照常在下面单独一条显示，不藏起来
        */}
        {(() => {
          const titleRow = (
            <>
              <button
                onClick={toggleList}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted"
                title={sidebarOpen ? "收起列表" : "展开列表"}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
              </button>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg brand-gradient">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex min-w-0 flex-1 items-baseline gap-2" title={MEMORY_TIP}>
                <span className="shrink-0 text-sm font-bold text-foreground">高阶自由模式</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeConv?.difyConversationId
                    ? "✅ 记忆已开启"
                    : activeConv?.wantsFreshWindow
                      ? "🆕 从头开始"
                      : "🔗 接着各板块刚做的内容"}<span className="hidden xl:inline"> · 选题·脚本·打磨都能聊</span>
                </span>
              </div>
              {activeConv && (
                <div role="status" className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className={`hidden sm:inline ${syncStatuses[activeConv.id]?.state === 'failed' ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                    {syncStatuses[activeConv.id]?.state === 'saving' ? '正在同步云端…' : syncStatuses[activeConv.id]?.state === 'failed' ? (syncStatuses[activeConv.id].localProtected ? '云端同步失败 · 本机完整快照已保留' : '云端同步失败 · 本机备份未成功，请先导出') : syncStatuses[activeConv.id]?.state === 'saved' || activeConv.remoteId ? '已同步云端' : '新对话，发送后保存'}
                  </span>
                  {syncStatuses[activeConv.id]?.state === 'failed' && <button type="button" onClick={retrySync} className="text-primary underline">重试同步</button>}
                  <button type="button" onClick={exportConversation} title="导出完整历史" aria-label="导出完整历史" className="rounded-lg p-1.5 hover:bg-muted hover:text-primary"><Download className="h-4 w-4" /></button>
                </div>
              )}
            </>
          );
          return (
            <>
              <TopBarPortal><div className="flex min-w-0 flex-1 items-center gap-3 pr-6">{titleRow}</div></TopBarPortal>
              <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5 md:hidden">{titleRow}</div>
            </>
          );
        })()}

        {historyError && <div role="alert" className="flex items-center justify-between gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>{historyError}</span>
          <button type="button" onClick={() => { loadedScopeRef.current = undefined; setLoadRevision(v => v + 1); }} className="shrink-0 underline">重试读取</button>
        </div>}
        {/* 同步失败：手机上顶栏放不下状态字，失败时单独一条；失败原因也在这里 */}
        {activeConv && syncStatuses[activeConv.id]?.state === 'failed' && (
          <div role="alert" className="border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            <span className="sm:hidden">{syncStatuses[activeConv.id].localProtected ? '云端同步失败 · 本机完整快照已保留 ' : '云端同步失败 · 本机备份未成功，请先导出 '}</span>
            {getConversationSaveError(activeConv.remoteId || activeConv.cloudId || activeConv.id.replace(PENDING_PREFIX, '')) || <span className="hidden sm:inline">点右上角「重试同步」，或先导出保留</span>}
          </div>
        )}

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-6">
          <div className={`mx-auto ${CHAT_WIDTH}`}>
            {(!activeConv || activeConv.messages.length === 0) && (
              <div className="mt-10 flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-foreground">想聊点什么？</h2>
                <p className="mb-6 max-w-md text-sm text-muted-foreground">
                  可以连续追问、联网查资料，也可以上传图片和文档一起分析。对话与附件随历史保存在云端。
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
                {/* 出方案入口（lib/plan-builder）：各行各业、各种场景，先出大纲再写全文，能下载 Word / PDF */}
                <button type="button" onClick={() => setShowPlanner(true)} disabled={showLegacy || contextLoading || !loaded}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-primary hover:bg-primary/15 disabled:opacity-50">
                  <ClipboardList className="h-4 w-4" />出一份方案（活动、运营、直播、招商……先出大纲再写全文，可下载 Word / PDF）
                </button>
              </div>
            )}

            {activeConv && activeConv.messages.length > messageWindow && <button type="button" onClick={() => setMessageWindow(n => n + 100)} className="mb-4 w-full rounded-lg border py-2 text-xs text-muted-foreground">显示更早消息（还有 {activeConv.messages.length - messageWindow} 条，全部历史仍保留）</button>}
            {activeConv?.messages.map((msg, idx) => idx < Math.max(0, activeConv.messages.length - messageWindow) ? null : (
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
                    id={`chat-msg-${idx}`}
                    className={`inline-block max-w-full break-words rounded-2xl px-3.5 py-3 text-left sm:px-4 ${
                      msg.role === "user"
                        ? "bg-primary text-white"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    {msg.attachments && <AttachmentList files={msg.attachments} />}
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
                      ) : msg.research ? null : (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      )
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    )}
                    {/* 深度研究：计划、进度在这里；报告写完放进正文，之后只在有没查完的部分时露一行 */}
                    {msg.role === 'assistant' && msg.research && !showLegacy && (
                      <ResearchCard key={msg.research.jobId} meta={msg.research} profileId={profile?.id || null} hasReport={!!msg.content} onUpdate={(p) => updateResearch(idx, p)} />
                    )}
                  </div>
                  {msg.webSearch && <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1"><Globe className="h-3 w-3" />{msg.webSearch.status === 'searching' ? '正在联网查资料…' : msg.webSearch.status === 'done' ? '已执行联网搜索' : msg.webSearch.status === 'quota_exhausted' ? '联网额度已用完，本轮基于已有资料回答' : '本次联网搜索未成功，实时信息请稍后核实'}</p>
                    {msg.webSearch.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block max-w-full truncate text-primary underline" title={source.url}>{source.title}</a>)}
                  </div>}
                  {/* 回答下面的操作：复制、画布、重新生成（最后一条）、引用追问 */}
                  {msg.role === "assistant" && msg.content && !(isStreaming && idx === activeConv.messages.length - 1) && (
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <button onClick={() => copyMessage(msg.canvas?.at(-1)?.content ?? msg.content, idx)} className="flex items-center gap-1 hover:text-foreground">
                        {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedIdx === idx ? "已复制" : "复制"}
                      </button>
                      {(msg.content.length >= CANVAS_MIN_CHARS || msg.canvas) && (
                        <button onClick={() => { if (canvasIdx !== idx && canvasDirty.current && !confirm('当前画布修改尚未同步。建议先保存或复制，仍要打开另一条回答吗？')) return; setCanvasIdx(idx); }} className="flex items-center gap-1 text-primary hover:underline">
                          <PanelRight className="h-3 w-3" />
                          {msg.canvas && msg.canvas.length > 1 ? `在画布中打开（已改到第 ${msg.canvas.length} 版）` : '在画布中打开'}
                        </button>
                      )}
                      {idx === activeConv.messages.length - 1 && !showLegacy && !msg.research && (
                        <button onClick={regenerate} disabled={isStreaming} className="flex items-center gap-1 hover:text-foreground disabled:opacity-50">
                          <RotateCcw className="h-3 w-3" />重新生成
                        </button>
                      )}
                      {!showLegacy && (
                        <button onClick={() => quoteMessage(idx, msg.content)} className="flex items-center gap-1 hover:text-foreground" title="先在回答里选中一段再点，就只引用那段">
                          <Quote className="h-3 w-3" />引用追问
                        </button>
                      )}
                      {/* 下载成文档（lib/doc-export）：画布里改过的取最新一版；浏览器里生成，不上传、不扣次数 */}
                      <button onClick={() => { downloadDocx(msg.canvas?.at(-1)?.content ?? msg.content).catch(() => notify('Word 没生成出来，请重试', 'error')); }} className="flex items-center gap-1 hover:text-foreground" title="下载成 Word 文档（.docx），打开能接着改">
                        <FileDown className="h-3 w-3" />Word
                      </button>
                      <button onClick={() => { try { printPdf(msg.canvas?.at(-1)?.content ?? msg.content); } catch { notify('这个浏览器打印不了，先下载 Word 再转 PDF', 'error'); } }} className="flex items-center gap-1 hover:text-foreground" title="打开打印，选「另存为 PDF」">
                        <Printer className="h-3 w-3" />PDF
                      </button>
                    </div>
                  )}
                  {/* 这几处请核对（2026-10-05）：自由对话只查冒充事实的几类（百分比、顾客见证、据统计、自称自检通过） */}
                  {msg.role === 'assistant' && msg.content && !msg.research && !(isStreaming && idx === activeConv.messages.length - 1) && !showLegacy && (
                    <div className="mt-2">
                      <FactCheckNotice
                        text={msg.canvas?.at(-1)?.content ?? msg.content}
                        taskType="自由对话"
                        profile={creatorContext.profile}
                        source={activeConv.messages.slice(0, idx).filter((m) => m.role === 'user').map((m) => m.content).join('\n')}
                        context={buildProfileContext()}
                        onFix={async (fixed) => {
                          const base: CanvasVersion[] = msg.canvas?.length ? msg.canvas : [{ content: msg.content, at: msg.timestamp, note: 'AI 原稿' }];
                          const ok = await saveCanvas(idx, addVersion(base, fixed, '按资料修正'));
                          if (ok) notify('已按资料修正，存成画布里新的一版');
                          return !!ok;
                        }}
                      />
                    </div>
                  )}
                  {/* 我的创作偏好：最新这条回答按哪些偏好写的（lib/preferences） */}
                  {msg.role === 'assistant' && msg.content && !msg.research && !msg.plan && idx === activeConv.messages.length - 1 && !isStreaming && !showLegacy && <PreferenceHint board="freeChat" />}
                  {/* 出方案：大纲这一轮下面是大纲编辑器；全文这一轮缺章时可以补写 */}
                  {msg.role === 'assistant' && msg.plan && msg.content && !(isStreaming && idx === activeConv.messages.length - 1) && !showLegacy && (() => {
                    const plan = msg.plan;
                    if (plan.stage === 'outline') {
                      const text = msg.canvas?.at(-1)?.content ?? msg.content;
                      const o = parseOutline(text);
                      // 没出大纲、在提问：直接在这里回答，回答完接着出大纲（只给最新这条）
                      if (!o.sections.length && idx === activeConv.messages.length - 1 && looksLikeQuestion(text)) {
                        return <PlanClarify key={`${idx}-${msg.timestamp}`} options={clarifyOptions(text)} disabled={isStreaming || !loaded} onAnswer={(a) => answerPlan(plan, text, a)} />;
                      }
                      return <PlanOutlineEditor key={`${idx}-${msg.timestamp}`} initialTitle={o.title} initialSections={o.sections} hasDoubts={/需要你确认/.test(text)} disabled={isStreaming || !loaded} onConfirm={(p) => confirmOutline(plan, p)} />;
                    }
                    if (!plan.outline?.length || idx !== activeConv.messages.length - 1) return null;
                    // 补写时看前面几轮全文一起：缺的章可能在上一条里已经写了
                    const fullText = activeConv.messages.slice(0, idx + 1).filter((m) => m.role === 'assistant' && m.plan?.stage === 'full').map((m) => m.content).join('\n');
                    const c = planCompleteness(plan.outline, fullText);
                    if (!c.missing.length) return null;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        <span>还缺 {c.missing.length} 章没写：{c.missing.join('、')}</span>
                        <button type="button" onClick={() => continuePlan(plan, c.missing)} disabled={isStreaming} className="rounded-md bg-primary px-2.5 py-1 text-white disabled:opacity-50">补写缺的章节</button>
                      </div>
                    );
                  })()}
                  {/* 最后一个提问可以改了再问 */}
                  {msg.role === "user" && idx === lastUserIdx && !isStreaming && !showLegacy && !msg.plan && !msg.research && (
                    <button onClick={startEditLast} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <PencilLine className="h-3 w-3" />改一下再问
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.content && !(isStreaming && idx === activeConv.messages.length - 1) && <div className="mt-3"><CreationLinks body={msg.canvas?.at(-1)?.content ?? msg.content} context={{ originContent: activeConv.messages.find(m => m.role === 'user')?.content, settings: mergeCreationSettings(settingsFromText(activeConv.messages.find(m => m.role === 'user')?.content || ''), activeConv.messages.slice(0, idx).filter(m => m.role === 'user').at(-1)?.creationSettings, msg.creationSettings) }} /></div>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/*
          输入区（2026-10-04 一体式）：原来是「联网额度一行 + 上传一行 + 输入框 + 两行说明」约 200px，
          现在输入框和一排小工具（上传、联网模式、联网剩余、发送）合在一个框里；输入框一行起、打字多了自己长高。
          上传格式说明放到上传按钮的悬停提示；记忆说明压成一行，完整的在顶上「记忆已开启」的悬停提示里。功能一个没少
        */}
        <div className="border-t bg-card px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
          <div
            className={`mx-auto ${CHAT_WIDTH}`}
            onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
            onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); attachRef.current?.upload(Array.from(e.dataTransfer.files)); } }}
          >
            <AttachmentComposer ref={attachRef} compact key={`${profile?.id || 'default'}:${activeId}:${showLegacy}`} files={attachments} onChange={setAttachments} onBusy={setUploadingFiles} disabled={isStreaming || showLegacy || contextLoading || !loaded} />
            {editingLast && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary">
                <span>正在改上一个提问：发送后会换掉最后这一轮问答</span>
                <button onClick={() => { setEditingLast(false); setInput(''); }} className="underline">取消</button>
              </div>
            )}
            {showPlanner && !showLegacy && (
              <PlanStarter defaultIndustry={profileIndustry()} disabled={isStreaming || contextLoading || !loaded} onStart={startPlan} onClose={() => setShowPlanner(false)}
                fileNames={attachments.map((a) => a.name)} uploading={uploadingFiles} canUpload={!isStreaming && !contextLoading && loaded && attachments.length < MAX_CHAT_FILES}
                onPickFiles={() => attachRef.current?.open()} />
            )}
            {showResearch && !showLegacy && (
              <ResearchStarter key={profile?.id || 'default'} profileId={profile?.id || null} profileContext={buildProfileContext()}
                files={attachments} uploading={uploadingFiles} canUpload={!isStreaming && !contextLoading && loaded && attachments.length < MAX_CHAT_FILES}
                onPickFiles={() => attachRef.current?.open()}
                onCreated={(r) => { addResearchTurn(r, 'planning'); setAttachments([]); }}
                onOpen={(r) => addResearchTurn(r, undefined)}
                onClose={() => setShowResearch(false)} />
            )}
            <div className="rounded-xl glass-panel focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-primary">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={showLegacy ? "旧对话可以查阅；继续创作请返回当前档案的对话" : "自由输入…（Enter 发送，Shift+Enter 换行）"}
                rows={1}
                disabled={isStreaming || showLegacy || contextLoading || !loaded}
                className="block max-h-[200px] w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm focus:outline-none disabled:opacity-60 sm:px-4"
              />
              <div className="flex flex-wrap items-center gap-2 px-2 pb-2 sm:px-3">
                <button
                  type="button"
                  onClick={() => attachRef.current?.open()}
                  disabled={isStreaming || showLegacy || contextLoading || !loaded || uploadingFiles || attachments.length >= MAX_CHAT_FILES}
                  title={`上传图片 / 文件：${ATTACHMENT_HINT}`}
                  aria-label="上传图片 / 文件"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  <span className="hidden sm:inline">{uploadingFiles ? '正在上传…' : '上传'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPlanner((v) => !v); setShowResearch(false); }}
                  disabled={showLegacy || contextLoading || !loaded}
                  aria-pressed={showPlanner}
                  title="出方案：先出大纲，确认后写完整方案，能下载 Word / PDF"
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-muted disabled:opacity-50 ${showPlanner ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">出方案</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowResearch((v) => !v); setShowPlanner(false); }}
                  disabled={showLegacy || contextLoading || !loaded}
                  aria-pressed={showResearch}
                  title="深度研究：上网查一圈、读几十个网页，整理成带出处的报告（专业会员、高频会员）"
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-muted disabled:opacity-50 ${showResearch ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Telescope className="h-4 w-4" />
                  <span className="hidden sm:inline">深度研究</span>
                </button>
                <select aria-label="联网模式" value={webSearchMode} onChange={e => setWebSearchMode(e.target.value as 'auto' | 'on' | 'off')} disabled={isStreaming} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
                  <option value="auto">按需联网</option><option value="on">本轮联网</option><option value="off">关闭联网</option>
                </select>
                <WebSearchQuota />
                <div className="ml-auto">
                  {isStreaming ? (
                    // 生成中：发送键变成停止，已经写出来的会留着
                    <button
                      onClick={() => abortRef.current?.abort()}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      停止
                    </button>
                  ) : (
                    <button
                      onClick={submit}
                      disabled={(!input.trim() && !attachments.length) || uploadingFiles || showLegacy || contextLoading || !loaded}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg brand-gradient px-4 text-sm font-medium text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {editingLast ? '重新提问' : '发送'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-1.5 hidden truncate text-center text-[11px] text-muted-foreground sm:block" title={MEMORY_TIP}>
              💡 和选题、脚本、分镜共用记忆，刚生成的可以直接接着聊 · 换话题点「新建对话」
            </p>
          </div>
        </div>
      </div>

      {/* 结果画布：电脑上在右边并排，手机上全屏盖住（lib/canvas、components/chat/ResultCanvas） */}
      {canvasIdx !== null && activeConv?.messages[canvasIdx]?.role === 'assistant' && (() => {
        const msg = activeConv.messages[canvasIdx];
        const versions: CanvasVersion[] = msg.canvas?.length ? msg.canvas : [{ content: msg.content, at: msg.timestamp, note: 'AI 原稿' }];
        const firstUser = activeConv.messages.find((m) => m.role === 'user')?.content;
        return (
          <ResultCanvas
            key={`${profile?.id || 'default'}:${activeConv.id}:${canvasIdx}:${msg.timestamp}`}
            draftKey={`free-chat:${activeConv.id}:${canvasIdx}:${msg.timestamp}`}
            versions={versions}
            onChange={(v) => saveCanvas(canvasIdx, v)}
            onClose={() => setCanvasIdx(null)}
            onDirtyChange={trackCanvasDirty}
            onLocksChange={(texts) => saveCanvasLocks(canvasIdx, texts)}
            profileContext={buildProfileContext()}
            profileId={profile?.id || null}
            creationContext={{ originContent: firstUser, settings: mergeCreationSettings(settingsFromText(firstUser || ''), activeConv.messages.slice(0, canvasIdx).filter((m) => m.role === 'user').at(-1)?.creationSettings, msg.creationSettings) }}
          />
        );
      })()}
    </div>
  );
}
