"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Globe, Paperclip, Sparkles, Telescope, X } from "lucide-react";
import { askAssistant } from "@/lib/assistant/ask";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { CHAT_FILE_ACCEPT, MAX_CHAT_FILES, MAX_CHAT_FILE_BYTES, chatFileType } from "@/lib/chat-attachments";
import { putHomeChat, type WebMode } from "@/lib/home-chat-handoff";

/**
 * 工作台首页顶部的大对话框（2026-11-02 产品方定稿）：
 * - 默认「自由对话」：问什么都行，能带附件、选联网、开深度研究；发出去跳到自由对话页接着聊，历史都在那里。
 * - 「让助理去做」：说要做什么，交给右下角的开物助理派板块去干（和原来首页那条一句话条是同一个助理）。
 *   没有配置助理时不出现这个切换，只有自由对话。
 */

type Mode = "chat" | "agent";

const CHIPS: Record<Mode, { text: string; pick?: boolean }[]> = {
  chat: [
    { text: "今天抖音有什么热点" },
    // 要看图：先把这句填好、打开选图，选好了再发
    { text: "帮我看看这张截图", pick: true },
    { text: "这个行业怎么起号" },
  ],
  agent: [{ text: "帮我选题" }, { text: "审一稿" }, { text: "记个待办：周五拍探店" }],
};

const PLACEHOLDER: Record<Mode, string> = {
  chat: "问什么都行：查资料、读图片和文档、出方案……",
  agent: "说要做什么，助理派板块去干，比如「帮我出 10 条节前选题」",
};

/** 和自由对话页上传的规则一样：先在这里挡掉，免得到了那边才发现传不了 */
export function checkHomeFiles(files: { name: string; size: number }[]): string | null {
  if (files.length > MAX_CHAT_FILES) return `每条消息最多 ${MAX_CHAT_FILES} 个文件`;
  if (files.some((f) => !chatFileType(f.name) || !f.size || f.size > MAX_CHAT_FILE_BYTES)) {
    return "请选择支持的图片或文档，每个文件不能超过 10 MB；旧版 Office 文件请另存为新格式。";
  }
  return null;
}

/** 首页「今天」的一件事（/api/assistant/today，和助理每轮看的是同一份老板现状） */
interface TodayItem { key: string; label: string; ask: string; href: string }

/**
 * 「今天」（2026-11-02 产品方：助理要主动、站在老板角度）：对话框上方一行，列出现在卡在哪、最值得做的几件事。
 * 点一下交给助理去办（助理会先列出来等确认）；没配置助理就打开对应的页面。一件都没有就不显示。
 */
function TodayStrip({ agentOn }: { agentOn: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<TodayItem[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      const id = getActiveProfileId();
      fetch(`/api/assistant/today${id ? `?profileId=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive) setItems(Array.isArray(d?.items) ? d.items : []); })
        .catch(() => {});
    };
    load();
    const off = onActiveProfileChange(load);
    return () => { alive = false; off(); };
  }, []);
  if (!items.length) return null;
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2" aria-label="今天">
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />今天</span>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => (agentOn ? askAssistant(it.ask) : router.push(it.href))}
          title={agentOn ? `交给助理：${it.ask}` : "打开对应的页面"}
          className="rounded-full border border-primary/30 bg-primary/[0.06] px-3 py-1 text-[12px] text-foreground hover:border-primary/60"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function HomeChatBox() {
  const router = useRouter();
  const [agentOn, setAgentOn] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [webMode, setWebMode] = useState<WebMode>("auto");
  const [research, setResearch] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/assistant?status=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.enabled) setAgentOn(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 打字多了自己长高（最高 200px）
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files, ...Array.from(list)];
    const problem = checkHomeFiles(next);
    setError(problem ?? "");
    if (!problem) setFiles(next);
  };

  const send = (message = text) => {
    const t = message.trim();
    if (mode === "agent") {
      if (!t) return;
      askAssistant(t);
      setText("");
      return;
    }
    if (research && !t) return setError("先写下要研究的问题");
    if (!t && !files.length) return setError("先写下你想问的，或者选个文件");
    putHomeChat({ text: t, webMode, research, files });
    router.push("/dashboard/free-chat");
  };

  const chip = (c: { text: string; pick?: boolean }) => {
    if (c.pick) {
      setText(c.text);
      picker.current?.click();
      return;
    }
    send(c.text);
  };

  const modes: { key: Mode; label: string }[] = agentOn ? [{ key: "chat", label: "自由对话" }, { key: "agent", label: "让助理去做" }] : [];

  return (
    <div className="mb-6">
      <TodayStrip agentOn={agentOn} />
      <div className="glass-panel rounded-2xl border border-border px-3 pb-2.5 pt-3 focus-within:border-primary/60 sm:px-4">
        {modes.length > 0 && (
          <div className="mb-2 flex gap-1.5" role="tablist" aria-label="对话方式">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                onClick={() => { setMode(m.key); setError(""); }}
                className={`rounded-lg border px-2.5 py-1 text-[12px] ${mode === m.key ? "border-primary/50 bg-primary/12 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={input}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(""); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={mode === "chat" && research ? "写下要研究的问题，到自由对话页选好深度再开始" : PLACEHOLDER[mode]}
          aria-label={mode === "chat" ? "问自由对话" : "告诉助理你想做什么"}
          className="block max-h-[200px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
        {mode === "chat" && files.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label={`移除 ${f.name}`} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5">
          {mode === "chat" && (
            <>
              <input ref={picker} type="file" multiple accept={CHAT_FILE_ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => picker.current?.click()} title="附图片或文档一起问" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
                <Paperclip className="h-3.5 w-3.5" />附件
              </button>
              <label className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] text-muted-foreground hover:bg-muted">
                <Globe className="h-3.5 w-3.5" />
                <select aria-label="联网模式" value={webMode} onChange={(e) => setWebMode(e.target.value as WebMode)} className="bg-transparent text-[12px] outline-none">
                  <option value="auto">按需联网</option>
                  <option value="on">本轮联网（扣 1 次）</option>
                  <option value="off">关闭联网</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setResearch((v) => !v)}
                aria-pressed={research}
                title="深度研究：上网查一圈、读几十个网页，整理成带出处的报告（专业会员、高频会员）"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] hover:bg-muted ${research ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Telescope className="h-3.5 w-3.5" />深度研究
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => send()}
            aria-label={mode === "chat" ? "发送到自由对话" : "发给助理"}
            className="brand-gradient ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-destructive">{error}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {CHIPS[mode].map((c) => (
          <button key={c.text} type="button" onClick={() => chip(c)} className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground hover:text-foreground">
            {c.text}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-muted-foreground">
        {mode === "chat" ? "发出去后跳到自由对话页接着聊，历史都在那里" : "助理在右下角的面板里干活，派板块前会先列给你确认"}
      </p>
    </div>
  );
}
