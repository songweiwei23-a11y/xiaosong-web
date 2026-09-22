'use client'

import { useEffect, useState } from 'react'
import { notify } from '@/components/ui/feedback'
import { throwApiError } from '@/lib/api-error'
import { readDifyStream } from '@/lib/sse-stream'
import { saveGenerationHistory } from '@/lib/history'
import { getActiveProfileId } from '@/lib/active-profile'
import { useCreatorContext } from '@/hooks/useCreatorContext'
import { buildContextBlock } from '@/lib/creator-context'
import { ContextBadge } from '@/components/workspace/ContextBadge'
import { Markdown } from '@/components/markdown'
import { GROWTH_TACTICS, SELECTION_MATRIX } from '@/lib/growth-tactics'
import { OPENING_CARDS, OPENING_CATEGORIES } from '@/lib/opening-cards'
import { buildGrowthPlanPrompt, buildOpeningPrompt } from '@/lib/growth-standards'

/**
 * 起号板块：起号 36+1 计 + 开篇 36 计。
 *
 * 【为什么不是把 73 条摆出来让用户挑】知识库原话「先选适合自己的，
 * 而非最炫的」。用户看完第一反应是挑最有意思的，而不是挑自己拍得出来的——
 * 单人低预算的号去学多人剧情，拍两条就撑不住。
 * 所以默认让 AI 按选择矩阵结合账号真实资源推荐；想自己挑也可以圈定。
 */

type Tab = 'plan' | 'opening'

