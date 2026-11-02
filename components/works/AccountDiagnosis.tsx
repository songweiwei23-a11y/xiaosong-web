"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { invalidateCreatorContext, useCreatorContext } from "@/hooks/useCreatorContext";
import { buildContextBlock } from "@/lib/creator-context";
import { fetchGeneration, isNetworkError, NETWORK_ERROR_HINT, throwApiError } from "@/lib/api-error";
import { readDifyStream } from "@/lib/sse-stream";
import { postSafely } from "@/lib/safe-post";
import { collectionSummary, coverageEstimate, formatCollection, sanitizeCollection, type Collection } from "@/lib/benchmark-collection";
import { buildDiagnosisQuery, DIAGNOSIS_TASK_TYPE, type AccountDiagnosis as Diagnosis } from "@/lib/account-diagnosis";
import { batchKey, dataUrlToFile, douyinLinkFromText, SELF_SINCE, versionBelow } from "@/components/benchmark/CaptureBridge";
import { uploadImage } from "@/components/benchmark/BenchmarkAnalyzer";
import { BenchmarkReport } from "@/components/benchmark/BenchmarkReport";
import { clearDraft, DRAFT_THROTTLE_MS, readDraft, saveDraft } from "@/lib/report-draft";

/**
 * 创作进度顶部的「诊断我的账号」（2026-11-02 产品方：用拆对标的逻辑拆自己的号，也能用抖音的真实数据，
 * 诊断结果同步给需要的板块和开物助理）。
 * - 粘贴自己的抖音主页链接：开物插件按拆对标的同一套方法采集（插件 0.5.0 起分得清是自己的号，采完回到这一页）；
 * - 下面「账号作品概况」里导入的文件（抖音创作者中心导出的作品数据、脚本、字幕）和作品记录一起读；
 * - 地基（档案、账号定位、简报）拿来对照「定的」和「实际的」。
 * 诊断存进作品概况那一行（app/api/account-diagnosis），各板块按 lib/context-manifest 的 diagnosis 字段领自己那一份。
 */

const MAX_IMAGES = 9;
const LINK_KEY = (pid: string) => `kaiwu-self-link:${pid}`;
const DRAFT_KEY = (pid: string) => `diagnosis:${pid}`;

interface Capture { dataUrl: string; url?: string; at?: string; kind?: string }

