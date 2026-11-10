"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { postSafely } from "@/lib/safe-post";
import { isNetworkError, NETWORK_ERROR_HINT } from "@/lib/api-error";
import { collectionSummary, formatCollection, sanitizeCollection } from "@/lib/benchmark-collection";
import { douyinLinkFromText, SELF_SINCE, versionBelow } from "@/components/benchmark/CaptureBridge";
import { CONTENT_ROLE_LIST } from "@/lib/content-roles";
import {
  REVIEW_BOARD_LABELS, reviewFreshness, reviewMonthLabel, STALE_WARN_DAYS,
  type MonthlyReview as Review, type ReviewDataStatus, type ReviewMemory, type ReviewStrategy,
} from "@/lib/monthly-review";
import { ReportArchive } from "./ReportArchive";
import { claimSelfCollection, SELF_LINK_KEY, wantSelfCollection } from "@/lib/self-collect-target";
import { PLUGIN_SILENT, pluginVersionFromPage, prepareCollectLink, watchPluginOpened } from "@/lib/collect-link-client";

/**
 * 创作进度里的「月度复盘 · 下月策略卡」（2026-11-08 产品方：全链路——产出、结果、复盘、调整接下来的方向）。
 * - 每月 1 号服务器自动复盘上个月；这里也能随时手动复盘（可以像诊断账号一样贴自己的主页，让插件采一遍再复盘）
 * - 策略卡出来直接生效：选题、方向、内容规划、起号、自由对话、开物助理照它调整；脚本、二创只拿两行
 * - 可以改、可以关掉、可以退回上一版；每一份复盘都永久存档
 */

interface Job { state: "idle" | "running" | "failed"; error?: string; month?: string }
interface Data { review: Review | null; history: Review[]; memory: ReviewMemory; job: Job; defaultMonth: string; dataStatus?: ReviewDataStatus | null }

