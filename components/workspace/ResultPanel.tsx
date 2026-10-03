"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from 'next/navigation';
import { Markdown } from "@/components/markdown";
import { Copy, Download, Loader2, MessageCircle, Clock, Type, ArrowRight, ArrowDown, FileText, type LucideIcon } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { extractPlainCopy } from "@/lib/script-copy";
import {
  splitQualityReport,
  parseQualitySummary,
  estimateSpeechStats,
  formatDuration,
} from "@/lib/script-result-utils";
import { EmptyState } from "./EmptyState";
import { CreationLinks } from './CreationLinks';
import { RemixContinuation } from './RemixContinuation';
import type { CreationContext } from '@/lib/creation-flow';
import { CREATION_SOURCES } from '@/lib/creation-flow';
import { splitRemixPlans } from '@/lib/remix-plans';
import { TabooScan } from './TabooScan';
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { reportQuality } from '@/lib/quality-report';
import type { ResolvedMix } from '@/lib/content-mix';

/**
 * 工作区通用的生成结果区。
 *
 * 原先只有脚本页做了这一套，其余页面各写各的：标题字号不一、
 * 操作按钮位置不同、正文直接铺在页面上没有边界、空状态是一块巨大的彩色图标。
 * 统一成一个组件后，八个页面的结果区行为与外观完全一致。
 *
 * 质量评分是脚本页独有的，做成可选：其余页面传 showQuality={false} 即可，
 * 组件内部照样会把误拼进正文的报告段落剥掉，避免复制时带出来。
 */
/** 生成完之后可以直接去的下一步 */
export interface NextAction {
  label: string;
  icon: LucideIcon;
  /** 拿到的是正文（不含质量报告），由调用方决定带去哪里 */
  onClick: (bodyOnly: string) => void;
}

