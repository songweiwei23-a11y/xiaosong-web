"use client";
import type { HandoffPayload } from '@/lib/handoff';
import { useAutoCreationSetup } from '@/hooks/useAutoCreationSetup';
import { CreationSetupNotice } from '@/components/workspace/CreationSetupNotice';
import { resolveCreationSettings, mergeCreationSettings, settingsForResult, REVIEW_SCRIPT_TYPES, creationSettingsBlock, durationSeconds } from '@/lib/creation-settings';


import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Shuffle, Wand2 } from "lucide-react";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, TEXTAREA_CLS, GENERATE_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { notify } from "@/components/ui/feedback";
import { useGenerationPage } from "@/hooks/useGenerationPage";
import { useRestoreLastResult } from "@/hooks/useRestoreLastResult";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { useCreativeHistory } from '@/hooks/useCreativeHistory';
import { profileHistoryQuery } from '@/lib/profile-history';
import { remixHistoryForm } from '@/lib/creative-history-form';
import type { HistoryItem } from '@/components/workspace/HistoryPanel';
import { useProfileRequestGuard } from '@/hooks/useProfileRequestGuard';
import { checkQuota } from "@/lib/history";
import { createHistoryId } from '@/lib/history-id';
import { openUpgrade } from "@/lib/upgrade";
import { isNetworkError, NETWORK_ERROR_HINT, throwApiError, fetchGeneration } from "@/lib/api-error";
import { readDifyStream } from "@/lib/sse-stream";
import { takeHandoff } from "@/lib/handoff";
import { asText, buildProfileSummary, businessLines } from "@/lib/profile-summary";
import { buildContextBlock } from "@/lib/creator-context";
import { BREAKDOWN_TASK_TYPE } from "@/lib/viral-breakdown";
import {
  BORROW_LAYERS,
  COUNT_OPTIONS,
  DEFAULT_LAYERS,
  DEFAULT_OUTPUTS,
  DEPTHS,
  DIFFERENTIATE,
  DURATIONS,
  OUTPUTS,
  REMIX_TASK_TYPE,
  ROLES,
  buildRemixPrompt,
  type BorrowLayer,
  type Choice,
  type Depth,
  type Differentiate,
  type RemixCount,
  type RemixDuration,
  type RemixOutput,
  type RemixRole,
  type RemixSource,
} from "@/lib/remix";

interface BreakdownRow {
  id: string;
  result: string;
  created_at: string;
  input_data?: { fileName?: string } | null;
}

