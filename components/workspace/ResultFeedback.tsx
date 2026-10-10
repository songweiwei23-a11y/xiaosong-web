"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { postSafely } from "@/lib/safe-post";
import { FEEDBACK_REASONS, type FeedbackReason } from "@/lib/result-feedback";

type Phase = "ask" | "down" | "sent";

/** 每条结果底下的「有用 / 没用」。调用方给它的 key 绑定结果，换了结果就重新开始 */
export function ResultFeedback({ board }: { board: string }) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [busy, setBusy] = useState(false);

  const send = async (rating: 1 | -1, reason: FeedbackReason | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await postSafely("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board, rating, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "反馈没有保存，请稍后再试");
      }
      setPhase("sent");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "sent") {
    return <p className="text-[12.5px] text-muted-foreground">已记录，谢谢你的反馈。</p>;
  }

  if (phase === "down") {
    return (
      <div className="space-y-2.5">
        <p className="text-[13px] text-foreground">哪里不好？可以不选，直接记下「没用」。</p>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              disabled={busy}
              onClick={() => send(-1, reason)}
              className="glass-panel glass-interactive rounded-lg px-3 py-1.5 text-[12.5px] text-foreground disabled:opacity-50"
            >
              {reason}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => send(-1, null)}
            className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            不说原因
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[13px] text-muted-foreground">这条结果有用吗？</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => send(1, null)}
        aria-label="有用"
        className="glass-panel glass-interactive inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] text-foreground disabled:opacity-50"
      >
        <ThumbsUp className="h-3.5 w-3.5" />有用
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setPhase("down")}
        aria-label="没用"
        className="glass-panel glass-interactive inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] text-foreground disabled:opacity-50"
      >
        <ThumbsDown className="h-3.5 w-3.5" />没用
      </button>
    </div>
  );
}
