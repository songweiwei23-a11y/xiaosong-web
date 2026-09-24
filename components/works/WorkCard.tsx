"use client";

import Link from "next/link";
import { Trash2, ArrowRight, Check } from "lucide-react";
import type { Work } from "@/lib/works";
import { nextStage, workStageUrl } from "@/lib/resume";

const fmt = (s: string) =>
  new Date(s).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 一条作品：标题、下一步、每个环节的入口。
 * 「我的作品」页用它；拆成组件是为了能单独预览（页面文件里不能导出别的东西）。
 */
export function WorkCard({ work: w, onDelete }: { work: Work; onDelete: () => void }) {
  const next = nextStage(w.stages);
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
            {w.is_done && <span className="ml-2 text-emerald-500">已完成</span>}
          </p>
        </div>
        {next && (
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
    </li>
  );
}
