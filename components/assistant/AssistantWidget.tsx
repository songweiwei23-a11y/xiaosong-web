"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BellRing, Bot, Brain, Check, Copy, Globe, History, Loader2, Plus, Send, Sparkles, Square, Trash2, X } from "lucide-react";
import { getActiveProfileId } from "@/lib/active-profile";
import { memoryEnabled } from "@/lib/settings-memory";
import { ASSISTANT_ASK_EVENT } from "@/lib/assistant/ask";
import { runClientAction } from "@/components/assistant/clientActions";

/** 到期（含今天要做）的待办，打开面板时提醒用户 */
interface DueTodo {
  id: string;
  content: string;
}

/**
 * 右下角的开物助理。每句话是一组：你的话在右边，助理的过程和结果在左边，结果可以直接复制。
 * 对话记在服务器上（长期对话）：可以切换历史对话；助理记下来的事在「记忆」里，可以查看和删除。
 * 首页顶部的一句话条也是通过 ASSISTANT_ASK_EVENT 把话交到这里来的。
 *
 * 助理在服务端后台跑，这里只是每隔一段时间取一次进度，所以等多久都不会断。
 * 没有配置助理（服务端没有中转密钥）时，整个入口不显示。
 */

type TaskStatus = "running" | "done" | "error" | "stopped";

/** 联网这一轮的质量反馈（和服务端 WebFeedback 同形，这里自己写一份，免得界面引入服务端的模块） */
interface WebInfo {
  status: "searching" | "done" | "unavailable" | "quota_exhausted";
  message?: string;
  sources: { title: string; url: string }[];
}

interface Task {
  id: number;
  request: string;
  status: TaskStatus;
  steps: string[];
  answer: string;
  error: string;
  web: WebInfo | null;
}

interface ThreadItem {
  id: string;
  title: string;
  updated_at: string;
}

interface MemoryItem {
  id: string;
  content: string;
  created_at: string;
}

type View = "chat" | "history" | "memories";

const POLL_MS = 1200;
/** 带给助理的上文：只带已经完成的任务，最近 8 条消息（服务器存得下的时候，服务器自己会带摘要和原文） */
const HISTORY_LIMIT = 8;
/** 这一条还没回答完时，不让切换或新建对话：结果是写进当前这段对话的，切走了就接不回来 */
const BUSY_NOTICE = "正在回答这一条，等它结束后再切换或新建对话";
/** 没有对话时给的几句话，点一下就发 */
const STARTERS = ["帮我选 5 条选题", "审一稿", "我有什么要做的", "播放白噪音"];

/** 对话列表里的时间：今天显示时分，其它显示日期 */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  if (day === today) return d.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" });
}

/** 服务器上的消息 → 界面上的一句话（你的话 + 助理的回答） */
function tasksFromMessages(
  messages: { role: "user" | "assistant"; text: string; meta: { web?: WebInfo } | null }[],
  firstId: number,
): Task[] {
  const out: Task[] = [];
  let id = firstId;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const reply = messages[i + 1]?.role === "assistant" ? messages[i + 1] : null;
    out.push({
      id: id++,
      request: m.text,
      status: reply ? "done" : "error",
      steps: [],
      answer: reply?.text ?? "",
      error: reply ? "" : "这一条没有完成，可以再问一次",
      web: reply?.meta?.web ?? null,
    });
  }
  return out;
}

