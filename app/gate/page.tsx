"use client";

import { useState, useSyncExternalStore } from "react";
import { claimMessage, extractTicket } from "@/lib/gate-ticket-format";

/**
 * 首页拦截的提示页（第一道）。没有门票的人，所有页面都显示这里。
 * - 普通用户：打开管理员发的邀请链接，或粘贴门票码。
 * - 管理员：粘贴自己的管理员门票（在后台「首页门票」生成）；门票丢了，可以用应急登录（默认关，后台开关）。
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

  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergencyError, setEmergencyError] = useState("");

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

  const emergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emergencyBusy) return;
    setEmergencyBusy(true);
    setEmergencyError("");
    try {
      const res = await fetch("/api/gate/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmergencyError(data.error || "应急登录失败，请稍后再试");
        return;
      }
      window.location.replace("/");
    } catch {
      setEmergencyError("网络不稳定，请稍后再试");
    } finally {
      setEmergencyBusy(false);
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

        <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
          管理员？请粘贴你在后台「首页门票」生成的管理员门票，或打开它的链接，在任何设备上都能直接进入。
        </p>

        <div className="mt-4 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setEmergencyOpen((v) => !v)}
            aria-expanded={emergencyOpen}
            className="text-[12px] text-muted-foreground underline-offset-4 hover:underline"
          >
            门票丢了？管理员应急登录
          </button>

          {emergencyOpen && (
            <form onSubmit={emergency} className="mt-3 space-y-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="管理员邮箱"
                autoComplete="username"
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete="current-password"
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="验证器上的 6 位码"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 font-mono text-[13px] text-foreground outline-none focus:border-primary"
              />
              {emergencyError && <p role="alert" className="text-[12.5px] text-destructive">{emergencyError}</p>}
              <button
                type="submit"
                disabled={emergencyBusy || !email.trim() || !password || !code.trim()}
                className="h-9 w-full rounded-xl border border-border text-[13px] font-medium text-foreground disabled:opacity-50"
              >
                {emergencyBusy ? "核对中…" : "应急登录"}
              </button>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                只对绑定了验证器的管理员开放。登录成功只为这台设备开通，不会把账号登录到别处。
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