export default function GrowthPage() {
  const { context } = useCreatorContext()
  const [tab, setTab] = useState<Tab>('plan')

  // 起号方案
  const [pickedTactics, setPickedTactics] = useState<string[]>([])
  const [planNotes, setPlanNotes] = useState('')
  const [planResult, setPlanResult] = useState('')

  // 开篇钩子
  const [topic, setTopic] = useState('')
  const [currentOpening, setCurrentOpening] = useState('')
  const [pickedCards, setPickedCards] = useState<string[]>([])
  const [openingResult, setOpeningResult] = useState('')

  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showAllTactics, setShowAllTactics] = useState(false)
  const [openCat, setOpenCat] = useState<string | null>(null)

  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

  // 换页回来内容还在
  useEffect(() => {
    const restore = async () => {
      try {
        const res = await fetch('/api/script-history')
        if (!res.ok) return
        const rows = await res.json()
        if (!Array.isArray(rows)) return
        const plan = rows.find((x: any) => x.task_type === '起号方案')
        const open = rows.find((x: any) => x.task_type === '开篇钩子')
        if (plan?.result) setPlanResult((c) => c || plan.result)
        if (open?.result) setOpeningResult((c) => c || open.result)
      } catch (e) {
        console.error('恢复失败:', e)
      }
    }
    restore()
  }, [])

  const run = async (
    taskType: string,
    query: string,
    setResult: (s: string) => void,
    inputs: Record<string, unknown>
  ) => {
    setBusy(true)
    setResult('')
    try {
      const res = await fetch('/api/dify/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 写成显式 taskType: taskType，不用简写——全仓库扫描按
        // `taskType:` 匹配，简写会被判成"没传"，误报久了就没人当回事了
        body: JSON.stringify({ taskType: taskType, profileId: getActiveProfileId(), query }),
      })
      if (!res.ok) await throwApiError(res)
      const full = await readDifyStream(res, { onChunk: (_p, all) => setResult(all) })
      if (full.trim()) await saveGenerationHistory(taskType, inputs, full)
    } catch (e: unknown) {
      console.error(`${taskType}失败:`, e)
      notify((e as Error)?.message || '生成失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const genPlan = () =>
    run(
      '起号方案',
      buildGrowthPlanPrompt({
        contextBlock: buildContextBlock(context, 'script'),
        notes: planNotes,
        picked: pickedTactics.length ? pickedTactics : undefined,
      }),
      setPlanResult,
      { picked: pickedTactics, notes: planNotes }
    )

  const genOpening = () => {
    if (!topic.trim()) {
      notify('先说说这条内容讲什么')
      return
    }
    return run(
      '开篇钩子',
      buildOpeningPrompt({
        contextBlock: buildContextBlock(context, 'script'),
        topic,
        currentOpening,
        picked: pickedCards.length ? pickedCards : undefined,
      }),
      setOpeningResult,
      { topic, currentOpening, picked: pickedCards }
    )
  }

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const timer = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const result = tab === 'plan' ? planResult : openingResult

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">起号</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            起号 36+1 计决定「拍什么套路」，开篇 36 计决定「前三秒怎么说」。
            两套都按你的真实资源来挑，不是把方法摆出来让你自己猜。
          </p>
        </div>

        <div className="mb-5 flex gap-1.5">
          {([
            ['plan', '起号打法', `${GROWTH_TACTICS.length} 计`],
            ['opening', '开篇钩子', `${OPENING_CARDS.length} 张卡`],
          ] as const).map(([k, label, hint]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`glass-interactive rounded-xl border px-4 py-2 text-[13px] ${
                tab === k ? 'glass-selected text-primary' : 'glass-panel text-foreground'
              }`}
            >
              {label}
              <span className="ml-1.5 text-[11px] text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>

        <ContextBadge board="script" className="mb-5" />

        {tab === 'plan' ? (
          <div className="glass-panel mb-6 rounded-2xl p-6">
            {/* 默认让 AI 按矩阵推荐。想自己挑再展开——
                直接摆 37 计出来，用户会挑最有意思的而不是拍得出来的 */}
            <div className="mb-4 rounded-xl border border-border bg-foreground/[0.03] p-4">
              <p className="text-[12.5px] text-foreground">
                默认按你的资源条件从 37 计里挑。知识库的选择矩阵是这样分的：
              </p>
              <ul className="mt-2 space-y-1">
                {SELECTION_MATRIX.map((m) => (
                  <li key={m.condition} className="text-[11.5px] leading-relaxed text-muted-foreground">
                    · <span className="text-foreground">{m.condition}</span> → {m.prefer.slice(0, 3).join('、')}…
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setShowAllTactics((v) => !v)}
              className="mb-3 text-[12px] text-primary underline"
            >
              {showAllTactics ? '收起' : '我想自己圈定打法'}
              {pickedTactics.length > 0 && `（已选 ${pickedTactics.length}）`}
            </button>

            {showAllTactics && (
              <div className="mb-4 grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-3">
                {GROWTH_TACTICS.map((t) => {
                  const on = pickedTactics.includes(t.name)
                  return (
                    <button
                      key={t.no}
                      onClick={() => toggle(pickedTactics, setPickedTactics, t.name)}
                      title={`${t.mechanism}\n适合：${t.fit}`}
                      className={`glass-interactive rounded-lg border px-2.5 py-2 text-left text-[12px] ${
                        on ? 'glass-selected text-primary' : 'glass-panel text-foreground'
                      }`}
                    >
                      {t.no}. {t.name}
                    </button>
                  )
                })}
              </div>
            )}

            <label className="mb-2 block text-[13px] font-medium text-foreground">补充说明（选填）</label>
            <textarea
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              rows={2}
              placeholder="比如：老板不太愿意出镜、这阵子只有周末能拍"
              className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            <button
              onClick={genPlan}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-primary py-2.5 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? `正在挑打法… ${timer}` : '生成起号方案'}
            </button>
          </div>
        ) : (
          <div className="glass-panel mb-6 rounded-2xl p-6">
            <label className="mb-2 block text-[13px] font-medium text-foreground">
              这条内容讲什么 <span className="text-destructive">*</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              placeholder="比如：为什么我们家 60 多的自助敢用鲜切牛肉"
              className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            <label className="mb-2 mt-4 block text-[13px] font-medium text-foreground">
              现在的开头（选填，想换掉就贴进来）
            </label>
            <textarea
              value={currentOpening}
              onChange={(e) => setCurrentOpening(e.target.value)}
              rows={2}
              placeholder="贴上现有的开头，AI 会告诉你问题在哪并给替代方案"
              className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            <p className="mb-2 mt-4 text-[12px] text-muted-foreground">
              不选的话 AI 会按内容目的自己挑。
              {pickedCards.length > 0 && ` 已选 ${pickedCards.length} 种`}
            </p>
            <div className="space-y-2">
              {OPENING_CATEGORIES.map((cat) => {
                const cards = OPENING_CARDS.filter((c) => c.category === cat)
                const open = openCat === cat
                return (
                  <div key={cat} className="rounded-xl border border-border">
                    <button
                      onClick={() => setOpenCat(open ? null : cat)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
                    >
                      <span className="text-[12.5px] font-medium text-foreground">{cat}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {cards.length} 种 · {open ? '收起' : '展开'}
                      </span>
                    </button>
                    {open && (
                      <div className="grid grid-cols-2 gap-1.5 border-t border-border p-3 sm:grid-cols-3">
                        {cards.map((c) => {
                          const on = pickedCards.includes(c.name)
                          return (
                            <button
                              key={c.no}
                              onClick={() => toggle(pickedCards, setPickedCards, c.name)}
                              title={`${c.psychology}\n公式：${c.formula}`}
                              className={`glass-interactive rounded-lg border px-2.5 py-2 text-left text-[12px] ${
                                on ? 'glass-selected text-primary' : 'glass-panel text-foreground'
                              }`}
                            >
                              {c.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={genOpening}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-primary py-2.5 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? `正在写开头… ${timer}` : '生成开篇钩子'}
            </button>
          </div>
        )}

        {(result || busy) && (
          <div className="glass-panel rounded-2xl px-7 py-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">
                {tab === 'plan' ? '起号方案' : '开篇钩子'}
              </h2>
              {result && !busy && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(result)
                    notify('已复制')
                  }}
                  className="glass-panel rounded-lg px-3 py-1.5 text-[12px] text-foreground"
                >
                  复制
                </button>
              )}
            </div>
            <div
              className="prose prose-slate dark:prose-invert max-w-none
                         prose-headings:tracking-tight prose-headings:font-semibold
                         prose-h1:text-xl prose-h2:text-[17px] prose-h3:text-[15px]
                         prose-p:text-[14px] prose-p:leading-[1.85] prose-li:text-[14px]
                         prose-strong:text-foreground prose-hr:border-border/60"
            >
              <Markdown>{result}</Markdown>
            </div>
            {busy && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
