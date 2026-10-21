"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, FileUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { nextBatchHint, type WorkInsight } from "@/lib/work-insight";

/**
 * 创作进度顶部的「账号作品概况」：导入任意格式的文件，分析这个账号的内容配比、三类视频的表现和规划。
 * 分析结果存下来，选题、方向、起号、自由对话等规划类板块会自动参考它。
 */

interface Material {
  id: string;
  filename: string;
  kind: string;
  status: "ok" | "empty" | "unsupported" | "failed";
  note: string | null;
  byte_size: number;
  created_at: string;
}

const STATUS_TONE: Record<Material["status"], string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  empty: "text-amber-700 dark:text-amber-400",
  unsupported: "text-muted-foreground",
  failed: "text-destructive",
};
const STATUS_TEXT: Record<Material["status"], string> = { ok: "已读出", empty: "没读出文字", unsupported: "已保存", failed: "读取失败" };

const BAR_TONE: Record<"流量型" | "人设型" | "变现型", string> = {
  流量型: "bg-sky-500",
  人设型: "bg-violet-500",
  变现型: "bg-amber-500",
};

export function MaterialsPanel() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [insight, setInsight] = useState<WorkInsight | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async (pid: string) => {
    const [m, i] = await Promise.all([
      fetch(`/api/work-materials?profileId=${encodeURIComponent(pid)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/work-insights?profileId=${encodeURIComponent(pid)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setMaterials((m?.materials as Material[] | undefined) ?? []);
    setInsight((i?.insight as WorkInsight | null | undefined) ?? null);
  }, []);

  useEffect(() => {
    const sync = () => {
      const pid = getActiveProfileId();
      setProfileId(pid);
      if (pid) void load(pid);
    };
    sync();
    return onActiveProfileChange(sync);
  }, [load]);

  const upload = async (files: FileList | File[]) => {
    if (!profileId) return notify("先在侧边栏选一个档案");
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("profileId", profileId);
      const res = await fetch("/api/work-materials", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(`${file.name}：${data.error || "导入没有成功"}`);
        continue;
      }
      setMaterials((ms) => [data.material as Material, ...ms]);
    }
    setUploading(false);
    invalidateCreatorContext();
  };

  const remove = async (m: Material) => {
    if (!profileId) return;
    if (!(await confirmDialog(`删除「${m.filename}」？删除后它不再参与分析，已经生成的概况要重新分析才会更新。`))) return;
    const res = await fetch(`/api/work-materials?id=${encodeURIComponent(m.id)}&profileId=${encodeURIComponent(profileId)}`, { method: "DELETE" });
    if (!res.ok) return notify("删除没有成功");
    setMaterials((ms) => ms.filter((x) => x.id !== m.id));
    invalidateCreatorContext();
  };

  const analyze = async () => {
    if (!profileId) return;
    setAnalyzing(true);
    const res = await fetch("/api/work-insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.insight) setInsight(data.insight as WorkInsight);
    notify(res.ok ? "账号作品概况已更新，规划类板块会用上" : data.error || "分析没有完成");
    setAnalyzing(false);
    invalidateCreatorContext();
  };

  if (!profileId) {
    return (
      <section className="glass-panel mb-6 rounded-2xl p-4 text-[13px] text-muted-foreground">
        先在侧边栏选一个档案，再导入它的文件和作品资料，就能看到这个账号的内容配比和反馈。
      </section>
    );
  }

  const mix = insight?.mix;
  const recorded = mix ? mix.counts.流量型 + mix.counts.人设型 + mix.counts.变现型 : 0;

  return (
    <section className="glass-panel mb-6 space-y-4 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">账号作品概况</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            文档、表格、PPT、PDF、网页、字幕、截图都可以导入，会识别每条内容的脚本类型、结构、风格、开篇、目的、人群和数据。视频本身读不出台词，请同时导入它的脚本或字幕。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={analyzing}
          className="brand-gradient flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {insight ? "重新分析" : "开始分析"}
        </button>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-[13px] transition ${dragging ? "border-primary bg-primary/[0.06]" : "border-border text-muted-foreground hover:text-foreground"}`}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        <span>{uploading ? "正在读取文件…" : "点击或把文件拖到这里导入"}</span>
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {materials.length > 0 && (
        <ul className="space-y-1.5">
          {materials.map((m) => (
            <li key={m.id} className="flex items-start gap-2 rounded-lg bg-foreground/[0.03] px-3 py-2 text-[12.5px]">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{m.filename}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  <span className={STATUS_TONE[m.status]}>{STATUS_TEXT[m.status]}</span>
                  {m.note ? `｜${m.note}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => void remove(m)} aria-label={`删除 ${m.filename}`} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {insight && mix && (
        <div className="space-y-4 border-t border-border/60 pt-4 text-[13px]">
          <div className="flex flex-wrap gap-2 text-[12px] text-muted-foreground">
            <span>作品 {insight.overview.works} 条</span>
            <span>·</span>
            <span>已拍 {insight.overview.shot}</span>
            <span>·</span>
            <span>已发布 {insight.overview.published}</span>
            <span>·</span>
            <span>有数据 {insight.overview.withData}</span>
            <span>·</span>
            <span>读出文字的文件 {insight.overview.materials}</span>
            <span className="ml-auto">{insight.generatedAt.slice(0, 10)} 分析</span>
          </div>

          <div>
            <h3 className="mb-1.5 font-medium text-foreground">
              确定的配比 <span className="text-[12px] font-normal text-muted-foreground">（按作品记录的视频目的，{recorded} 条）</span>
            </h3>
            {mix.shares ? (
              <div className="space-y-1.5">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                  {(["流量型", "人设型", "变现型"] as const).map((r) => (
                    <div key={r} className={BAR_TONE[r]} style={{ width: `${mix.shares![r]}%` }} />
                  ))}
                </div>
                <p className="text-[12.5px] text-foreground">
                  流量型 {mix.shares.流量型}%　人设型 {mix.shares.人设型}%　变现型 {mix.shares.变现型}%
                  {mix.planned && (
                    <span className="text-muted-foreground">
                      　｜ 档案计划 {mix.planned.流量型}% / {mix.planned.人设型}% / {mix.planned.变现型}%
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">作品记录里还没有能确定目的的作品。创作时选好视频目的，这里才会算出配比。</p>
            )}
            {mix.gaps.map((g, i) => (
              <p key={i} className="mt-1 text-[12px] text-muted-foreground">· {g}</p>
            ))}
            {nextBatchHint(mix) && <p className="mt-1.5 text-[12.5px] text-foreground">下一批：{nextBatchHint(mix)}</p>}
          </div>

          <div>
            <h3 className="mb-1.5 font-medium text-foreground">三种视频的表现</h3>
            <ul className="space-y-1">
              {insight.feedback.map((f) => (
                <li key={f.role} className="text-[12.5px]">
                  <span className="font-medium text-foreground">{f.role}</span>
                  <span className="text-muted-foreground">
                    （{f.n} 条{f.enough ? "" : "，样本少，不下结论"}）：{f.line}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {insight.materialMix && (
            <p className="text-[12.5px] text-foreground">
              从导入的文件里识别出 {insight.materialMix.total} 条标题（推测）：流量型 {insight.materialMix.counts.流量型}、人设型 {insight.materialMix.counts.人设型}、变现型 {insight.materialMix.counts.变现型}、不确定 {insight.materialMix.counts.不确定}
            </p>
          )}

          {(insight.items ?? []).length > 0 && (
            <div>
              <h3 className="mb-1.5 font-medium text-foreground">
                文件里识别出的内容{" "}
                <span className="text-[12px] font-normal text-muted-foreground">
                  （推测，共 {insight.items.length} 条，已发布 {insight.items.filter((i) => i.published === true).length} 条）
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12px]">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2 font-normal">内容</th>
                      <th className="pr-2 font-normal">目的</th>
                      <th className="pr-2 font-normal">脚本类型</th>
                      <th className="pr-2 font-normal">结构</th>
                      <th className="pr-2 font-normal">风格</th>
                      <th className="pr-2 font-normal">开篇</th>
                      <th className="pr-2 font-normal">人群</th>
                      <th className="pr-2 font-normal">发布</th>
                      <th className="font-normal">播放</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insight.items.map((it, i) => (
                      <tr key={i} className="border-t border-border/50 align-top text-foreground">
                        <td className="py-1 pr-2">{it.title}</td>
                        <td className="pr-2">{it.role}</td>
                        <td className="pr-2">{it.scriptType ?? "—"}</td>
                        <td className="pr-2">{it.structure ?? "—"}</td>
                        <td className="pr-2">{it.style ?? "—"}</td>
                        <td className="pr-2">{it.opening ?? "—"}</td>
                        <td className="pr-2">{it.audience ?? "—"}</td>
                        <td className="pr-2">{it.published === true ? "已发布" : it.published === false ? "未发布" : "—"}</td>
                        <td>{it.views ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {insight.planning.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-foreground">规划</h3>
              <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-foreground">{insight.planning.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {insight.reviewNotes.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-foreground">反馈</h3>
              <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-foreground">{insight.reviewNotes.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {insight.materialNotes.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-foreground">文件里有什么</h3>
              <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-muted-foreground">{insight.materialNotes.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}

          {insight.caveats.length > 0 && (
            <ul className="space-y-0.5 text-[11.5px] text-muted-foreground">
              {insight.caveats.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
