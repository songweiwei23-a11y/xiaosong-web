"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from 'next/navigation';
import { Markdown } from "@/components/markdown";
import { Copy, Download, Loader2, MessageCircle, Clock, Type, ArrowRight, ArrowDown, FileText, PenLine, type LucideIcon } from "lucide-react";
import { ResultCanvas } from '@/components/chat/ResultCanvas';
import { addVersion, type CanvasVersion } from '@/lib/canvas';
import { CANVAS_TASK_BY_BOARD, saveResultVersions } from '@/lib/result-versions';
import { getActiveProfileId } from '@/lib/active-profile';
import { buildContextBlock, type ContextModule } from '@/lib/creator-context';
import { notify } from "@/components/ui/feedback";
import { extractPlainCopy } from "@/lib/script-copy";
import {
  splitQualityReport,
  parseQualitySummary,
  displayQualityReport,
  resultStats,
  formatDuration,
} from "@/lib/script-result-utils";
import { EmptyState } from "./EmptyState";
import { CreationLinks } from './CreationLinks';
import { RemixContinuation } from './RemixContinuation';
import type { CreationContext } from '@/lib/creation-flow';
import { CREATION_SOURCES } from '@/lib/creation-flow';
import { splitRemixPlans } from '@/lib/remix-plans';
import { TabooScan } from './TabooScan';
import { FactCheckNotice } from './FactCheckNotice';
import { stripSelfCert } from '@/lib/self-cert';
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { PreferenceHint } from '@/components/preferences/PreferenceHint';
import { reportQuality } from '@/lib/quality-report';
import { buildFactFixContext, factCheckCreationSource } from '@/lib/fact-fix';
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
/** 画布改写时带哪个板块的账号背景（口吻、禁忌） */
const CONTEXT_BOARD: Record<string, ContextModule> = {
  topic: 'topic', script: 'script', storyboard: 'storyboard', review: 'review', title: 'title',
  growth: 'growth', remix: 'remix', breakdown: 'breakdown', direction: 'direction', 'deal-reason': 'dealReason',
};

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
  canvasTaskType,
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
  /** 画布版本存成哪种任务的记录；不传按板块定（开篇页一页两种任务，自己传） */
  canvasTaskType?: string;
}) {
  // 拆分与统计只依赖 result，用 memo 避免流式输出时逐字符重算
  const pathname = usePathname();
  const supportsCreationLinks = Boolean(CREATION_SOURCES[pathname?.split('/')[2] || '']);
  const { body, report, stats, quality } = useMemo(() => {
    const split = splitQualityReport(result);
    // 模型自称「自检通过 / 无虚构」一律删掉再展示、复制、带去下一步（lib/self-cert）：它不可信，真假以程序核对为准
    const cleanBody = stripSelfCert(split.body);
    return {
      body: cleanBody,
      report: split.report,
      stats: resultStats(cleanBody),
      quality: parseQualitySummary(split.report),
    };
  }, [result]);
  /*
   * 结果画布（2026-10-04 接入各创作板块）：直接改、选中一段让 AI 改、锁定原文、比较版本。
   * 保存的版本存成一条「画布改稿」历史记录（lib/result-versions），之后这里显示、复制、继续创作都用最新一版；
   * 重新生成了新结果，画布和改稿状态跟着清掉。
   */
  const segment = pathname?.split('/')[2] || '';
  const canvasTask = canvasTaskType ?? CANVAS_TASK_BY_BOARD[segment];
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvas, setCanvas] = useState<{ base: string; id: string | null; versions: CanvasVersion[] } | null>(null);
  const adopted = canvas && canvas.base === body && canvas.versions.length > 1 ? canvas.versions[canvas.versions.length - 1].content : null;
  const view = adopted ?? body;
  useEffect(() => { if (isGenerating) setCanvasOpen(false); }, [isGenerating]);
  const openCanvas = () => {
    if (!canvas || canvas.base !== body) setCanvas({ base: body, id: null, versions: [{ content: body, at: Date.now(), note: '生成稿' }] });
    setCanvasOpen(true);
  };
  const saveCanvas = async (versions: CanvasVersion[]): Promise<boolean> => {
    if (!canvas || !canvasTask) return false;
    try {
      const id = await saveResultVersions({
        id: canvas.id, taskType: canvasTask, workId: flowContext?.workId ?? null, profileId: getActiveProfileId(), versions,
        base: { creationSettings: flowContext?.settings, originContent: flowContext?.originContent },
      });
      setCanvas({ base: canvas.base, id, versions });
      return true;
    } catch (e) {
      notify((e as Error).message, 'error');
      return false;
    }
  };
  /** 「按资料修正」改好的稿子：存成画布里新的一版（原稿还在，能对比、能退回） */
  const adoptFix = async (fixed: string): Promise<boolean> => {
    if (!canvasTask) return false;
    const same = !!canvas && canvas.base === body;
    const base: CanvasVersion[] = same ? canvas!.versions : [{ content: body, at: Date.now(), note: '生成稿' }];
    const versions = addVersion(base, fixed, '按资料修正');
    try {
      const id = await saveResultVersions({
        id: same ? canvas!.id : null, taskType: canvasTask, workId: flowContext?.workId ?? null, profileId: getActiveProfileId(), versions,
        base: { creationSettings: flowContext?.settings, originContent: flowContext?.originContent },
      });
      setCanvas({ base: body, id, versions });
      notify('已按资料修正，存成新的一版；原稿在画布里还能看到');
      return true;
    } catch (e) {
      notify((e as Error).message, 'error');
      return false;
    }
  };
  const planParts = useMemo(() => individualPlans ? splitRemixPlans(view) : null, [view, individualPlans]);
  /*
   * 结果里有「纯文字文案」这一节（脚本生成、审稿优化都有）就在顶部给「复制纯文案」：
   * 只要念出来的话，去提词器、配音、发给出镜的人。
   * 原来这个按钮是脚本页传进来的 nextActions，有了「继续创作」之后 nextActions 不再显示，按钮跟着没了
   */
  const plainCopy = useMemo(() => (isGenerating ? '' : extractPlainCopy(view)), [view, isGenerating]);
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
  /** 刚生成完的那份原稿：只对它自动按资料修正（翻历史、刷新恢复的不自动跑） */
  const [freshBody, setFreshBody] = useState<string | null>(null);
  useEffect(() => {
    if (generatingBefore.current && !isGenerating && body) {
      const seg = pathname?.split('/')[2] || '';
      reportQuality({ taskType: CREATION_SOURCES[seg] || seg || '生成', output: body, profile: qualityCtx.profile, mix: qualityMix, source: flowContext?.originContent });
      setFreshBody(body);
    }
    generatingBefore.current = isGenerating;
  }, [isGenerating, body, pathname, qualityCtx.profile, qualityMix, flowContext?.originContent]);

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
            stats.totalChars > 0 && (
              <div className="flex items-center gap-1.5">
                {/* 整份字数和真正要念的分开（2026-10-07 体检 B01）：认不出台词就不估时长 */}
                <Stat icon={Type} text={stats.spokenChars ? `口播 ${stats.spokenChars} 字` : `${stats.totalChars} 字`} />
                {stats.spokenChars > 0 && <Stat icon={Clock} text={`念完约 ${formatDuration(stats.seconds)}`} />}
              </div>
            )
          )}
        </div>

        {body && !isGenerating && (
          <div className="flex gap-2">
            {supportsCreationLinks && <ActionButton icon={ArrowDown} label="继续创作" onClick={() => document.getElementById(individualPlans ? "remix-continuation" : "creation-links")?.scrollIntoView({ behavior: "smooth", block: "start" })} />}
            {canvasTask && supportsCreationLinks && <ActionButton icon={PenLine} label={adopted ? `画布第 ${canvas!.versions.length} 版` : "在画布里改"} onClick={openCanvas} />}
            {onContinue && <ActionButton icon={MessageCircle} label="继续对话" onClick={onContinue} />}
            {/* 复制与下载只取正文，不含质量报告；在画布里改过的取最新一版 */}
            {plainCopy && <ActionButton icon={FileText} label="复制纯文案" onClick={() => { navigator.clipboard?.writeText(plainCopy); notify("纯文案已复制：只有要念的话，可以直接贴进提词器"); }} />}
            {onCopy && <ActionButton icon={Copy} label="复制" onClick={() => onCopy(view)} />}
            {onDownload && <ActionButton icon={Download} label="下载" onClick={() => onDownload(view)} />}
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
          {adopted && !isGenerating && (
            <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-primary">
              <PenLine className="h-3.5 w-3.5" />这是在画布里改过的第 {canvas!.versions.length} 版（已保存），复制、继续创作都用这一版
              <button type="button" onClick={openCanvas} className="underline">打开画布</button>
            </p>
          )}
          <div
            className={`prose prose-slate dark:prose-invert max-w-none
                       prose-headings:tracking-tight prose-headings:font-semibold
                       prose-h1:text-xl prose-h2:text-[17px] prose-h3:text-[15px]
                       prose-p:text-[14px] prose-p:leading-[1.85] prose-li:text-[14px]
                       prose-strong:text-foreground prose-hr:border-border/60 ${bodyClassName ?? ""}`}
          >
            <Markdown>{view}</Markdown>
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

      {/* 这几处请核对（2026-10-05）：资料里找不到出处的价格、百分比、见证、承诺……查到才出现 */}
      {body && !isGenerating && (
        <FactCheckNotice
          text={view}
          taskType={CREATION_SOURCES[segment] || segment}
          profile={qualityCtx.profile}
          source={factCheckCreationSource(flowContext)}
          context={buildFactFixContext(flowContext, buildContextBlock(qualityCtx, CONTEXT_BOARD[segment] ?? 'script'))}
          onFix={canvasTask ? adoptFix : undefined}
          autoFix={!!canvasTask && freshBody === body}
          autoKey={body}
        />
      )}
      {showQuality && report && !isGenerating && <QualityCard report={report} quality={quality} />}

      {/* 各页面自己的核对结果。紧跟正文，因为它说的就是上面这份内容对不对 */}
      {body && !isGenerating && footer}
      {/* 禁忌兜底：平台红线 + 行业禁忌词（lib/taboos），命中了就标出来 */}
      {/* 我的创作偏好：这次按哪些偏好写的（lib/preferences），写稿类板块才有 */}
      {body && !isGenerating && <PreferenceHint board={CONTEXT_BOARD[segment] ?? 'script'} />}
      {body && !isGenerating && <TabooScan body={view} onContinue={onContinue} />}
      {/*
       * 继续创作 / 收藏：放在正文底部（2026-10-02 产品方要求）。原来在正文上面，
       * 用户读完往下找下一步找不到；而且顶部那时还没读内容，不知道该勾哪几条。
       * 顶部按钮排里留了一个「继续创作 ↓」跳到这里，结果很长时也找得到。
       */}
      {body && !isGenerating && !individualPlans && <div id="creation-links" className="scroll-mt-4"><CreationLinks body={view} context={flowContext} /></div>}
      {body && !isGenerating && planParts && <RemixContinuation body={view} plans={planParts.plans} context={flowContext} />}

      {/* 画布：右侧抽屉（手机全屏）。关掉时有未保存修改会先确认，草稿留在本机 */}
      {canvasOpen && canvas && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <ResultCanvas
            versions={canvas.versions}
            onChange={saveCanvas}
            onClose={() => setCanvasOpen(false)}
            profileContext={buildContextBlock(qualityCtx, CONTEXT_BOARD[segment] ?? 'script')}
            profileId={getActiveProfileId()}
            creationContext={flowContext}
            draftKey={`result:${segment}:${canvas.base.length}:${canvas.base.slice(0, 40)}`}
          />
        </div>
      )}

      {/* 接下来：放在正文之后，因为它是「读完再决定」的动作，
          摆在顶部会和复制下载抢位置，也不符合阅读顺序 */}
      {body && !isGenerating && !individualPlans && !supportsCreationLinks && nextActions && nextActions.length > 0 && (
        // 只有不支持「继续创作」的板块才显示这一排；传给按钮的是最新一版
        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
            接下来
          </p>
          <div className="flex flex-wrap gap-2">
            {nextActions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => a.onClick(view)}
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

/**
 * 结构检查（2026-10-05 质量整改）：原来显示「9.0 / 10 · MCN级 · 达标」。那个分只看格式要素齐不齐，
 * 没经过编导校准、不核对事实，包装成分数和等级给了过强的可信感。现在只说格式要素齐不齐、还缺哪几项；
 * 事实核对在正文下面另一块（FactCheckNotice）。旧记录里的分数、等级也不再显示。
 */
function QualityCard({
  report,
  quality,
}: {
  report: string;
  quality: ReturnType<typeof parseQualitySummary>;
}) {
  const label = quality.structure || (quality.passed ? "格式要素基本齐全" : "有待补的格式要素");
  const ok = /齐全/.test(label);
  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-foreground">结构检查</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${ok ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>{label}</span>
      </div>
      <p className="mb-3 text-[11.5px] text-muted-foreground">只看钩子、金句、秒数、镜头这些格式要素齐不齐，不代表内容好坏，也不核对事实。</p>

      <div
        className="prose prose-slate dark:prose-invert max-w-none
                   prose-p:text-[12px] prose-li:text-[12px] prose-li:leading-relaxed
                   prose-h2:hidden prose-h3:text-[12px] prose-h3:mt-3 prose-h3:mb-1.5
                   prose-h3:text-muted-foreground prose-strong:text-foreground"
      >
        <Markdown>{displayQualityReport(report)}</Markdown>
      </div>
    </div>
  );
}
