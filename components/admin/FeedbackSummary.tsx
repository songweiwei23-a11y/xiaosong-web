"use client";

import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

interface Summary {
  days: number;
  total: number;
  up: number;
  down: number;
  satisfaction: number | null;
  byBoard: { board: string; up: number; down: number }[];
  reasons: { reason: string; count: number }[];
}

const BOARD_LABEL: Record<string, string> = {
  topic: "选题策划",
  script: "脚本生成",
  storyboard: "分镜脚本",
  review: "审稿优化",
  title: "标题封面",
  growth: "起号",
  remix: "跨行业二创",
  breakdown: "拆解爆款",
  direction: "创作方向",
  "deal-reason": "成交理由",
  positioning: "账号定位",
  "content-plan": "内容规划",
  "industry-advice": "行业建议",
  "creative-brief": "创作简报",
  "free-chat": "自由对话",
};

/** 结果反馈的汇总：有用占比、各板块好评差评、没用的原因 */
export function FeedbackSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/feedback?days=30")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "读取失败");
        setData(json);
      })
      .catch((e) => setError(e.message || "读取失败"));
  }, []);

  return (
    <section className="glass-panel mb-6 rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">结果反馈</h2>
        <span className="text-[12px] text-muted-foreground">近 30 天，用户对每条结果点的「有用 / 没用」</span>
      </div>

      {error && <p className="text-[13px] text-muted-foreground">{error}</p>}
      {!error && !data && <p className="text-[13px] text-muted-foreground">读取中…</p>}

      {data && data.total === 0 && (
        <p className="text-[13px] text-muted-foreground">还没有反馈。用户在结果下面点「有用 / 没用」之后会出现在这里。</p>
      )}

      {data && data.total > 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 p-3">
              <div className="text-[12px] text-muted-foreground">反馈条数</div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{data.total}</div>
            </div>
            <div className="rounded-xl border border-border/60 p-3">
              <div className="text-[12px] text-muted-foreground">有用占比</div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{data.satisfaction}%</div>
            </div>
            <div className="rounded-xl border border-border/60 p-3">
              <div className="text-[12px] text-muted-foreground">有用 / 没用</div>
              <div className="mt-1 flex items-center gap-2 text-[20px] font-semibold tabular-nums text-foreground">
                <span className="inline-flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{data.up}</span>
                <span className="inline-flex items-center gap-1"><ThumbsDown className="h-4 w-4" />{data.down}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">板块</th>
                  <th className="py-2 pr-3 font-medium">有用</th>
                  <th className="py-2 pr-3 font-medium">没用</th>
                  <th className="py-2 font-medium">有用占比</th>
                </tr>
              </thead>
              <tbody>
                {data.byBoard.map((b) => (
                  <tr key={b.board} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-foreground">{BOARD_LABEL[b.board] ?? b.board}</td>
                    <td className="py-2 pr-3 tabular-nums">{b.up}</td>
                    <td className="py-2 pr-3 tabular-nums">{b.down}</td>
                    <td className="py-2 tabular-nums">{Math.round((b.up / (b.up + b.down)) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.reasons.length > 0 && (
            <div>
              <div className="mb-2 text-[12px] text-muted-foreground">没用的原因</div>
              <div className="flex flex-wrap gap-2">
                {data.reasons.map((r) => (
                  <span key={r.reason} className="rounded-lg border border-border/60 px-2.5 py-1 text-[12.5px] text-foreground">
                    {r.reason} · {r.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
