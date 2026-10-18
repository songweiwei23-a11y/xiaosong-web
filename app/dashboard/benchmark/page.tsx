"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { throwApiError } from "@/lib/api-error";
import { BenchmarkAnalyzer } from "@/components/benchmark/BenchmarkAnalyzer";
import { postSafely } from "@/lib/safe-post";

/**
 * 对标 & 热点（整改 C · 对标账号追踪）。全部手动录入：你看到的对标账号作品数据、热点线索，自己记下来。
 * 不去抓取任何平台的数据。
 */

interface Video { id: string; title: string; published_on: string | null; views: number | null; likes: number | null; completion: number | null }
interface Summary { count: number; avgViews: number | null; medianCompletion: number | null; best: { title: string; views: number } | null }
interface Analysis { id: string; materials: string[]; report: string; created_at: string }
interface Account { id: string; name: string; platform: string | null; link: string | null; note: string | null; videos: Video[]; summary: Summary; analyses: Analysis[] }
interface Hot { id: string; title: string; source_url: string | null; seen_on: string | null; note: string | null }

const inputCls = "mt-1 w-full rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[13px] text-foreground";

/** 写入一律走 postSafely：线路断了会自动重发（写的是编导自己的台账，重发不会重复扣次数） */
async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await postSafely("/api/benchmark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) await throwApiError(res, "没保存成功，请稍后再试，还不行就刷新页面");
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export default function BenchmarkPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hot, setHot] = useState<Hot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/benchmark", { cache: "no-store" });
      if (!res.ok) await throwApiError(res, "读取失败，请稍后再试，还不行就刷新页面");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      setHot(data.hotTopics ?? []);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (body: Record<string, unknown>, ok: string) => {
    try {
      await call(body);
      notify(ok);
      await load();
      return true;
    } catch (e) {
      notify((e as Error).message, "error");
      return false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">对标 & 热点</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          你看到的对标账号作品数据、热点线索，自己记下来。开物不去抓取任何平台的数据；记得多了，选题和方向会参考这些数字。
        </p>
      </header>

      {error && <p className="text-[13px] text-destructive">{error}</p>}
      {loading && !error && <p className="text-[13px] text-muted-foreground">正在读取…</p>}

      {/* 对标账号 */}
      <section className="glass-panel space-y-4 rounded-2xl p-5">
        <h2 className="text-[15px] font-semibold text-foreground">对标账号</h2>
        <AddAccount onAdd={(v) => run({ action: "addAccount", ...v }, "对标账号已添加")} />

        {accounts.length === 0 && !loading && <p className="text-[13px] text-muted-foreground">还没有对标账号。加一个，再把它的作品数据录进来。</p>}

        {accounts.map((a) => (
          <div key={a.id} className="rounded-xl border border-border/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">
                  {a.name}
                  {a.platform && <span className="ml-2 text-[12px] text-muted-foreground">{a.platform}</span>}
                </p>
                {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline">打开主页</a>}
                {a.note && <p className="mt-1 text-[12px] text-muted-foreground">{a.note}</p>}
              </div>
              <button type="button" onClick={() => run({ action: "deleteAccount", id: a.id }, "已删除这个对标账号")} aria-label={`删除 ${a.name}`} className="shrink-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-[12.5px] text-muted-foreground">
              已录 {a.summary.count} 条
              {a.summary.avgViews != null && <>，平均播放 {a.summary.avgViews.toLocaleString()}</>}
              {a.summary.medianCompletion != null && <>，完播中位数 {a.summary.medianCompletion}%</>}
              {a.summary.best && <>，播放最高：「{a.summary.best.title}」（{a.summary.best.views.toLocaleString()}）</>}
            </p>

            <div className="mt-3 space-y-1.5">
              {a.videos.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-foreground">{v.title}</span>
                  <span className="shrink-0 text-muted-foreground">{v.published_on ?? "日期未填"}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{v.views != null ? `播放 ${v.views.toLocaleString()}` : "播放未填"}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{v.completion != null ? `完播 ${v.completion}%` : ""}</span>
                  <button type="button" onClick={() => run({ action: "deleteVideo", id: v.id }, "已删除这条作品")} aria-label={`删除 ${v.title}`} className="shrink-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <AddVideo onAdd={(v) => run({ action: "addVideo", accountId: a.id, ...v }, "作品数据已记下")} />

            {/* 对标拆解（2026-10-18）：截图、文档、文字、视频都可以，拆成固定框架。直接放在这个账号下面，不用再点按钮 */}
            <div className="mt-4">
              <p className="mb-2 text-[13px] font-medium text-foreground">拆解这个账号</p>
              <BenchmarkAnalyzer
                accountId={a.id}
                accountName={a.name}
                platform={a.platform}
                onSaved={() => void load()}
              />
            </div>

            {a.analyses.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[12.5px] font-medium text-foreground">已保存的拆解（{a.analyses.length}）</p>
                {a.analyses.map((x) => (
                  <details key={x.id} className="rounded-lg border border-border/60 px-3 py-2 text-[12.5px]">
                    <summary className="cursor-pointer text-foreground">
                      {new Date(x.created_at).toLocaleDateString("zh-CN")} 的拆解 · 读到 {x.materials.length} 项材料
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-sans leading-relaxed text-foreground">{x.report}</pre>
                    <button
                      type="button"
                      onClick={() => void run({ action: "deleteAnalysis", id: x.id }, "已删除这份拆解")}
                      className="mt-2 text-[12px] text-muted-foreground hover:text-destructive"
                    >
                      删除这份拆解
                    </button>
                  </details>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* 热点线索 */}
      <section className="glass-panel space-y-4 rounded-2xl p-5">
        <h2 className="text-[15px] font-semibold text-foreground">热点线索</h2>
        <p className="text-[12px] text-muted-foreground">看到的热点记下来，写清楚在哪儿看到的、哪天看到的。开物不替你找热点。</p>
        <AddHot onAdd={(v) => run({ action: "addHot", ...v }, "热点线索已记下")} />

        {hot.map((h) => (
          <div key={h.id} className="flex items-start gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1">
              <p className="text-foreground">{h.title}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {h.seen_on ?? "日期未填"}
                {h.source_url && <> · <a href={h.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">来源</a></>}
                {h.note && <> · {h.note}</>}
              </p>
            </div>
            <button type="button" onClick={() => run({ action: "deleteHot", id: h.id }, "已删除这条热点")} aria-label={`删除热点 ${h.title}`} className="shrink-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function AddAccount({ onAdd }: { onAdd: (v: { name: string; platform: string; link: string; note: string }) => Promise<boolean> }) {
  const [v, setV] = useState({ name: "", platform: "", link: "", note: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const ok = await onAdd(v);
    setBusy(false);
    if (ok) setV({ name: "", platform: "", link: "", note: "" });
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-[12px] text-muted-foreground">名字<input aria-label="对标账号名字" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls} /></label>
      <label className="text-[12px] text-muted-foreground">平台<input aria-label="对标账号平台" value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })} placeholder="例如：抖音" className={inputCls} /></label>
      <label className="text-[12px] text-muted-foreground sm:col-span-2">主页链接（可不填）<input aria-label="对标账号链接" value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} placeholder="https://" className={inputCls} /></label>
      <label className="text-[12px] text-muted-foreground sm:col-span-2">备注（可不填）<input aria-label="对标账号备注" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className={inputCls} /></label>
      <div className="sm:col-span-2">
        <button type="button" onClick={() => void submit()} disabled={busy || !v.name.trim()} className="inline-flex items-center gap-1.5 rounded-lg brand-gradient px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" />添加对标账号
        </button>
      </div>
    </div>
  );
}

function AddVideo({ onAdd }: { onAdd: (v: { title: string; publishedOn: string; views: string; likes: string; completion: string }) => Promise<boolean> }) {
  const [v, setV] = useState({ title: "", publishedOn: "", views: "", likes: "", completion: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const ok = await onAdd(v);
    setBusy(false);
    if (ok) setV({ title: "", publishedOn: "", views: "", likes: "", completion: "" });
  };
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-5">
      <label className="text-[11.5px] text-muted-foreground sm:col-span-2">这条作品的标题<input aria-label="作品标题" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={inputCls} /></label>
      <label className="text-[11.5px] text-muted-foreground">发布日期<input aria-label="发布日期" value={v.publishedOn} onChange={(e) => setV({ ...v, publishedOn: e.target.value })} placeholder="2026-10-17" className={inputCls} /></label>
      <label className="text-[11.5px] text-muted-foreground">播放<input aria-label="播放" inputMode="decimal" value={v.views} onChange={(e) => setV({ ...v, views: e.target.value })} className={inputCls} /></label>
      <label className="text-[11.5px] text-muted-foreground">完播率（%）<input aria-label="完播率" inputMode="decimal" value={v.completion} onChange={(e) => setV({ ...v, completion: e.target.value })} className={inputCls} /></label>
      <div className="sm:col-span-5">
        <button type="button" onClick={() => void submit()} disabled={busy || !v.title.trim()} className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-foreground/[0.06] disabled:opacity-50">
          记下这条作品
        </button>
      </div>
    </div>
  );
}

function AddHot({ onAdd }: { onAdd: (v: { title: string; sourceUrl: string; seenOn: string; note: string }) => Promise<boolean> }) {
  const [v, setV] = useState({ title: "", sourceUrl: "", seenOn: "", note: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const ok = await onAdd(v);
    setBusy(false);
    if (ok) setV({ title: "", sourceUrl: "", seenOn: "", note: "" });
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-[12px] text-muted-foreground sm:col-span-2">这个热点是什么<input aria-label="热点" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={inputCls} /></label>
      <label className="text-[12px] text-muted-foreground">来源链接（可不填）<input aria-label="来源链接" value={v.sourceUrl} onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} placeholder="https://" className={inputCls} /></label>
      <label className="text-[12px] text-muted-foreground">哪天看到的（可不填）<input aria-label="看到的日期" value={v.seenOn} onChange={(e) => setV({ ...v, seenOn: e.target.value })} placeholder="2026-10-17" className={inputCls} /></label>
      <div className="sm:col-span-2">
        <button type="button" onClick={() => void submit()} disabled={busy || !v.title.trim()} className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-foreground/[0.06] disabled:opacity-50">
          记下热点
        </button>
      </div>
    </div>
  );
}
