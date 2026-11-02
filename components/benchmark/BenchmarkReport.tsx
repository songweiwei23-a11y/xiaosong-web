"use client";

import { useRef } from "react";
import { Copy } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { notify } from "@/components/ui/feedback";

/**
 * 对标拆解报告的排版（2026-11-02 产品方：原来整段原文直接显示，### 和 ** 都露在外面，太丑）。
 * 和账号定位方案一样按 Markdown 排：大标题（一、二、三……）左边一道主色竖线，六维的小标题用主色，表格成表。
 * 顶上一排章节按钮，点了跳到那一节；报告长，翻着找太累。正在生成的报告和已保存的拆解都用这一个。
 */

/** 报告里的大标题（### 一、材料清单 → 「材料清单」），给章节按钮用；没有就不出按钮 */
export function reportSections(report: string): string[] {
  return [...report.matchAll(/^###\s+(.+?)\s*$/gm)].map((m) => m[1].replace(/^[一二三四五六七八九十]+、/, "").replace(/[（(].*$/, "").trim()).filter(Boolean);
}

export function BenchmarkReport({ report, streaming = false }: { report: string; streaming?: boolean }) {
  const body = useRef<HTMLDivElement>(null);
  const sections = streaming ? [] : reportSections(report);

  const jump = (i: number) => body.current?.querySelectorAll("h3")[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      notify("报告已复制");
    } catch {
      notify("没复制上：浏览器不让读写剪贴板，可以手动选中复制", "error");
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/70">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <p className="text-[13px] font-semibold text-foreground">{streaming ? "拆解报告 · 正在写…" : "拆解报告"}</p>
        {!streaming && (
          <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />复制
          </button>
        )}
      </div>

      {sections.length > 2 && (
        <nav aria-label="报告章节" className="flex flex-wrap gap-1.5 border-b border-border/60 px-4 py-2.5">
          {sections.map((s, i) => (
            <button key={`${s}-${i}`} type="button" onClick={() => jump(i)} className="rounded-full border border-border/70 px-2.5 py-0.5 text-[12px] text-muted-foreground hover:border-primary/50 hover:text-foreground">
              {s}
            </button>
          ))}
        </nav>
      )}

      <div
        ref={body}
        className="prose prose-slate dark:prose-invert max-w-none break-words px-4 py-4
                   prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground
                   prose-h2:mb-4 prose-h2:mt-12 prose-h2:border-b prose-h2:border-border/70 prose-h2:pb-2 prose-h2:text-[17px] prose-h3:mb-3 prose-h3:mt-8 prose-h3:scroll-mt-20 prose-h3:border-l-[3px] prose-h3:border-primary prose-h3:pl-2.5 prose-h3:text-[15.5px]
                   prose-h4:mb-1.5 prose-h4:mt-5 prose-h4:text-[14px] prose-h4:text-primary
                   prose-p:my-2 prose-p:text-[13.5px] prose-p:leading-[1.85]
                   prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:text-[13.5px] prose-li:leading-[1.8] prose-li:marker:text-primary/70
                   prose-strong:text-foreground prose-hr:my-6 prose-hr:border-border/60
                   [&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none prose-blockquote:rounded-r-lg prose-blockquote:border-primary prose-blockquote:bg-primary/[0.07] prose-blockquote:py-1 prose-blockquote:font-medium prose-blockquote:not-italic prose-blockquote:text-foreground
                   [&>*:first-child]:mt-0"
      >
        <Markdown>{report}</Markdown>
      </div>
    </div>
  );
}
