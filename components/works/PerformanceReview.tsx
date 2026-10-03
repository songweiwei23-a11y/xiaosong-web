'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'
import { getActiveProfileId, onActiveProfileChange } from '@/lib/active-profile'
import { metricsLine, MIN_SAMPLE, type PerformanceSummary } from '@/lib/performance'

/**
 * 数据复盘（数据回流，lib/performance）：当前档案录了数据的作品，按三种视频、拍法汇总，
 * 列出数据最好 / 最差的几条和看得出来的规律。这些同样会写进选题、方向、起号、自由对话的提示词。
 */
export function PerformanceReview({ revision }: { revision: number }) {
  const [data, setData] = useState<PerformanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<string | null>(() => getActiveProfileId())

  useEffect(() => onActiveProfileChange(() => setScope(getActiveProfileId())), [])
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/works/performance${scope ? `?profileId=${encodeURIComponent(scope)}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [scope, revision])

  if (loading && !data) return <div className="mb-4 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />读取数据复盘…</div>
  if (!data || data.count === 0) {
    return (
      <div className="glass-panel mb-4 rounded-2xl border border-border p-4 text-[13px] text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground"><TrendingUp className="h-4 w-4 text-primary" />数据复盘</p>
        <p className="mt-1">把作品标成「已发布」后点「录入数据」，填上播放、完播、咨询这些。录了 {MIN_SAMPLE} 条以上，这里会告诉你这个号哪类内容、哪种拍法最有效，选题和方向也会照着调整。</p>
      </div>
    )
  }

  const row = (g: PerformanceSummary['byPurpose'][number]) => (
    <tr key={g.name} className="border-t border-border/50">
      <td className="py-1 pr-2">{g.name}</td>
      <td className="py-1 text-right tabular-nums">{g.n}</td>
      <td className="py-1 text-right tabular-nums">{g.avgViews === null ? '—' : Math.round(g.avgViews)}</td>
      <td className="py-1 text-right tabular-nums">{g.avgCompletion === null ? '—' : `${Math.round(g.avgCompletion)}%`}</td>
      <td className="py-1 text-right tabular-nums">{g.inquiries + g.deals || '—'}</td>
    </tr>
  )
  const table = (title: string, rows: PerformanceSummary['byPurpose']) => rows.length > 0 && (
    <div>
      <p className="mb-1 text-[12px] text-muted-foreground">{title}</p>
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-[11.5px] text-muted-foreground"><th className="pb-1 text-left font-normal"></th><th className="pb-1 text-right font-normal">条数</th><th className="pb-1 text-right font-normal">平均播放</th><th className="pb-1 text-right font-normal">完播</th><th className="pb-1 text-right font-normal">咨询+成交</th></tr></thead>
        <tbody>{rows.slice(0, 6).map(row)}</tbody>
      </table>
    </div>
  )

  return (
    <div className="glass-panel mb-4 space-y-3 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-medium text-foreground"><TrendingUp className="h-4 w-4 text-primary" />数据复盘（{data.count} 条录了数据）</p>
      {data.insights.length > 0 && (
        <ul className="space-y-1 text-[13px] text-foreground">{data.insights.map((x) => <li key={x}>· {x}</li>)}</ul>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {table('按三种视频', data.byPurpose)}
        {table('按拍法', data.byTactic)}
      </div>
      {data.best.length > 0 && <p className="text-[12.5px]"><span className="text-emerald-500">数据最好：</span>{data.best.map((r) => `「${r.title}」${metricsLine(r.metrics)}`).join('；')}</p>}
      {data.worst.length > 0 && <p className="text-[12.5px]"><span className="text-amber-500">数据最差：</span>{data.worst.map((r) => `「${r.title}」${metricsLine(r.metrics)}`).join('；')}</p>}
      <p className="text-[11.5px] text-muted-foreground">选题、创作方向、起号方案、自由对话生成时会参考这些数据：多做有效的，少做没效果的。</p>
    </div>
  )
}
