"use client";

import { useState } from "react";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { AdminPanelHint, Button, Panel, readError } from "@/components/admin/kit";

interface Pending {
  user_id: string;
  request_id: string;
  feature: string;
  status: string;
  created_at: string;
  expires_at: string | null;
}

/**
 * 额度对账：生成请求卡在「处理中」时，有可信的完成证据就补记用量；没有证据的保持未知。
 * 这里先看待对账的请求，再预览会发生什么，确认后才真正执行。
 */
export function QuotaReconcilePanel() {
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<"list" | "preview" | "apply" | null>(null);

  const list = async () => {
    setBusy("list");
    try {
      const res = await fetch("/api/admin/quota/reconcile");
      if (!res.ok) throw new Error(await readError(res, "读取待对账记录失败"));
      const data = await res.json();
      setPending(data.requests ?? []);
      setNote(data.note ?? "");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const run = async (dryRun: boolean) => {
    if (!dryRun) {
      const ok = await confirmDialog(
        "执行对账会按证据补记这些生成请求的用量，写入后不能撤回。确定执行？",
        { tone: "danger", confirmText: "确定执行", title: "执行额度对账" }
      );
      if (!ok) return;
    }
    setBusy(dryRun ? "preview" : "apply");
    try {
      const res = await fetch("/api/admin/quota/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      if (!res.ok) throw new Error(await readError(res, "对账没有完成"));
      const data = (await res.json()) as Record<string, unknown>;
      setResult({ ...data, __dryRun: dryRun });
      if (!dryRun) {
        notify("对账已执行", "success");
        void list();
      }
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const numbers = result
    ? Object.entries(result).filter(([k, v]) => k !== "__dryRun" && typeof v === "number")
    : [];

  return (
    <Panel
      title="额度对账"
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={() => void list()} busy={busy === "list"}>查看待对账</Button>
          <Button variant="default" size="sm" onClick={() => void run(true)} busy={busy === "preview"}>预览对账</Button>
          <Button variant="primary" size="sm" onClick={() => void run(false)} busy={busy === "apply"}>执行对账</Button>
        </div>
      }
    >
      <AdminPanelHint>
        生成请求卡在「处理中」时，如果有可信的完成证据，就补记用量；没有证据的保持未知，不会凭过期时间扣次数。
        先预览，确认无误再执行。
      </AdminPanelHint>

      {pending && (
        <div className="mt-4">
          <div className="mb-2 text-[12.5px] text-muted-foreground">
            待对账 {pending.length} 条{pending.length >= 50 ? "（只显示前 50 条）" : ""}{note ? ` · ${note}` : ""}
          </div>
          {pending.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">没有待对账的请求。</p>
          ) : (
            <ul className="max-h-64 divide-y divide-border/40 overflow-y-auto text-[12.5px]">
              {pending.map((r) => (
                <li key={`${r.user_id}-${r.request_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{r.feature}</span>
                  <span className="text-muted-foreground">用户 {r.user_id.slice(0, 8)} · 请求 {r.request_id.slice(0, 10)}</span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("zh-CN")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-border/60 p-3 text-[12.5px]">
          <div className="mb-2 font-medium">{result.__dryRun ? "预览结果（还没有写入）" : "执行结果"}</div>
          {numbers.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-3">
              {numbers.map(([k, v]) => (
                <span key={k} className="tabular-nums">
                  {k}：<span className="text-foreground">{String(v)}</span>
                </span>
              ))}
            </div>
          )}
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-foreground/[0.04] p-2 text-[11.5px] text-muted-foreground">
            {JSON.stringify(Object.fromEntries(Object.entries(result).filter(([k]) => k !== "__dryRun")), null, 2)}
          </pre>
        </div>
      )}
    </Panel>
  );
}
