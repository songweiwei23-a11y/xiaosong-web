"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Paperclip, Telescope, X } from "lucide-react";
import { DEPTHS, type ResearchDepth } from "@/lib/research";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { createHistoryId } from "@/lib/history-id";
import { postSafely } from "@/lib/safe-post";

/**
 * 深度研究 · 开始（2026-10-04 产品方：和「出方案」一样，点开还在对话页，就是输入框上面一张小卡片，别太正式）。
 * 写主题、挑深度，点「拟研究计划」；计划、进度、报告都出现在对话里（components/chat/ResearchCard）。
 */
export function ResearchStarter({ profileId, profileContext, files, uploading, canUpload, onPickFiles, onCreated, onOpen, onClose }: {
  profileId: string | null;
  profileContext: string;
  /** 输入框那套上传：传好的资料一起带进研究 */
  files: ChatAttachment[];
  uploading: boolean;
  canUpload: boolean;
  onPickFiles: () => void;
  onCreated: (r: { jobId: string; topic: string; depth: ResearchDepth }) => void;
  /** 把以前的一份研究放回对话里看 */
  onOpen: (r: { jobId: string; topic: string; depth: ResearchDepth }) => void;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState<ResearchDepth>("standard");
  const [material, setMaterial] = useState("");
  const [showMaterial, setShowMaterial] = useState(false);
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [ready, setReady] = useState(true);
  const [locked, setLocked] = useState("");
  const [recent, setRecent] = useState<{ id: string; topic: string; depth: ResearchDepth; status: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ payload: string; id: string } | null>(null);

  useEffect(() => {
    let off = false;
    void (async () => {
      try {
        const r = await fetch("/api/research", { cache: "no-store" });
        const d = await r.json();
        if (off) return;
        if (!r.ok) return setError(d.error || "深度研究暂时打不开，请稍后再试");
        setQuota(d.quota); setReady(!!d.searchReady); setLocked(d.quota?.limit === 0 ? d.message || "" : "");
        const h = await fetch(`/api/research?list=1&profileId=${encodeURIComponent(profileId || "default")}`, { cache: "no-store" });
        if (h.ok && !off) setRecent(((await h.json()).items || []).slice(0, 4));
      } catch { if (!off) setError("深度研究暂时打不开，请稍后再试"); }
    })();
    return () => { off = true; };
  }, [profileId]);

  const start = async () => {
    if (busy) return;
    if (topic.trim().length < 4) return setError("研究什么？写具体一点，比如：2026 年本地餐饮团购还值不值得做");
    if (uploading) return setError("资料还在上传，传完再开始");
    setBusy(true); setError("");
    const payload = { topic: topic.trim(), depth, material, profileId, profileContext, files };
    const encoded = JSON.stringify(payload);
    if (!request.current || request.current.payload !== encoded) request.current = { payload: encoded, id: createHistoryId() };
    try {
      const r = await postSafely("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: request.current.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "没开始成，请重试");
      request.current = null;
      onCreated({ jobId: d.id, topic: payload.topic, depth });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const chip = (on: boolean) => `rounded-lg border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/40"}`;
  const field = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
  const statusText: Record<string, string> = { done: "", plan_ready: " · 待确认", running: " · 进行中", writing: " · 进行中", planning: " · 进行中", failed: " · 没做完", canceled: " · 已停止" };
  const disabled = busy || !!locked || !ready || quota?.remaining === 0;

  return (
    <div className="mb-2 max-h-[60dvh] overflow-y-auto rounded-xl border border-primary/40 bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><Telescope className="h-4 w-4 text-primary" />深度研究</p>
          <p className="mt-0.5 text-xs text-muted-foreground">帮你上网查一圈、读几十个网页，整理成一份带出处的报告。先给你看研究计划，确认了才开始查。</p>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {locked ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{locked} <Link href="/pricing" className="text-primary hover:underline">看看会员</Link></p>
      ) : (
        <>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} maxLength={500} autoFocus aria-label="研究主题"
            placeholder="想研究什么？比如：2026 年本地餐饮团购还值不值得做，同行都怎么玩" className={`${field} resize-y`} />

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs text-muted-foreground">查多深：</span>
            {(Object.keys(DEPTHS) as ResearchDepth[]).map((d) => (
              <button key={d} type="button" aria-pressed={depth === d} onClick={() => setDepth(d)} className={chip(depth === d)} title={DEPTHS[d].desc}>
                {DEPTHS[d].label}<span className="ml-1 text-[11px] opacity-70">{DEPTHS[d].time.replace(/^约\s*/, "")}</span>
              </button>
            ))}
          </div>

          <div className="mt-2">
            {!showMaterial ? (
              <button type="button" onClick={() => setShowMaterial(true)} className="text-xs text-primary hover:underline">
                ＋ 加点背景资料（可不加）{files.length ? ` · 已附 ${files.length} 份` : ""}
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={onPickFiles} disabled={!canUpload || uploading}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:border-primary/40 disabled:opacity-50">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                    {uploading ? "正在上传…" : "上传文档 / 图片"}
                  </button>
                  <span className="text-[11px] text-muted-foreground">{files.length ? `已附 ${files.length} 份（在输入框上方，可删）` : "当前档案会自动带上"}</span>
                </div>
                <textarea value={material} onChange={(e) => setMaterial(e.target.value)} rows={2} maxLength={8000}
                  placeholder="也可以把你的情况、想解决的问题直接贴在这里" className={`${field} resize-y`} />
              </div>
            )}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">最近的研究：</span>
          {recent.map((r) => (
            <button key={r.id} type="button" onClick={() => onOpen({ jobId: r.id, topic: r.topic, depth: r.depth })}
              className="max-w-[14rem] truncate rounded-lg bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground" title={r.topic}>
              {r.topic}{statusText[r.status] ?? ""}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      {!locked && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
          <span className="mr-auto text-[11px] text-muted-foreground">
            {!ready ? "联网搜索还没配置好，暂时用不了" : quota ? `本期还剩 ${quota.remaining}/${quota.limit} 份 · 不占对话和联网次数` : "正在查剩余次数…"}
          </span>
          <button type="button" onClick={() => void start()} disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg brand-gradient px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}拟研究计划
          </button>
        </div>
      )}
    </div>
  );
}