export function AssistantWidget() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState<{ taskId: number; jobId: string } | null>(null);
  const busy = running !== null;
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [due, setDue] = useState<DueTodo[]>([]);
  const [dueDismissed, setDueDismissed] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[] | null>(null);
  /** 助理提议要忘掉的记忆：等用户在页面上点确认，确认前不删 */
  const [forgets, setForgets] = useState<{ id: string; content: string }[]>([]);
  /** 这段对话的摘要没有跟上（上一次压缩没成功）：提醒用户 */
  const [summaryLag, setSummaryLag] = useState(false);
  const [storeOff, setStoreOff] = useState(false);
  const sinceRef = useRef(0);
  const nextIdRef = useRef(1);
  const endRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/assistant?status=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.enabled) setEnabled(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 助理要忘掉某条记忆：只列出来让用户确认，不直接删（同一条只列一次）
  const proposeForget = (args: Record<string, unknown>) => {
    const id = typeof args.id === "string" ? args.id : "";
    const content = typeof args.content === "string" ? args.content : "";
    if (!id || !content) return;
    setForgets((fs) => (fs.some((f) => f.id === id) ? fs : [...fs, { id, content }]));
  };

  // 有任务在跑：每隔一段时间取增量进度，直到结束
  useEffect(() => {
    if (!running) return;
    const { taskId, jobId } = running;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/assistant?job=${encodeURIComponent(jobId)}&since=${sinceRef.current}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          setNotice("取进度没有成功，稍后会再试");
          return;
        }
        sinceRef.current = data.next;
        const added: string[] = [];
        let failure = "";
        let web: WebInfo | null = null;
        const actions: { name: string; args: Record<string, unknown> }[] = [];
        for (const e of data.events as ({ type: string; text?: string; name?: string; args?: Record<string, unknown> } & Partial<WebInfo>)[]) {
          if (e.type === "step" && e.text) added.push(e.text);
          if (e.type === "error" && e.text) failure = e.text;
          if (e.type === "web" && e.status) web = { status: e.status, message: e.message, sources: e.sources ?? [] };
          // 助理安排的页面动作（播放声音等）：这里真的去做
          if (e.type === "action" && e.name) actions.push({ name: e.name, args: e.args ?? {} });
        }
        for (const a of actions) {
          if (a.name === "memory.forget") proposeForget(a.args);
          else void runClientAction(a);
        }
        if (added.length || failure || web) {
          setTasks((ts) =>
            ts.map((t) => (t.id === taskId ? { ...t, steps: [...t.steps, ...added], error: failure || t.error, web: web ?? t.web } : t)),
          );
        }
        if (data.status !== "running") {
          setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: data.status, answer: data.answer || t.answer } : t)));
          setRunning(null);
        }
      } catch {
        // 网络断了一下没关系，下一轮再取
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running]);

  // 打开面板：看一眼待办（到期的、今天要做的，提醒用户；网页关着的时候不会提醒，这是现在的边界）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/todos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((list: { id: string; content: string; due_at: string | null; done: boolean }[] | null) => {
        if (!alive || !Array.isArray(list)) return;
        const endToday = new Date(`${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" })}T23:59:59+08:00`).getTime();
        setDue(list.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() <= endToday).map((t) => ({ id: t.id, content: t.content })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  const refreshThreads = async (): Promise<ThreadItem[] | null> => {
    try {
      const res = await fetch("/api/assistant/threads", { cache: "no-store" });
      if (!res.ok) {
        setStoreOff(true);
        return null;
      }
      const data = (await res.json()) as { threads: ThreadItem[] };
      setStoreOff(false);
      setThreads(data.threads ?? []);
      return data.threads ?? [];
    } catch {
      setStoreOff(true);
      return null;
    }
  };

  const openThread = async (id: string) => {
    if (busy) {
      setView("chat");
      return setNotice(BUSY_NOTICE);
    }
    try {
      const res = await fetch(`/api/assistant/threads?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) return setNotice("这段对话暂时打不开，请稍后再试");
      const data = (await res.json()) as {
        messages: { role: "user" | "assistant"; text: string; meta: { web?: WebInfo } | null }[];
        summaryLagging?: boolean;
      };
      const loaded = tasksFromMessages(data.messages ?? [], nextIdRef.current);
      nextIdRef.current += loaded.length + 1;
      setTasks(loaded);
      setThreadId(id);
      setSummaryLag(!!data.summaryLagging);
      setNotice("");
      setView("chat");
    } catch {
      setNotice("这段对话暂时打不开，请稍后再试");
    }
  };

  // 第一次打开：列出对话，并接着最近的一段聊
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const list = await refreshThreads();
      if (list && list.length && !threadId) await openThread(list[0].id);
    })();
    // 只在第一次打开时接着聊，之后的开关不重复加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [tasks, open, view]);

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const id = nextIdRef.current++;
    const history = tasks
      .filter((t) => t.status === "done")
      .flatMap((t) => [
        { role: "user" as const, text: t.request },
        { role: "assistant" as const, text: t.answer },
      ])
      .slice(-HISTORY_LIMIT);
    setTasks((ts) => [...ts, { id, request: text, status: "running", steps: [], answer: "", error: "", web: null }]);
    setInput("");
    setNotice("");
    setView("chat");
    const fail = (error: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: "error", error } : t)));
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 记忆预填的开关和各板块页面用的是同一个（默认开着）
        body: JSON.stringify({ message: text, history, profileId: getActiveProfileId(), memoryOn: memoryEnabled(), threadId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        fail(data.error || "助理暂时不可用");
        return;
      }
      // 服务器接住了这段对话：记下它的编号，之后的消息接着存在这里
      if (data.threadId) {
        setThreadId(data.threadId);
        void refreshThreads();
      }
      sinceRef.current = 0;
      setRunning({ taskId: id, jobId: data.jobId });
    } catch {
      fail("网络有点问题，请再发一次");
    }
  };

  // 首页的一句话条发来的话：打开面板、直接执行。用最新的 submit，避免拿到旧的上文
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    const onAsk = (e: Event) => {
      const message = (e as CustomEvent<{ message: string }>).detail?.message;
      if (!message) return;
      setOpen(true);
      void submitRef.current(message);
    };
    window.addEventListener(ASSISTANT_ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASSISTANT_ASK_EVENT, onAsk);
  }, []);

  if (!enabled) return null;

  const stop = async () => {
    if (!running) return;
    await fetch(`/api/assistant?job=${encodeURIComponent(running.jobId)}`, { method: "DELETE" }).catch(() => undefined);
  };

  const copy = async (task: Task) => {
    try {
      await navigator.clipboard.writeText(task.answer);
      setCopiedId(task.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setNotice("复制没有成功，可以手动选中文字复制");
    }
  };

  const newConversation = () => {
    if (busy) {
      setView("chat");
      return setNotice(BUSY_NOTICE);
    }
    setThreadId(null);
    setTasks([]);
    setNotice("");
    setSummaryLag(false);
    setView("chat");
  };

  const removeThread = async (id: string) => {
    // 正在答的这段对话不能删：删了结果就没有地方存
    if (busy && id === threadId) return setNotice(BUSY_NOTICE);
    const res = await fetch(`/api/assistant/threads?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setNotice("删除没有成功，请稍后再试");
    if (id === threadId) newConversation();
    void refreshThreads();
  };

  const openMemories = async () => {
    setView("memories");
    try {
      const res = await fetch("/api/assistant/memories", { cache: "no-store" });
      setMemories(res.ok ? ((await res.json()) as { memories: MemoryItem[] }).memories ?? [] : null);
    } catch {
      setMemories(null);
    }
  };

  const removeMemory = async (id: string) => {
    const res = await fetch(`/api/assistant/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setNotice("删除没有成功，请稍后再试");
    setMemories((ms) => (ms ?? []).filter((m) => m.id !== id));
  };

  // 用户点了「确定忘掉」才真的删；删失败就留着卡片，方便再点一次
  const confirmForget = async (id: string) => {
    const res = await fetch(`/api/assistant/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setNotice("忘掉没有成功，请稍后再试");
    setForgets((fs) => fs.filter((f) => f.id !== id));
    setMemories((ms) => (ms ?? []).filter((m) => m.id !== id));
  };

  const keepForget = (id: string) => setForgets((fs) => fs.filter((f) => f.id !== id));

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="打开开物助理"
          className="brand-gradient fixed right-[85px] top-[68%] z-40 flex items-center gap-2.5 rounded-full py-3 pl-3.5 pr-5 text-[15px] font-semibold text-white shadow-lg"
        >
          {/* 小绿点：助理随时待命。减少动效的人看到的是静止的点 */}
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <Bot className="h-5 w-5" /> 问助理
        </button>
      )}

      {open && (
        <section
          aria-label="开物助理"
          className="glass-panel fixed bottom-4 right-4 top-20 z-40 flex w-[min(92vw,400px)] flex-col overflow-hidden rounded-3xl border border-border/70 shadow-2xl sm:bottom-6 sm:right-6"
        >
          <header className="flex items-center gap-2 border-b border-border/60 px-3 py-3 sm:gap-3 sm:px-4">
            <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">
              <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight text-foreground">开物助理</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} aria-hidden="true" />
                {busy ? "正在替你处理…" : storeOff ? "在线（对话暂时不会保存）" : "在线，随时可以吩咐"}
              </p>
            </div>
            <HeaderButton label="新对话" disabled={busy} onClick={newConversation}>
              <Plus className="h-4 w-4" />
            </HeaderButton>
            <HeaderButton label="历史对话" active={view === "history"} onClick={() => setView(view === "history" ? "chat" : "history")}>
              <History className="h-4 w-4" />
            </HeaderButton>
            <HeaderButton label="我记得的事" active={view === "memories"} onClick={() => (view === "memories" ? setView("chat") : void openMemories())}>
              <Brain className="h-4 w-4" />
            </HeaderButton>
            <HeaderButton label="收起助理" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </HeaderButton>
          </header>

          {view === "history" && (
            <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
              <p className="px-1 pb-1 text-[12px] text-muted-foreground">历史对话</p>
              {threads.length === 0 && <p className="px-1 text-[12.5px] text-muted-foreground">还没有保存的对话。开始聊的时候，对话会自动存在这里。</p>}
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition ${t.id === threadId ? "bg-primary/10" : "hover:bg-foreground/[0.04]"}`}
                >
                  <button type="button" onClick={() => void openThread(t.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[13px] text-foreground">{t.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{whenLabel(t.updated_at)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeThread(t.id)}
                    aria-label={`删除对话 ${t.title}`}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {view === "memories" && (
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
                助理会在聊天中记下长期有用的事（比如你的偏好、账号情况、要长期遵守的要求）。你也可以直接告诉它「记住……」。删掉的，它就不再记得了。
              </p>
              {memories === null && <p className="px-1 text-[12.5px] text-muted-foreground">记忆暂时读不出来，请稍后再试。</p>}
              {memories && memories.length === 0 && <p className="px-1 text-[12.5px] text-muted-foreground">还没有记下来的事。</p>}
              {(memories ?? []).map((m) => (
                <div key={m.id} className="group flex items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5">
                  <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">{m.content}</p>
                  <button
                    type="button"
                    onClick={() => void removeMemory(m.id)}
                    aria-label="删除这条记忆"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {view === "chat" && (
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {due.length > 0 && !dueDismissed && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                    <BellRing className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    到期和今天要做的
                  </div>
                  <ul className="mt-2 space-y-1 text-[12.5px] text-muted-foreground">
                    {due.map((t) => (
                      <li key={t.id} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500/70" aria-hidden="true" />
                        <span>{t.content}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setDueDismissed(true)}
                    className="mt-2.5 rounded-lg px-2 py-1 text-[12px] text-primary transition hover:bg-primary/10"
                  >
                    知道了
                  </button>
                </div>
              )}

              {tasks.length === 0 && (
                <div className="flex flex-col items-center px-2 pt-6 text-center">
                  <span className="brand-gradient mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-[14px] font-medium text-foreground">你好，想做点什么？</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    直接说就行，比如「我不知道这周拍什么」。我会先查你的档案和额度，用好默认设置，再交给对应的板块。聊过的事我会记住。
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void submit(s)}
                        disabled={busy}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tasks.map((t) => (
                <TaskThread key={t.id} task={t} copied={copiedId === t.id} onCopy={() => void copy(t)} />
              ))}

              {notice && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{notice}</p>}
              <div ref={endRef} />
            </div>
          )}

          {notice && view !== "chat" && <p className="mx-3 mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{notice}</p>}

          {view === "chat" && summaryLag && (
            <p className="mx-3 mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-foreground">
              这段对话已经很长，较早的内容没能压缩成摘要，助理可能记不全前面的细节。可以新开一段对话，或稍后再问。
            </p>
          )}

          {view === "chat" && forgets.length > 0 && (
            <div className="mx-3 mb-2 space-y-2">
              {forgets.map((f) => (
                <div key={f.id} className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12.5px]">
                  <p className="leading-relaxed text-foreground">确定要忘掉「{f.content}」吗？忘掉后助理就不再记得这件事。</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => keepForget(f.id)} className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground transition hover:text-foreground">
                      先留着
                    </button>
                    <button type="button" onClick={() => void confirmForget(f.id)} className="rounded-lg border border-destructive/50 px-2.5 py-1 font-medium text-destructive transition hover:bg-destructive/10">
                      确定忘掉
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "chat" && (
            <footer className="border-t border-border/60 bg-background/40 px-3 pb-3 pt-2.5">
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit(input);
                    }
                  }}
                  rows={1}
                  placeholder="告诉我你要做的事…"
                  className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="停止"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submit(input)}
                    disabled={!input.trim()}
                    aria-label="发送"
                    className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Enter 发送 · Shift + Enter 换行</p>
            </footer>
          )}
        </section>
      )}
    </>
  );
}

/** 头部的小按钮（统一的大小和悬停效果） */
function HeaderButton({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`shrink-0 rounded-xl p-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

const WEB_LABEL: Record<WebInfo["status"], string> = {
  searching: "正在联网…",
  done: "已联网核实",
  unavailable: "没有查到可核实的资料",
  quota_exhausted: "本期联网额度已用完，这次没有联网",
};

/** 联网的质量反馈：状态一句话，来源逐条列出、可以点开核对 */
function WebBlock({ web }: { web: WebInfo }) {
  const ok = web.status === "done";
  return (
    <div className="rounded-xl border border-border/60 bg-foreground/[0.02] px-3 py-2.5 text-[12px]">
      <p className={`flex items-center gap-1.5 font-medium ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        {WEB_LABEL[web.status]}
        {ok ? `（${web.sources.length} 条来源）` : ""}
      </p>
      {!ok && web.message && <p className="mt-1 text-muted-foreground">{web.message}</p>}
      {web.sources.length > 0 && (
        <ol className="mt-2 space-y-1.5">
          {web.sources.map((s, i) => (
            <li key={`${i}-${s.url}`} className="flex gap-2">
              <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-medium text-primary">{i + 1}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-primary underline-offset-2 hover:underline">
                {s.title || s.url}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  running: "处理中",
  done: "已完成",
  error: "没有完成",
  stopped: "已停止",
};

/** 一句话的完整过程：你的话 → 助理的过程、来源、回答 */
function TaskThread({ task, copied, onCopy }: { task: Task; copied: boolean; onCopy: () => void }) {
  const tone =
    task.status === "done"
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
      : task.status === "error"
        ? "bg-destructive/12 text-destructive"
        : task.status === "stopped"
          ? "bg-foreground/[0.06] text-muted-foreground"
          : "bg-primary/12 text-primary";
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary/12 px-3.5 py-2 text-[13px] leading-relaxed text-foreground">
          {task.request}
        </p>
      </div>

      <article className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="brand-gradient flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{STATUS_LABEL[task.status]}</span>
        </div>

        {task.status === "running" && (
          <div className="space-y-2 pl-1">
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> 正在处理…
            </p>
            <Steps steps={task.steps} />
          </div>
        )}

        {task.status !== "running" && task.steps.length > 0 && (
          <details className="group text-[12px] text-muted-foreground">
            <summary className="cursor-pointer select-none rounded-md py-0.5 transition hover:text-foreground">
              看过程（{task.steps.length} 步）
            </summary>
            <div className="mt-2 pl-1">
              <Steps steps={task.steps} />
            </div>
          </details>
        )}

        {task.web && <WebBlock web={task.web} />}

        {task.answer && (
          <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-border/60 bg-card px-3.5 py-3 text-[13.5px] leading-7 text-foreground shadow-sm">
            {task.answer}
          </div>
        )}
        {task.error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{task.error}</p>}

        {task.answer && (
          <div className="flex items-center justify-between gap-2 pl-1">
            <p className="text-[11px] text-muted-foreground">用了 1 次助理对话；板块按各自额度扣费</p>
            <button
              type="button"
              onClick={onCopy}
              aria-label="复制结果"
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        )}
      </article>
    </div>
  );
}

/** 过程用竖线时间线串起来，看起来就是助理一步步在做 */
function Steps({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <ol className="space-y-2 border-l border-border pl-3.5 text-[12px] leading-relaxed text-muted-foreground">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[18px] top-1.5 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
          {s}
        </li>
      ))}
    </ol>
  );
}
