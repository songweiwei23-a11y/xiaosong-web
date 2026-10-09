"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarRange, Loader2, Wand2 } from "lucide-react";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, TEXTAREA_CLS, GENERATE_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel, type HistoryItem } from "@/components/workspace/HistoryPanel";
import { ContentMixBar } from "@/components/workspace/ContentMix";
import { notify } from "@/components/ui/feedback";
import { useGenerationPage } from "@/hooks/useGenerationPage";
import { useRestoreLastResult } from "@/hooks/useRestoreLastResult";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { useCreativeHistory } from "@/hooks/useCreativeHistory";
import { useProfileRequestGuard } from "@/hooks/useProfileRequestGuard";
import { checkQuota } from "@/lib/history";
import { createHistoryId } from "@/lib/history-id";
import { openUpgrade } from "@/lib/upgrade";
import { isNetworkError, NETWORK_ERROR_HINT, throwApiError, fetchGeneration } from "@/lib/api-error";
import { readDifyStream } from "@/lib/sse-stream";
import { asText, buildProfileSummary, businessLines } from "@/lib/profile-summary";
import { buildContextBlock } from "@/lib/creator-context";
import { resolveMix, readSetting, type MixSetting, type ResolvedMix } from "@/lib/content-mix";
import { listWorksPage } from "@/lib/works";
import {
  CONTENT_PLAN_TASK_TYPE, LAST_MONTH_OPTIONS, MONTH_COUNT_OPTIONS, PLAN_FOCUS,
  buildContentPlanPrompt, checkPlan, lastMonthPublished, monthLabel, suggestMonthCount, type LastMonthId,
} from "@/lib/content-plan";

/** 生成完核对：方向条数加起来对不对、每种目的对不对 */
function PlanCheckLine({ text, resolved, count }: { text: string; resolved: ResolvedMix; count: number }) {
  const c = checkPlan(text, resolved, count);
  if (!c.counted) return null;
  return (
    <p className={`text-[12px] ${c.ok ? "text-emerald-600" : "text-amber-600"}`}>
      {c.ok
        ? `✓ ${c.directions} 个方向共 ${c.sum} 条，配比对上了（${c.summary}）`
        : `配比没完全对上：方向加起来 ${c.sum} 条（${c.summary}），要的是 ${count} 条（${c.expected}）。可以重新生成，或者在下一步选题时按需要调条数`}
    </p>
  );
}

/**
 * 当月内容规划（2026-10-09 新板块）：上个月发了多少 → 这个月发几条 → 按配比分到几个内容方向（只定类型、方向、目的）→
 * 勾选方向，带去创作方向 / 选题 / 脚本接着做（结果下面的「继续创作」）。提示词见 lib/content-plan.ts。
 */
