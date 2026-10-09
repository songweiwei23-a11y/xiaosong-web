"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Compass, Loader2, Wand2 } from "lucide-react";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, TEXTAREA_CLS, GENERATE_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel, type HistoryItem } from "@/components/workspace/HistoryPanel";
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
import { takeHandoff, type HandoffPayload } from "@/lib/handoff";
import { mergeCreationSettings, settingsFromInput, settingsForResult, creationSettingsBlock, purposeOf } from '@/lib/creation-settings';
import { creationBridgeData, creationBridgePrompt } from '@/lib/creation-bridge';
import { creationReference, carriedIntent, intentBlock, originForResult } from "@/lib/creation-continuation";
import { asText, buildProfileSummary, businessLines } from "@/lib/profile-summary";
import { buildContextBlock } from "@/lib/creator-context";
import { resolveMix, mixPromptBlock, type MixSetting, type ResolvedMix } from "@/lib/content-mix";
import { ContentMixBar, MixCheckLine } from "@/components/workspace/ContentMix";
import {
  CAPACITY, COUNT_OPTIONS, DEPTHS, DIRECTION_TASK_TYPE, FORMATS, HORIZON, ON_CAMERA, PURPOSES,
  buildDirectionPrompt, hasGoal, type Choice, type DirectionCount,
} from "@/lib/direction";

