"use client";

import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, GENERATE_BTN, SECONDARY_BTN } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { useState, useEffect, useMemo, useRef } from "react";
import { throwApiError, fetchGeneration } from "@/lib/api-error";
import { useCreatorContext, invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { useProfileRequestGuard } from '@/hooks/useProfileRequestGuard';
import { buildContextBlock } from "@/lib/creator-context";
import { Award, Loader2, Sparkles, Save, Check, ChevronDown } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { saveGenerationHistory } from "@/lib/history";
import { profileHistoryQuery } from '@/lib/profile-history';
import { readDifyStream } from "@/lib/sse-stream";
import type { HandoffPayload } from "@/lib/handoff";
import { useCreationBridge } from '@/hooks/useCreationBridge';
import { incomingNote } from "@/lib/creation-flow";
import {
  DEAL_REASONS,
  APPLICABLE_MIN_SCORE,
  buildDealReasonPrompt,
  parseDealReasons,
  normalizeLegacyResult,
  dealFormFromProfile,
} from "@/lib/deal-reasons";
import { postSafely } from '@/lib/safe-post';

/*
 * 成交理由。改动的来龙去脉见 lib/deal-reasons.ts 顶部，这里只说页面：
 *
 *   - 结果区原样显示模型输出。原来有个"格式化"把 <br> 换成空行、|| 换成加粗，
 *     表格就是被它撑碎的；新的提示词不出表格，也就不需要格式化了
 *   - 分析完只自动勾上**适用的**（7 分及以上），不适用的收起来，想加可以展开手动勾
 *   - 至少选 1 个就能保存。原来要求至少 15 个，等于逼人把不相干的也存进去
 *   - 保存走 /api/deal-reasons。原来那个写法在线上从没成功过
 */

// 历史里用它区分本页记录
const HISTORY_TASK_TYPE = "成交理由";

const STORE_TYPES = [
  "餐饮美食", "美容美发", "休闲娱乐", "运动健身",
  "亲子教育", "生活服务", "医疗健康", "宠物服务",
  "汽车服务", "其他",
];

interface Saved {
  reasons: string[];
  updatedAt: string | null;
  storeName: string;
  storeType: string;
}

export default function DealReasonPage() {
  const beginProfileRequest = useProfileRequestGuard();
  const { context: creatorContext, loading: ctxLoading } = useCreatorContext();
  /** 成交理由按档案分别存：切换档案，这一页跟着换成那个档案的 */
  const profile = creatorContext.profile as Record<string, unknown> | null;
  const profileId = (profile?.id as string | undefined) ?? null;
  /** 表单是从档案带进来的（这个档案还没存过成交理由） */
  const [fromProfile, setFromProfile] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("餐饮美食");
  const [storeFeatures, setStoreFeatures] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  /** 勾选的理由，存中文名 */
  const [selected, setSelected] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const restoredProfileRef = useRef<string>();
  /*
   * 别的板块「继续创作」带过来的内容（比如写好的脚本、内容定位）：
   * 等下面把档案和已保存的表单回填完，再追加到「店铺特色」后面——先填会被回填盖掉（2026-10-02）
   */
  const incomingRef = useRef<HandoffPayload | null>(null);
  const [handoffFrom, setHandoffFrom] = useState("");
  const bridge = useCreationBridge(HISTORY_TASK_TYPE, 'deal-reason', profileId, ctxLoading);
  useEffect(() => {
    const data = bridge.payload;
    if (data?.sourceContent) incomingRef.current = data;
  }, [bridge.payload]);

  // 从结果里现算适用 / 不适用。显示给用户的和自动勾上的是同一份
  const parsed = useMemo(() => parseDealReasons(analysisResult), [analysisResult]);
  const scoreOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of [...parsed.applicable, ...parsed.notApplicable]) m.set(r.label, r.score);
    return m;
  }, [parsed]);
  const applicableLabels = parsed.applicable.map((r) => r.label);
  // 没被判为适用的其余理由（包括模型漏掉没打分的）
  const otherReasons = DEAL_REASONS.filter((r) => !applicableLabels.includes(r.label));

  /*
   * 进页面时把两样东西取回来：已保存的（表单和勾选以它为准），
   * 以及最近一次分析（结果区以它为准——可能分析了但还没保存）。
   */
  useEffect(() => {
    if (ctxLoading) return;
    const scope = profileId || "default";
    if (restoredProfileRef.current === scope) {
      if (bridge.payload) {
        setHandoffFrom(bridge.payload.from);
        setStoreFeatures(current => current.includes(incomingNote(bridge.payload!, 1200)) ? current : [current.slice(0, 600), incomingNote(bridge.payload!, 1200)].join('\n\n'));
      }
      return;
    }
    setIsLoading(true);
    setAnalysisResult("");
    setSaved(null);
    setSelected([]);
    let cancelled = false;
    (async () => {
      try {
        const [savedRes, histRes] = await Promise.all([
          fetch(`/api/deal-reasons${profileId ? `?profileId=${encodeURIComponent(profileId)}` : ""}`),
          fetch(`/api/script-history?taskType=${encodeURIComponent(HISTORY_TASK_TYPE)}&limit=1${profileHistoryQuery(profileId)}`),
        ]);
        const s = savedRes.ok ? await savedRes.json() : null;
        const h = histRes.ok ? await histRes.json() : [];
        if (cancelled) return;

        // 最近一次分析：优先这个档案的；老记录没记档案，这个档案没分析过时才拿它顶上
        const mine = Array.isArray(h) ? h.filter((x: any) => x.task_type === HISTORY_TASK_TYPE) : [];
        const latest = mine[0] ?? null;
        const input = latest?.input_data && typeof latest.input_data === "object" ? latest.input_data : {};
        const hasOwn = !!(s?.reasons?.length && !s?.legacy) || !!latest;

        // 这个档案还没存过、也没分析过：用档案里已有的信息预填（店名、类型、特色、客人）
        const seed = !hasOwn && profile ? dealFormFromProfile(profile) : null;
        setFromProfile(!!seed);
        setStoreName(seed?.storeName || s?.storeName || input.storeName || "");
        setStoreType(seed?.storeType || s?.storeType || input.storeType || "餐饮美食");
        const baseFeatures = seed?.storeFeatures || s?.storeFeatures || input.storeFeatures || "";
        const incoming = incomingRef.current;
        incomingRef.current = null;
        // 店铺特色存库上限 2000 字，带入的那段给原有内容留出位置
        setStoreFeatures(incoming ? [baseFeatures.slice(0, 600), incomingNote(incoming, 1200)].filter(Boolean).join("\n\n") : baseFeatures);
        if (incoming) setHandoffFrom(incoming.from || "其他板块");
        setTargetCustomer(bridge.creationSettings.audience || seed?.targetCustomer || s?.targetCustomer || input.targetCustomer || "");

        const result = seed ? "" : normalizeLegacyResult(latest?.result || s?.analysisResult || "");
        setAnalysisResult((current) => current || result);
        restoredProfileRef.current = scope;

        if (s?.reasons?.length && !seed) {
          setSaved({ reasons: s.reasons, updatedAt: s.updatedAt, storeName: s.storeName, storeType: s.storeType });
          setSelected(s.reasons);
        } else {
          setSaved(null);
          setSelected(parseDealReasons(result).applicable.map((r) => r.label));
        }
      } catch (e) {
        console.error("恢复成交理由失败:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 只跟着"换了哪个档案"走；档案对象每次取回来都是新引用，放进依赖会反复重置表单
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxLoading, profileId, bridge.payload]);

  const handleAnalyze = async () => {
    const isCurrent = beginProfileRequest();
    if (!storeName.trim() || !storeFeatures.trim()) {
      notify("请填写店铺名称和特色描述");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult("");
    setSelected([]);
    setShowOthers(false);

    try {
      const query = buildDealReasonPrompt({
        // 账号上下文：这个号的人群、卖点、禁忌。不给的话分析等于隔空猜
        accountContext: buildContextBlock(creatorContext, 'dealReason'),
        storeName,
        storeType,
        storeFeatures,
        targetCustomer,
      }) + bridge.prompt;

      const response = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: "成交理由", category: "成交理由", profileId, topic: query, creationSettings: bridge.creationSettings }),
      });
      if (!response.ok) await throwApiError(response, "分析失败");

      const full = await readDifyStream(response, {
        onChunk: (_piece, text) => { if (isCurrent()) setAnalysisResult(text); },
      });

      // 只自动勾上适用的
      const applicable = parseDealReasons(full).applicable.map((r) => r.label);
      if (isCurrent()) setSelected(applicable);
      if (applicable.length === 0) {
        notify("没有分析出适用的成交理由，可以把店铺特色写得更具体些再试");
      }

      if (full.trim()) {
        const historyInput = { storeName, storeType, storeFeatures, targetCustomer, profileId, creationSettings: bridge.creationSettings, originContent: bridge.originContent || storeFeatures };
        await saveGenerationHistory(
          HISTORY_TASK_TYPE,
          historyInput,
          full
        );
        bridge.rememberResult(full, historyInput);
      }
    } catch (error: any) {
      notify(error.message || "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggle = (label: string) =>
    setSelected((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));

  const handleSave = async () => {
    const isCurrent = beginProfileRequest();
    if (selected.length === 0) {
      notify("至少选一个成交理由");
      return;
    }
    setSaving(true);
    try {
      const res = await postSafely("/api/deal-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          storeType,
          storeFeatures,
          targetCustomer,
          analysisResult,
          selectedReasons: selected,
          profileId,
        }),
      });
      if (!res.ok) await throwApiError(res, "保存失败");
      const data = await res.json();
      if (isCurrent()) {
        setSaved({ reasons: data.reasons, updatedAt: new Date().toISOString(), storeName, storeType });
        setFromProfile(false);
      }
      // 各板块缓存的上下文作废，下次生成就用上新的成交理由
      invalidateCreatorContext();
      notify(
        profileId && !data.perProfile
          ? "已保存，但数据库尚未启用按档案保存，请先完成数据库升级"
          : data.profileSynced
          ? `已保存 ${data.reasons.length} 个成交理由，并同步进「${String(profile?.profile_name ?? "档案")}」的卖点；选题、脚本、标题、二创会自动带上`
          : `已保存 ${data.reasons.length} 个成交理由，选题、脚本、标题会自动带上`
      );
    } catch (error: any) {
      notify(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || ctxLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
      </div>
    );
  }

  const hasResult = !!analysisResult && !isAnalyzing;
  const unsaved =
    !saved ||
    saved.reasons.length !== selected.length ||
    saved.reasons.some((r) => !selected.includes(r));

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader
            title="成交理由"
            subtitle="AI 判断 17 个成交理由哪些适用；按账号档案分别保存，并同步进档案，各板块自动带上"
          />

          {saved && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
              <p className="text-[13px] font-medium text-emerald-500">
                已保存 {saved.reasons.length} 个：{saved.reasons.join("、")}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {profile ? `属于「${String(profile.profile_name ?? "当前档案")}」· ` : ""}
                {saved.storeName}（{saved.storeType}）· 选题、脚本、标题、二创会自动带上
              </p>
            </div>
          )}
          {fromProfile && (
            <p className="rounded-xl bg-primary/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
              「{String(profile?.profile_name ?? "当前档案")}」还没存过成交理由，已经把档案里的店名、品类、卖点、客人带进下面，检查一下就能分析。
            </p>
          )}

          <CollapsibleSection title="店铺信息" defaultOpen={!hasResult}>
            <Field label="店铺名称" required>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="例如：老李烧烤、美美美容院"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="店铺类型" optional>
              <select value={storeType} onChange={(e) => setStoreType(e.target.value)} className={SELECT_CLS}>
                {STORE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>

            <Field label="店铺特色" required hint={handoffFrom ? `已带入来自「${handoffFrom}」的内容，直接点分析就会一并纳入` : "写得越具体，分析越准"} stacked>
              <textarea
                value={storeFeatures}
                onChange={(e) => setStoreFeatures(e.target.value)}
                placeholder={"开了 10 年的老店\n秘制配方，味道独特\n环境装修有特色\n人均 50 元"}
                rows={5}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="目标客户" optional>
              <input
                type="text"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                placeholder="例如：周边 3 公里上班族"
                className={INPUT_CLS}
              />
            </Field>
          </CollapsibleSection>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !storeName.trim() || !storeFeatures.trim()}
            className={GENERATE_BTN}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                分析中…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {analysisResult ? "重新分析" : "分析成交理由"}
              </>
            )}
          </button>

          {hasResult && (
            <CollapsibleSection title="选择要用的成交理由" defaultOpen>
              <Field
                label={`适用的（${APPLICABLE_MIN_SCORE} 分及以上，已自动勾上）`}
                stacked
                hint={
                  applicableLabels.length === 0
                    ? "这次没有分析出适用的，可以展开下面手动选"
                    : `已选 ${selected.length} 个 · 建议主打 2–3 个`
                }
              >
                {applicableLabels.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {parsed.applicable.map((r) => (
                      <ReasonChip
                        key={r.label}
                        label={r.label}
                        score={r.score}
                        picked={selected.includes(r.label)}
                        onClick={() => toggle(r.label)}
                      />
                    ))}
                  </div>
                )}
              </Field>

              {/* 不适用的收起来，只露一行。想加可以展开手动勾——判断未必全对 */}
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[12px] text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">
                  其余 {otherReasons.length} 个不太适用
                  {!showOthers && otherReasons.length > 0 && `：${otherReasons.map((r) => r.label).join("、")}`}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${showOthers ? "rotate-180" : ""}`} />
              </button>
              {showOthers && (
                <div className="grid grid-cols-3 gap-1.5">
                  {otherReasons.map((r) => (
                    <ReasonChip
                      key={r.label}
                      label={r.label}
                      score={scoreOf.get(r.label)}
                      picked={selected.includes(r.label)}
                      onClick={() => toggle(r.label)}
                      muted
                    />
                  ))}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={selected.length === 0 || saving}
                className={`${SECONDARY_BTN} w-full disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saved && !unsaved ? `已保存（${selected.length} 个）` : `保存到云端（${selected.length} 个）`}
              </button>
            </CollapsibleSection>
          )}
        </>
      }
    >
      <ResultPanel
        result={analysisResult}
        isGenerating={isAnalyzing}
        title="分析结果"
        flowContext={bridge.flowContext(analysisResult)}
        showStats={false}
        emptyIcon={Award}
        emptyTitle="填好店铺信息就能开始"
        emptyHint="AI 会判断 17 个成交理由哪些适用，只详细写适用的"
        emptyTips={[
          "特色写得越具体，判断越准",
          "适用的会自动勾上，也可以手动调整",
          "保存后选题、脚本、标题都会自动带上",
        ]}
        generatingHint="正在判断哪些成交理由适用…"
        onCopy={(text) => {
          navigator.clipboard.writeText(text);
          notify("已复制到剪贴板");
        }}
      />
    </WorkspaceLayout>
  );
}

function ReasonChip({
  label,
  score,
  picked,
  onClick,
  muted,
}: {
  label: string;
  score?: number;
  picked: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  const meta = DEAL_REASONS.find((r) => r.label === label);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={picked}
      className={`glass-interactive relative flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left ${
        picked ? "glass-selected" : "glass-panel"
      } ${muted && !picked ? "opacity-60" : ""}`}
    >
      <span className="text-sm leading-none">{meta?.icon}</span>
      <span className={`text-[12px] font-medium ${picked ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
      {score !== undefined && (
        <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">{score}分</span>
      )}
      {picked && <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-primary p-0.5 text-white" />}
    </button>
  );
}
