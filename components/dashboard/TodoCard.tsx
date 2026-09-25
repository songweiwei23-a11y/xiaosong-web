"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Plus, X, ChevronDown } from "lucide-react";
import { describeDue, sortTodos, TODO_MAX_LEN, type Todo } from "@/lib/todos";

/**
 * 首页待办：自己记的事，可以带一个截止时间。
 *
 * 调子是"温和"：首页每天都要打开，满屏红色倒计时只会让人不想看。
 * 过期用柔和的琥珀色点一下，快到了用主题色，其余一律灰；
 * 做完的收起来，只留一个"已完成 N"可以展开回看。
 * 所有操作先改界面再发请求，失败了再退回去——点一下要等一秒的勾选框很烦人。
 */

const TONE_CLS = {
  overdue: "text-amber-700/80 dark:text-amber-300/70",
  soon: "text-primary/80",
  normal: "text-muted-foreground",
} as const;

/** datetime-local 要的是本地时间的 "YYYY-MM-DDTHH:mm" */
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TodoCard() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [showDue, setShowDue] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /** 截止时间的说法（"今天 18:00""已过 2 天"）每分钟跟着时间走一次 */
  const [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/todos")
      .then(async (r) => {
        if (r.status === 503) {
          setUnavailable(true);
          return;
        }
        if (r.ok) {
          const list = await r.json();
          if (Array.isArray(list)) setTodos(list);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const flash = (msg: string) => {
    setError(msg);
    window.setTimeout(() => setError(""), 3000);
  };

  const add = async () => {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, dueAt: due ? new Date(due).toISOString() : null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 503) setUnavailable(true);
        flash(d.error || "没存上，再试一次");
        return;
      }
      setTodos((list) => [d, ...list]);
      setText("");
      setDue("");
      setShowDue(false);
      inputRef.current?.focus();
    } catch {
      flash("网络不太好，没存上");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (todo: Todo) => {
    const next = !todo.done;
    const doneAt = next ? new Date().toISOString() : null;
    setTodos((list) => list.map((t) => (t.id === todo.id ? { ...t, done: next, done_at: doneAt } : t)));
    const r = await fetch(`/api/todos?id=${encodeURIComponent(todo.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    }).catch(() => null);
    if (!r?.ok) {
      setTodos((list) => list.map((t) => (t.id === todo.id ? todo : t)));
      flash("没改成功，再点一次");
    }
  };

  const remove = async (todo: Todo) => {
    setTodos((list) => list.filter((t) => t.id !== todo.id));
    const r = await fetch(`/api/todos?id=${encodeURIComponent(todo.id)}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      setTodos((list) => sortTodos([...list, todo]));
      flash("没删掉，再试一次");
    }
  };

  const sorted = sortTodos(todos);
  const open = sorted.filter((t) => !t.done);
  const done = sorted.filter((t) => t.done);

  return (
    <section className="glass-panel rounded-2xl p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted-foreground">待办</span>
        {open.length > 0 && (
          <span className="text-[12px] tabular-nums text-muted-foreground">{open.length} 件没做完</span>
        )}
      </div>

      {unavailable ? (
        <p className="mt-3 rounded-xl bg-foreground/[0.04] px-3 py-3 text-[12px] leading-relaxed text-muted-foreground">
          待办功能还在开通中，稍后刷新就能用
        </p>
      ) : (
        <>
          {/* 输入：回车就加；时间可选，点小钟才展开，不给没这个需要的人添负担 */}
          <div className="mt-3 rounded-xl border border-border/60 bg-background/40 transition-colors focus-within:border-primary/40">
            <div className="flex items-center gap-1 pl-3 pr-1.5">
              <input
                ref={inputRef}
                value={text}
                maxLength={TODO_MAX_LEN}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
                }}
                placeholder="记一件要做的事…"
                aria-label="新待办"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setShowDue((v) => !v);
                  if (!due) {
                    // 默认给今天傍晚六点；已经过了就明天同一时间
                    const d = new Date();
                    d.setHours(18, 0, 0, 0);
                    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
                    setDue(toLocalInput(d));
                  }
                }}
                aria-pressed={showDue}
                title="设个时间"
                className={`rounded-lg p-1.5 transition-colors ${
                  showDue || due ? "text-primary" : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                <Clock className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={add}
                disabled={!text.trim() || saving}
                title="添加"
                className="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:text-primary disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {showDue && (
              <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
                <span className="text-[12px] text-muted-foreground">什么时候前</span>
                <input
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground focus:outline-none"
                />
                {due && (
                  <button
                    type="button"
                    onClick={() => {
                      setDue("");
                      setShowDue(false);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    不设了
                  </button>
                )}
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-[12px] text-amber-600/90 dark:text-amber-400/90">{error}</p>}

          {/* 列表 */}
          {loading ? (
            <div className="mt-3 space-y-2">
              <div className="h-8 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-8 animate-pulse rounded-lg bg-muted/40" />
            </div>
          ) : open.length === 0 && done.length === 0 ? (
            <p className="mt-4 pb-1 text-center text-[12px] leading-relaxed text-muted-foreground/80">
              今天想先做完什么？记在这里
            </p>
          ) : (
            <ul className="mt-3 max-h-[26rem] space-y-0.5 overflow-y-auto pr-0.5">
              {open.map((t) => (
                <TodoRow key={t.id} todo={t} now={now} onToggle={toggle} onRemove={remove} />
              ))}
              {open.length === 0 && (
                <li className="py-2 text-center text-[12px] text-muted-foreground/80">都做完了，歇会儿</li>
              )}
              {done.length > 0 && (
                <li className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDone((v) => !v)}
                    className="flex items-center gap-1 px-1 py-1 text-[11px] text-muted-foreground/80 hover:text-foreground"
                  >
                    <ChevronDown className={`h-3 w-3 transition-transform ${showDone ? "" : "-rotate-90"}`} />
                    已完成 {done.length}
                  </button>
                </li>
              )}
              {showDone &&
                done.map((t) => <TodoRow key={t.id} todo={t} now={now} onToggle={toggle} onRemove={remove} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function TodoRow({
  todo,
  now,
  onToggle,
  onRemove,
}: {
  todo: Todo;
  now: Date;
  onToggle: (t: Todo) => void;
  onRemove: (t: Todo) => void;
}) {
  const dueInfo = todo.done ? null : describeDue(todo.due_at, now);
  return (
    <li className="group flex items-start gap-2.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-foreground/[0.04]">
      <button
        type="button"
        onClick={() => onToggle(todo)}
        aria-label={todo.done ? "标记为没做完" : "标记为做完"}
        aria-pressed={todo.done}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
          todo.done
            ? "border-primary/50 bg-primary/15 text-primary"
            : "border-foreground/25 hover:border-primary/60"
        }`}
      >
        {todo.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`break-words text-[13px] leading-snug ${
            todo.done ? "text-muted-foreground/70 line-through decoration-foreground/20" : "text-foreground/85"
          }`}
        >
          {todo.content}
        </p>
        {dueInfo && (
          <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${TONE_CLS[dueInfo.tone]}`} suppressHydrationWarning>
            <Clock className="h-3 w-3" />
            {dueInfo.text}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(todo)}
        aria-label="删除"
        // 有鼠标的悬停才出现；手机没有悬停，一直淡淡地显示着
        className="mt-0.5 rounded-md p-0.5 text-muted-foreground/50 transition-opacity hover:text-foreground focus:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
