"use client";

import { useEffect, useState } from "react";
import { Bot, Send } from "lucide-react";
import { askAssistant } from "@/lib/assistant/ask";

/**
 * 工作台首页顶部的一句话条：直接说要做什么，助理就开始干。它和右下角的助理是同一个，
 * 发出去以后由右下角的面板展示过程和结果。没有配置助理时整条不显示。
 */

const CHIPS = ["帮我选题", "审一稿", "今天有什么热点"];

export function AssistantHomeBar() {
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/assistant?status=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.enabled) setEnabled(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!enabled) return null;

  const send = (message: string) => {
    const t = message.trim();
    if (!t) return;
    askAssistant(t);
    setText("");
  };

  return (
    <div className="mb-6 space-y-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5 focus-within:border-primary/60"
      >
        <Bot className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="告诉助理你想做什么，比如「帮我写一条节前活动脚本」"
          aria-label="告诉助理你想做什么"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="发给助理"
          className="brand-gradient shrink-0 rounded-full p-2 text-white disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => send(chip)}
            className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
