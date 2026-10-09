"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { postSafely } from "@/lib/safe-post";
import { notify } from "@/components/ui/feedback";
import { PERMISSIONS, REAL_FIELDS, type PermissionId, type RealMaterialFields } from "@/lib/library";

/**
 * 记录一条真实素材（2026-10-03）。
 *
 * 产品要求："客户问题、原话、行动、过程、真实结果、可拍画面、使用许可/待确认。手动录入也可用。"
 * 只做手动录入：语音转写在 http 访问下浏览器不给麦克风，图片识别要调模型——都不做假按钮。
 * 新建走 POST /api/library { real }，修改走 PATCH ?id= { fields }（正文由各栏重新拼出来）。
 */
export function RealMaterialForm({ profileId, initial, editId, onSaved, onCancel }: {
  profileId: string | null;
  initial?: { title?: string; fields?: RealMaterialFields | null };
  editId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [fields, setFields] = useState<RealMaterialFields>(initial?.fields ?? { permission: "pending" });
  const [saving, setSaving] = useState(false);

  const filled = Boolean(fields.question?.trim() || fields.quote?.trim() || fields.result?.trim());

  const save = async () => {
    if (!filled) return notify("至少写上客户问题、原话或真实结果中的一项", "error");
    setSaving(true);
    try {
      const res = editId
        ? await postSafely(`/api/library?id=${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields, ...(title.trim() ? { title } : {}) }) })
        : await postSafely("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, real: { title, fields } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "保存失败，请重试");
      notify(editId ? "已保存修改" : "已记到素材库");
      onSaved();
    } catch (e) {
      // 失败时表单内容原样留着，网络好了再点保存
      notify((e as Error).message || "保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel mb-4 rounded-2xl border border-primary/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium text-foreground">{editId ? "修改真实素材" : "记录真实素材"}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">记真事：照实写，没有的栏空着。拿去继续创作时，AI 会按真事写，不替你编结果。</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="关闭" className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-[12.5px] text-muted-foreground">标题（可不填，默认用客户问题）</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
          className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[14px] text-foreground outline-none focus:border-primary" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {REAL_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[12.5px] text-foreground">{f.label}</span>
            <textarea value={fields[f.key] ?? ""} rows={3} placeholder={f.hint} maxLength={2000}
              onChange={(e) => setFields((cur) => ({ ...cur, [f.key]: e.target.value }))}
              className="w-full resize-y rounded-lg border border-border bg-background/60 px-3 py-2 text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary" />
          </label>
        ))}
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-[12.5px] text-foreground">使用许可（涉及客人、员工或别家店的画面和原话时）</legend>
        <div className="flex flex-wrap gap-1.5">
          {PERMISSIONS.map((p) => (
            <button key={p.id} type="button" aria-pressed={fields.permission === p.id} onClick={() => setFields((cur) => ({ ...cur, permission: p.id as PermissionId }))}
              className={`rounded-lg px-3 py-1.5 text-[13px] ${fields.permission === p.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">取消</button>
        <button type="button" onClick={save} disabled={saving || !filled}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}保存
        </button>
      </div>
    </div>
  );
}