export function AccountDiagnosis() {
  const { context, loading } = useCreatorContext();
  // 插件交来的数据可能比档案、定位先到：先存着，等地基读完再诊断（不然拿不到地基对照）
  const pending = useRef<{ collected: Collection; images: File[] } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [installed, setInstalled] = useState(false);
  const [version, setVersion] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState("");
  const [saved, setSaved] = useState<Diagnosis | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const lastBatch = useRef("");
  const [tick, setTick] = useState(0);
  const runRef = useRef<(collected: Collection | null, images: File[]) => Promise<void>>(async () => {});

  /** 存到服务器（作品概况那一行）；成功就清掉本地草稿 */
  const persist = useCallback(async (pid: string, full: string, materials: string[]) => {
    const save = await postSafely("/api/account-diagnosis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: pid, report: full, materials }),
    });
    if (!save.ok) await throwApiError(save, "诊断做完了，但没保存上：报告先留在页面上，也存在了这台电脑的浏览器里，下次打开会自动再存");
    clearDraft(DRAFT_KEY(pid));
    const data = await save.json().catch(() => null);
    if (data?.diagnosis) setSaved(data.diagnosis as Diagnosis);
    invalidateCreatorContext();
  }, []);

  const load = useCallback(async (pid: string) => {
    const d = await fetch(`/api/work-insights?profileId=${encodeURIComponent(pid)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setSaved((d?.insight?.diagnosis as Diagnosis | null | undefined) ?? null);
    setReport("");
    setDraftNote("");
    try { setLink(localStorage.getItem(LINK_KEY(pid)) ?? ""); } catch { /* 读不到就空着 */ }
    // 本地草稿（lib/report-draft）：上次写完没存上的自动补存；没写完的摆出来
    const draft = readDraft(DRAFT_KEY(pid));
    if (!draft) return;
    if (!draft.done) {
      setReport(draft.report);
      setDraftNote("这是上次没写完的诊断（页面中途关了或刷新了），只存在这台电脑上。可以看，也可以重新诊断一次。");
      return;
    }
    await persist(pid, draft.report, draft.materials)
      .then(() => setDraftNote("上次没存上的诊断已经补存好了，也同步给各板块了"))
      .catch(() => { setReport(draft.report); setDraftNote("上次诊断完没存上，报告在下面；这台电脑上留着，下次打开会再试着保存"); });
  }, [persist]);

  useEffect(() => {
    const sync = () => {
      const pid = getActiveProfileId();
      setProfileId(pid);
      if (pid) void load(pid);
    };
    sync();
    return onActiveProfileChange(sync);
  }, [load]);

  const run = async (collected: Collection | null, images: File[]) => {
    const pid = profileId;
    if (!pid) { notify("先在侧边栏选一个档案"); return; }
    if (running) return;
    setRunning(true);
    setReport("");
    try {
      setProgress("读导入的文件和作品记录");
      const mat = await fetch(`/api/account-diagnosis?profileId=${encodeURIComponent(pid)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const files = (mat?.files as { name: string; text: string }[] | undefined) ?? [];
      const overview = mat?.overview as { works: number; published: number; withData: number } | undefined;
      if (!collected && !files.length && !overview?.works) {
        notify("还没有可以诊断的材料：粘贴你的抖音主页一键采集，或者在下面导入抖音后台导出的作品数据", "error");
        return;
      }

      const imageIds: string[] = [];
      for (const [i, f] of images.slice(0, MAX_IMAGES).entries()) {
        setProgress(`上传截图和封面 ${i + 1}/${Math.min(images.length, MAX_IMAGES)}`);
        imageIds.push(await uploadImage(f));
      }

      const cov = collected ? coverageEstimate(collected) : null;
      const materialLines = [
        collected ? `${collectionSummary(collected)}${cov ? `，大约覆盖最近 ${cov.days} 天` : ""}` : "这次没有采集主页",
        files.length ? `导入的文件 ${files.length} 个：${files.map((f) => f.name).join("、")}` : "没有导入文件（没有抖音后台的真实数据）",
        overview ? `作品记录 ${overview.works} 条，已发布 ${overview.published} 条，录了数据的 ${overview.withData} 条` : "",
        imageIds.length ? `截图和封面 ${imageIds.length} 张` : "",
      ].filter(Boolean);
      // 地基：档案、简报等按「自由对话」那一份给（最全）；再附上账号定位原文，好对照「定的」和「实际的」。旧的诊断不带，免得自己抄自己
      const ctx = { ...context, workInsight: context.workInsight ? { ...context.workInsight, diagnosis: null } : null };
      const foundation = [
        buildContextBlock(ctx, "freeChat"),
        context.positioning?.full ? `## 账号定位原文\n${context.positioning.full.slice(0, 6000)}` : "",
        context.contentPositioning ? `## 内容定位原文\n${context.contentPositioning.slice(0, 3000)}` : "",
      ].filter(Boolean).join("\n\n");

      const query = buildDiagnosisQuery({
        profileName: context.profile?.profile_name ?? "",
        materialLines,
        collectedText: collected ? formatCollection(collected) : "",
        fileTexts: files,
        insightBlock: (mat?.insightBlock as string | undefined) ?? "",
        contextBlock: foundation,
      });

      setProgress("AI 诊断中");
      const res = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: DIAGNOSIS_TASK_TYPE, query, imageFileIds: imageIds, profileId: pid }),
      });
      if (!res.ok) await throwApiError(res, "诊断失败");
      setDraftNote("");
      let lastAt = 0;
      const full = await readDifyStream(res, {
        onChunk: (_p, text) => {
          setReport(text);
          // 边写边存草稿（隔 2 秒存一次）：中途刷新、关页面也留得住
          if (Date.now() - lastAt >= DRAFT_THROTTLE_MS) {
            lastAt = Date.now();
            saveDraft(DRAFT_KEY(pid), { report: text, done: false, materials: materialLines });
          }
        },
      });
      if (!full.trim()) throw new Error("这次没诊断出内容，可以再试一次");
      setReport(full);
      saveDraft(DRAFT_KEY(pid), { report: full, done: true, materials: materialLines });

      await persist(pid, full, materialLines);
      // 存好了：下面显示的就是存下的这份
      setReport("");
      notify("诊断完成，已同步给选题、方向、内容规划、起号、脚本、地基板块和开物助理");
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message, "error");
    } finally {
      setRunning(false);
      setProgress("");
    }
  };
  runRef.current = run;

  // 插件：报到、交来自己主页的采集结果（插件只把「自己的号」交给这一页）
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; version?: string; captures?: Capture[]; collection?: unknown } | null;
      if (data?.source !== "kaiwu-capture") return;
      setInstalled(true);
      if (typeof data.version === "string") setVersion(data.version);
      if (data.type !== "captures") return;
      const col = sanitizeCollection(data.collection);
      if (!col || col.purpose !== "self") return;
      const captures = Array.isArray(data.captures) ? data.captures : [];
      const key = batchKey(captures, col);
      if (key === lastBatch.current) return;
      lastBatch.current = key;
      window.postMessage({ source: "kaiwu-page", type: "received" }, window.location.origin);
      const images = captures.map((c, i) => (typeof c?.dataUrl === "string" ? dataUrlToFile(c.dataUrl, `${c.kind === "cover" ? "封面" : "主页截图"}-${i + 1}`) : null)).filter((f): f is File => !!f);
      setMsg("");
      pending.current = { collected: col, images };
      setTick((n) => n + 1);
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "kaiwu-page", type: "ready" }, window.location.origin);
    const timer = window.setTimeout(() => { if (document.documentElement.hasAttribute("data-kaiwu-capture")) setInstalled(true); }, 1500);
    return () => { window.removeEventListener("message", onMessage); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!pending.current || loading || !profileId) return;
    const { collected, images } = pending.current;
    pending.current = null;
    void runRef.current(collected, images);
  }, [tick, loading, profileId]);

  const collect = () => {
    const url = douyinLinkFromText(link);
    if (!url) return setMsg("没认出抖音链接：打开你自己的抖音主页，复制浏览器地址栏的链接，或者抖音 App 里「分享主页 → 复制链接」");
    if (!installed) return setMsg("要先装「开物 · 截屏带入」插件（在「对标 & 热点」页有安装步骤），装好刷新这一页再点");
    if (version && versionBelow(version, SELF_SINCE)) return setMsg(`插件是旧版本（${version}），还不会诊断自己的号：到「对标 & 热点」页按提示更新插件，刷新这一页再点`);
    try { if (profileId) localStorage.setItem(LINK_KEY(profileId), link.trim()); } catch { /* 存不了就算了 */ }
    window.postMessage({ source: "kaiwu-page", type: "collect", url, purpose: "self" }, window.location.origin);
    setMsg("插件已经去打开你的主页、自动采集了：大约 3 分钟，采完自动回到这里开始诊断。采集时先别动那个标签页；抖音要求验证的话，在那个页面上手动完成就行。");
  };

  if (!profileId) return null;
  const shown = report || saved?.report || "";

  return (
    <section className="glass-panel mb-6 space-y-3 rounded-2xl p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground"><Stethoscope className="h-4 w-4 text-primary" />诊断我的账号</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          用拆对标的同一套方法拆你自己的号：实际做成了什么样、和地基定的差多少，配比、流量、人设、变现、评论区逐项诊断，再给出接下来 30 天怎么做。诊断结果会同步给选题、方向、内容规划、起号、脚本、地基板块和开物助理（各自只拿用得上的那部分）。
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="我的抖音主页链接"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") collect(); }}
          placeholder="粘贴你自己的抖音主页链接，或抖音 App 里分享主页复制的整段文字"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground"
        />
        <button type="button" onClick={collect} disabled={running} className="brand-gradient shrink-0 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
          一键采集并诊断
        </button>
        <button type="button" onClick={() => void run(null, [])} disabled={running} className="shrink-0 rounded-lg border border-border px-3 py-2 text-[12.5px] text-foreground hover:bg-foreground/[0.06] disabled:opacity-60">
          只用导入的数据诊断
        </button>
      </div>
      <p className="text-[12px] text-muted-foreground">
        想诊断得准：在下面「账号作品概况」里导入抖音创作者中心导出的作品数据表格（播放、完播、5 秒完播、涨粉），诊断会一起读；在电脑上登录抖音网页版，采集能读得更全。
      </p>
      {msg && <p className="text-[12.5px] text-foreground">{msg}</p>}
      {draftNote && <p className="rounded-lg border border-primary/30 px-3 py-2 text-[12.5px] text-foreground">{draftNote}</p>}
      {running && <p className="flex items-center gap-1.5 text-[12.5px] text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" />{progress || "诊断中…"}</p>}
      {shown && (
        <div className="space-y-1.5">
          {!report && saved && <p className="text-[12px] text-muted-foreground">上一次诊断：{saved.generatedAt.slice(0, 10)}{saved.materials.length ? `｜${saved.materials.join("；")}` : ""}</p>}
          <BenchmarkReport report={shown} streaming={running} title="账号诊断报告" />
        </div>
      )}
    </section>
  );
}
