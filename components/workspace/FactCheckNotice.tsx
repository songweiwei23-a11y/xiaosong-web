"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, Wand2 } from "lucide-react";
import { runQualityChecks } from "@/lib/quality-checks";
import { postSafely } from "@/lib/safe-post";
import { notify } from "@/components/ui/feedback";

/**
 * 「⚠️ 这几处请核对」（2026-10-05 质量整改）。
 *
 * 原来关键事实核对（lib/quality-checks）只报给后台看板，用户在结果页上什么都看不到，
 * 看到的反而是模型自己写的「自检通过、无编造」。现在只要查到了就显示在结果下面：最多 5 条、可以收起；
 * 「按资料修正」只改这几句（lib/fact-fix），改完存成画布里新的一版，再核对一遍。
 * 没查到就不出现，不打扰。
 */
export const NOTICE_MAX = 5;

export function FactCheckNotice({ text, taskType, profile, source, context, onFix, autoFix = false, autoKey }: {
  text: string;
  taskType: string;
  profile: object | null | undefined;
  source?: string | null;
  /** 账号背景：修正时事实以它为准 */
  context?: string;
  /** 采用修正后的稿子（存成画布新版本）；不传就只提示、不给修正按钮 */
  onFix?: (fixed: string) => Promise<boolean>;
  /**
   * 刚生成完就自动修正一次（2026-10-05 现状研究：事后提醒靠用户自己看，不看就直接发出去了）。
   * 只对刚生成的结果开（翻历史、刷新恢复的不自动跑，免得重复花钱）；同一份原稿只自动修一次
   */
  autoFix?: boolean;
  /** 原稿的标识：变了（重新生成）才会再自动修 */
  autoKey?: string;
}) {
  const issues = useMemo(() => runQualityChecks({ output: text, profile, taskType, source })
    .issues.filter((i) => i.kind === "facts" || i.kind === "years")
    .map((i) => (i.kind === "years" ? `年限${i.detail}` : i.detail)), [text, profile, taskType, source]);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState<{ key: string; state: 'running' | 'done' | 'failed'; count: number } | null>(null);
  const autoTried = useRef<string | null>(null);

  const fix = async (silent = false, list: string[] = issues): Promise<boolean> => {
    if (!onFix || busy) return false;
    setBusy(true);
    try {
      const res = await postSafely("/api/fact-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, issues: list, context, auto: silent, taskType }),
      });
      let fixed = "";
      if ((res.headers.get("content-type") || "").includes("text/event-stream")) {
        const last = (await res.text()).split("\n").filter((l) => l.startsWith("data: ")).at(-1);
        const d = last ? JSON.parse(last.slice(6)) : null;
        if (!d || d.event === "error") throw new Error(d?.message || "这次没改成，请重试");
        fixed = String(d.text || "");
      } else {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "这次没改成，请重试");
      }
      return await onFix(fixed);
    } catch (e) {
      if (!silent) notify((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  /*
   * 只有把握大的问题才自动改（2026-10-09 全板块实测：脚本里 4 条提醒全是误报——「餐桌区」当地名、「语速慢 20%」当数据——
   * 自动修正被它们触发，把有用的拍摄路线删成了「不同区域」，真错误反而没动）。地名这类把握小的只提示，不自动动手
   */
  const autoIssues = issues.filter((i) => !/^地名「/.test(i));
  useEffect(() => {
    if (!autoFix || !onFix || !autoKey || !autoIssues.length || autoTried.current === autoKey) return;
    autoTried.current = autoKey;
    const count = autoIssues.length;
    setAuto({ key: autoKey, state: 'running', count });
    void fix(true, autoIssues).then((ok) => setAuto({ key: autoKey, state: ok ? 'done' : 'failed', count }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFix, autoKey, issues.length]);

  const autoBanner = auto && auto.key === autoKey && (
    <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-foreground">
      {auto.state === 'running' ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />发现 {auto.count} 处资料里找不到出处的说法，正在按资料自动修正……</>
        /*
         * 2026-10-07 体检 B03：原来写「已自动修正 X 处」，X 是改之前查出的数——并不证明这 X 处都改好了。
         * 现在说「按资料改写了」，后半句用改完重新核对的结果
         */
        : auto.state === 'done' ? (issues.length
          ? <>已按资料改写，重新核对后还有 {issues.length} 处待你确认（见下面；原稿在画布里还能看到）</>
          : <>✅ 已按资料改写，重新核对没再发现找不到出处的说法（原稿在画布里还能看到）</>)
        : <>自动修正没成功，下面这几处请你核对</>}
    </p>
  );
  if (!issues.length) return auto?.state === 'done' && auto.key === autoKey ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">{autoBanner}</div> : null;

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-4 sm:p-5">
      {autoBanner}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="flex-1 text-[13px] font-medium text-foreground">这几处请核对：账号资料和素材里找不到出处（{issues.length} 处）</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <ul className="mt-2.5 space-y-1.5">
            {issues.slice(0, NOTICE_MAX).map((i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-foreground/90"><span className="text-amber-600 dark:text-amber-400">·</span><span>{i}</span></li>
            ))}
          </ul>
          {issues.length > NOTICE_MAX && <p className="mt-1 text-[11.5px] text-muted-foreground">还有 {issues.length - NOTICE_MAX} 处，修正后会再核对一遍</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {onFix && (
              <button type="button" onClick={() => void fix()} disabled={busy || auto?.state === "running"}
                className="inline-flex items-center gap-1.5 rounded-lg brand-gradient px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}{busy ? "正在修正…" : "按资料修正"}
              </button>
            )}
            <span className="text-[11.5px] text-muted-foreground">
              是真的就不用管（比如你口头告诉过它的）；{onFix ? "点「按资料修正」只改这几句，其余不动，不扣次数" : "不是真的，在画布里改掉再发"}。
            </span>
          </div>
        </>
      )}
    </div>
  );
}
