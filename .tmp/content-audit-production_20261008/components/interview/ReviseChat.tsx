"use client";

import { useState } from "react";
import { Loader2, MessageSquareText, Send } from "lucide-react";
import { MAX_INSTRUCTION_CHARS, type Revision, type RevisionInput } from "@/lib/interview-import";
import { PROFILE_FIELDS } from "@/lib/profile-fields";
import { isNetworkError, NETWORK_ERROR_HINT, throwApiError } from "@/lib/api-error";
import { readSseResult } from "@/lib/sse-result";
import { postSafely } from "@/lib/safe-post";

const LABEL = new Map(PROFILE_FIELDS.map((f) => [f.key, f.label]));

/** 点一下就填进输入框的说法，让人知道能这么用 */
const EXAMPLES = ["粉丝其实有 3 万", "客人主要是女性", "不做直播，把直播相关的去掉", "再看看原文，团队到底几个人"];

interface Turn {
  ask: string;
  reply: string;
  changed: string[];
  failed?: boolean;
}

/**
 * 确认页的"哪里不对，直接跟 AI 说"。
 * 前采记录会记漏、记错，客户也会改口；一项项手改太慢，编导一句话让 AI 改对应的几项。
 * 改动怎么合进确认页由页面的 onApply 做，这里只管对话。
 */
/** 网络断了自动再发几次：修改不扣次数，重发没有代价 */
const RETRIES = 2;

export function ReviseChat({
  current,
  source,
  importId,
  onApply,
}: {
  /** 确认页此刻的结果（含手动改过的） */
  current: Omit<RevisionInput, "instruction">;
  source: string;
  /** 历史记录里的这一条。有它就不发原文，服务端自己取——请求小，不容易被网络掐断 */
  importId: string | null;
  onApply: (r: Revision) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  const send = async () => {
    const ask = input.trim();
    if (!ask || busy) return;
    setBusy(true);
    setRetrying(false);
    try {
      const body = JSON.stringify({ ...current, instruction: ask, ...(importId ? { importId } : { source }) });
      let res: Response | null = null;
      for (let attempt = 0; !res; attempt++) {
        try {
          res = await postSafely("/api/interview/revise", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        } catch (e) {
          if (!isNetworkError(e) || attempt >= RETRIES) throw e;
          setRetrying(true);
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (!res.ok) await throwApiError(res, "修改失败");
      const { revision } = await readSseResult<{ revision: Revision }>(res);
      onApply(revision);
      const changed = [
        ...revision.set.map((f) => LABEL.get(f.key) ?? f.key),
        ...revision.remove.map((k) => `清空「${LABEL.get(k) ?? k}」`),
        ...(revision.highlights ? ["前采要点"] : []),
        ...(revision.profileName ? ["档案名称"] : []),
      ];
      setTurns((t) => [...t, { ask, reply: revision.reply || (changed.length ? "改好了" : "没有需要改的"), changed }]);
      setInput("");
    } catch (e) {
      const reply = isNetworkError(e) ? `${NETWORK_ERROR_HINT}（你的话还在输入框里，直接点发送）` : (e as Error).message || "修改失败，请重试";
      setTurns((t) => [...t, { ask, reply, changed: [], failed: true }]);
    } finally {
      setBusy(false);
      setRetrying(false);
    }
  };

  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
        <MessageSquareText className="h-4 w-4 text-primary" /> 哪里不对？直接跟 AI 说
      </h3>
      <p className="mt-1 text-[12.5px] text-muted-foreground">说一句就行，AI 只改你说到的那几项。不额外用次数。</p>

      {turns.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {turns.map((t, i) => (
            <li key={i} className="text-[13px]">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 px-3 py-1.5 text-foreground">{t.ask}</div>
              <div className={`mt-1.5 w-fit max-w-[90%] rounded-2xl rounded-bl-md px-3 py-1.5 ${t.failed ? "bg-destructive/10 text-destructive" : "bg-foreground/[0.05] text-foreground"}`}>
                {t.reply}
                {t.changed.length > 0 && <div className="mt-1 text-[11.5px] text-muted-foreground">已更新：{t.changed.join("、")}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {turns.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setInput(x)}
              className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              {x}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_INSTRUCTION_CHARS))}
          onKeyDown={(e) => {
            // 回车发送，Shift+回车换行；输入法选字时的回车不算
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          disabled={busy}
          placeholder="比如：粉丝其实有 3 万；人均是 150 不是 120"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-[13.5px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="发送"
          className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {busy && <p className="mt-1.5 text-[12px] text-muted-foreground">{retrying ? "网络不稳，正在重试…" : "正在改，二三十秒…"}</p>}
      <p className="mt-1.5 text-[11.5px] text-muted-foreground/80">可以一直接着说，改到满意为止。</p>
    </section>
  );
}