function monthOptions(defaultMonth: string): string[] {
  const now = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 7);
  const list: string[] = [];
  let [y, m] = now.split("-").map(Number);
  for (let i = 0; i < 6; i++) {
    list.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return list.includes(defaultMonth) ? list : [defaultMonth, ...list];
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function MonthlyReview() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [month, setMonth] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [installed, setInstalled] = useState(false);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<null | { focus: string; mixReason: string; doMore: string; doLess: string; experiments: string; boards: Record<string, string> }>(null);
  const [showHistory, setShowHistory] = useState(false);
  const lastBatch = useRef("");

  const load = useCallback(async (pid: string, m?: string) => {
    const q = `profileId=${encodeURIComponent(pid)}${m ? `&month=${encodeURIComponent(m)}` : ""}`;
    const d = await fetch(`/api/monthly-review?${q}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) return;
    setData(d as Data);
    setMonth((x) => x || (d as Data).defaultMonth);
  }, []);
  // 换了月份：重新看那个月的数据齐不齐
  const pickMonth = (m: string) => { setMonth(m); if (profileId) void load(profileId, m); };

  useEffect(() => {
    const sync = () => {
      const pid = getActiveProfileId();
      setProfileId(pid);
      setData(null);
      setMonth("");
      setEditing(null);
      if (pid) { void load(pid); try { setLink(localStorage.getItem(SELF_LINK_KEY(pid)) ?? ""); } catch { /* 读不到就空着 */ } }
    };
    sync();
    return onActiveProfileChange(sync);
  }, [load]);

  // 复盘在后台跑：跑着的时候每 5 秒看一眼，跑完刷新策略卡、通知各板块重新读
  const running = data?.job.state === "running";
  useEffect(() => {
    if (!running || !profileId) return;
    const t = window.setInterval(async () => {
      const before = data?.review?.generatedAt;
      const d = await fetch(`/api/monthly-review?profileId=${encodeURIComponent(profileId)}${month ? `&month=${encodeURIComponent(month)}` : ""}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!d) return;
      setData(d as Data);
      if ((d as Data).job.state !== "running") {
        if ((d as Data).review?.generatedAt !== before) { invalidateCreatorContext(); notify("复盘完成，下月策略卡已生效：选题、方向、内容规划、起号会照它调整"); }
        else if ((d as Data).job.state === "failed") notify((d as Data).job.error || "复盘没有完成，可以再试一次", "error");
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [running, profileId, data?.review?.generatedAt, month]);

  const start = async (collected?: { text: string; summary: string }) => {
    if (!profileId) { notify("先在侧边栏选一个档案"); return; }
    setBusy(true);
    try {
      const res = await postSafely("/api/monthly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, action: "run", month, collectedText: collected?.text ?? "", collectedSummary: collected?.summary ?? "" }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { notify(d?.error || "复盘没开始，请稍后再试", "error"); return; }
      setMsg("");
      notify("开始复盘了：大约 1～2 分钟，可以先去做别的，做完这里会自动更新");
      await load(profileId, month);
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const startRef = useRef(start);
  startRef.current = start;

  // 插件：只接「复盘这边发起的」那一次采集（诊断账号也用同一个插件，见 lib/self-collect-target）
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const d = event.data as { source?: string; type?: string; version?: string; captures?: unknown[]; collection?: unknown } | null;
      if (d?.source !== "kaiwu-capture") return;
      setInstalled(true);
      if (typeof d.version === "string") setVersion(d.version);
      if (d.type !== "captures") return;
      const col = sanitizeCollection(d.collection);
      if (!col || col.purpose !== "self") return;
      const key = JSON.stringify([col.profile?.name, col.works?.length, col.collectedAt]);
      if (key === lastBatch.current) return;
      if (!claimSelfCollection("review")) return;
      lastBatch.current = key;
      window.postMessage({ source: "kaiwu-page", type: "received" }, window.location.origin);
      void startRef.current({ text: formatCollection(col), summary: collectionSummary(col) });
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "kaiwu-page", type: "ready" }, window.location.origin);
    const timer = window.setTimeout(() => { if (document.documentElement.hasAttribute("data-kaiwu-capture")) setInstalled(true); }, 1500);
    return () => { window.removeEventListener("message", onMessage); window.clearTimeout(timer); };
  }, []);

  const [checking, setChecking] = useState(false);
  const collect = async () => {
    const raw = douyinLinkFromText(link);
    if (!raw) return setMsg("没认出抖音链接：打开你自己的抖音主页，复制浏览器地址栏的链接，或者抖音 App 里「分享主页 → 复制链接」");
    const v = version || pluginVersionFromPage();
    if (!installed && !v) return setMsg("要先装「开物 · 截屏带入」插件（在「对标 & 热点」页有安装步骤），装好刷新这一页再点");
    if (v && versionBelow(v, SELF_SINCE)) return setMsg(`插件是旧版本（${v}），还不会采自己的号：到「对标 & 热点」页重新下载安装新版，刷新这一页再点`);
    // 先解析链接（见 lib/collect-link-client）：不是主页的当场说清楚，不交给插件空跑
    setChecking(true);
    setMsg("正在核对链接…");
    const prepared = await prepareCollectLink(raw);
    setChecking(false);
    if (!prepared.ok) return setMsg(prepared.message);
    try { if (profileId) localStorage.setItem(SELF_LINK_KEY(profileId), link.trim()); } catch { /* 存不了就算了 */ }
    wantSelfCollection("review");
    window.postMessage({ source: "kaiwu-page", type: "collect", url: prepared.url, purpose: "self" }, window.location.origin);
    setMsg("插件已经去打开你的主页、自动采集了：大约 3 分钟，采完自动回到这里开始复盘。采集时先别动那个标签页；抖音要求验证的话，在那个页面上手动完成就行。");
    watchPluginOpened(() => setMsg(PLUGIN_SILENT));
  };

  const act = async (body: Record<string, unknown>, done: string) => {
    if (!profileId) return;
    setBusy(true);
    try {
      const res = await postSafely("/api/monthly-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, ...body }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) { notify(d?.error || "没保存上，请稍后再试", "error"); return; }
      await load(profileId, month);
      invalidateCreatorContext();
      notify(done);
      setEditing(null);
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (s: ReviewStrategy) => setEditing({
    focus: s.focus, mixReason: s.mixReason, doMore: s.doMore.join("\n"), doLess: s.doLess.join("\n"),
    experiments: s.experiments.map((e) => [e.name, e.how, e.success].join("｜")).join("\n"),
    boards: Object.fromEntries(REVIEW_BOARD_LABELS.map((b) => [b, s.boards[b] ?? ""])),
  });
  const saveEdit = () => {
    if (!editing || !data?.review) return;
    const strategy: ReviewStrategy = {
      focus: editing.focus.trim(), mix: data.review.strategy.mix, mixReason: editing.mixReason.trim(),
      doMore: lines(editing.doMore), doLess: lines(editing.doLess),
      experiments: lines(editing.experiments).map((l) => { const [name, how = "", success = ""] = l.split(/[｜|]/).map((x) => x.trim()); return { name, how, success }; }).filter((e) => e.name),
      boards: Object.fromEntries(Object.entries(editing.boards).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
    };
    void act({ action: "edit", strategy }, "策略卡改好了，各板块下次生成就照新的来");
  };

  if (!profileId) return null;
  const r = data?.review ?? null;
  const fresh = reviewFreshness(r);
  const s = r?.strategy;
  const input = "w-full rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[12.5px] text-foreground";

  return (
    <section className="glass-panel mb-6 space-y-3 rounded-2xl p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground"><RefreshCcw className="h-4 w-4 text-primary" />月度复盘 · 下月策略卡</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          每月 1 号自动复盘上个月：这个月做了什么、什么起作用、上个月的试验成没成，再定下个月的策略卡。策略卡直接生效，选题、方向、内容规划、起号、自由对话和开物助理会照它调整，二创只拿两行提醒（写脚本不读，保持脚本只看档案和写作底线）；你随时可以改、关掉或退回上一版。复盘不扣次数，每一份都永久存着。
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select aria-label="复盘哪个月" value={month} onChange={(e) => pickMonth(e.target.value)} className="rounded-lg border border-border bg-background px-2.5 py-2 text-[13px] text-foreground">
          {monthOptions(data?.defaultMonth || month || "").filter(Boolean).map((m) => <option key={m} value={m}>{reviewMonthLabel(m)}</option>)}
        </select>
        <input
          aria-label="我的抖音主页链接（复盘用）"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="可选：粘贴你自己的抖音主页链接，插件采一遍再复盘"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground"
        />
        <button type="button" onClick={() => void collect()} disabled={busy || running || checking} className="brand-gradient shrink-0 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">采集主页并复盘</button>
        <button type="button" onClick={() => void start()} disabled={busy || running} className="shrink-0 rounded-lg border border-border px-3 py-2 text-[12.5px] text-foreground hover:bg-foreground/[0.06] disabled:opacity-60">只用作品记录复盘</button>
      </div>
      {data?.dataStatus && (() => {
        // 补数据入口（第三步）：复盘前看一眼这个月的数据齐不齐，缺的指到录数据、导入数据表的地方
        const ds = data.dataStatus;
        return (
          <div className="space-y-1 rounded-lg bg-foreground/[0.03] px-3 py-2 text-[12.5px] text-muted-foreground">
            {ds.published === 0 ? (
              <p>{reviewMonthLabel(ds.month)}还没有记成「已发布」的作品：复盘只能看作品记录和导入的数据，结论会比较粗。</p>
            ) : ds.missing.length ? (
              <p>
                <span className="text-amber-500">{reviewMonthLabel(ds.month)}发布了 {ds.published} 条，{ds.published - ds.withData} 条还没录数据</span>，复盘看不到它们的效果：
                {ds.missing.map((t) => `《${t}》`).join("")}{ds.published - ds.withData > ds.missing.length ? "…" : ""}
                <a href="#metrics-import" className="ml-1 text-primary underline">去录数据</a>
                <a href="#import-materials" className="ml-2 text-primary underline">导入抖音后台的数据表</a>
              </p>
            ) : (
              <p className="text-emerald-500">{reviewMonthLabel(ds.month)}发布的 {ds.published} 条都录了数据 ✓</p>
            )}
            {ds.noPurpose > 0 && <p>{ds.noPurpose} 条作品没记视频目的：复盘时会按流量型 / 人设型 / 变现型推测，标明「推测」，不算进确定的配比。</p>}
          </div>
        );
      })()}
      {msg && <p className="text-[12.5px] text-foreground">{msg}</p>}
      {running &&<p className="flex items-center gap-1.5 text-[12.5px] text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在复盘{data?.job.month ? ` ${reviewMonthLabel(data.job.month)}` : ""}，大约 1～2 分钟，做完自动更新</p>}
      {data?.job.state === "failed" && <p className="text-[12.5px] text-destructive">上次复盘没完成：{data.job.error}</p>}

      {r && s && (
        <div className="space-y-3 rounded-xl border border-border/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-foreground">
              {reviewMonthLabel(r.month)}复盘定的策略卡
              <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">{r.generatedAt.slice(0, 10)} · {r.source === "auto" ? "自动复盘" : "手动复盘"}{r.edited ? " · 改过" : ""}</span>
            </p>
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              {!editing && <button type="button" disabled={busy} onClick={() => beginEdit(s)} className="rounded-md border border-border px-2 py-1 hover:bg-foreground/[0.06]">改策略卡</button>}
              <button type="button" disabled={busy} onClick={() => void act({ action: "toggle", off: !r.off }, r.off ? "策略卡已打开，各板块重新照它调整" : "策略卡已关掉，各板块暂时不读它")} className="rounded-md border border-border px-2 py-1 hover:bg-foreground/[0.06]">{r.off ? "打开" : "关掉"}</button>
              {!!data?.history.length && <button type="button" onClick={() => setShowHistory((v) => !v)} className="rounded-md border border-border px-2 py-1 hover:bg-foreground/[0.06]">退回旧版</button>}
            </div>
          </div>
          {fresh === "off" && <p className="text-[12.5px] text-amber-500">这张卡关着，各板块现在不读它。</p>}
          {(fresh === "stale" || fresh === "expired") && <p className="text-[12.5px] text-amber-500">这张卡超过 {STALE_WARN_DAYS} 天没更新了{fresh === "expired" ? "，各板块已经不再读它" : "，各板块只当参考"}；复盘一次就会换成新的。</p>}
          {r.summary && <p className="text-[13px] text-foreground">{r.summary}</p>}

          {showHistory && !!data?.history.length && (
            <ul className="space-y-1 rounded-lg bg-foreground/[0.03] p-2 text-[12.5px]">
              {data.history.map((h, i) => (
                <li key={h.generatedAt + i} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{reviewMonthLabel(h.month)}（{h.generatedAt.slice(0, 10)}）：{h.strategy.focus}</span>
                  <button type="button" disabled={busy} onClick={() => void act({ action: "rollback", index: i }, `已退回 ${reviewMonthLabel(h.month)} 那一版`)} className="shrink-0 text-primary hover:underline">用这一版</button>
                </li>
              ))}
            </ul>
          )}

          {editing ? (
            <div className="space-y-2 text-[12.5px]">
              <label className="block">最该抓的一件事<input className={input} value={editing.focus} onChange={(e) => setEditing({ ...editing, focus: e.target.value })} /></label>
              <label className="block">配比说明<input className={input} value={editing.mixReason} onChange={(e) => setEditing({ ...editing, mixReason: e.target.value })} /></label>
              <label className="block">多做（一行一条）<textarea rows={3} className={input} value={editing.doMore} onChange={(e) => setEditing({ ...editing, doMore: e.target.value })} /></label>
              <label className="block">少做（一行一条）<textarea rows={2} className={input} value={editing.doLess} onChange={(e) => setEditing({ ...editing, doLess: e.target.value })} /></label>
              <label className="block">本月试验（一行一个：试验名｜怎么做｜怎么算成了，最多 3 个）<textarea rows={3} className={input} value={editing.experiments} onChange={(e) => setEditing({ ...editing, experiments: e.target.value })} /></label>
              {REVIEW_BOARD_LABELS.map((b) => (
                <label key={b} className="block">给{b}<input className={input} value={editing.boards[b] ?? ""} onChange={(e) => setEditing({ ...editing, boards: { ...editing.boards, [b]: e.target.value } })} /></label>
              ))}
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={saveEdit} className="brand-gradient rounded-lg px-3 py-1.5 text-white disabled:opacity-60">保存</button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-border px-3 py-1.5">取消</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 text-[12.5px] leading-relaxed sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-foreground"><span className="font-medium">最该抓：</span>{s.focus}</p>
                <p className="text-muted-foreground"><span className="text-foreground">配比：</span>{s.mix ? CONTENT_ROLE_LIST.map((x) => `${x} ${s.mix![x]}%`).join("、") : "暂不调整"}{s.mixReason ? `（${s.mixReason}）` : ""}</p>
                {s.doMore.map((x) => <p key={x} className="text-muted-foreground">＋ {x}</p>)}
                {s.doLess.map((x) => <p key={x} className="text-muted-foreground">－ {x}</p>)}
                {s.experiments.map((e) => <p key={e.name} className="text-muted-foreground"><span className="text-primary">试验</span> {e.name}：{e.how}{e.success ? `（成没成看：${e.success}）` : ""}</p>)}
              </div>
              <div className="space-y-1.5">
                {REVIEW_BOARD_LABELS.filter((b) => s.boards[b]).map((b) => <p key={b} className="text-muted-foreground"><span className="text-foreground">给{b}：</span>{s.boards[b]}</p>)}
                {r.experimentResults.length > 0 && <p className="pt-1 font-medium text-foreground">上月试验</p>}
                {r.experimentResults.map((e) => <p key={e.name} className="text-muted-foreground">{e.name}：<span className={e.result === "成了" ? "text-emerald-500" : e.result === "没成" ? "text-amber-500" : ""}>{e.result}</span>{e.evidence ? `（${e.evidence}）` : ""}</p>)}
              </div>
            </div>
          )}

          {(r.worked.length > 0 || r.notWorked.length > 0) && (
            <details className="text-[12.5px] text-muted-foreground">
              <summary className="cursor-pointer text-foreground">这个月什么起作用、什么没起作用</summary>
              <div className="mt-1.5 space-y-1">
                {r.worked.map((x) => <p key={x}>✓ {x}</p>)}
                {r.notWorked.map((x) => <p key={x}>✗ {x}</p>)}
                {!!r.inferred?.length && (
                  <p className="pt-1">没记目的的作品（推测，不算进确定配比）：{r.inferred.map((x) => `《${x.title}》${x.purpose}${x.why ? `（${x.why}）` : ""}`).join("；")}</p>
                )}
                {r.dataGaps.length > 0 && <p className="pt-1 text-foreground">补了能复盘得更准：{r.dataGaps.join("；")}</p>}
                {r.materials.length > 0 && <p className="pt-1">读到的材料：{r.materials.join("；")}</p>}
              </div>
            </details>
          )}
          {(data?.memory.verified.length || data?.memory.dropped.length) ? (
            <p className="text-[12px] text-muted-foreground">
              {data!.memory.verified.length ? <>这个号验证过有效的：{data!.memory.verified.map((v) => v.name).join("；")}。</> : null}
              {data!.memory.dropped.length ? <>试过没成的（不再推荐）：{data!.memory.dropped.map((v) => v.name).join("；")}。</> : null}
            </p>
          ) : null}
        </div>
      )}
      {data && !r && !running && <p className="text-[12.5px] text-muted-foreground">还没有策略卡。点上面复盘一次（这个月作品少也能复盘，会告诉你缺什么）。</p>}

      <ReportArchive profileId={profileId} kind="review" label="历次复盘" />
    </section>
  );
}
