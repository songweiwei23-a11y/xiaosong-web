"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPage, AdminPanelHint, ErrorState, Panel, StatCard } from "@/components/admin/kit";

/**
 * 助理概览（升级方案 J1）：只读。数据来自 /api/admin/assistant/overview，只有统计数字，没有对话内容。
 * 关键的两个数：「没有回执的完成说法」次数（目标 0）和用户的有用率。
 */

interface Overview {
  days: number;
  jobs: {
    total: number;
    byStatus: Record<string, number>;
    successRate: number | null;
    modelCalls: number;
    toolCalls: number;
    perDone: { inputTokens: number; outputTokens: number; calls: number } | null;
    tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
    cheapRouted: number;
    models: Record<string, number>;
  };
  claimRewrites: { answers: number; sentences: number };
  knowledge: { answersWithoutCitation: number };
  feedback: { total: number; helpful: number; helpfulRate: number | null };
}

const pct = (v: number | null) => (v === null ? "暂无" : `${Math.round(v * 100)}%`);
const num = (v: number) => v.toLocaleString("zh-CN");

const STATUS_NAME: Record<string, string> = {
  done: "完成",
  error: "没有完成",
  stopped: "已停止",
  interrupted: "服务重启中断",
  running: "进行中",
};

export default function AssistantOverviewPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/assistant/overview?days=${days}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as Overview & { error?: string } | null;
      if (!res.ok || !body) throw new Error(body?.error || `读取失败（${res.status}）`);
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminPage
      title="助理概览"
      subtitle="开物助理最近的运行情况：完成率、用量、回答核对、用户反馈。只看统计，不含对话内容。"
      actions={
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground"
          aria-label="统计天数"
        >
          {[1, 7, 30].map((d) => (
            <option key={d} value={d}>
              近 {d} 天
            </option>
          ))}
        </select>
      }
    >
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <p className="text-[13px] text-muted-foreground">读取中…</p>}

      {data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="运行次数" value={num(data.jobs.total)} hint={`近 ${data.days} 天`} />
            <StatCard label="完成率" value={pct(data.jobs.successRate)} hint={`完成 ${num(data.jobs.byStatus.done ?? 0)} 次`} />
            <StatCard
              label="没有回执的完成说法"
              value={num(data.claimRewrites.sentences)}
              hint={`涉及 ${num(data.claimRewrites.answers)} 次回答；目标为 0`}
              tone={data.claimRewrites.sentences > 0 ? "warn" : "ok"}
            />
            <StatCard label="用户反馈有用率" value={pct(data.feedback.helpfulRate)} hint={`共 ${num(data.feedback.total)} 条反馈`} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="模型调用次数" value={num(data.jobs.modelCalls)} hint={`工具调用 ${num(data.jobs.toolCalls)} 次`} />
            <StatCard
              label="单次平均 token"
              value={data.jobs.perDone ? num(data.jobs.perDone.inputTokens + data.jobs.perDone.outputTokens) : "暂无"}
              hint={data.jobs.perDone ? `输入 ${num(data.jobs.perDone.inputTokens)} · 输出 ${num(data.jobs.perDone.outputTokens)}` : "没有完成的任务"}
            />
            <StatCard label="便宜模型分流" value={num(data.jobs.cheapRouted)} hint="没配置便宜模型时为 0" />
            <StatCard
              label="知识库没写出资料名"
              value={num(data.knowledge.answersWithoutCitation)}
              hint="用了资料却没注明出处的回答"
            />
          </div>

          <Panel title="运行结果分布">
            <ul className="grid grid-cols-2 gap-2 text-[13px] md:grid-cols-5">
              {Object.entries(data.jobs.byStatus).map(([k, v]) => (
                <li key={k} className="rounded-xl border border-border/60 px-3 py-2">
                  <p className="text-muted-foreground">{STATUS_NAME[k] ?? k}</p>
                  <p className="mt-0.5 text-[16px] font-medium text-foreground">{num(v)}</p>
                </li>
              ))}
            </ul>
            <AdminPanelHint>
              「没有回执的完成说法」是模型说了「已改好 / 已记下」却没有对应的操作结果，系统已经把那一句改写成「没有完成」。这个数字应该趋近于 0。
            </AdminPanelHint>
          </Panel>

          <Panel title="使用的模型">
            {Object.keys(data.jobs.models).length === 0 ? (
              <p className="text-[13px] text-muted-foreground">还没有记录。</p>
            ) : (
              <ul className="space-y-1 text-[13px]">
                {Object.entries(data.jobs.models).map(([m, n]) => (
                  <li key={m} className="flex justify-between gap-3">
                    <span className="font-mono text-foreground">{m}</span>
                    <span className="text-muted-foreground">{num(n)} 次</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </AdminPage>
  );
}
