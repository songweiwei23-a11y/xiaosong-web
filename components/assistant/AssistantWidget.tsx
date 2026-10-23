"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, Bot, Brain, Check, Copy, FileDown, Globe, History, Loader2, Plus, Send, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, Undo2, X } from "lucide-react";
import { getActiveProfileId } from "@/lib/active-profile";
import { memoryEnabled } from "@/lib/settings-memory";
import { ASSISTANT_ASK_EVENT } from "@/lib/assistant/ask";
import { runClientAction } from "@/components/assistant/clientActions";
import { OPEN_PAGES } from "@/lib/assistant/client-action-spec";
import type { ActionReceipt, UndoSpec } from "@/lib/assistant/receipts";
import { postSafely } from "@/lib/safe-post";
import { notifyProgressChanged } from "@/lib/progress-events";

/** 到期（含今天要做）的待办，打开面板时提醒用户 */
interface DueTodo {
  id: string;
  content: string;
}

/**
 * 右下角的开物助理。每句话是一组：你的话在右边，助理的过程和结果在左边，结果可以直接复制。
 * 对话记在服务器上（长期对话）：可以切换历史对话；助理记下来的事在「记忆」里，可以查看和删除。
 * 助理做了写操作（记待办、改待办、存笔记…）就在回答下面显示回执，能撤销的带撤销按钮。
 * 要删、要改档案、要改作品状态的，助理只会列出来，点了「确定」才真的做（见 Proposal）。
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

/** 回执 + 是否已经撤销了 */
type ReceiptView = ActionReceipt & { undone?: boolean };

interface Task {
  id: number;
  request: string;
  status: TaskStatus;
  steps: string[];
  answer: string;
  error: string;
  web: WebInfo | null;
  receipts: ReceiptView[];
  /** 服务端的任务号（反馈要用）；从历史对话载入的没有 */
  jobId: string | null;
  feedback: "helpful" | "not" | null;
}

/**
 * 助理提议要做、但要用户点确认才真的做的事（删待办、忘掉记忆、改档案、改作品状态）。
 * 确认前什么都不改；确认后由 runProposal 调用对应的接口。
 */
type ProposalKind = "memory.forget" | "todo.delete" | "profile.update" | "profile.create" | "work.status" | "work.progress" | "material.delete" | "board.run";
interface Proposal {
  id: string;
  kind: ProposalKind;
  title: string;
  detail: string;
  confirmLabel: string;
  args: Record<string, unknown>;
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
type StoredMeta = { web?: WebInfo; receipts?: ReceiptView[] } | null;

/** 悬浮按钮和面板的位置（像素，左上角）。没拖过就是 undefined，用默认位置 */
type Pos = { x: number; y: number };
interface SavedPos {
  launcher?: Pos;
  panel?: Pos;
}
const POS_KEY = "kaiwu-assistant-pos";
/** 手机宽度：面板变成底部弹出的整幅面板，不能拖 */
const NARROW_QUERY = "(max-width: 639px)";

/** 把位置夹在可视范围里，免得拖出屏幕找不回来 */
function clampPos(p: Pos, w: number, h: number): Pos {
  if (typeof window === "undefined") return p;
  return {
    x: Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - w - 8)),
    y: Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - h - 8)),
  };
}

function readSavedPos(): SavedPos {
  try {
    return JSON.parse(window.localStorage.getItem(POS_KEY) || "{}") as SavedPos;
  } catch {
    return {};
  }
}

function writeSavedPos(p: SavedPos): void {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    // 存不了（隐私模式等）就每次回到默认位置，不影响使用
  }
}

/** 服务器给的一批进度（轮询和流式都是这个形状），事件同服务端 AssistantEvent */
interface JobChunk {
  status: string;
  answer: string;
  next: number;
  events: ({ type: string; text?: string; name?: string; args?: Record<string, unknown>; receipt?: ActionReceipt } & Partial<WebInfo>)[];
}

