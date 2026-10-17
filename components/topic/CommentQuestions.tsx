"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { extractCommentQuestions, questionsAsRequirement, type CommentQuestion } from "@/lib/comment-questions";

/**
 * 评论区 → 选题（体检 F1）：贴进评论，挑出观众反复问的问题，勾选后放进选题的「个人要求」。
 * 只在本地算，不调模型，不扣次数。
 */
export function CommentQuestions({ onPick }: { onPick: (text: string) => void }) {
  const [raw, setRaw] = useState("");
  const [items, setItems] = useState<CommentQuestion[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const find = () => {
    const found = extractCommentQuestions(raw);
    setItems(found);
    setPicked(new Set(found.filter((f) => f.count >= 2).map((f) => f.question)));
  };

  const toggle = (q: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border/60 p-3.5">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
        <MessageCircleQuestion className="h-4 w-4 text-primary" />评论区问题（选填）
      </p>
      <p className="mb-2 text-[12px] text-muted-foreground">把视频下面的评论复制粘贴进来，一行一条。开物会挑出观众反复在问的问题，放进选题的要求里。</p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={4}
        placeholder={"多少钱啊？\n这个能用在小房子里吗\n怎么预约？"}
        aria-label="评论区原文"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
      />
      <button
        type="button"
        onClick={find}
        disabled={!raw.trim()}
        className="mt-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-foreground disabled:opacity-50"
      >
        找出高频问题
      </button>

      {items && (
        <div className="mt-3">
          {items.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">没有找到问句。评论里要有「？」或「怎么、多少、能不能」这类说法才认得出。</p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {items.map((it) => (
                  <li key={it.question}>
                    <label className="flex cursor-pointer items-start gap-2 text-[13px] text-foreground">
                      <input type="checkbox" className="mt-1" checked={picked.has(it.question)} onChange={() => toggle(it.question)} />
                      <span className="min-w-0 flex-1">{it.question}</span>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">{it.count} 次</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={picked.size === 0}
                onClick={() => onPick(questionsAsRequirement(items.filter((i) => picked.has(i.question)).map((i) => i.question)))}
                className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] text-primary-foreground disabled:opacity-50"
              >
                放进选题要求（{picked.size} 条）
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
