"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Download, Loader2, MessageCircle, Sparkles, Clock, Type } from "lucide-react";
import {
  splitQualityReport,
  parseQualitySummary,
  estimateSpeechStats,
  formatDuration,
} from "@/lib/script-result-utils";

/**
 * 生成结果区。
 *
 * 相比原先「一整块 Markdown 直接铺在页面上」，这里做了三件事：
 *
 * 1. 把质量报告从正文里拆出来单独成卡。原先报告被拼在正文末尾，
 *    用户复制脚本会连评分一起带走，粘进剪辑脚本还得手删。
 * 2. 标出字数与口播时长。编导拿到脚本第一件事就是判断「能不能压进 60 秒」，
 *    直接算给他看，省得自己数。
 * 3. 生成过程中就展示正文，并在顶部给出明确的进行中状态，
 *    而不是转圈转到结束才一次性出现。
 */
export function ResultPanel({
  result,
  isGenerating,
  onCopy,
  onDownload,
  onContinue,
}: {
  result: string;
  isGenerating: boolean;
  onCopy: (bodyOnly: string) => void;
  onDownload: (bodyOnly: string) => void;
  onContinue?: () => void;
}) {
  // 拆分与统计都只依赖 result，用 memo 避免流式输出时每个字符都重算
  const { body, report, stats, quality } = useMemo(() => {
    const split = splitQualityReport(result);
    return {
      body: split.body,
      report: split.report,
      stats: estimateSpeechStats(split.body),
      quality: parseQualitySummary(split.report),
    };
  }, [result]);

  // 空状态
  if (!result && !isGenerating) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <div className="brand-gradient mx-auto flex h-16 w-16 items-center justify-center rounded-2xl opacity-90 shadow-lg shadow-primary/25">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <p className="mt-6 text-[15px] font-medium text-foreground/85">
            填写左侧需求后点击生成
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            AI 会结合编导知识库为你生成专业脚本
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题栏：左侧状态与统计，右侧操作 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">生成结果</h2>

          {isGenerating ? (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              创作中
            </span>
          ) : (
            stats.chars > 0 && (
              // 字数与时长做成两枚小徽章，比写成一句话更容易一眼扫到
              <div className="flex items-center gap-1.5">
                <Stat icon={Type} text={`${stats.chars} 字`} />
                <Stat icon={Clock} text={`约 ${formatDuration(stats.seconds)}`} />
              </div>
            )
          )}
        </div>

        {body && !isGenerating && (
          <div className="flex gap-2">
            {onContinue && (
              <ActionButton icon={MessageCircle} label="继续对话" onClick={onContinue} />
            )}
            {/* 复制与下载都只给正文，不含质量报告 */}
            <ActionButton icon={Copy} label="复制" onClick={() => onCopy(body)} />
            <ActionButton icon={Download} label="下载" onClick={() => onDownload(body)} />
          </div>
        )}
      </div>

      {/* 正文 */}
      {body ? (
        <article className="glass-panel rounded-2xl px-7 py-6">
          <div
            className="prose prose-slate dark:prose-invert max-w-none
                       prose-headings:tracking-tight prose-headings:font-semibold
                       prose-h1:text-xl prose-h2:text-[17px] prose-h3:text-[15px]
                       prose-p:text-[14px] prose-p:leading-[1.85] prose-li:text-[14px]
                       prose-strong:text-foreground prose-hr:border-border/60"
          >
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>

          {/* 流式输出时的光标，让人知道还在写而不是卡住了 */}
          {isGenerating && (
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
          )}
        </article>
      ) : (
        <div className="glass-panel flex min-h-[200px] items-center justify-center rounded-2xl">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-[13px] text-muted-foreground">正在检索知识库并创作…</p>
          </div>
        </div>
      )}

      {/* 质量报告：独立成卡，不混在正文里 */}
      {report && !isGenerating && <QualityCard report={report} quality={quality} />}
    </div>
  );
}

function Stat({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-panel glass-interactive flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/**
 * 质量评分卡。
 * 分数用一根横条表示——读「9.0 / 10.0」要在脑子里换算，看条子一眼就有概念。
 */
function QualityCard({
  report,
  quality,
}: {
  report: string;
  quality: ReturnType<typeof parseQualitySummary>;
}) {
  const score = quality.score;
  const pct = score !== null ? Math.max(0, Math.min(100, score * 10)) : 0;

  // 颜色反映结论，而不是统一用主题色：达标与否需要一眼可辨
  const tone =
    score === null ? "muted" : score >= 9 ? "emerald" : score >= 8 ? "amber" : "rose";
  const bar = {
    muted: "bg-foreground/30",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[tone];
  const text = {
    muted: "text-muted-foreground",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
  }[tone];

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-foreground">脚本质量</span>

        {score !== null && (
          <>
            <span className={`text-lg font-semibold tabular-nums ${text}`}>
              {score.toFixed(1)}
              <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">/ 10</span>
            </span>
            {quality.level && (
              <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
                {quality.level}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                quality.passed
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-rose-500/15 text-rose-500"
              }`}
            >
              {quality.passed ? "达标" : "需改进"}
            </span>
          </>
        )}
      </div>

      {score !== null && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* 报告详情：问题与建议。去掉原报告里的一级标题，标题已由卡片承担 */}
      <div
        className="prose prose-slate dark:prose-invert max-w-none
                   prose-p:text-[12px] prose-li:text-[12px] prose-li:leading-relaxed
                   prose-h2:hidden prose-h3:text-[12px] prose-h3:mt-3 prose-h3:mb-1.5
                   prose-h3:text-muted-foreground prose-strong:text-foreground"
      >
        <ReactMarkdown>{report}</ReactMarkdown>
      </div>
    </div>
  );
}
