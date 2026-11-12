"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";

/**
 * 出方案 · 模型在提问、没出大纲时（2026-10-04）：直接在这里回答，回答完接着出大纲。
 * 它给的选项变成按钮（点一下就是回答）；也可以自己写；或者让它别问了、按自己的判断先出。
 * 资料文件会自动沿用（lib/chat-attachments 的 conversationAttachments），同样的问题不会再问（lib/plan-builder 的 clarify）。
 */
export const SKIP_CLARIFY = "不用再问了，按你判断最合理的方式先出大纲，疑点在大纲开头标出来";

export function PlanClarify({ options, disabled, onAnswer }: { options: string[]; disabled: boolean; onAnswer: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="mt-2 rounded-xl border border-primary/40 bg-card p-3 text-left">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><MessageCircleQuestion className="h-4 w-4 text-primary" />它需要你确认几件事，回答完接着出大纲</p>
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button key={o} type="button" disabled={disabled} onClick={() => onAnswer(o)}
              className="max-w-full rounded-lg border border-border px-2.5 py-1.5 text-left text-xs text-foreground hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50">{o}</button>
          ))}
        </div>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={600} placeholder="或者直接写你的回答，比如：附件 2 其实是抖音的，文件名写错了"
        className="mt-2 w-full resize-y rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={disabled} onClick={() => onAnswer(SKIP_CLARIFY)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">别问了，按你的判断先出大纲</button>
        <button type="button" disabled={disabled || !text.trim()} onClick={() => onAnswer(text.trim())} className="rounded-lg brand-gradient px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">回答并出大纲</button>
      </div>
    </div>
  );
}
