"use client";

import { useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { routeOptions, SCHOOL_LABEL, type RouteOption, type RouteSchool } from "@/lib/script-route";

type Filter = "all" | RouteSchool;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "four", label: "四大脚本" },
  { id: "tactic", label: "36 计" },
];

/** 两派的徽标颜色：四大脚本偏蓝，36 计偏琥珀；卡片的大小和字段两派完全一样 */
const BADGE: Record<RouteSchool, string> = {
  four: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  tactic: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
};

/**
 * 脚本打法的统一选择（2026-10-30）。四大脚本（讲怎么讲）和 36 计（怎么拍）是两个派别：
 * 同一个版式、同样大小的卡片，用徽标分派，不做两块分开摆的区域。
 *
 * 单选（脚本页）：value 是一个 key；空串表示 AI 在两派里挑一派（allowAi 时显示「AI 挑」卡片）。
 * 多选（内容规划、创作方向）：value 是 key 数组，选了哪些就只用哪些。
 */
export function ScriptRoutePicker(props: {
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
  allowAi?: boolean;
}) {
  const { value, onChange, multi = false, allowAi = false } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const options = useMemo(() => routeOptions(), []);
  const visible = options.filter((o) => filter === "all" || o.school === filter);
  const selected = multi ? (Array.isArray(value) ? value : []) : [];
  const single = multi ? "" : typeof value === "string" ? value : "";
  const isOn = (key: string) => (multi ? selected.includes(key) : single === key);

  const pick = (key: string) => {
    if (!multi) return onChange(key);
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  const card = (o: RouteOption) => {
    const on = isOn(o.key);
    return (
      <button
        key={o.key}
        type="button"
        onClick={() => pick(o.key)}
        aria-pressed={on}
        className={`glass-interactive relative flex min-h-[64px] flex-col justify-between rounded-xl border p-2.5 text-left ${
          on ? "glass-selected" : "glass-panel"
        }`}
      >
        <div className="flex items-start justify-between gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE[o.school]}`}>
            {o.school === "four" ? "四大脚本" : "36 计"}
          </span>
          {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </div>
        <div className={`mt-1.5 text-[12.5px] font-medium leading-snug ${on ? "text-primary" : "text-foreground"}`}>{o.title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">适合：{o.fit}</div>
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          <span className={`rounded px-1.5 py-0.5 ${BADGE.four}`}>{SCHOOL_LABEL.four}</span>
          <span className={`rounded px-1.5 py-0.5 ${BADGE.tactic}`}>{SCHOOL_LABEL.tactic}</span>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                filter === f.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {allowAi && !multi && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-pressed={single === ""}
              className={`glass-interactive col-span-2 flex items-center gap-2 rounded-xl border p-2.5 text-left text-[12.5px] font-medium sm:col-span-3 ${
                single === "" ? "glass-selected text-primary" : "glass-panel text-muted-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              AI 在两派里挑一派（不指定；只挑一派，不叠加）
            </button>
          )}
          {visible.map(card)}
        </div>
      </div>

      {multi && (
        <div className="text-[11px] text-muted-foreground">
          已选 {selected.length} 种；选了就只用选中的，没选就按上面的配比分。
        </div>
      )}
    </div>
  );
}
