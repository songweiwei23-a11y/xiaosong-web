"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPage, AdminPanelHint, Button, ErrorState, Panel, StatCard, readError } from "@/components/admin/kit";
import type { MigrationState, MigrationStatus } from "@/lib/migration-status";

/*
 * 迁移状态（体检 P0-2）。每个迁移文件建的表、加的列，在库里是不是都在。
 * 有「缺失」的，说明对应功能现在用户那边是「暂时不可用」，去 Supabase SQL Editor 执行那个文件即可。
 */

interface Resp {
  summary: { total: number; applied: number; partial: number; missing: number; unknown: number };
  items: MigrationStatus[];
}

const LABEL: Record<MigrationState, { text: string; cls: string }> = {
  applied: { text: "已执行", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  partial: { text: "缺列", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  missing: { text: "未执行", cls: "bg-destructive/15 text-destructive" },
  unknown: { text: "无法自动检测", cls: "bg-foreground/10 text-muted-foreground" },
};

export default function MigrationsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // 读取本身不同步改加载态（只在请求结束后才改），按钮「重新检查」会先切到加载中
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/migrations", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "读取失败"));
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/migrations", { cache: "no-store" });
        if (!res.ok) throw new Error(await readError(res, "读取失败"));
        const json: Resp = await res.json();
        if (!off) setData(json);
      } catch (e) {
        if (!off) setError((e as Error).message);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, []);

  const pending = data?.items.filter((i) => i.state === "missing" || i.state === "partial") ?? [];

  return (
    <AdminPage
      title="迁移状态"
      subtitle="每个迁移文件建的表、加的列，在数据库里是不是都在"
      actions={<Button onClick={load} busy={loading}><RefreshCw className="h-4 w-4" />重新检查</Button>}
    >
      {error && <ErrorState message={error} onRetry={load} />}

      {data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="已执行" value={data.summary.applied} />
            <StatCard label="未执行" value={data.summary.missing} hint={data.summary.missing ? "对应功能对用户暂时不可用" : undefined} />
            <StatCard label="缺列" value={data.summary.partial} />
            <StatCard label="无法自动检测" value={data.summary.unknown} hint="只改策略或写数据的迁移，需要人工确认" />
          </div>

          <Panel title={pending.length ? `还需要执行的（${pending.length} 个）` : "没有缺失的迁移"}>
            {pending.length ? (
              <ul className="space-y-2">
                {pending.map((i) => (
                  <li key={i.file} className="rounded-xl border border-border/60 px-4 py-3">
                    <p className="font-mono text-[13px] text-foreground">{i.file}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {[...i.missingTables.map((t) => `缺表 ${t}`), ...i.missingColumns.map((c) => `缺列 ${c}`)].join("　")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <AdminPanelHint>所有能自动检测的迁移都已经执行。</AdminPanelHint>
            )}
            <div className="mt-3">
              <AdminPanelHint>在 Supabase 的 SQL Editor 里，按文件名顺序执行上面列出的文件（每个文件都可以重复执行，不会重复建表）。</AdminPanelHint>
            </div>
          </Panel>

          <div className="mt-5">
            <Panel title="全部迁移">
              <ul className="divide-y divide-border/60">
                {data.items.map((i) => (
                  <li key={i.file} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] ${LABEL[i.state].cls}`}>{LABEL[i.state].text}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-foreground">{i.file}</span>
                    <span className="text-[11.5px] text-muted-foreground">检查 {i.checked} 项</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
      {loading && !data && <p className="text-[13px] text-muted-foreground">正在检查…</p>}
    </AdminPage>
  );
}