export default function ContentPlanPage() {
  const beginProfileRequest = useProfileRequestGuard();
  const { history, loadHistory, deleteHistory, lastResult, resultScope } = useGenerationPage({ taskType: CONTENT_PLAN_TASK_TYPE });
  const { context, loading: ctxLoading } = useCreatorContext();
  const { saveCreativeHistory, saveError, retrySave, getHistoryOwner } = useCreativeHistory(loadHistory);
  const profile = context.profile as Record<string, unknown> | null;
  const lines = profile ? businessLines(profile) : [];
  const track = profile ? asText(profile.account_track) : "";

  const [lastMonth, setLastMonth] = useState<LastMonthId | "">("");
  const [recorded, setRecorded] = useState<number | null>(null);
  const [count, setCount] = useState(8);
  const [countTouched, setCountTouched] = useState(false);
  const [focus, setFocus] = useState<string[]>([]);
  const [events, setEvents] = useState("");
  const [notes, setNotes] = useState("");
  const [industry, setIndustry] = useState("");
  const [mixOverride, setMixOverride] = useState<MixSetting | null>(null);
  const [planUsed, setPlanUsed] = useState<{ resolved: ResolvedMix; count: number } | null>(null);
  const goalText = [focus.map((id) => PLAN_FOCUS.find((f) => f.id === id)?.label).join("、"), events, notes].filter(Boolean).join("；");
  const resolvedMix = resolveMix(profile, mixOverride, goalText);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const restoredScope = useRef<string>();

  // 系统里录过的上个月已发布作品：有就帮他勾上对应的区间（他可以改）
  useEffect(() => {
    if (!resultScope) return;
    let alive = true;
    listWorksPage({ group: "published", limit: 100 })
      .then((works) => {
        if (!alive) return;
        const n = lastMonthPublished(works);
        setRecorded(works.length ? n : null);
        if (works.length && !lastMonth) {
          const opt = n === 0 ? "0" : n <= 4 ? "1-4" : n <= 8 ? "5-8" : n <= 12 ? "9-12" : n <= 20 ? "13-20" : "21+";
          setLastMonth(opt);
          if (!countTouched) setCount(suggestMonthCount(opt));
        }
      })
      .catch(() => { if (alive) setRecorded(null); });
    return () => { alive = false; };
    // 只在换档案时重取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultScope]);

  const pickLastMonth = (id: LastMonthId) => {
    setLastMonth(id);
    if (!countTouched) setCount(suggestMonthCount(id));
  };

  const restoreHistory = (item: HistoryItem) => {
    const d = (item.input_data ?? {}) as Record<string, unknown>;
    setResult(item.result);
    if (typeof d.lastMonth === "string" && LAST_MONTH_OPTIONS.some((o) => o.id === d.lastMonth)) setLastMonth(d.lastMonth as LastMonthId);
    if (typeof d.count === "number" && d.count > 0) { setCount(d.count); setCountTouched(true); }
    if (Array.isArray(d.focus)) setFocus(d.focus.map(String));
    if (typeof d.events === "string") setEvents(d.events);
    if (typeof d.notes === "string") setNotes(d.notes);
    const mix = readSetting(d.mixOverride);
    setMixOverride(mix);
    if (typeof d.count === "number") setPlanUsed({ resolved: resolveMix(profile, mix, goalText), count: d.count });
  };

  // 切页面回来：结果和当时的选择一起取回来
  useEffect(() => {
    if (!resultScope || !lastResult || !history[0] || restoredScope.current === resultScope) return;
    restoredScope.current = resultScope;
    if (!running && (!result || result === lastResult)) restoreHistory(history[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultScope, lastResult, history, running, result]);
  useRestoreLastResult(lastResult, setResult, resultScope);

  const start = async () => {
    if (running) return;
    if (ctxLoading) { notify("正在读取当前档案，稍等一秒再点"); return; }
    if (!lastMonth) { notify("先勾一下上个月发了多少条", "error"); return; }
    if (!count || count < 1 || count > 60) { notify("这个月发几条：填 1 到 60 之间的数", "error"); return; }
    const isCurrent = beginProfileRequest();
    setRunning(true);
    const historyOwnerId = await getHistoryOwner();
    const left = await checkQuota("direction");
    if (!isCurrent()) { setRunning(false); return; }
    if (left !== null && left <= 0) { openUpgrade("direction"); setRunning(false); return; }
    setResult("");
    const historyInput = { lastMonth, recordedLastMonth: recorded, count, focus, events, notes, mixOverride, month: monthLabel(), profileId: profile?.id ?? null, profileName: profile?.profile_name ?? null, contentMix: resolvedMix.mix };
    try {
      const historyId = createHistoryId();
      const query = buildContentPlanPrompt({
        lastMonth, recordedLastMonth: recorded, count, focus, events, notes, resolved: resolvedMix,
        profileSummary: profile ? buildProfileSummary(profile) : undefined,
        // 和创作方向读同一份账号记忆：简报、成交理由、禁忌、发布后的数据
        contextBlock: buildContextBlock(context, "direction"),
        industry: profile ? undefined : industry,
      });
      setPlanUsed({ resolved: resolvedMix, count });
      const userIntent = [events, notes].filter(Boolean).join("\n");
      const res = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: CONTENT_PLAN_TASK_TYPE, query, profileId: profile ? (profile.id as string) : null, historyId, historyInput, historyOwnerId, creationSettings: userIntent ? { userIntent, notes } : {} }),
      });
      if (!res.ok) await throwApiError(res, "生成失败");
      const full = await readDifyStream(res, {
        onChunk: (_p, text) => { if (isCurrent()) setResult(text); },
        onRecovering: () => notify("网络断了一下，AI 那边还在写，写完会自动取回，请别关页面"),
      });
      if (full.trim()) {
        await saveCreativeHistory({ id: historyId, taskType: CONTENT_PLAN_TASK_TYPE, profileId: (profile?.id as string) || null, ownerId: historyOwnerId, inputData: historyInput, result: full });
      }
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message || "生成失败，请重试", "error");
    } finally {
      setRunning(false);
    }
  };

  const toggleFocus = (id: string) => setFocus((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="当月内容规划" subtitle="定这个月发几条、怎么配比、分哪几个方向；勾选方向，接着去出方向思路、选题或脚本" />

          {saveError && <p role="alert" className="mb-2 text-[12px] text-amber-600">{saveError} <button type="button" className="underline" onClick={() => void retrySave()}>重试保存</button></p>}
          <CollapsibleSection title={`历史记录（${history.length}）`} defaultOpen={false}>
            {history.length === 0 && <p className="mb-2 text-[12px] text-muted-foreground">当前档案还没有记录，生成成功后会自动保存。</p>}
            <HistoryPanel items={history} title="做过的规划" showStats={false} onLoad={restoreHistory} onDelete={(id) => deleteHistory(id)} />
          </CollapsibleSection>

          <CollapsibleSection title="1. 上个月发了多少条" defaultOpen>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="上个月发了多少条">
              {LAST_MONTH_OPTIONS.map((o) => (
                <button key={o.id} type="button" onClick={() => pickLastMonth(o.id)} aria-pressed={lastMonth === o.id} className={chipCls(lastMonth === o.id)}>{o.label}</button>
              ))}
            </div>
            {recorded !== null && (
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                「创作进度」里记录上个月发布了 {recorded} 条{recorded > 0 ? "，录了数据的会一起拿来参考" : ""}。没记全的按实际情况勾。
              </p>
            )}
          </CollapsibleSection>

          <CollapsibleSection title={`2. ${monthLabel()}发几条`} defaultOpen>
            <div className="flex flex-wrap items-center gap-1.5">
              {MONTH_COUNT_OPTIONS.map((n) => (
                <button key={n} type="button" onClick={() => { setCount(n); setCountTouched(true); }} aria-pressed={count === n} className={chipCls(count === n)}>{n} 条</button>
              ))}
              <input type="number" min={1} max={60} aria-label="自己填条数" value={count}
                onChange={(e) => { setCount(Math.max(0, Math.min(60, Number(e.target.value) || 0))); setCountTouched(true); }}
                className={`${INPUT_CLS} w-20`} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">一周约 {Math.max(1, Math.round(count / 4))} 条。{!countTouched && lastMonth ? "按上个月的量推荐的，可以改" : "定一个能坚持下来的量，比定得多发不出来有用"}</p>
            <Field label="怎么配比" stacked hint="条数按配比分到流量型、人设型、变现型">
              <ContentMixBar className="mt-1" profile={profile} override={mixOverride} onOverride={setMixOverride} count={count} goal={goalText} />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="3. 这个月的重点（选填）" defaultOpen={false}>
            <Field label="主攻什么（可多选）" stacked>
              <div className="flex flex-wrap gap-1.5">
                {PLAN_FOCUS.map((f) => <button key={f.id} type="button" title={f.hint} onClick={() => toggleFocus(f.id)} aria-pressed={focus.includes(f.id)} className={chipCls(focus.includes(f.id))}>{f.label}</button>)}
              </div>
            </Field>
            <Field label="这个月有什么安排、节点" optional stacked>
              <textarea value={events} onChange={(e) => setEvents(e.target.value)} rows={2} className={TEXTAREA_CLS} placeholder="例如：中旬上新一批沙发；月底店庆；国庆后客流少" />
            </Field>
            <Field label="其他要求" optional stacked>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={TEXTAREA_CLS} placeholder="例如：老板不想出镜太多；不想拍成甩卖降价" />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="按哪个账号来" defaultOpen>
            {ctxLoading ? (
              <p className="flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在读取当前档案…</p>
            ) : profile ? (
              <div className="rounded-xl bg-primary/[0.06] px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                <div className="font-medium">以「{String(profile.profile_name || "当前档案")}」为准</div>
                {track && <div className="mt-1 text-[11.5px] text-muted-foreground">行业：{track}</div>}
                {lines.length > 0 && <div className="mt-0.5 text-[11.5px] text-muted-foreground">在卖的品类：{lines.join("、")}</div>}
                <div className="mt-1.5 text-[11px] text-muted-foreground">会带上它的定位简报、禁忌和发布后的数据。要换账号，在左侧栏切换档案；信息不对去<Link href="/dashboard/profiles" className="mx-0.5 text-primary">改档案</Link></div>
              </div>
            ) : (
              <Field label="你是做什么的" stacked hint="还没有账号档案。建好档案后，规划会按档案里的品类、团队和数据来，准得多">
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="例如：社区烧烤店、家具城" className={INPUT_CLS} />
              </Field>
            )}
          </CollapsibleSection>

          <button type="button" onClick={start} disabled={ctxLoading || running} className={GENERATE_BTN}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {running ? "正在排这个月…" : `规划这个月的 ${count || 0} 条`}
          </button>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={running}
        title={`${monthLabel()}内容规划`}
        flowContext={{ from: "内容规划" }}
        showStats={false}
        emptyIcon={CalendarRange}
        emptyTitle="先定这个月拍什么类型、往哪几个方向，再去出选题"
        emptyHint="勾上个月发了多少、这个月发几条，AI 按配比把条数分到几个内容方向——只定类型、方向和目的，不出具体选题"
        emptyTips={["条数会按配比分到流量型、人设型、变现型", "出来后勾选想做的方向，点「创作方向」「生成选题」「脚本生成」接着做", "带去选题时，那个方向的目的、类型和条数会自动选好"]}
        generatingHint="AI 正在排这个月的内容…"
        footer={planUsed ? <PlanCheckLine text={result} resolved={planUsed.resolved} count={planUsed.count} /> : undefined}
        onCopy={(text) => { navigator.clipboard.writeText(text); notify("已复制到剪贴板"); }}
      />
    </WorkspaceLayout>
  );
}
