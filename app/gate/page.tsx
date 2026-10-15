"use client";

import { useState, useSyncExternalStore } from "react";
import { claimMessage, extractTicket } from "@/lib/gate-ticket-format";

/**
 * 首页拦截的提示页（第一道）。没有门票的人，所有页面都显示这里。
 * 管理员发的邀请链接直接打开就能进；拿到的是门票码，就粘贴在这里。
 * 失败原因从地址的 e 参数读出（领门票的接口跳过来时带着）。
 */
export default function GatePage() {
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const reason = new URLSearchParams(search).get("e");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticket = extractTicket(text);
    if (!ticket) {
      setError("请粘贴管理员发给你的门票，或整条邀请链接");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "进入失败，请稍后再试");
        return;
      }
      window.location.replace("/");
    } catch {
      setError("网络不稳定，请稍后再试");
    } finally {
      setBusy(false);
    }
  };

  const shown = error || (reason ? claimMessage(reason) : "");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-6">
        <h1 className="text-[18px] font-semibold text-foreground">开物</h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">AI 短视频创作智能体</p>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground/80">
          这是邀请制的产品。请打开管理员发给你的邀请链接；如果你拿到的是一串门票码，粘贴在下面。
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="粘贴门票码或邀请链接"
            rows={3}
            autoComplete="off"
            spellCheck={false}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 font-mono text-[12.5px] text-foreground outline-none focus:border-primary"
          />
          {shown && <p role="alert" className="text-[12.5px] text-destructive">{shown}</p>}
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="h-10 w-full rounded-xl bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "进入中…" : "进入"}
          </button>
        </form>
      </div>
    </main>
  );
}
