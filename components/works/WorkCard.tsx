"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2, ArrowRight, Check, Camera, Clock, Send, AlertCircle, BarChart3, Clapperboard, Loader2 } from "lucide-react";
import { METRIC_FIELDS, metricsLine, readMetrics, type WorkMetrics } from "@/lib/performance";
import { workReminder, type ShootStatus, type Work } from "@/lib/works";
import { fetchWork, nextStage, workStageUrl, type WorkDetail } from "@/lib/resume";
import { ProductionPack } from "@/components/works/ProductionPack";

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
    setForm(Object.fromEntries([...METRIC_FIELDS.map((f) => [f.key, m[f.key] === undefined ? "" : String(m[f.key])]), ["note", m.note ?? ""], ['platform', m.platform ?? ''], ['paidPromotion', m.paidPromotion === undefined ? '' : m.paidPromotion ? 'yes' : 'no']]));
    setEditing(true);
  };
  const save = async () => {
    if (!onMetricsSave) return;
    setSaving(true);
    try {
      if (await onMetricsSave(readMetrics({ ...form, paidPromotion: form.paidPromotion ? form.paidPromotion === 'yes' : undefined }))) setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  const reminder = workReminder(w);
  // 写过脚本或审过稿才有可拍的口播；拍过、发过的也能回看
  const scriptReady = w.stages.some((s) => (s.name === "脚本生成" || s.name === "审稿优化") && s.done);
  const [packOpen, setPackOpen] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState("");
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const togglePack = async () => {
    if (packOpen) return setPackOpen(false);
    setPackError("");
    // 每次展开都重新取：在别的板块改过、生成过新版本，交付包要跟着是最新的
    setPackLoading(true);
    const d = await fetchWork(w.id).catch(() => null);
    setPackLoading(false);
    if (!d) return setPackError("这条作品的内容没取到，请重试");
    setDetail(d);
    setPackOpen(true);
  };
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

      {/*
        拍摄交付包（2026-10-04 接入，组件见 components/works/ProductionPack）：口播大字稿、镜头清单、导出。
        点开才去取这条作品的完整内容（各环节最新一版 + 作品需求），列表里不带正文
      */}
      {(scriptReady || status !== "none") && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <button type="button" onClick={togglePack} aria-expanded={packOpen} disabled={packLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-60">
            {packLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clapperboard className="h-3 w-3" />}
            {packOpen ? "收起拍摄交付包" : "拍摄交付包：口播大字稿、镜头清单"}
          </button>
          {packError && <p role="alert" className="mt-2 text-[12px] text-destructive">{packError}</p>}
          {packOpen && detail && <div className="mt-3"><ProductionPack work={detail} /></div>}
        </div>
      )}

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
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11.5px] text-muted-foreground">发布平台<input aria-label="发布平台" value={form.platform ?? ''} maxLength={40} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} placeholder="例如：抖音" className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-foreground" /></label>
                <label className="text-[11.5px] text-muted-foreground">是否投放<select aria-label="是否投放" value={form.paidPromotion ?? ''} onChange={e => setForm(p => ({ ...p, paidPromotion: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-foreground"><option value="">未记录</option><option value="no">自然流量</option><option value="yes">有付费投放</option></select></label>
              </div>
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