/** 从拆解报告里取"一句话：这条为什么能火"那一句，列表里好认 */
function oneLiner(report: string): string {
  const m = report.match(/这条为什么能火[^\n]*\n+([^\n#]+)/);
  return (m?.[1] ?? report.replace(/[#*>|`-]/g, " ").trim()).replace(/\s+/g, " ").slice(0, 60);
}

/** 一组可点的选项：标签 + 一句说明 */
function ChoiceGrid<T extends string>({
  items,
  isOn,
  onToggle,
  cols = 2,
}: {
  items: readonly Choice<T>[];
  isOn: (id: T) => boolean;
  onToggle: (id: T) => void;
  cols?: 1 | 2;
}) {
  return (
    <div className={`grid gap-1.5 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {items.map((c) => {
        const on = isOn(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            aria-pressed={on}
            className={`glass-interactive rounded-xl border px-3 py-2 text-left ${on ? "glass-selected" : "glass-panel"}`}
          >
            <div className={`text-[12.5px] font-medium leading-5 ${on ? "text-foreground" : "text-muted-foreground"}`}>{c.label}</div>
            <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{c.hint}</div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 跨行业二创：拿别的行业的爆款（拆过的、或者直接贴文案），借它的开篇、结构、拍法……换成自己的行业来拍。
 * 借哪几层、出几个、怎么拉开、多深、什么目的、多长、要哪些产出，全让用户选（产品方定：自由度拉满）。
 * 方法和提示词见 lib/remix.ts。
 */
export default function RemixPage() {
  const beginProfileRequest = useProfileRequestGuard();
  const [incomingSetup, setIncomingSetup] = useState<HandoffPayload | null>(null);
  const { history, loadHistory, deleteHistory, lastResult, resultScope } = useGenerationPage({ taskType: REMIX_TASK_TYPE });
  const { context, loading: ctxLoading } = useCreatorContext();
  const { saveCreativeHistory, saveError, retrySave, getHistoryOwner } = useCreativeHistory(loadHistory);
  const profile = context.profile as Record<string, unknown> | null;
  /*
   * 二创一律落到侧边栏当前选中的档案上（产品方定，2026-09-30）：行业、在卖的品类、店里的场景都从它来。
   * 原来有个「用不用档案」的勾选框，取消勾选就退回手填行业——两套来源，产出落到哪家店用户说不清。
   * 现在只有还没建档案时才手填。
   */
  const lines = profile ? businessLines(profile) : [];
  const track = profile ? asText(profile.account_track) : "";

  const [mode, setMode] = useState<"breakdown" | "paste">("breakdown");
  const [breakdowns, setBreakdowns] = useState<BreakdownRow[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  /** 从拆解页"拿去二创"带过来的那份（可能还没进历史列表） */
  const [handed, setHanded] = useState<{ title?: string; text: string } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteIndustry, setPasteIndustry] = useState("");

  const [layers, setLayers] = useState<BorrowLayer[]>(DEFAULT_LAYERS);
  const [count, setCount] = useState<RemixCount>(3);
  const [differentiate, setDifferentiate] = useState<Differentiate>("auto");
  const [depth, setDepth] = useState<Depth>("full");
  const [role, setRole] = useState<RemixRole>("same");
  const [duration, setDuration] = useState<RemixDuration>("跟原片");
  const [outputs, setOutputs] = useState<RemixOutput[]>(DEFAULT_OUTPUTS);
  const [targetIndustry, setTargetIndustry] = useState("");
  const [notes, setNotes] = useState("");

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const breakdownScopeRef = useRef<string>();
  const restoredInputScope = useRef<string>();
  const incomingHandoff = useRef(false);

  const restoreHistory = (item: HistoryItem) => {
    const form = remixHistoryForm(item.input_data);
    setResult(item.result);
    setLayers(form.layers); setCount(form.count); setDifferentiate(form.differentiate);
    setDepth(form.depth); setRole(form.role); setDuration(form.duration); setOutputs(form.outputs);
    setTargetIndustry(form.targetIndustry); setNotes(form.notes);
    if (form.source?.kind === 'paste') {
      setMode('paste'); setPasteText(form.source.text); setPasteTitle(form.source.title || ''); setPasteIndustry(form.source.industry || '');
    } else if (form.source?.kind === 'breakdown') {
      setMode('breakdown'); setHanded({ title: form.source.title, text: form.source.text }); setPicked('__handed__');
    }
  };

  useEffect(() => {
    if (!resultScope || !lastResult || !history[0] || restoredInputScope.current === resultScope) return;
    restoredInputScope.current = resultScope;
    if (!incomingHandoff.current && !running && (!result || result === lastResult)) restoreHistory(history[0]);
    // 一次性恢复；后续刷新历史不会改掉正在编辑的设置。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultScope, lastResult, history, running, result]);

  useRestoreLastResult(lastResult, setResult, resultScope);

  useEffect(() => {
    const h = takeHandoff();
    if (h) setIncomingSetup(h);
    if (h?.remixSource?.text) {
      incomingHandoff.current = true;
      if (h.from === BREAKDOWN_TASK_TYPE) {
        setHanded(h.remixSource);
        setMode("breakdown");
        setPicked("__handed__");
      } else {
        setMode('paste'); setPasteText(h.remixSource.text); setPasteTitle(h.remixSource.title || h.from);
      }
    }
  }, []);

  useEffect(() => {
    if (ctxLoading) return;
    let alive = true;
    const scope = String(profile?.id || 'default');
    if (breakdownScopeRef.current && breakdownScopeRef.current !== scope) { setPicked(null); setHanded(null); }
    breakdownScopeRef.current = scope;
    setBreakdowns([]);
    fetch(`/api/script-history?taskType=${encodeURIComponent(BREAKDOWN_TASK_TYPE)}${profileHistoryQuery(profile?.id as string || null)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => alive && Array.isArray(rows) && setBreakdowns(rows.filter((r: { task_type?: string }) => r.task_type === BREAKDOWN_TASK_TYPE)))
      .catch(() => {});
    return () => { alive = false; };
  }, [profile?.id, ctxLoading]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const source = (): RemixSource | null => {
    if (mode === "paste") {
      return pasteText.trim().length >= (incomingHandoff.current ? 1 : 20) ? { kind: "paste", text: pasteText, title: pasteTitle.trim() || undefined, industry: pasteIndustry.trim() || undefined } : null;
    }
    if (picked === "__handed__" && handed) return { kind: "breakdown", text: handed.text, title: handed.title };
    const row = breakdowns.find((b) => b.id === picked);
    return row ? { kind: "breakdown", text: row.result, title: row.input_data?.fileName } : null;
  };

  const autoSetup = useAutoCreationSetup(incomingSetup, context, ctxLoading, s => {
    // 原稿写明了目的才填，没写就「和原片一样」；补充说明不塞占位话（2026-10-03：跳转时别乱填）
    setRole(s.purpose ?? 'same'); setTargetIndustry(s.industry ?? ''); setPasteIndustry(s.industry ?? '');
    setDuration(s.duration as RemixDuration); setNotes(s.notes || '');
  });
  const currentSettings = resolveCreationSettings({ from: '跨行业二创', sourceContent: pasteText || handed?.text || '', settings: mergeCreationSettings(autoSetup.settings, { industry: profile ? track : targetIndustry, duration, purpose: role === 'same' ? undefined : role, notes }) }, context);

  const start = async () => {
    if (running) return;
    if (autoSetup.preparing || ctxLoading) { notify('正在承接原方案，请稍候'); return; }
    const isCurrent = beginProfileRequest();
    const src = source();
    if (!src) {
      notify(mode === "paste" ? "把原片的文案或描述贴进来（至少 20 个字）" : "先选一条拆过的视频", "error");
      return;
    }
    if (layers.length === 0) {
      notify("至少选一层要借的", "error");
      return;
    }
    if (ctxLoading) {
      notify("正在读取当前档案，稍等一秒再点", "error");
      return;
    }
    setRunning(true);
    const historyOwnerId = await getHistoryOwner();
    const left = await checkQuota("remix");
    if (!isCurrent()) { setRunning(false); return; }
    if (left !== null && left <= 0) {
      openUpgrade("remix");
      setRunning(false);
      return;
    }
    setRunning(true);
    setResult("");
    const historyInput = {
      source: src.title ?? src.kind, sourceData: src, layers, count, differentiate, depth, role,
      duration, outputs, targetIndustry, notes, creationSettings: currentSettings,
      profileId: profile?.id ?? null, profileName: profile?.profile_name ?? null,
    };
    try {
      const historyId = createHistoryId();
      const query = buildRemixPrompt(src, {
        layers,
        count,
        differentiate,
        depth,
        role,
        duration,
        outputs,
        profileSummary: profile ? buildProfileSummary(profile) : undefined,
        store: profile ? { name: String(profile.profile_name ?? ""), lines, track } : undefined,
        // 定位简报、成交理由、禁忌：和选题、脚本读的是同一份账号记忆
        contextBlock: buildContextBlock(context, 'remix') + creationSettingsBlock(currentSettings),
        targetIndustry: profile ? undefined : targetIndustry,
        notes,
      });
      const res = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: REMIX_TASK_TYPE,
          query,
          profileId: profile ? (profile.id as string) : null,
          historyId,
          historyInput,
          historyOwnerId,
        }),
      });
      if (!res.ok) await throwApiError(res, "二创失败");
      const full = await readDifyStream(res, {
        onChunk: (_p, text) => { if (isCurrent()) setResult(text); },
        onRecovering: () => notify("网络断了一下，AI 那边还在写，写完会自动取回，请别关页面"),
      });
      if (full.trim()) {
        await saveCreativeHistory({ id: historyId, taskType: REMIX_TASK_TYPE, profileId: profile?.id as string || null, ownerId: historyOwnerId, inputData: historyInput, result: full });
      }
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message || "二创失败，请重试", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="跨行业二创" subtitle="借别的行业爆款的开篇、结构、拍法，换成你自己的行业来拍" />
          <CreationSetupNotice settings={autoSetup.settings} preparing={autoSetup.preparing} />

          {saveError && <p role="alert" className="mb-2 text-[12px] text-amber-600">{saveError} <button type="button" className="underline" onClick={() => void retrySave()}>重试保存</button></p>}
          <CollapsibleSection title={`历史记录（${history.length}）`} defaultOpen={false}>
            <p className="mb-2 text-[11.5px] text-muted-foreground">当前档案：{String(profile?.profile_name || '未关联档案')}。结果保存在当前账号的云端，不主动删除就一直保留，点击记录可恢复正文和当时的设置。</p>
            {history.length === 0 && <p className="mb-2 text-[12px] text-muted-foreground">当前档案还没有二创记录，生成成功后会自动保存。</p>}
            <HistoryPanel items={history} title="二创历史" showStats={false} onLoad={restoreHistory} onDelete={(id) => deleteHistory(id)} />
            <Link href="/history" className="mt-2 inline-block text-[11.5px] text-primary underline">查看这个账号的全部历史</Link>
          </CollapsibleSection>

          <CollapsibleSection title="原片" defaultOpen>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setMode("breakdown")} aria-pressed={mode === "breakdown"} className={chipCls(mode === "breakdown")}>
                从拆过的视频选
              </button>
              <button type="button" onClick={() => setMode("paste")} aria-pressed={mode === "paste"} className={chipCls(mode === "paste")}>
                贴别的行业爆款
              </button>
            </div>

            {mode === "breakdown" ? (
              <div className="mt-2.5 space-y-1.5">
                {handed && (
                  <button type="button" onClick={() => setPicked("__handed__")} aria-pressed={picked === "__handed__"} className={`w-full rounded-xl border px-3 py-2 text-left ${picked === "__handed__" ? "glass-selected" : "glass-panel"}`}>
                    <div className="text-[12.5px] font-medium text-foreground">刚才拆的：{handed.title || "这条视频"}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{oneLiner(handed.text)}</div>
                  </button>
                )}
                {breakdowns.slice(0, 8).map((b) => (
                  <button key={b.id} type="button" onClick={() => setPicked(b.id)} aria-pressed={picked === b.id} className={`w-full rounded-xl border px-3 py-2 text-left ${picked === b.id ? "glass-selected" : "glass-panel"}`}>
                    <div className="truncate text-[12.5px] font-medium text-foreground">{b.input_data?.fileName || "拆过的视频"}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{oneLiner(b.result)}</div>
                  </button>
                ))}
                {!handed && breakdowns.length === 0 && (
                  <p className="rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-[12px] text-muted-foreground">
                    还没拆过视频。先去<Link href="/dashboard/breakdown" className="mx-0.5 text-primary">拆解爆款</Link>拆一条，拆完点「拿去二创」就能直接过来；或者切到「贴别的行业爆款」。
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-2.5 space-y-2.5">
                <Field label="原片文案 / 描述" required stacked hint="口播原话、字幕，或者你看到的画面和情节都行">
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} className={TEXTAREA_CLS} placeholder="例如：一个修车师傅，开头说「信不信 15 秒让你不敢去 4S 店」，然后……" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <input value={pasteIndustry} onChange={(e) => setPasteIndustry(e.target.value)} placeholder="原片是什么行业" aria-label="原片行业" className={INPUT_CLS} />
                  <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="原片标题（选填）" aria-label="原片标题" className={INPUT_CLS} />
                </div>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="借哪几层（可多选）" defaultOpen>
            <p className="mb-2 text-[11.5px] leading-relaxed text-muted-foreground">知识库原则：行业内看选题，跨行业看开篇、金句、呈现形式。没选的层都换成你自己的。</p>
            <ChoiceGrid items={BORROW_LAYERS} isOn={(id) => layers.includes(id)} onToggle={(id) => setLayers((l) => toggle(l, id))} />
          </CollapsibleSection>

          <CollapsibleSection title="出几个、怎么拉开、写多深" defaultOpen>
            <Field label="出几个方案" stacked>
              <div className="flex gap-1.5">
                {COUNT_OPTIONS.map((n) => (
                  <button key={n} type="button" onClick={() => setCount(n)} aria-pressed={count === n} className={chipCls(count === n)}>
                    {n} 个
                  </button>
                ))}
              </div>
            </Field>
            {count > 1 && (
              <Field label="方案之间怎么拉开" stacked>
                <ChoiceGrid items={DIFFERENTIATE} isOn={(id) => differentiate === id} onToggle={setDifferentiate} />
              </Field>
            )}
            <Field label="写多深" stacked>
              <ChoiceGrid items={DEPTHS} isOn={(id) => depth === id} onToggle={setDepth} cols={1} />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="目的、时长、要哪些产出" defaultOpen={false}>
            <Field label="这条拍来干什么" stacked>
              <ChoiceGrid items={ROLES} isOn={(id) => role === id} onToggle={setRole} />
            </Field>
            <Field label="时长" stacked>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set([...DURATIONS, duration])).map((d) => (
                  <button key={d} type="button" onClick={() => setDuration(d)} aria-pressed={duration === d} className={chipCls(duration === d)}>
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="要哪些产出（可多选）" stacked hint={depth === "quick" ? "快速模式只出方向、开头和口播要点；要完整产出请选「完整」或「深度」" : undefined}>
              <ChoiceGrid items={OUTPUTS} isOn={(id) => outputs.includes(id)} onToggle={(id) => setOutputs((o) => toggle(o, id))} />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="二创到哪家店" defaultOpen>
            {ctxLoading ? (
              <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在读取当前档案…
              </p>
            ) : profile ? (
              <div className="rounded-xl bg-primary/[0.06] px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">
                <div className="font-medium">以「{String(profile.profile_name || "当前档案")}」为准</div>
                {track && <div className="mt-1 text-[11.5px] text-muted-foreground">行业：{track}</div>}
                {lines.length > 0 && <div className="mt-0.5 text-[11.5px] text-muted-foreground">在卖的品类：{lines.join("、")}</div>}
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  方案里的事、场景、产品都换成这家店的，也会带上它的定位简报和成交理由。要换店，在左侧栏切换档案；品类不对去
                  <Link href="/dashboard/profiles"className="mx-0.5 text-primary">改档案</Link>
                </div>
              </div>
            ) : (
              <Field label="你是做什么的" stacked hint="还没有账号档案。建好档案后，二创会自动按档案里的行业和品类来">
                <input value={targetIndustry} onChange={(e) => setTargetIndustry(e.target.value)} placeholder="例如：社区烧烤店、美甲工作室" className={INPUT_CLS} />
              </Field>
            )}
            <Field label="补充要求" optional stacked>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={TEXTAREA_CLS} placeholder="例如：老板不想出镜；想推新上的烤鱼" />
            </Field>
          </CollapsibleSection>

          <button type="button" onClick={start} disabled={autoSetup.preparing || ctxLoading || running} className={GENERATE_BTN}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {running ? "二创中…" : "开始二创"}
          </button>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={running}
        title="二创方案"
        flowContext={{ settings: settingsForResult(result, history, currentSettings) }}
        individualPlans
        showStats={false}
        emptyIcon={Shuffle}
        emptyTitle="借别的行业的爆款，拍成你自己的"
        emptyHint="选一条拆过的视频（或贴一段别的行业的爆款文案），选好借哪几层，AI 换成你的行业来写"
        emptyTips={["行业内看选题，跨行业看开篇、金句、呈现形式", "借的是结构和机制，不是台词——照抄会被判搬运", "拆解爆款页拆完，点「拿去二创」直接带过来"]}
        generatingHint="AI 正在二创…"
        bodyClassName="prose-h4:mt-5 prose-h4:mb-1.5 prose-h4:text-[14px] prose-ul:my-1.5 prose-li:my-0.5"
        onCopy={(text) => {
          navigator.clipboard.writeText(text);
          notify("已复制到剪贴板");
        }}
      />

    </WorkspaceLayout>
  );
}
