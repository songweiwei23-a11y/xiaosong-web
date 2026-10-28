"use client";

import { useEffect, useState } from "react";
import { Coins, Copy, X } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { SUPPORT_WECHAT } from "@/lib/config/contact";
import { useAgentStatus } from "@/components/agent/useAgentStatus";

/*
 * 首页底部的「成为代理人」小横幅（2026-10-28）：只对还不是代理的用户显示，代理看到的是头像菜单里的「代理后台」。
 * 点开弹窗说明怎么分成、怎么开通，联系方式用全站统一的客服微信。关掉后这台设备不再显示（只是个提示，不需要跨设备记住）。
 * 具体分成比例不在页面上公开，加微信沟通。
 */
const DISMISS_KEY = "xiaosong-agent-banner-dismissed";

export function AgentRecruitBanner() {
  const agent = useAgentStatus();
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 还在查、已经是代理、或者关掉过：都不显示
  if (!agent || agent.isAgent || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* 存不了就只在这次隐藏 */ }
  };

  const copyWechat = async () => {
    try { await navigator.clipboard.writeText(SUPPORT_WECHAT); notify("已复制微信号", "success"); }
    catch { notify(`复制失败，请手动添加：${SUPPORT_WECHAT}`, "error"); }
  };

  return (
    <>
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
        <Coins className="h-4 w-4 shrink-0 text-amber-500" />
        <button type="button" onClick={() => setOpen(true)} className="flex-1 text-left text-[13px] text-foreground hover:text-primary">
          推荐朋友用开物，拿分成 <span className="text-muted-foreground">· 了解一下 →</span>
        </button>
        <button type="button" onClick={dismiss} aria-label="不再显示" title="不再显示" className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="成为开物代理人" className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">成为开物代理人</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭" className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <ul className="space-y-2 text-[13px] leading-relaxed text-foreground">
              <li>· 开通后你有自己的邀请码，发给朋友注册开物</li>
              <li>· 他们之后开通会员，你按统一比例拿分成</li>
              <li>· 每月结算一次，客户、账单、分成都能在「代理后台」里看到</li>
            </ul>
            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <div className="text-[12px] text-muted-foreground">开通方式：加微信联系我们（分成比例沟通后确定）</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-[15px] font-medium text-foreground">{SUPPORT_WECHAT}</span>
                <button type="button" onClick={() => void copyWechat()} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:opacity-90">
                  <Copy className="h-3.5 w-3.5" /> 复制微信号
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
