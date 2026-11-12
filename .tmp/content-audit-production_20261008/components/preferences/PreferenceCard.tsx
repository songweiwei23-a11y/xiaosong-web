"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Check, Loader2, Pencil, Plus, RefreshCw, Settings2, Trash2, X } from "lucide-react";
import { PREFERENCE_CATEGORIES, PREFERENCE_NAME, MIN_SIGNALS, TEXT_MAX, type PreferenceCategory, type PreferenceItem } from "@/lib/preferences";
import { fetchPreferences, preferenceAction, type PreferenceView } from "@/lib/preferences-client";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { confirmDialog, notify } from "@/components/ui/feedback";

/**
 * 我的创作偏好卡（2026-10-04，lib/preferences）：放在档案编辑页。
 * 每条写依据；能改、能删（删了不再学）、观察中的能「现在就用」、能自己加；右上角开关学习；「现在更新」手动学一次。
 */
const fmt = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

function basis(i: PreferenceItem) {
  if (i.origin === "manual" && !i.count) return "你自己加的";
  const parts = [i.from.edits && `改稿 ${i.from.edits} 次`, i.from.saves && `收藏 ${i.from.saves} 条`, i.from.published && `已拍/已发 ${i.from.published} 条`].filter(Boolean);
  return `依据：${parts.join("、") || `${i.count} 个内容`}${i.origin === "manual" ? " · 你改过" : ""}`;
}

