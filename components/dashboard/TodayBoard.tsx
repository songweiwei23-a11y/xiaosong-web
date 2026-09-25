"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Clock as ClockIcon, Plus, X } from "lucide-react";
import { useTodos } from "@/hooks/useTodos";
import { useNow } from "@/hooks/useNow";
import { describeDue, shortDue, TODO_MAX_LEN, type Todo } from "@/lib/todos";
import { Clock } from "./Clock";

/**
 * 首页「今日看板」：左边时钟，右边待办（时间线样式，用户从四版里选的）。
 *
 * 待办的调子是"温和"：首页每天都要打开，满屏红色倒计时只会让人不想看。
 * 过期用淡琥珀色、快到了用淡主题色，其余一律灰；做完的收进"已完成 N"。
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

/** 输入框：回车就加；时间可选，点小钟才展开，不给没这个需要的人添负担 */
function TodoInput({ onAdd }: { onAdd: (text: string, dueAt: string | null) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [showDue, setShowDue] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    const ok = await onAdd(text, due ? new Date(due).toISOString() : null);
    setSaving(false);
    if (ok) {
      setText("");
      setDue("");
      setShowDue(false);
      ref.current?.focus();
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 transition-colors focus-within:border-primary/40">
      <div className="flex items-center gap-1 pl-3 pr-1.5">
        <input
          ref={ref}
          value={text}
          maxLength={TODO_MAX_LEN}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
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
          <ClockIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={submit}
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
  );
}

/** 时间线：左边时间，中间一根细线串起圆点，点圆点就算做完 */
function Timeline({
  items,
  now,
  onToggle,
  onRemove,
}: {
  items: Todo[];
  now: Date;
  onToggle: (t: Todo) => void;
  onRemove: (t: Todo) => void;
}) {
  return (
    <ol className="relative">
      {/* 竖线穿过圆点中心：时间列 64 + 间距 6 + 圆点列的一半 10 */}
      <span className="absolute bottom-3 left-[79.5px] top-3 w-px bg-foreground/10" aria-hidden />
      {items.map((todo) => {
        const due = todo.done ? null : describeDue(todo.due_at, now);
        const label = todo.due_at ? shortDue(todo.due_at, now) : "随时";
        const dot = todo.done
          ? "border-primary/50 bg-primary/20"
          : due?.tone === "overdue"
            ? "border-amber-500/60 bg-background"
            : due?.tone === "soon"
              ? "border-primary/70 bg-background"
              : "border-foreground/30 bg-background";
        return (
          <li
            key={todo.id}
            className="group relative grid grid-cols-[64px_20px_1fr_auto] items-start gap-x-1.5 rounded-xl py-2 pr-1 transition-colors hover:bg-foreground/[0.03]"
          >
            <span
              className={`whitespace-nowrap pt-px text-right text-[11px] tabular-nums ${
                due ? TONE_CLS[due.tone] : "text-muted-foreground/70"
              }`}
              title={due?.text}
            >
              {label}
            </span>
            <button
              type="button"
              onClick={() => onToggle(todo)}
              aria-label={todo.done ? "标记为没做完" : "标记为做完"}
              aria-pressed={todo.done}
              className={`relative z-10 mx-auto mt-[3px] flex h-3 w-3 items-center justify-center rounded-full border-2 transition-colors hover:border-primary ${dot}`}
            >
              {todo.done && <Check className="h-2 w-2 text-primary" strokeWidth={3.5} />}
            </button>
            <p
              className={`break-words text-[13px] leading-snug ${
                todo.done ? "text-muted-foreground/70 line-through decoration-foreground/20" : "text-foreground/85"
              }`}
            >
              {todo.content}
            </p>
            <button
              type="button"
              onClick={() => onRemove(todo)}
              aria-label="删除"
              // 有鼠标的悬停才出现；手机没有悬停，一直淡淡地显示着
              className="rounded-md p-0.5 text-muted-foreground/50 transition-opacity hover:text-foreground focus:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Todos() {
  const t = useTodos();
  const now = useNow() ?? new Date();
  const [showDone, setShowDone] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted-foreground">待办</span>
        {t.open.length > 0 && (
          <span className="text-[12px] tabular-nums text-muted-foreground">{t.open.length} 件没做完</span>
        )}
      </div>

      {t.unavailable ? (
        <p className="mt-3 rounded-xl bg-foreground/[0.04] px-3 py-3 text-[12px] leading-relaxed text-muted-foreground">
          待办功能还在开通中，稍后刷新就能用
        </p>
      ) : (
        <>
          <div className="mt-3">
            <TodoInput onAdd={t.add} />
          </div>
          {t.error && <p className="mt-2 text-[12px] text-amber-700/80 dark:text-amber-300/70">{t.error}</p>}

          <div className="mt-3 max-h-[22rem] overflow-y-auto pr-0.5">
            {t.loading ? (
              <div className="space-y-2">
                <div className="h-7 animate-pulse rounded-lg bg-muted/60" />
                <div className="h-7 animate-pulse rounded-lg bg-muted/40" />
              </div>
            ) : t.open.length === 0 && t.done.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-muted-foreground/80">今天想先做完什么？记在这里</p>
            ) : (
              <>
                <Timeline items={t.open} now={now} onToggle={t.toggle} onRemove={t.remove} />
                {t.open.length === 0 && (
                  <p className="py-2 text-center text-[12px] text-muted-foreground/80">都做完了，歇会儿</p>
                )}
                {t.done.length > 0 && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setShowDone((v) => !v)}
                      className="flex items-center gap-1 px-1 py-1 text-[11px] text-muted-foreground/80 hover:text-foreground"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${showDone ? "" : "-rotate-90"}`} />
                      已完成 {t.done.length}
                    </button>
                    {showDone && <Timeline items={t.done} now={now} onToggle={t.toggle} onRemove={t.remove} />}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 今日看板：宽屏左右排（时钟上下居中，分隔线挂在待办那边，待办再长左边也不空），
 * 窄屏上下排。
 */
export function TodayBoard() {
  return (
    <section className="glass-panel grid gap-6 rounded-2xl p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-0">
      <div className="md:pr-6">
        <Clock />
      </div>
      <div className="border-t border-border/50 pt-5 md:self-stretch md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <Todos />
      </div>
    </section>
  );
}
