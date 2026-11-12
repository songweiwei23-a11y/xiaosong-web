"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { postSafely } from "@/lib/safe-post";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { DEFAULT_PROFILE_SCOPE } from "@/lib/profile-history";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { PRESET_LIMITS, presetsExportJson, toPreset, type CreatorPreset, type PresetExample } from "@/lib/creator-presets";
import type { LibraryListItem } from "@/lib/library";

/**
 * 风格预设管理（2026-10-03），放在素材库「风格预设」分页。说明见 lib/creator-presets.ts。
 * 示例从「认可的好稿」里挑（素材库里点过星标的），或者自己贴一段——只学用户主动认可的。
 */

interface ProfileLite { id: string; profile_name: string }
type Draft = { id?: string; name: string; profileId: string | null; style: string; structure: string; examples: PresetExample[] };

const EMPTY: Draft = { name: "", profileId: null, style: "", structure: "", examples: [] };

export function CreatorPresets() {
  const [presets, setPresets] = useState<CreatorPreset[] | null>(null);
  const [notReady, setNotReady] = useState("");
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // 按档案隔离（2026-10-04）：只列给这个档案的和「全部档案」通用的；别的档案专用的看不到
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  useEffect(() => { setActiveProfile(getActiveProfileId()); return onActiveProfileChange(() => { setDraft(null); setActiveProfile(getActiveProfileId()); }); }, []);
  const visible = (presets ?? []).filter((p) => p.profile_id === null || p.profile_id === activeProfile);

  const load = async () => {
    try {
      const res = await fetch("/api/creator-presets");
      const d = await res.json().catch(() => ({}));
      if (res.status === 503) { setNotReady(d.error || "风格预设还没启用"); setPresets([]); return; }
      if (!res.ok) throw new Error(d.error);
      setPresets((d.presets ?? []).map(toPreset));
    } catch {
      notify("风格预设加载失败，请刷新重试", "error");
      setPresets([]);
    }
  };

  useEffect(() => {
    load();
    fetch("/api/profiles").then((r) => (r.ok ? r.json() : [])).then((l) => setProfiles(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);

  const profileName = (id: string | null) => (id ? profiles.find((p) => p.id === id)?.profile_name ?? "档案已删除" : "全部档案");

  const act = async (p: CreatorPreset, action: "adopt" | "unadopt") => {
    setBusy(p.id);
    try {
      const res = await postSafely(`/api/creator-presets?id=${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "操作失败");
      notify(action === "adopt" ? `已采用：${profileName(p.profile_id)}生成写稿时套用「${p.name}」` : "已停用");
      // 各生成板块的上下文里带着预设：让它们重新取
      invalidateCreatorContext();
      await load();
    } catch (e) { notify((e as Error).message, "error"); } finally { setBusy(null); }
  };

  const remove = async (p: CreatorPreset) => {
    if (!(await confirmDialog(`删掉风格预设「${p.name}」？`, { tone: "danger", confirmText: "删除", title: "删除预设" }))) return;
    const res = await postSafely(`/api/creator-presets?id=${p.id}`, { method: "DELETE" });
    if (!res.ok) return notify("删除失败，请重试", "error");
    if (p.is_active) invalidateCreatorContext();
    setPresets((cur) => (cur ?? []).filter((x) => x.id !== p.id));
  };

  const exportAll = () => {
    if (!visible.length) return;
    const blob = new Blob([presetsExportJson(visible)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `开物风格预设_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (notReady) return <div className="glass-panel rounded-2xl p-6 text-sm text-amber-500">{notReady}</div>;
  if (presets === null) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
        把你认可的写法存成预设，采用后写脚本、审稿、标题、开篇、分镜、二创和自由对话都会照这个风格写。只学语气和结构，不搬示例里的店名、价格和经历。
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setDraft({ ...EMPTY, profileId: getActiveProfileId() })}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90"><Plus className="h-4 w-4" />新建预设</button>
        {visible.length > 0 && <button type="button" onClick={exportAll} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"><Download className="h-4 w-4" />导出全部</button>}
      </div>

      {draft && <PresetForm draft={draft} profiles={profiles.filter((p) => p.id === activeProfile)} onCancel={() => setDraft(null)} onSaved={() => { setDraft(null); invalidateCreatorContext(); load(); }} />}

      {visible.length === 0 && !draft ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-center text-sm leading-relaxed text-muted-foreground sm:p-10">
          还没有风格预设。先在「我的收藏」里给喜欢的稿子点<Star className="mx-0.5 inline h-3.5 w-3.5" />认可为好稿，再回来新建预设、选它当示例。
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <li key={p.id} className={`glass-panel rounded-2xl border p-4 ${p.is_active ? "border-primary/60" : "border-border"}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    <span className="break-words">{p.name}</span>
                    {p.is_active && <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[12px] font-normal text-primary"><CheckCircle2 className="h-3.5 w-3.5" />采用中</span>}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">适用：{profileName(p.profile_id)} · {p.examples.length} 条示例</p>
                  {p.style && <p className="mt-2 line-clamp-2 break-words text-[12.5px] text-muted-foreground">风格：{p.style}</p>}
                  {p.structure && <p className="mt-1 line-clamp-2 break-words text-[12.5px] text-muted-foreground">结构：{p.structure}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" aria-label="修改" title="修改" onClick={() => setDraft({ id: p.id, name: p.name, profileId: p.profile_id, style: p.style, structure: p.structure, examples: p.examples })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label="删除" title="删除" onClick={() => remove(p)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3">
                <button type="button" disabled={busy === p.id} onClick={() => act(p, p.is_active ? "unadopt" : "adopt")}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-60 ${p.is_active ? "bg-muted text-muted-foreground hover:text-foreground" : "bg-primary text-white hover:opacity-90"}`}>
                  {busy === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{p.is_active ? "停用" : "采用"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PresetForm({ draft: initial, profiles, onCancel, onSaved }: { draft: Draft; profiles: ProfileLite[]; onCancel: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [approved, setApproved] = useState<LibraryListItem[] | null>(null);
  const [paste, setPaste] = useState("");
  const [saving, setSaving] = useState(false);

  // 认可的好稿（全部档案的都列出来，用户自己挑）
  useEffect(() => {
    // 示例只从这个档案的好稿里挑
    fetch(`/api/library?kind=approved&limit=50&profileId=${encodeURIComponent(getActiveProfileId() || DEFAULT_PROFILE_SCOPE)}`).then((r) => r.json()).then((x) => setApproved(Array.isArray(x.items) ? x.items : [])).catch(() => setApproved([]));
  }, []);

  const full = d.examples.length >= PRESET_LIMITS.examples;
  const has = (id: string) => d.examples.some((e) => e.libraryId === id);

  const save = async () => {
    setSaving(true);
    try {
      const body = JSON.stringify({ name: d.name, profileId: d.profileId, style: d.style, structure: d.structure, examples: d.examples });
      const res = d.id
        ? await postSafely(`/api/creator-presets?id=${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
        : await postSafely("/api/creator-presets", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const x = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(x.error || "保存失败，请重试");
      notify(x.deactivated ? "已保存；换了适用档案，原来的采用已停用，需要的话再点一次采用" : "已保存");
      onSaved();
    } catch (e) {
      notify((e as Error).message, "error"); // 表单内容留着
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[13.5px] text-foreground outline-none focus:border-primary";
  return (
    <div className="glass-panel mb-4 rounded-2xl border border-primary/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-foreground">{d.id ? "修改风格预设" : "新建风格预设"}</h2>
        <button type="button" onClick={onCancel} aria-label="关闭" className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-[12.5px] text-foreground">名称</span>
          <input value={d.name} maxLength={PRESET_LIMITS.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="比如：老板唠嗑风" className={field} /></label>
        <label className="block"><span className="mb-1 block text-[12.5px] text-foreground">适用档案</span>
          <select value={d.profileId ?? ""} onChange={(e) => setD({ ...d, profileId: e.target.value || null })} className={field}>
            <option value="">全部档案</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.profile_name}</option>)}
          </select></label>
      </div>
      <label className="mt-3 block"><span className="mb-1 block text-[12.5px] text-foreground">表达风格</span>
        <textarea rows={3} value={d.style} maxLength={PRESET_LIMITS.style} onChange={(e) => setD({ ...d, style: e.target.value })} placeholder="语气、用词、节奏：比如像跟熟客唠嗑，短句多，不说“家人们”" className={field} /></label>
      <label className="mt-3 block"><span className="mb-1 block text-[12.5px] text-foreground">结构</span>
        <textarea rows={3} value={d.structure} maxLength={PRESET_LIMITS.structure} onChange={(e) => setD({ ...d, structure: e.target.value })} placeholder="开头怎么起、中间怎么展开、结尾怎么收：比如先抛客人原话，再演示做法，最后一句落到店里" className={field} /></label>

      <div className="mt-3">
        <p className="mb-1 text-[12.5px] text-foreground">认可的示例（最多 {PRESET_LIMITS.examples} 条）</p>
        {d.examples.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {d.examples.map((e, i) => (
              <li key={`${e.libraryId ?? "paste"}-${i}`} className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[12.5px]">
                <span className="min-w-0 flex-1 break-words"><span className="text-foreground">{e.title}</span><span className="ml-1 text-muted-foreground">{e.libraryId ? "· 好稿" : "· 自己贴的"}</span></span>
                <button type="button" aria-label="移除示例" onClick={() => setD({ ...d, examples: d.examples.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        {!full && (
          <>
            <p className="mb-1 text-[12px] text-muted-foreground">从认可的好稿里选：</p>
            {approved === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : approved.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">还没有认可的好稿——在「我的收藏」里给喜欢的稿子点星标。</p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {approved.map((a) => (
                  <button key={a.id} type="button" disabled={has(a.id)} onClick={() => setD({ ...d, examples: [...d.examples, { title: a.title, content: a.preview, libraryId: a.id }] })}
                    className="max-w-full truncate rounded-lg bg-muted px-2.5 py-1 text-[12.5px] text-muted-foreground hover:text-foreground disabled:opacity-40">{a.title}</button>
                ))}
              </div>
            )}
            <p className="mb-1 mt-2 text-[12px] text-muted-foreground">或者贴一段你自己写的、认可的稿子：</p>
            <textarea rows={3} value={paste} maxLength={PRESET_LIMITS.exampleChars} onChange={(e) => setPaste(e.target.value)} className={field} />
            <button type="button" disabled={paste.trim().length < 10} onClick={() => { setD({ ...d, examples: [...d.examples, { title: paste.trim().slice(0, 20), content: paste.trim() }] }); setPaste(""); }}
              className="mt-1 rounded-lg bg-muted px-3 py-1 text-[12.5px] text-muted-foreground hover:text-foreground disabled:opacity-40">加为示例</button>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">取消</button>
        <button type="button" onClick={save} disabled={saving || !d.name.trim()} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}保存
        </button>
      </div>
    </div>
  );
}