export function PreferenceCard({ profileId }: { profileId: string | null }) {
  const [view, setView] = useState<PreferenceView | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const [editing, setEditing] = useState<{ id?: string; text: string; category: PreferenceCategory } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let off = false;
    void fetchPreferences(profileId).then((v) => {
      if (off) return;
      if (!v) return setFailed(true);
      setView(v);
      // 看过了：首页「最近又学到 N 条」清零
      if (v.ready && v.newCount > 0) void preferenceAction(profileId, "seen").catch(() => {});
    });
    return () => { off = true; };
  }, [profileId]);

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}, label = action) => {
    setBusy(label);
    try {
      const v = await preferenceAction(profileId, action, extra);
      setView(v);
      invalidateCreatorContext();
      return v;
    } catch (e) {
      notify((e as Error).message, "error");
      return null;
    } finally {
      setBusy("");
    }
  }, [profileId]);

  const saveEdit = async () => {
    if (!editing) return;
    const ok = await act(editing.id ? "edit" : "add", { id: editing.id, item: { text: editing.text, category: editing.category } }, "save");
    if (ok) setEditing(null);
  };

  const learnNow = async () => {
    const v = await act("learn", {}, "learn");
    if (!v) return;
    const s = (v as PreferenceView & { status?: string; signals?: number });
    if (s.status === "not_enough") notify(`内容还不够多（现在 ${s.signals ?? 0} 个），攒够 ${MIN_SIGNALS} 个就能开始学`);
    else notify("已更新");
  };

  if (failed) return null;
  if (!view) return <div id="preferences" className="mb-6 rounded-2xl border border-border p-4 text-[13px] text-muted-foreground"><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />正在读取{PREFERENCE_NAME}…</div>;
  if (!view.ready) return <div id="preferences" className="mb-6 rounded-2xl border border-border p-4 text-[13px] text-muted-foreground">🧠 {PREFERENCE_NAME}还没开通（数据库还没升级），请联系管理员。</div>;

  const active = view.items.filter((i) => i.status === "active");
  const watching = view.items.filter((i) => i.status === "watching");
  const field = "w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-primary";

  const row = (i: PreferenceItem) => editing?.id === i.id ? (
    <li key={i.id} className="rounded-lg bg-muted/60 p-2">
      <EditRow editing={editing} setEditing={setEditing} onSave={saveEdit} busy={busy === "save"} field={field} />
    </li>
  ) : (
    <li key={i.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
      {i.status === "active" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <span className="mt-0.5 w-4 shrink-0 text-center text-muted-foreground">·</span>}
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] ${i.status === "active" ? "text-foreground" : "text-muted-foreground"}`}>{i.text}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{basis(i)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {i.status === "watching" && (
          <button type="button" onClick={() => void act("activate", { id: i.id })} disabled={!!busy} className="rounded-md px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10 disabled:opacity-50">现在就用</button>
        )}
        <button type="button" onClick={() => setEditing({ id: i.id, text: i.text, category: i.category })} aria-label="改这一条" className="rounded p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => void act("delete", { id: i.id })} disabled={!!busy} aria-label={i.status === "watching" ? "不要学这条" : "删掉这一条，以后不再学"} title={i.status === "watching" ? "不要学这条" : "删掉，以后不再学"} className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </li>
  );

  return (
    <section id="preferences" className="mb-6 scroll-mt-20 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground"><Brain className="h-4 w-4 text-primary" />{PREFERENCE_NAME}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {view.enabled ? "开物从你在画布里的修改、收藏和拍了发了的内容里学你的写法，写稿时自动照着写。" : "学习已关闭：不再学新的，下面的偏好也暂停使用。"}
            {view.learnedAt && ` 最近更新：${fmt(view.learnedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {view.enabled && (
            <button type="button" onClick={() => void learnNow()} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] text-foreground hover:border-primary/40 disabled:opacity-50">
              {busy === "learn" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{busy === "learn" ? "正在学…" : "现在更新"}
            </button>
          )}
          <button type="button" onClick={() => setShowSettings((v) => !v)} aria-label="学习设置" aria-expanded={showSettings} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Settings2 className="h-4 w-4" /></button>
        </div>
      </div>

      {showSettings && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-card p-3 text-[12px]">
          <label className="flex items-center gap-2 text-foreground">
            <input type="checkbox" checked={view.enabled} disabled={!!busy} onChange={(e) => void act("enable", { enabled: e.target.checked })} />
            让开物从我的使用中学习
          </label>
          <p className="text-muted-foreground">只读你自己这个档案的内容，不跨账号、不跨档案；学习在后台进行，不扣任何次数。偏好随「数据导出」一起导出。</p>
          <div className="flex flex-wrap gap-3">
            {view.enabled && <button type="button" disabled={!!busy} onClick={async () => { if (await confirmDialog("关闭学习并清空已学到的偏好？")) void act("enable", { enabled: false, clear: true }); }} className="text-muted-foreground underline hover:text-foreground">关闭并清空</button>}
            <button type="button" disabled={!!busy} onClick={async () => { if (await confirmDialog("清空全部偏好（包括「不要再学」的记录），从头重新学？")) void act("clear"); }} className="text-muted-foreground underline hover:text-destructive">清空重新学</button>
          </div>
        </div>
      )}

      {view.enabled && view.stats && view.stats.reduction > 0 && (
        <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
          📉 最近 5 次修改，你平均改动的字数比刚开始少了 {view.stats.reduction}%（共 {view.stats.edits} 次修改）
        </p>
      )}

      {active.length === 0 && watching.length === 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          还没学到东西。在各板块的结果上点「在画布里改」改一改、把好内容收藏起来、在创作进度里标出拍了发了的，攒够 {MIN_SIGNALS} 个开物就开始学（每晚自动学一次，也可以点「现在更新」）。
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {PREFERENCE_CATEGORIES.map((c) => {
            const list = active.filter((i) => i.category === c.id);
            return list.length ? (
              <div key={c.id}>
                <p className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground">{c.label}</p>
                <ul className="space-y-0.5">{list.map(row)}</ul>
              </div>
            ) : null;
          })}
          {watching.length > 0 && (
            <div className="border-t border-border/60 pt-3">
              <p className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground">观察中（还没生效，再出现几次就会用上）</p>
              <ul className="space-y-0.5">{watching.map(row)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        {editing && !editing.id ? (
          <div className="rounded-lg bg-muted/60 p-2"><EditRow editing={editing} setEditing={setEditing} onSave={saveEdit} busy={busy === "save"} field={field} /></div>
        ) : (
          <button type="button" onClick={() => setEditing({ text: "", category: "tone" })} className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"><Plus className="h-3.5 w-3.5" />自己加一条</button>
        )}
      </div>
    </section>
  );
}

function EditRow({ editing, setEditing, onSave, busy, field }: {
  editing: { id?: string; text: string; category: PreferenceCategory };
  setEditing: (v: { id?: string; text: string; category: PreferenceCategory } | null) => void;
  onSave: () => void;
  busy: boolean;
  field: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as PreferenceCategory })} aria-label="类别" className="rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]">
        {PREFERENCE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input value={editing.text} maxLength={TEXT_MAX} autoFocus onChange={(e) => setEditing({ ...editing, text: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSave(); } }}
        placeholder="比如：不用「家人们」；开头直接说结论" aria-label="偏好内容" className={`${field} min-w-0 flex-1`} />
      <button type="button" onClick={onSave} disabled={busy || editing.text.trim().length < 2} className="rounded-lg bg-primary px-3 py-1.5 text-[12px] text-primary-foreground disabled:opacity-50">{busy ? "保存中…" : "保存"}</button>
      <button type="button" onClick={() => setEditing(null)} aria-label="取消" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
