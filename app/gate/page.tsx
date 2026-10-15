"use client";

import { useState } from "react";

/**
 * 首页拦截的访问码页（第一道）。没有访问码或邀请链接的人，所有页面都显示这里。
 * 输入正确后，服务端发 Cookie，再回到首页。
 */
export default function GatePage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-6">
        <h1 className="text-[18px] font-semibold text-foreground">开物</h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">AI 短视频创作智能体</p>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground/80">
          这是邀请制的产品。请输入访问码，或打开你收到的邀请链接进入。
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="访问码"
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary"
          />
          {error && <p role="alert" className="text-[12.5px] text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="h-10 w-full rounded-xl bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "进入中…" : "进入"}
          </button>
        </form>
      </div>
    </main>
  );
}