/** 「存为文档」：把一条回答（连同操作记录）存成 Markdown 文件，用户自己保存 */
function downloadAsDocument(task: Task): void {
  const title = task.request.split("\n")[0].slice(0, 40) || "助理回答";
  const lines = [`# ${title}`, "", task.answer];
  if (task.receipts.length) {
    lines.push("", "## 操作记录", "");
    for (const r of task.receipts) lines.push(`- ${r.ok ? "已完成" : "没有完成"}：${r.text}${r.undone ? "（已撤销）" : ""}`);
  }
  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  const a = document.createElement("a");
  a.href = url;
  a.download = `开物助理-${day}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const POLL_MS = 1200;
/** 带给助理的上文：只带已经完成的任务，最近 8 条消息（服务器存得下的时候，服务器自己会带摘要和原文） */
const HISTORY_LIMIT = 8;
/** 这一条还没回答完时，不让切换或新建对话：结果是写进当前这段对话的，切走了就接不回来 */
const BUSY_NOTICE = "正在回答这一条，等它结束后再切换或新建对话";
/** 没有对话时给的几句话，点一下就发 */
const STARTERS = ["帮我选 5 条选题", "审一稿", "我有什么要做的", "播放白噪音"];
/** 按页面给的示例提问（升级方案 I2）：在哪个页面打开，就先提哪些事 */
const STARTERS_BY_PAGE: [string, string[]][] = [
  ["/dashboard/script", ["帮我写一条脚本", "选题怎么做，才有爆款的可能？", "我有什么要做的", "播放白噪音"]],
  ["/dashboard/topic", ["帮我选 5 条选题", "选题怎么做，才有爆款的可能？", "今天的安排是什么", "播放白噪音"]],
  ["/dashboard/review", ["审一稿", "审稿要注意什么？", "我有什么要做的", "播放白噪音"]],
  ["/dashboard/profiles", ["我的档案还缺什么", "我的额度还剩多少？", "我有什么要做的", "播放白噪音"]],
];
const startersFor = (path: string): string[] => STARTERS_BY_PAGE.find(([p]) => path.startsWith(p))?.[1] ?? STARTERS;

/** 能做什么、不能做什么（升级方案 I1）：和助理的规则保持一致 */
const CAN_DO = [
  "记待办、改待办的内容或日期、标记完成；存笔记、查笔记",
  "查你的档案、作品进度和额度；派活给选题、脚本、审稿、标题、分镜、方向、内容规划、成交理由、账号定位、创作简报、行业建议、起号方案、开篇钩子、跨行业二创、文案拆解（先列给你看，你点确定才开跑）",
  "查编导知识库里的方法，查最新热点（会注明来源）",
  "播放白噪音、雨声等环境声；带你走到某个页面",
  "要删待办、改档案、改作品状态，先列给你看，你点确定才生效",
];
const CANNOT_DO = [
  "付款、删除脚本历史和作品这类数据、发布或发送内容、修改账号和密码",
  "替你在页面里填写内容（它只带你去页面）",
];

/** 每次提交都带一个新的请求编号：网络重试时服务端不会重复跑、重复扣额度 */
function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  messages: { role: "user" | "assistant"; text: string; meta: StoredMeta }[],
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
      receipts: reply?.meta?.receipts ?? [],
      jobId: null,
      feedback: null,
    });
  }
  return out;
}

/** 助理发来的动作 → 待确认的提议（不认识的返回 null） */
function proposalFrom(name: string, args: Record<string, unknown>): Proposal | null {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (name === "memory.forget") {
    const id = s(args.id);
    const content = s(args.content);
    if (!id || !content) return null;
    return { id: `memory:${id}`, kind: "memory.forget", title: `忘掉「${content}」`, detail: "忘掉后，助理就不再记得这件事。", confirmLabel: "确定忘掉", args };
  }
  if (name === "todo.delete") {
    const id = s(args.id);
    const content = s(args.content);
    if (!id || !content) return null;
    return { id: `todo:${id}`, kind: "todo.delete", title: `删除待办「${content}」`, detail: "删除后就找不回来了。", confirmLabel: "确定删除", args };
  }
  if (name === "profile.update") {
    const id = s(args.id);
    const field = s(args.field);
    if (!id || (field !== "profile_name" && field !== "industry")) return null;
    return {
      id: `profile:${id}:${field}`,
      kind: "profile.update",
      title: `修改档案「${s(args.profileName) || "未命名档案"}」`,
      detail: `${s(args.label) || field}：「${s(args.from) || "未填"}」改为「${s(args.value)}」`,
      confirmLabel: "确定修改",
      args,
    };
  }
  if (name === "work.progress") {
    const id = s(args.id);
    if (!id) return null;
    return {
      id: `work-progress:${id}`,
      kind: "work.progress",
      title: `修改作品「${s(args.title) || "未命名"}」`,
      detail: `${s(args.label) || "内容做完情况"}`,
      confirmLabel: "确定修改",
      args,
    };
  }
  if (name === "material.delete") {
    const id = s(args.id);
    const profileId = s(args.profileId);
    if (!id || !profileId) return null;
    return {
      id: `material:${id}`,
      kind: "material.delete",
      title: `删除素材「${s(args.filename) || "未命名"}」`,
      detail: "删除后素材库里就没有这个文件了。",
      confirmLabel: "确定删除",
      args,
    };
  }
  if (name === "board.run") {
    const runId = s(args.runId);
    if (!runId) return null;
    const label = s(args.label) || "板块";
    const maxRuns = typeof args.maxRuns === "number" ? args.maxRuns : 3;
    return {
      id: `board:${runId}`,
      kind: "board.run",
      title: `开跑「${label}」`,
      detail: `${s(args.summary)}。最多跑 ${maxRuns} 次，每次扣一次「${s(args.feature)}」额度；不达标我会让板块返工。`,
      confirmLabel: "确定开跑",
      args,
    };
  }
  if (name === "profile.create") {
    const profileName = s(args.profileName);
    if (!profileName) return null;
    const industry = s(args.industry);
    return {
      id: `profile:new:${profileName}`,
      kind: "profile.create",
      title: `新建档案「${profileName}」`,
      detail: industry ? `行业：${industry}` : "行业未填，建好后可以到档案页面补",
      confirmLabel: "确定新建",
      args,
    };
  }
  if (name === "work.status") {
    const id = s(args.id);
    if (!id) return null;
    return {
      id: `work:${id}`,
      kind: "work.status",
      title: `修改作品「${s(args.title) || "未命名"}」`,
      detail: `改为${s(args.label)}`,
      confirmLabel: "确定修改",
      args,
    };
  }
  return null;
}

const PROPOSAL_DONE: Record<ProposalKind, string> = {
  "memory.forget": "已忘掉这件事",
  "todo.delete": "已删除待办",
  "profile.update": "已修改档案",
  "profile.create": "已新建档案",
  "work.status": "已修改作品状态",
  "board.run": "已派给板块，进度在下面",
  "work.progress": "已更新作品进度",
  "material.delete": "已删除素材",
};

/** 确认后真的去做（接口都是用户自己的 Cookie，权限和页面一样） */
async function runProposal(p: Proposal): Promise<boolean> {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const json = { "Content-Type": "application/json" };
  let res: Response;
  if (p.kind === "memory.forget") {
    res = await fetch(`/api/assistant/memories?id=${encodeURIComponent(s(p.args.id))}`, { method: "DELETE" });
  } else if (p.kind === "todo.delete") {
    res = await fetch(`/api/todos?id=${encodeURIComponent(s(p.args.id))}`, { method: "DELETE" });
  } else if (p.kind === "profile.update") {
    const field = s(p.args.field);
    if (field !== "profile_name" && field !== "industry") return false;
    res = await postSafely("/api/profiles", { method: "PATCH", headers: json, body: JSON.stringify({ id: s(p.args.id), [field]: s(p.args.value) }) });
  } else if (p.kind === "work.progress") {
    res = await fetch(`/api/works?id=${encodeURIComponent(s(p.args.id))}`, { method: "PUT", headers: json, body: JSON.stringify({ isDone: p.args.done === true }) });
  } else if (p.kind === "material.delete") {
    res = await fetch(`/api/work-materials?id=${encodeURIComponent(s(p.args.id))}&profileId=${encodeURIComponent(s(p.args.profileId))}`, { method: "DELETE" });
  } else if (p.kind === "profile.create") {
    const profileName = s(p.args.profileName);
    if (!profileName) return false;
    const industry = s(p.args.industry);
    res = await postSafely("/api/profiles", { method: "POST", headers: json, body: JSON.stringify({ profile_name: profileName, ...(industry ? { industry } : {}) }) });
  } else {
    res = await fetch(`/api/works?id=${encodeURIComponent(s(p.args.id))}`, { method: "PUT", headers: json, body: JSON.stringify({ shootStatus: s(p.args.status) }) });
  }
  return res.ok;
}

/** 撤销一条回执：用回执里记下的做法，调用对应的接口 */
async function runUndo(u: UndoSpec): Promise<boolean> {
  const json = { "Content-Type": "application/json" };
  let res: Response | null;
  if (u.type === "todo_delete") {
    res = await fetch(`/api/todos?id=${encodeURIComponent(u.id)}`, { method: "DELETE" }).catch(() => null);
  } else if (u.type === "todo_patch") {
    res = await fetch(`/api/todos?id=${encodeURIComponent(u.id)}`, { method: "PATCH", headers: json, body: JSON.stringify(u.body) }).catch(() => null);
  } else {
    res = await fetch(`/api/assistant/notes?id=${encodeURIComponent(u.id)}`, { method: "DELETE" }).catch(() => null);
  }
  return !!res?.ok;
}

export function AssistantWidget() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState<{ taskId: number; jobId: string } | null>(null);
  const busy = running !== null;
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  /** 一句成功的话（确认提议、撤销之后给的），和红色的错误提示分开 */
  const [flash, setFlash] = useState("");
  const [due, setDue] = useState<DueTodo[]>([]);
  const [dueDismissed, setDueDismissed] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[] | null>(null);
  /** 助理提议的待确认事项：列出来让用户确认，确认前不改 */
  const [proposals, setProposals] = useState<Proposal[]>([]);
  /** 这段对话的摘要没有跟上（上一次压缩没成功）：提醒用户 */
  const [summaryLag, setSummaryLag] = useState(false);
  const [storeOff, setStoreOff] = useState(false);
  const sinceRef = useRef(0);
  const nextIdRef = useRef(1);
  const endRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  // 悬浮按钮、面板可以拖到任意位置（位置记在这台设备的浏览器里）；手机宽度下面板固定在底部，不能拖
  const [launcherPos, setLauncherPos] = useState<Pos | undefined>(undefined);
  const [panelPos, setPanelPos] = useState<Pos | undefined>(undefined);
  const [narrow, setNarrow] = useState(false);
  const dragRef = useRef<{ which: "launcher" | "panel"; startX: number; startY: number; originX: number; originY: number; w: number; h: number; moved: boolean } | null>(null);
  const posRef = useRef<SavedPos>({});
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const saved = readSavedPos();
    posRef.current = saved;
    setLauncherPos(saved.launcher);
    setPanelPos(saved.panel);
    const mq = window.matchMedia(NARROW_QUERY);
    const onNarrow = () => setNarrow(mq.matches);
    onNarrow();
    mq.addEventListener("change", onNarrow);
    // 窗口大小变了（转屏、拉窄浏览器）：把位置夹回可视范围
    const onResize = () => {
      setLauncherPos((p) => (p ? clampPos(p, 56, 56) : p));
      setPanelPos((p) => (p ? clampPos(p, Math.min(400, window.innerWidth * 0.92), 360) : p));
    };
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener("change", onNarrow);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // 拖动：指针在窗口上移动、松开。移动超过几个像素才算拖，免得误触打开助理
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      const next = clampPos({ x: d.originX + dx, y: d.originY + dy }, d.w, d.h);
      posRef.current = { ...posRef.current, [d.which]: next };
      if (d.which === "launcher") setLauncherPos(next);
      else setPanelPos(next);
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !d.moved) return;
      // 刚拖完松手，浏览器还会发一次点击：这一次不当成「打开」
      if (d.which === "launcher") suppressClickRef.current = true;
      writeSavedPos(posRef.current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /** 在按钮或面板的标题上按下：记下起点，之后由窗口上的移动事件处理拖动 */
  const beginDrag = (which: "launcher" | "panel") => (e: ReactPointerEvent<HTMLElement>) => {
    if (which === "panel" && narrow) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const box = which === "launcher" ? (e.currentTarget as HTMLElement) : (e.currentTarget.closest("section") as HTMLElement | null);
    if (!box) return;
    const r = box.getBoundingClientRect();
    dragRef.current = { which, startX: e.clientX, startY: e.clientY, originX: r.left, originY: r.top, w: r.width, h: r.height, moved: false };
  };

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

  // 助理提议要做的事：同一件只列一次
  const propose = (p: Proposal) => setProposals((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p]));

  // 有任务在跑：优先用流式接收进度（事件一产生就推过来）；流断了，退回每隔一段时间取一次
  useEffect(() => {
    if (!running) return;
    const { taskId, jobId } = running;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;
    let finished = false;

    // 把服务器给的一批进度（增量）放进界面；任务已经结束就返回 true
    const apply = (data: JobChunk): boolean => {
      sinceRef.current = data.next;
      const added: string[] = [];
      const got: ReceiptView[] = [];
      let failure = "";
      let web: WebInfo | null = null;
      let page: string | null = null;
      const actions: { name: string; args: Record<string, unknown> }[] = [];
      for (const e of data.events) {
        if (e.type === "step" && e.text) added.push(e.text);
        if (e.type === "error" && e.text) failure = e.text;
        if (e.type === "web" && e.status) web = { status: e.status, message: e.message, sources: e.sources ?? [] };
        // 写操作的回执：显示在回答下面
        if (e.type === "receipt" && e.receipt) got.push(e.receipt);
        // 助理安排的页面动作：声音这里马上做，页面跳转等回答结束后再做
        if (e.type === "action" && e.name) actions.push({ name: e.name, args: e.args ?? {} });
      }
      for (const a of actions) {
        if (a.name === "page.open") {
          const target = typeof a.args.page === "string" ? OPEN_PAGES[a.args.page] : undefined;
          if (target) page = target.path;
          continue;
        }
        const p = proposalFrom(a.name, a.args);
        if (p) propose(p);
        else void runClientAction(a);
      }
      if (added.length || failure || web || got.length) {
        setTasks((ts) =>
          ts.map((t) =>
            t.id === taskId
              ? { ...t, steps: [...t.steps, ...added], error: failure || t.error, web: web ?? t.web, receipts: got.length ? [...t.receipts, ...got] : t.receipts }
              : t,
          ),
        );
      }
      if (data.status === "running") return false;
      setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: data.status as TaskStatus, answer: data.answer || t.answer } : t)));
      setRunning(null);
      if (page) router.push(page);
      return true;
    };

    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const pollOnce = async () => {
      try {
        const res = await fetch(`/api/assistant?job=${encodeURIComponent(jobId)}&since=${sinceRef.current}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as JobChunk | null;
        if (!res.ok || !data) {
          setNotice("取进度没有成功，稍后会再试");
          return;
        }
        if (apply(data)) {
          finished = true;
          stopPolling();
        }
      } catch {
        // 网络断了一下没关系，下一轮再取
      }
    };
    const startPolling = () => {
      if (finished || timer) return;
      timer = setInterval(() => void pollOnce(), POLL_MS);
    };

    // 流式：服务器有新进度就按行推过来；没结束就断了，退回轮询（进度位置保留，不会重复也不会丢）
    const stream = async () => {
      try {
        const res = await fetch(`/api/assistant?job=${encodeURIComponent(jobId)}&since=${sinceRef.current}&stream=1`, { cache: "no-store", signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error("流式接口不可用");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl = buf.indexOf("\n");
          while (nl >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line && apply(JSON.parse(line) as JobChunk)) {
              finished = true;
              return;
            }
            nl = buf.indexOf("\n");
          }
        }
        if (!finished) throw new Error("流式提前结束");
      } catch {
        if (ctrl.signal.aborted || finished) return;
        startPolling();
      }
    };
    void stream();
    return () => {
      ctrl.abort();
      stopPolling();
    };
  }, [running, router]);

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
        messages: { role: "user" | "assistant"; text: string; meta: StoredMeta }[];
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
    setTasks((ts) => [
      ...ts,
      { id, request: text, status: "running", steps: [], answer: "", error: "", web: null, receipts: [], jobId: null, feedback: null },
    ]);
    setInput("");
    setNotice("");
    setFlash("");
    setView("chat");
    const fail = (error: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: "error", error } : t)));
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 记忆预填的开关和各板块页面用的是同一个（默认开着）；请求编号防止网络重试时重复跑
        body: JSON.stringify({ message: text, history, profileId: getActiveProfileId(), memoryOn: memoryEnabled(), threadId, requestId: newRequestId() }),
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
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, jobId: data.jobId } : t)));
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
    setFlash("");
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

  // 用户点了确认才真的做；做失败就留着卡片，方便再点一次
  // 用户确定开跑：服务端接手执行（板块跑、验收、返工），界面按任务显示进度
  const startBoardRun = async (p: Proposal) => {
    if (busy) return setNotice(BUSY_NOTICE);
    const runId = String(p.args.runId ?? "");
    const res = await fetch("/api/assistant/board-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { jobId?: string; error?: string };
    if (!res?.ok || !data.jobId) return setNotice(data.error || "开跑没有成功，请稍后再试");
    const id = nextIdRef.current++;
    setProposals((ps) => ps.filter((x) => x.id !== p.id));
    setTasks((ts) => [
      ...ts,
      {
        id,
        request: `（管理员派活）${String(p.args.label ?? "板块")}：${String(p.args.summary ?? "")}`,
        status: "running",
        steps: [],
        answer: "",
        error: "",
        web: null,
        receipts: [],
        jobId: data.jobId ?? null,
        feedback: null,
      },
    ]);
    sinceRef.current = 0;
    setRunning({ taskId: id, jobId: data.jobId });
  };

  const confirmProposal = async (p: Proposal) => {
    if (p.kind === "board.run") return startBoardRun(p);
    const ok = await runProposal(p).catch(() => false);
    if (!ok) return setNotice("这次没有改成功，请稍后再试");
    setProposals((ps) => ps.filter((x) => x.id !== p.id));
    if (p.kind === "memory.forget") setMemories((ms) => (ms ?? []).filter((m) => m.id !== String(p.args.id)));
    // 档案、作品改了，进度页要立刻看到变化（和其他写入的地方一样）
    if (p.kind === "profile.update" || p.kind === "profile.create" || p.kind === "work.status") notifyProgressChanged();
    setFlash(PROPOSAL_DONE[p.kind]);
  };

  const keepProposal = (id: string) => setProposals((ps) => ps.filter((x) => x.id !== id));

  // 撤销一条回执：成功后标成「已撤销」，不再显示撤销按钮
  const undoReceipt = async (taskId: number, index: number) => {
    const task = tasks.find((t) => t.id === taskId);
    const receipt = task?.receipts[index];
    if (!receipt?.undo) return;
    const ok = await runUndo(receipt.undo);
    if (!ok) return setNotice("撤销没有成功，请稍后再试");
    setTasks((ts) =>
      ts.map((t) => (t.id === taskId ? { ...t, receipts: t.receipts.map((r, i) => (i === index ? { ...r, undone: true } : r)) } : t)),
    );
    setFlash("已撤销");
  };

  // 回答有用 / 没用（I3）：存的是这条任务的编号，不存对话内容
  const sendFeedback = async (task: Task, helpful: boolean) => {
    if (!task.jobId) return;
    const res = await fetch("/api/assistant/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: task.jobId, helpful }),
    }).catch(() => null);
    if (!res?.ok) return setNotice("反馈暂时没有存下来，请稍后再试");
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, feedback: helpful ? "helpful" : "not" } : t)));
  };

  const shownStarters = startersFor(pathname);
  // 拖出来的面板：高度取一个合适的值（不超过屏幕，也不超过 640）。服务端渲染时没有窗口，给个默认值
  const panelH = typeof window !== "undefined" ? Math.min(640, window.innerHeight - 40) : 600;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            // 刚拖完松手不算点击
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            setOpen(true);
          }}
          onPointerDown={beginDrag("launcher")}
          aria-label="打开开物助理（按住可以拖动）"
          title="打开开物助理，按住可以拖到任意位置"
          style={launcherPos ? { left: launcherPos.x, top: launcherPos.y, right: "auto", bottom: "auto" } : undefined}
          className={`brand-gradient fixed z-40 flex touch-none select-none items-center gap-2 rounded-full py-2.5 pl-3 pr-4 text-[14px] font-semibold text-white shadow-lg sm:gap-2.5 sm:py-3 sm:pl-3.5 sm:pr-5 sm:text-[15px] ${launcherPos ? "cursor-grab" : "bottom-24 right-4 sm:bottom-auto sm:right-[85px] sm:top-[68%]"}`}
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
          style={!narrow && panelPos ? { left: panelPos.x, top: panelPos.y, right: "auto", bottom: "auto", height: panelH } : undefined}
          className={`glass-panel fixed z-40 flex flex-col overflow-hidden border border-border/70 shadow-2xl ${
            narrow
              ? "inset-x-0 bottom-0 h-[88dvh] w-full rounded-t-3xl"
              : `w-[min(92vw,400px)] rounded-3xl ${panelPos ? "" : "bottom-4 right-4 top-20 sm:bottom-6 sm:right-6"}`
          }`}
        >
          <header
            onPointerDown={beginDrag("panel")}
            className={`flex items-center gap-2 border-b border-border/60 px-3 py-3 sm:gap-3 sm:px-4 ${narrow ? "" : "cursor-move touch-none select-none"}`}
          >
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
                    {shownStarters.map((s) => (
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
                  <details className="mt-5 w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3 py-2.5 text-left text-[12px] text-muted-foreground">
                    <summary className="cursor-pointer select-none text-foreground">我能做什么、不能做什么</summary>
                    <p className="mt-2 font-medium text-foreground">能做</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 leading-relaxed">
                      {CAN_DO.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <p className="mt-2 font-medium text-foreground">不做</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 leading-relaxed">
                      {CANNOT_DO.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}

              {tasks.map((t) => (
                <TaskThread
                  key={t.id}
                  task={t}
                  copied={copiedId === t.id}
                  onCopy={() => void copy(t)}
                  onExport={() => downloadAsDocument(t)}
                  onUndo={(index) => void undoReceipt(t.id, index)}
                  onFeedback={(helpful) => void sendFeedback(t, helpful)}
                />
              ))}

              {notice && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{notice}</p>}
              <div ref={endRef} />
            </div>
          )}

          {notice && view !== "chat" && <p className="mx-3 mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{notice}</p>}

          {view === "chat" && flash && (
            <p className="mx-3 mb-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-400">{flash}</p>
          )}

          {view === "chat" && summaryLag && (
            <p className="mx-3 mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-foreground">
              这段对话已经很长，较早的内容没能压缩成摘要，助理可能记不全前面的细节。可以新开一段对话，或稍后再问。
            </p>
          )}

          {view === "chat" && proposals.length > 0 && (
            <div className="mx-3 mb-2 space-y-2">
              {proposals.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12.5px]">
                  <p className="font-medium leading-relaxed text-foreground">{p.title}</p>
                  <p className="mt-0.5 leading-relaxed text-muted-foreground">{p.detail}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => keepProposal(p.id)} className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground transition hover:text-foreground">
                      先不改
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmProposal(p)}
                      className={`rounded-lg border px-2.5 py-1 font-medium transition ${p.kind === "todo.delete" || p.kind === "memory.forget" ? "border-destructive/50 text-destructive hover:bg-destructive/10" : "border-primary/50 text-primary hover:bg-primary/10"}`}
                    >
                      {p.confirmLabel}
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

/** 操作回执：做成了什么、没做成什么，能撤销的带撤销按钮（升级方案 A1） */
function ReceiptList({ receipts, onUndo }: { receipts: ReceiptView[]; onUndo: (index: number) => void }) {
  if (!receipts.length) return null;
  return (
    <ul className="space-y-1.5">
      {receipts.map((r, i) => (
        <li
          key={i}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed ${
            r.ok ? "border-emerald-500/30 bg-emerald-500/[0.07] text-foreground" : "border-destructive/30 bg-destructive/[0.07] text-destructive"
          }`}
        >
          {r.ok ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span className={`min-w-0 flex-1 ${r.undone ? "text-muted-foreground line-through" : ""}`}>{r.text}</span>
          {r.undone && <span className="shrink-0 text-[11px] text-muted-foreground">已撤销</span>}
          {r.ok && r.undo && !r.undone && (
            <button
              type="button"
              onClick={() => onUndo(i)}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <Undo2 className="h-3 w-3" aria-hidden="true" />
              撤销
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  running: "处理中",
  done: "已完成",
  error: "没有完成",
  stopped: "已停止",
};

/** 一句话的完整过程：你的话 → 助理的过程、来源、回执、回答 */
function TaskThread({
  task,
  copied,
  onCopy,
  onExport,
  onUndo,
  onFeedback,
}: {
  task: Task;
  copied: boolean;
  onCopy: () => void;
  onExport: () => void;
  onUndo: (index: number) => void;
  onFeedback: (helpful: boolean) => void;
}) {
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

        <ReceiptList receipts={task.receipts} onUndo={onUndo} />

        {task.answer && (
          <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-border/60 bg-card px-3.5 py-3 text-[13.5px] leading-7 text-foreground shadow-sm">
            {task.answer}
          </div>
        )}
        {task.error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{task.error}</p>}

        {task.answer && (
          <div className="flex items-center justify-between gap-2 pl-1">
            <p className="text-[11px] text-muted-foreground">用了 1 次助理对话；板块按各自额度扣费</p>
            <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onExport}
              aria-label="存为文档"
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              存为文档
            </button>
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
          </div>
        )}

        {task.answer && task.jobId && (
          <div className="flex items-center gap-2 pl-1 text-[11.5px] text-muted-foreground">
            {task.feedback ? (
              <span>谢谢你的反馈</span>
            ) : (
              <>
                <span>这条回答对你有用吗？</span>
                <button
                  type="button"
                  onClick={() => onFeedback(true)}
                  aria-label="有用"
                  className="rounded-lg p-1 transition hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback(false)}
                  aria-label="没用"
                  className="rounded-lg p-1 transition hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
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