/** 一组可点的选项：标签 + 一句说明 */
function ChoiceGrid({ items, isOn, onToggle, cols = 2 }: { items: Choice[]; isOn: (id: string) => boolean; onToggle: (id: string) => void; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-1.5 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {items.map((c) => {
        const on = isOn(c.id);
        return (
          <button key={c.id} type="button" onClick={() => onToggle(c.id)} aria-pressed={on}
            className={`glass-interactive rounded-xl border px-3 py-2 text-left ${on ? "glass-selected" : "glass-panel"}`}>
            <div className={`text-[12.5px] font-medium leading-5 ${on ? "text-foreground" : "text-muted-foreground"}`}>{c.label}</div>
            {c.hint && <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{c.hint}</div>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 创作方向（2026-10-02 新板块）：说目的 → AI 基于档案把方向和思路铺开 → 推荐一个最佳 →
 * 勾选方向，去选题、脚本等板块继续（结果下面的「继续创作」，自动填好）。
 * 选项和提示词见 lib/direction.ts。
 */
export default function DirectionPage() {
  const beginProfileRequest = useProfileRequestGuard();
  const { history, loadHistory, deleteHistory, lastResult, resultScope } = useGenerationPage({ taskType: DIRECTION_TASK_TYPE });
  const { context, loading: ctxLoading } = useCreatorContext();
  const { saveCreativeHistory, saveError, retrySave, getHistoryOwner } = useCreativeHistory(loadHistory);
  const profile = context.profile as Record<string, unknown> | null;
  const lines = profile ? businessLines(profile) : [];
  const track = profile ? asText(profile.account_track) : "";

  const [purposes, setPurposes] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [ideas, setIdeas] = useState("");
  const [formats, setFormats] = useState<string[]>(["any"]);
  const [onCamera, setOnCamera] = useState("");
  const [capacity, setCapacity] = useState("");
  const [horizon, setHorizon] = useState("");
  const [count, setCount] = useState<DirectionCount>(20);
  const [depth, setDepth] = useState<"quick" | "full">("full");
  const [industry, setIndustry] = useState("");
  const [handoffFrom, setHandoffFrom] = useState("");
  // 别的板块带过来、要在它上面继续拓展的方向（2026-10-06：原来塞进「已有的想法」一并参考，出来的方向跑题）
  const [expandContent, setExpandContent] = useState("");
  const [incomingSetup, setIncomingSetup] = useState<HandoffPayload | null>(null);
  const bridge = creationBridgeData(incomingSetup);
  const selectedGoals = purposes.map(id => PURPOSES.find(p => p.id === id)?.label).filter(Boolean).join('、');
  const currentSettings = mergeCreationSettings(bridge.creationSettings, {
    purpose: purposeOf(selectedGoals), purposeText: selectedGoals || undefined,
    userIntent: bridge.creationSettings.userIntent || [selectedGoals, customGoal, ideas].filter(Boolean).join('\n'),
    notes: [bridge.creationSettings.notes, customGoal, ideas].filter(Boolean).join('\n'),
  });
  // 内容配比：默认按档案（或系统推荐）把方向分到流量 / 人设 / 变现；只想跟着目的走的可以关掉
  const [useMix, setUseMix] = useState(false);
  const [mixOverride, setMixOverride] = useState<MixSetting | null>(null);
  const [mixUsed, setMixUsed] = useState<{ resolved: ResolvedMix; count: number } | null>(null);
  const goalText = [customGoal, ideas, expandContent].filter(Boolean).join("；");
  const resolvedMix = resolveMix(profile, mixOverride, goalText);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const restoredScope = useRef<string>();
  const incoming = useRef(false);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const restoreHistory = (item: HistoryItem) => {
    const d = (item.input_data ?? {}) as Record<string, unknown>;
    setIncomingSetup({ from: typeof d.expandFrom === 'string' ? d.expandFrom : '创作方向', sourceContent: typeof d.expandContent === 'string' ? d.expandContent : '', originContent: typeof d.originContent === 'string' ? d.originContent : '', settings: settingsFromInput(d) });
    setResult(item.result);
    if (Array.isArray(d.purposes)) setPurposes(d.purposes.map(String));
    if (typeof d.customGoal === "string") setCustomGoal(d.customGoal);
    if (typeof d.ideas === "string") setIdeas(d.ideas);
    if (Array.isArray(d.formats)) setFormats(d.formats.map(String));
    if (typeof d.onCamera === "string") setOnCamera(d.onCamera);
    if (typeof d.capacity === "string") setCapacity(d.capacity);
    if (typeof d.horizon === "string") setHorizon(d.horizon);
    if (COUNT_OPTIONS.includes(d.count as DirectionCount)) setCount(d.count as DirectionCount);
    if (d.depth === "quick" || d.depth === "full") setDepth(d.depth);
    setExpandContent(typeof d.expandContent === "string" ? d.expandContent : "");
    setHandoffFrom(typeof d.expandFrom === "string" ? d.expandFrom : "");
  };

  // 切页面回来：结果和当时的选择一起取回来（别的板块带内容过来时不覆盖）
  useEffect(() => {
    if (!resultScope || !lastResult || !history[0] || restoredScope.current === resultScope) return;
    restoredScope.current = resultScope;
    if (!incoming.current && !running && (!result || result === lastResult)) restoreHistory(history[0]);
  }, [resultScope, lastResult, history, running, result]);
  useRestoreLastResult(lastResult, setResult, resultScope);

  // 别的板块「继续创作」带过来的内容（比如自由对话里聊出来的目的）：填进「已有的想法」
  useEffect(() => {
    const data = takeHandoff();
    if (!data?.sourceContent) return;
    incoming.current = true;
    setIncomingSetup(data);
    // 带过来的就是要拓展的那个方向：单独放，提示词里当主线；「已有的想法」留给编导自己写
    const ref = creationReference(data).trim();
    setExpandContent(ref);
    setHandoffFrom(data.from || "其他板块");
    // 拓展一个已经定了目的的方向：默认不按账号配比去拆（那样会把一个流量型方向拆成人设、变现），想按配比可以再打开
    setUseMix(false);
  }, []);

  const start = async () => {
    if (running) return;
    if (ctxLoading) { notify("正在读取当前档案，稍等一秒再点"); return; }
    // 带着要拓展的方向来的，目的就是它原本的目的，不用再勾
    if (!hasGoal({ purposes, customGoal }) && !expandContent.trim()) { notify("先勾一个目的，或者自己写一句想达到什么", "error"); return; }
    const isCurrent = beginProfileRequest();
    setRunning(true);
    const historyOwnerId = await getHistoryOwner();
    const left = await checkQuota("direction");
    if (!isCurrent()) { setRunning(false); return; }
    if (left !== null && left <= 0) { openUpgrade("direction"); setRunning(false); return; }
    setResult("");
    const historyInput = { purposes, customGoal, ideas, expandFrom: expandContent.trim() ? handoffFrom : "", expandContent, formats, onCamera, capacity, horizon, count, depth, industry, profileId: profile?.id ?? null, profileName: profile?.profile_name ?? null, contentMix: useMix ? resolvedMix.mix : null, creationSettings: currentSettings, originContent: bridge.originContent || [customGoal, ideas, selectedGoals].filter(Boolean).join('\n') };
    try {
      const historyId = createHistoryId();
      const query = buildDirectionPrompt({
        purposes, customGoal, ideas, formats, onCamera, capacity, horizon, count, depth,
        profileSummary: profile ? buildProfileSummary(profile) : undefined,
        // 定位简报、成交理由、禁忌：和选题、脚本读的是同一份账号记忆
        contextBlock: buildContextBlock(context, "direction"),
        industry: profile ? undefined : industry,
        mixBlock: useMix ? mixPromptBlock(resolvedMix, { count, unit: "个" }) : undefined,
        expand: expandContent.trim() ? { from: handoffFrom || "其他板块", content: expandContent, intent: intentBlock(carriedIntent({ sourceContent: expandContent, originContent: "" })) } : undefined,
      }) + creationBridgePrompt(incomingSetup) + creationSettingsBlock(currentSettings);
      setMixUsed(useMix ? { resolved: resolvedMix, count } : null);
      const res = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: DIRECTION_TASK_TYPE, query, profileId: profile ? (profile.id as string) : null, historyId, historyInput, historyOwnerId, creationSettings: currentSettings }),
      });
      if (!res.ok) await throwApiError(res, "生成失败");
      const full = await readDifyStream(res, {
        onChunk: (_p, text) => { if (isCurrent()) setResult(text); },
        onRecovering: () => notify("网络断了一下，AI 那边还在写，写完会自动取回，请别关页面"),
      });
      if (full.trim()) {
        await saveCreativeHistory({ id: historyId, taskType: DIRECTION_TASK_TYPE, profileId: (profile?.id as string) || null, ownerId: historyOwnerId, inputData: historyInput, result: full });
      }
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message || "生成失败，请重试", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="创作方向" subtitle="告诉 AI 你拍视频是为了什么，它按你的档案把方向和思路铺开，再推荐一个最好的" />

          {saveError && <p role="alert" className="mb-2 text-[12px] text-amber-600">{saveError} <button type="button" className="underline" onClick={() => void retrySave()}>重试保存</button></p>}
          <CollapsibleSection title={`历史记录（${history.length}）`} defaultOpen={false}>
            {history.length === 0 && <p className="mb-2 text-[12px] text-muted-foreground">当前档案还没有记录，生成成功后会自动保存。</p>}
            <HistoryPanel items={history} title="出过的方向" showStats={false} onLoad={restoreHistory} onDelete={(id) => deleteHistory(id)} />
          </CollapsibleSection>

          {expandContent && (
            <CollapsibleSection title={`要拓展的方向（来自「${handoffFrom || "其他板块"}」）`} defaultOpen>
              <p className="mb-2 text-[12px] text-muted-foreground">出来的方向都会守住它的主题、目的和核心角度，在它上面往下拓展。可以直接改这段。</p>
              <textarea aria-label="要拓展的方向" value={expandContent} onChange={(e) => setExpandContent(e.target.value)} rows={6} className={TEXTAREA_CLS} />
              <button type="button" onClick={() => { setExpandContent(""); setHandoffFrom(""); setIncomingSetup(null); }} className="mt-1.5 text-[12px] text-muted-foreground underline">不按它拓展，从零出方向</button>
            </CollapsibleSection>
          )}

          <CollapsibleSection title={expandContent ? "1. 另外想达到的目的（选填，不选就按上面方向原本的目的）" : "1. 你拍视频是为了什么（可多选）"} defaultOpen>
            <ChoiceGrid items={PURPOSES} isOn={(id) => purposes.includes(id)} onToggle={(id) => setPurposes((p) => toggle(p, id))} />
            <Field label="也可以自己写" optional stacked>
              <textarea value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} rows={2} className={TEXTAREA_CLS} placeholder="例如：下个月开第二家店，想先在那个小区把名气做起来" />
            </Field>
            <Field label="你已经有的想法" optional stacked hint="有就写，AI 会认真看：好的展开成方向，不靠谱的直说哪里不行">
              <textarea value={ideas} onChange={(e) => setIdeas(e.target.value)} rows={2} className={TEXTAREA_CLS} placeholder="例如：想拍老板每天凌晨去市场挑肉" />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="2. 条件（选填，不选 AI 按档案来）" defaultOpen={false}>
            <Field label="想用的形式（可多选）" stacked>
              <ChoiceGrid items={FORMATS} cols={3}
                isOn={(id) => formats.includes(id)}
                onToggle={(id) => setFormats((f) => (id === "any" ? ["any"] : (() => { const next = toggle(f.filter((x) => x !== "any"), id); return next.length ? next : ["any"]; })()))} />
            </Field>
            <Field label="谁出镜" stacked>
              <div className="flex flex-wrap gap-1.5">{ON_CAMERA.map((c) => <button key={c.id} type="button" onClick={() => setOnCamera(onCamera === c.id ? "" : c.id)} aria-pressed={onCamera === c.id} className={chipCls(onCamera === c.id)}>{c.label}</button>)}</div>
            </Field>
            <Field label="一周能拍几条" stacked>
              <div className="flex flex-wrap gap-1.5">{CAPACITY.map((c) => <button key={c.id} type="button" onClick={() => setCapacity(capacity === c.id ? "" : c.id)} aria-pressed={capacity === c.id} className={chipCls(capacity === c.id)}>{c.label}</button>)}</div>
            </Field>
            <Field label="多久要见效" stacked>
              <div className="flex flex-wrap gap-1.5">{HORIZON.map((c) => <button key={c.id} type="button" onClick={() => setHorizon(horizon === c.id ? "" : c.id)} aria-pressed={horizon === c.id} className={chipCls(horizon === c.id)}>{c.label}</button>)}</div>
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="3. 出几个、写多细" defaultOpen>
            <Field label="出几个方向" stacked>
              <div className="flex gap-1.5">{COUNT_OPTIONS.map((n) => <button key={n} type="button" onClick={() => setCount(n)} aria-pressed={count === n} className={chipCls(count === n)}>{n} 个</button>)}</div>
            </Field>
            <Field label="写多细" stacked>
              <ChoiceGrid items={DEPTHS} isOn={(id) => depth === id} onToggle={(id) => setDepth(id as "quick" | "full")} />
            </Field>
            <Field label="按内容配比分方向" stacked hint={useMix ? "方向会按配比分到流量型、人设型、变现型，每个标明是哪种" : "不按配比，方向完全跟着你勾的目的走"}>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setUseMix(true)} aria-pressed={useMix} className={chipCls(useMix)}>按配比</button>
                <button type="button" onClick={() => setUseMix(false)} aria-pressed={!useMix} className={chipCls(!useMix)}>只跟着目的走</button>
              </div>
              {useMix && <ContentMixBar className="mt-2" profile={profile} override={mixOverride} onOverride={setMixOverride} count={count} goal={goalText} />}
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
                <div className="mt-1.5 text-[11px] text-muted-foreground">会带上它的定位简报、成交理由和拍摄条件。要换账号，在左侧栏切换档案；信息不对去<Link href="/dashboard/profiles" className="mx-0.5 text-primary">改档案</Link></div>
              </div>
            ) : (
              <Field label="你是做什么的" stacked hint="还没有账号档案。建好档案后，方向会按档案里的行业、品类、团队来，准得多">
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="例如：社区烧烤店、美甲工作室" className={INPUT_CLS} />
              </Field>
            )}
          </CollapsibleSection>

          <button type="button" onClick={start} disabled={ctxLoading || running} className={GENERATE_BTN}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {running ? "正在想方向…" : "出方向和思路"}
          </button>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={running}
        title="创作方向与思路"
        flowContext={{ settings: settingsForResult(result, history, currentSettings), originContent: originForResult(result, history, bridge.originContent || [customGoal, ideas, selectedGoals].filter(Boolean).join('\n')) }}
        showStats={false}
        emptyIcon={Compass}
        emptyTitle="带着目的去拍，而不是为了拍而拍"
        emptyHint="勾一下你想达到的目的（也可以自己写），AI 按你的档案把能走的方向都铺开，再推荐一个最好的"
        emptyTips={["目的可以多选，比如「引流到店 + 立人设」", "已经有想法就写上，AI 会帮你判断靠不靠谱", "出来后勾选想做的方向，点「生成选题」「脚本生成」直接接着做"]}
        generatingHint="AI 正在按你的目的想方向…"
        footer={mixUsed ? <MixCheckLine text={result} resolved={mixUsed.resolved} count={mixUsed.count} /> : undefined}
        qualityMix={mixUsed}
        onCopy={(text) => { navigator.clipboard.writeText(text); notify("已复制到剪贴板"); }}
      />
    </WorkspaceLayout>
  );
}