export function ResultPanel({
  result,
  isGenerating,
  title = "生成结果",
  showStats = true,
  showQuality = false,
  emptyIcon,
  emptyTitle,
  emptyHint,
  emptyTips,
  generatingHint = "正在检索知识库并创作…",
  onCopy,
  onDownload,
  onContinue,
  nextActions,
  footer,
  bodyClassName,
  flowContext,
  individualPlans = false,
  qualityMix,
}: {
  result: string;
  isGenerating: boolean;
  title?: string;
  /** 是否展示字数与口播时长。对脚本类内容有意义，对问答类没有 */
  showStats?: boolean;
  showQuality?: boolean;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyHint?: string;
  emptyTips?: string[];
  generatingHint?: string;
  onCopy?: (bodyOnly: string) => void;
  onDownload?: (bodyOnly: string) => void;
  onContinue?: () => void;
  /**
   * 「接下来」的去处。内容会自动带过去，不用复制粘贴——
   * 这是九个功能之间最缺的一环：同一条内容原先要手动粘贴四五次。
   */
  nextActions?: NextAction[];
  /**
   * 正文之后、「接下来」之前的位置，给各页面放自己的核对结果。
   *
   * 分镜页用它显示代码数出来的时长/景别配比——模型自检栏写的数字不可信，
   * 实测里它声称「总时长 60s（已对账）」而表格实际只有 55s。
   * 做成插槽而不是写死在这里：别的板块的核对项各不相同。
   */
  footer?: React.ReactNode;
  /** 给正文额外的排版（接在 prose 后面）。拆解爆款用它把每个镜头的四级标题排成卡片头 */
  bodyClassName?: string;
  flowContext?: CreationContext;
  individualPlans?: boolean;
  /** 按配比出的（选题、方向）：生成完体检时核对条数 */
  qualityMix?: { resolved: ResolvedMix; count: number } | null;
}) {
  // 拆分与统计只依赖 result，用 memo 避免流式输出时逐字符重算
  const pathname = usePathname();
  const supportsCreationLinks = Boolean(CREATION_SOURCES[pathname?.split('/')[2] || '']);
  const { body, report, stats, quality } = useMemo(() => {
    const split = splitQualityReport(result);
    return {
      body: split.body,
      report: split.report,
      stats: estimateSpeechStats(split.body),
      quality: parseQualitySummary(split.report),
    };
  }, [result]);
  const planParts = useMemo(() => individualPlans ? splitRemixPlans(body) : null, [body, individualPlans]);
  /*
   * 结果里有「纯文字文案」这一节（脚本生成、审稿优化都有）就在顶部给「复制纯文案」：
   * 只要念出来的话，去提词器、配音、发给出镜的人。
   * 原来这个按钮是脚本页传进来的 nextActions，有了「继续创作」之后 nextActions 不再显示，按钮跟着没了
   */
  const plainCopy = useMemo(() => (isGenerating ? '' : extractPlainCopy(body)), [body, isGenerating]);
  const proseClassName = `prose prose-slate dark:prose-invert max-w-none prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-xl prose-h2:text-[17px] prose-h3:text-[15px] prose-p:text-[14px] prose-p:leading-[1.85] prose-li:text-[14px] prose-strong:text-foreground prose-hr:border-border/60 ${bodyClassName ?? ''}`;

  /*
   * 手机上结果在表单下面：点了生成，得把人带到结果那儿，
   * 不然看到的还是表单，以为"点了没反应"。电脑上左右排，结果本来就看得见，不动。
   */
  const wasGenerating = useRef(false);
  useEffect(() => {
    if (isGenerating && !wasGenerating.current && window.innerWidth < 1024) {
      document.getElementById("workspace-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    wasGenerating.current = isGenerating;
  }, [isGenerating]);

  /*
   * 自动质检（lib/quality-checks）：这一次生成刚写完就体检一遍、报给后台。
   * 只在"生成中 → 写完"那一下报——刷新后恢复出来的旧结果不算新生成
   */
  const { context: qualityCtx } = useCreatorContext();
  const generatingBefore = useRef(false);
  useEffect(() => {
    if (generatingBefore.current && !isGenerating && body) {
      const seg = pathname?.split('/')[2] || '';
      reportQuality({ taskType: CREATION_SOURCES[seg] || seg || '生成', output: body, profile: qualityCtx.profile, mix: qualityMix });
    }
    generatingBefore.current = isGenerating;
  }, [isGenerating, body, pathname, qualityCtx.profile, qualityMix]);

  if (!result && !isGenerating) {
    return (
      <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} tips={emptyTips} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>

          {isGenerating ? (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              创作中
            </span>
          ) : (
            showStats &&
            stats.chars > 0 && (
              <div className="flex items-center gap-1.5">
                <Stat icon={Type} text={`${stats.chars} 字`} />
                <Stat icon={Clock} text={`约 ${formatDuration(stats.seconds)}`} />
              </div>
            )
          )}
        </div>

        {body && !isGenerating && (
          <div className="flex gap-2">
            {supportsCreationLinks && <ActionButton icon={ArrowDown} label="继续创作" onClick={() => document.getElementById(individualPlans ? "remix-continuation" : "creation-links")?.scrollIntoView({ behavior: "smooth", block: "start" })} />}
            {onContinue && <ActionButton icon={MessageCircle} label="继续对话" onClick={onContinue} />}
            {/* 复制与下载只取正文，不含质量报告 */}
            {plainCopy && <ActionButton icon={FileText} label="复制纯文案" onClick={() => { navigator.clipboard?.writeText(plainCopy); notify("纯文案已复制：只有要念的话，可以直接贴进提词器"); }} />}
            {onCopy && <ActionButton icon={Copy} label="复制" onClick={() => onCopy(body)} />}
            {onDownload && <ActionButton icon={Download} label="下载" onClick={() => onDownload(body)} />}
          </div>
        )}
      </div>

      {planParts && !isGenerating && planParts.plans.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2" aria-label="二创方案目录">
            {planParts.plans.map((plan, i) => <button key={plan.id} type="button" className="glass-panel glass-interactive rounded-lg px-3 py-1.5 text-[12px] text-primary" onClick={() => document.getElementById(`remix-${plan.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看方案 {i + 1}</button>)}
          </div>
          {planParts.intro && <article className="glass-panel rounded-2xl px-4 py-5 sm:px-7 sm:py-6"><div className={proseClassName}><Markdown>{planParts.intro}</Markdown></div></article>}
          {planParts.plans.map(plan => <article key={plan.id} id={`remix-${plan.id}`} className="glass-panel scroll-mt-4 rounded-2xl px-4 py-5 sm:px-7 sm:py-6">
            <div className={proseClassName}><Markdown>{plan.body}</Markdown></div>
          </article>)}
          {planParts.footer && <article className="glass-panel rounded-2xl px-4 py-5 sm:px-7 sm:py-6"><div className={proseClassName}><Markdown>{planParts.footer}</Markdown></div></article>}
        </>
      ) : body ? (
        <article className="glass-panel rounded-2xl px-4 py-5 sm:px-7 sm:py-6">
          <div
            className={`prose prose-slate dark:prose-invert max-w-none
                       prose-headings:tracking-tight prose-headings:font-semibold
                       prose-h1:text-xl prose-h2:text-[17px] prose-h3:text-[15px]
                       prose-p:text-[14px] prose-p:leading-[1.85] prose-li:text-[14px]
                       prose-strong:text-foreground prose-hr:border-border/60 ${bodyClassName ?? ""}`}
          >
            <Markdown>{body}</Markdown>
          </div>

          {isGenerating && (
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
          )}
        </article>
      ) : (
        <div className="glass-panel flex min-h-[200px] items-center justify-center rounded-2xl">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-[13px] text-muted-foreground">{generatingHint}</p>
          </div>
        </div>
      )}

      {showQuality && report && !isGenerating && <QualityCard report={report} quality={quality} />}

      {/* 各页面自己的核对结果。紧跟正文，因为它说的就是上面这份内容对不对 */}
      {body && !isGenerating && footer}
      {/* 禁忌兜底：平台红线 + 行业禁忌词（lib/taboos），命中了就标出来 */}
      {body && !isGenerating && <TabooScan body={body} onContinue={onContinue} />}
      {/*
       * 继续创作 / 收藏：放在正文底部（2026-10-02 产品方要求）。原来在正文上面，
       * 用户读完往下找下一步找不到；而且顶部那时还没读内容，不知道该勾哪几条。
       * 顶部按钮排里留了一个「继续创作 ↓」跳到这里，结果很长时也找得到。
       */}
      {body && !isGenerating && !individualPlans && <div id="creation-links" className="scroll-mt-4"><CreationLinks body={body} context={flowContext} /></div>}
      {body && !isGenerating && planParts && <RemixContinuation body={body} plans={planParts.plans} context={flowContext} />}

      {/* 接下来：放在正文之后，因为它是「读完再决定」的动作，
          摆在顶部会和复制下载抢位置，也不符合阅读顺序 */}
      {body && !isGenerating && !individualPlans && !supportsCreationLinks && nextActions && nextActions.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
            接下来
          </p>
          <div className="flex flex-wrap gap-2">
            {nextActions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => a.onClick(body)}
                className="glass-panel glass-interactive group flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-foreground"
              >
                <a.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                {a.label}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground">内容会自动带过去，不用复制</p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
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
  icon: LucideIcon;
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

/** 分数用横条表示——读「9.0 / 10.0」要在脑子里换算，看条子一眼就有概念 */
function QualityCard({
  report,
  quality,
}: {
  report: string;
  quality: ReturnType<typeof parseQualitySummary>;
}) {
  const score = quality.score;
  const pct = score !== null ? Math.max(0, Math.min(100, score * 10)) : 0;
  const tone = score === null ? "muted" : score >= 9 ? "emerald" : score >= 8 ? "amber" : "rose";

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
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
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

      <div
        className="prose prose-slate dark:prose-invert max-w-none
                   prose-p:text-[12px] prose-li:text-[12px] prose-li:leading-relaxed
                   prose-h2:hidden prose-h3:text-[12px] prose-h3:mt-3 prose-h3:mb-1.5
                   prose-h3:text-muted-foreground prose-strong:text-foreground"
      >
        <Markdown>{report}</Markdown>
      </div>
    </div>
  );
}
