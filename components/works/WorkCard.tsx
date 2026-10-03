"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2, ArrowRight, Check, Camera, Clock, Send, AlertCircle, BarChart3 } from "lucide-react";
import { METRIC_FIELDS, metricsLine, readMetrics, type WorkMetrics } from "@/lib/performance";
import { workReminder, type ShootStatus, type Work } from "@/lib/works";
import { nextStage, workStageUrl } from "@/lib/resume";

const fmt = (s: string) =>
  new Date(s).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 一条作品：标题、下一步、每个环节的入口。
 * 「我的作品」页用它；拆成组件是为了能单独预览（页面文件里不能导出别的东西）。
 */
const SHOOT_STEPS: { id: ShootStatus; label: string; icon: typeof Camera }[] = [
  { id: "none", label: "还没拍", icon: Clock },
  { id: "shot", label: "已拍摄", icon: Camera },
  { id: "published", label: "已发布", icon: Send },
];

const TONE_CLS = { info: "text-primary", warn: "text-amber-500", done: "text-emerald-500" } as const;

export function WorkCard({ work: w, onDelete, onShootChange, onMetricsSave }: {
  work: Work;
  onDelete: () => void;
  onShootChange?: (status: ShootStatus) => void;
  /** 录发布后的数据（数据回流）；返回 false 表示没存上，表单留着 */
  onMetricsSave?: (metrics: WorkMetrics | null) => Promise<boolean>;
}) {
  const next = nextStage(w.stages);
  const status = w.shoot_status ?? "none";
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const openForm = () => {
    const m = w.metrics ?? {};
    setForm(Object.fromEntries([...METRIC_FIELDS.map((f) => [f.key, m[f.key] === undefined ? "" : String(m[f.key])]), ["note", m.note ?? ""]]));
    setEditing(true);
  };
  const save = async () => {
    if (!onMetricsSave) return;
    setSaving(true);
    try {
      if (await onMetricsSave(readMetrics(form))) setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  const reminder = workReminder(w);
  // 开篇是可选环节，插在选题和脚本之间显示，符合实际的创作顺序
  const chips = [
    ...w.stages.slice(0, 1),
    ...(w.optional ?? []).map((s) => ({ ...s, optional: true })),
    ...w.stages.slice(1),
  ] as { name: string; done: boolean; optional?: boolean }[];

  return (
    <li className="glass-panel rounded-2xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{w.title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            最近更新 {fmt(w.updated_at)}
            {w.is_done && <span className="ml-2 text-emerald-500">内容已做完</span>}
          </p>
          {reminder && <p className={`mt-1 flex items-center gap-1 text-[12px] ${TONE_CLS[reminder.tone]}`}>{reminder.tone === "warn" && <AlertCircle className="h-3.5 w-3.5" />}{reminder.text}</p>}
        </div>
        {next && status === "none" && (
          <Link
            href={workStageUrl(w.id, next)}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90"
          >
            继续：{next}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
        <button
          onClick={onDelete}
          aria-label={`删除作品：${w.title}`}
          title="删除这条作品（内容不会删）"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 每个环节都能点：做过的打开看、接着改；没做的直接去做 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((s) =>
          // 选题那一步不可点：作品标题本身就是那条选题，没有别的内容可打开
          s.name === "选题策划" ? (
            <span
              key={s.name}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[12px] text-primary"
            >
              <Check className="h-3 w-3" />
              选题已定
            </span>
          ) : (
            <Link
              key={s.name}
              href={workStageUrl(w.id, s.name)}
              title={s.done ? `打开这条作品的${s.name}，看或接着改` : `去给这条作品做${s.name}`}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] transition-colors ${
                s.done
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              } ${s.optional && !s.done ? "border-dashed" : ""}`}
            >
              {s.done && <Check className="h-3 w-3" />}
              {s.name}
              {s.optional && !s.done && <span className="opacity-60">（可选）</span>}
            </Link>
          )
        )}
      </div>

      {/* 落地状态：内容做完之后拍没拍、发没发（2026-10-02） */}
      {onShootChange && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <span className="mr-1 text-[12px] text-muted-foreground">落地：</span>
          {SHOOT_STEPS.map((s) => {
            const on = status === s.id;
            const Icon = s.icon;
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => !on && onShootChange(s.id)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] transition-colors ${on ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                <Icon className="h-3 w-3" />{s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 发布后的数据（数据回流）：录了以后选题、方向、起号会参考这个号的真实数据 */}
      {onMetricsSave && status === "published" && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {!editing ? (
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              {w.metrics ? <span className="text-foreground">{metricsLine(w.metrics)}{w.metrics.note ? `（${w.metrics.note}）` : ""}</span> : <span className="text-muted-foreground">还没录数据：录了以后，选题和方向会参考这个号的真实表现</span>}
              <button type="button" onClick={openForm} className="text-primary underline">{w.metrics ? "改数据" : "录入数据"}</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {METRIC_FIELDS.map((f) => (
                  <label key={f.key} className="text-[11.5px] text-muted-foreground">
                    {f.label}{f.unit ? `（${f.unit}）` : ""}
                    <input
                      aria-label={f.label}
                      inputMode="decimal"
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder="选填"
                      className="mt-0.5 w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-[13px] text-foreground focus:border-primary focus:outline-none"
                    />
                  </label>
                ))}
              </div>
              <input
                value={form.note ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="一句话备注（选填），例如：上了同城热榜"
                className="w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-[13px] text-foreground focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-[12.5px] text-white disabled:opacity-60">{saving ? "保存中…" : "保存数据"}</button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted">取消</button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
