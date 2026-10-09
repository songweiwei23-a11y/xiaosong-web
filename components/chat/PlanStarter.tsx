"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Loader2, Paperclip, Search, X } from "lucide-react";
import { CUSTOM_SCENARIO, MATERIAL_MAX, PLAN_CATEGORIES, type PlanMeta } from "@/lib/plan-builder";

/**
 * 出方案 · 开始（2026-10-04）：选场景 → 行业 → 要解决什么 → 已知条件 → 生成大纲。
 * 场景库按类别列常见的，搜不到就写「自定义方案」——各行各业、各个场景都能出。逻辑见 lib/plan-builder。
 */
export function PlanStarter({ defaultIndustry, disabled, onStart, onClose, fileNames, uploading, canUpload, onPickFiles }: {
  defaultIndustry: string;
  disabled: boolean;
  onStart: (meta: PlanMeta) => void;
  onClose: () => void;
  /**
   * 资料（2026-10-04）：做方案人的文档、图片。用的是输入框那套上传（同样的格式、大小、6 个上限），
   * 传上去的显示在输入框上方、可以删；生成大纲时一起发给模型，后面写全文、补写自动沿用
   */
  fileNames: string[];
  uploading: boolean;
  canUpload: boolean;
  onPickFiles: () => void;
}) {
  const [material, setMaterial] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ name: string; category?: string } | null>(null);
  const [custom, setCustom] = useState("");
  const [industry, setIndustry] = useState(defaultIndustry);
  const [goal, setGoal] = useState("");
  const [facts, setFacts] = useState("");
  const [error, setError] = useState("");

  const list = useMemo(() => {
    const kw = q.trim();
    return PLAN_CATEGORIES.filter((c) => cat === "all" || c.id === cat).flatMap((c) => c.scenarios.filter((s) => !kw || s.includes(kw) || c.label.includes(kw)).map((s) => ({ name: s, category: c.id })));
  }, [cat, q]);

  const isCustom = picked?.name === CUSTOM_SCENARIO;
  const start = () => {
    const scenario = isCustom ? custom.trim() : picked?.name;
    if (!scenario) return setError(isCustom ? "写一下要出什么方案，比如：社区团购冷启动方案" : "先选一个方案类型，或者选「自定义方案」");
    if (goal.trim().length < 4) return setError("写一句这次要解决什么，比如：国庆 7 天开业，想每天多来 30 桌");
    if (uploading) return setError("资料还在上传，传完再生成");
    setError("");
    onStart({
      stage: "outline", scenario: scenario.slice(0, 60), category: isCustom ? undefined : picked?.category, industry: industry.trim(), goal: goal.trim(),
      ...(facts.trim() ? { facts: facts.trim() } : {}),
      ...(material.trim() ? { material: material.trim().slice(0, MATERIAL_MAX) } : {}),
      ...(fileNames.length ? { files: fileNames } : {}),
    });
  };

  const chip = (on: boolean) => `rounded-lg px-2.5 py-1 text-xs ${on ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`;
  const field = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
  return (
    <div className="mb-2 max-h-[60dvh] overflow-y-auto rounded-xl border border-primary/40 bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><ClipboardList className="h-4 w-4 text-primary" />出方案</p>
          <p className="mt-0.5 text-xs text-muted-foreground">第一步先出大纲（章节骨架），你确认、改好之后，第二步再写完整方案。两步各用 1 次。</p>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <p className="mb-1 text-xs text-foreground">1. 方案类型</p>
      <label className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜场景：开业、直播、招聘、年会……" aria-label="搜方案场景" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
      </label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" className={chip(cat === "all")} onClick={() => setCat("all")}>全部</button>
        {PLAN_CATEGORIES.map((c) => <button key={c.id} type="button" className={chip(cat === c.id)} onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>
      <div className="mb-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {list.map((s) => (
          <button key={`${s.category}-${s.name}`} type="button" aria-pressed={picked?.name === s.name} onClick={() => setPicked(s)}
            className={`rounded-lg border px-2.5 py-1 text-xs ${picked?.name === s.name ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/40"}`}>{s.name}</button>
        ))}
        <button type="button" aria-pressed={isCustom} onClick={() => setPicked({ name: CUSTOM_SCENARIO })}
          className={`rounded-lg border border-dashed px-2.5 py-1 text-xs ${isCustom ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>+ 自定义方案</button>
      </div>
      {isCustom && <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={60} placeholder="要出什么方案？比如：社区团购冷启动方案" className={`${field} mb-3`} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs text-foreground">2. 行业 / 业务</span>
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={80} placeholder="比如：川菜馆、全屋定制、美甲店" className={field} /></label>
        <label className="block"><span className="mb-1 block text-xs text-foreground">3. 这次要解决什么（必填）</span>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={1000} placeholder="比如：国庆 7 天开业，想每天多来 30 桌" className={field} /></label>
      </div>
      <label className="mt-3 block"><span className="mb-1 block text-xs text-foreground">4. 已知条件（可不填）</span>
        <textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={2} maxLength={1500} placeholder="时间、预算、人手、地点、价格……没写的方案里会标【待确认】，不会替你编" className={`${field} resize-y`} /></label>

      <div className="mt-3">
        <span className="mb-1 block text-xs text-foreground">5. 资料（可不填）：方案要基于谁的资料来写，就把资料给它</span>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onPickFiles} disabled={!canUpload || uploading}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:border-primary/40 disabled:opacity-50">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            {uploading ? "正在上传…" : "上传文档 / 图片"}
          </button>
          <span className="text-[11px] text-muted-foreground">
            {fileNames.length ? `已附 ${fileNames.length} 份（在输入框上方，可删）：${fileNames.join("、")}` : "简历、公司介绍、产品清单、证书照片……PDF、Word、Excel、PPT、图片，最多 6 个"}
          </span>
        </div>
        <textarea value={material} onChange={(e) => setMaterial(e.target.value)} rows={3} maxLength={MATERIAL_MAX}
          placeholder="也可以直接把资料文字粘贴在这里。方案里的事实以资料为准，资料里没有的会标【待确认】"
          className={`${field} resize-y`} />
      </div>

      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={start} disabled={disabled} className="rounded-lg brand-gradient px-4 py-2 text-sm font-medium text-white disabled:opacity-50">生成大纲</button>
      </div>
    </div>
  );
}
