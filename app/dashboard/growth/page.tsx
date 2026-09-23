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
import {
  buildGrowthPlanPrompt,
  buildOpeningPrompt,
  buildTacticPickPrompt,
  parseTacticCandidates,
  detectTactics,
  detectOpeningCards,
  summarizeTacticTests,
  MIN_SAMPLES,
  type TacticCandidate,
  type TacticTestStat,
} from '@/lib/growth-standards'
import { takeHandoff, putHandoff, parseTopicOptions, extractOpening } from '@/lib/handoff'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
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

  /**
   * AI 推荐的候选打法。
   * 先出 5 个候选让用户选，再生成完整方案——直接出方案要跑三分钟才知道
   * 方向对不对，不对还得重来；而且方案是"给"的不是"选"的，执行意愿差一截。
   */
  const [candidates, setCandidates] = useState<TacticCandidate[]>([])
  const [picking, setPicking] = useState(false)

  /** 可以直接拿来用的选题和脚本 */
  const [recentTopics, setRecentTopics] = useState<string[]>([])
  const [recentScripts, setRecentScripts] = useState<Array<{ title: string; body: string }>>([])
  const [handoffFrom, setHandoffFrom] = useState('')
  // 每一计已经写过几条脚本。没有它，知识库的测试规则就只是一句话
  const [tested, setTested] = useState<TacticTestStat[]>([])

  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

  // 别的页面带过来的内容（选题页/脚本页的「设计开篇」入口）
  useEffect(() => {
    const data = takeHandoff()
    if (!data) return
    if (data.tab === 'opening') setTab('opening')
    if (data.topic) setTopic(data.topic)
    if (data.currentOpening) setCurrentOpening(data.currentOpening)
    if (data.from) setHandoffFrom(data.from)
  }, [])

  /*
   * 换页回来内容还在，同时把最近的选题和脚本取出来备用。
   *
   * 为什么要取：开篇钩子是给某条具体内容写开头的，而那条内容多半
   * 刚在选题页或脚本页生成过。让用户再手打一遍主题、或者回去复制，
   * 是白白把已经有的东西丢掉。
   */
  useEffect(() => {
    const restore = async () => {
      try {
        const res = await fetch('/api/script-history')
        if (!res.ok) return
        const rows = await res.json()
        if (!Array.isArray(rows)) return

        // 按打法统计已拍条数，给下面的「测试进度」和 AI 推荐用
        setTested(summarizeTacticTests(rows))

        const plan = rows.find((x: any) => x.task_type === '起号方案')
        const open = rows.find((x: any) => x.task_type === '开篇钩子')
        if (plan?.result) setPlanResult((c) => c || plan.result)
        if (open?.result) setOpeningResult((c) => c || open.result)

        // 最近的选题：从选题结果里解析出条目
        const topicRow = rows.find((x: any) => x.task_type === '选题策划')
        if (topicRow?.result) setRecentTopics(parseTopicOptions(topicRow.result).slice(0, 8))

        // 最近几条脚本：标题取第一行，正文用来截开头
        setRecentScripts(
          rows
            .filter((x: any) => x.task_type === '脚本生成' && x.result)
            .slice(0, 5)
            .map((x: any) => ({
              title:
                (x.result as string)
                  .split('\n')
                  .find((l: string) => l.trim())
                  ?.replace(/^#+\s*/, '')
                  .slice(0, 40) || '未命名脚本',
              body: x.result as string,
            }))
        )
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

  /** 先要候选。30 秒，选错了成本也小 */
  const askCandidates = async () => {
    setPicking(true)
    setCandidates([])
    try {
      const res = await fetch('/api/dify/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: '起号方案',
          profileId: getActiveProfileId(),
          query: buildTacticPickPrompt({
            contextBlock: buildContextBlock(context, 'script'),
            notes: planNotes,
            // 推荐要知道他已经测到哪儿了，否则每次都是重新抽签
            tested,
          }),
        }),
      })
      if (!res.ok) await throwApiError(res)
      const full = await readDifyStream(res, {
        onChunk: (_p, all) => setCandidates(parseTacticCandidates(all)),
      })
      const parsed = parseTacticCandidates(full)
      setCandidates(parsed)
      if (parsed.length === 0) notify('没解析出候选，可以直接点下面生成完整方案')
    } catch (e: unknown) {
      console.error('推荐失败:', e)
      notify((e as Error)?.message || '推荐失败，请重试')
    } finally {
      setPicking(false)
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

            {/*
              测试进度。知识库的规则是「每种打法至少测 3-5 条，样本太少
              只能判断单条执行好坏，不能否定方法本身」——这块面板就是让
              这条规则看得见：拍一条没火就换，是起不来号的主要原因。
              只有写过带打法的脚本才会有数据，所以没数据时整块不出现。
            */}
            {tested.length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-foreground/[0.03] p-4">
                <p className="mb-2 text-[12.5px] text-foreground">
                  你已经测过的打法（每种至少 {MIN_SAMPLES} 条才够下判断）
                </p>
                <ul className="space-y-1.5">
                  {tested.map((t) => (
                    <li key={t.name} className="flex items-center gap-2 text-[11.5px]">
                      <span className="w-20 shrink-0 truncate text-foreground">{t.name}</span>
                      <span className="flex gap-0.5">
                        {Array.from({ length: Math.max(MIN_SAMPLES, t.count) }).map((_, i) => (
                          <span
                            key={i}
                            className={`inline-block h-2 w-2 rounded-full ${
                              i < t.count ? 'bg-primary' : 'bg-foreground/15'
                            }`}
                          />
                        ))}
                      </span>
                      <span className={t.enough ? 'text-primary' : 'text-muted-foreground'}>
                        {t.enough
                          ? `${t.count} 条，可以判断了`
                          : `${t.count} 条，还差 ${MIN_SAMPLES - t.count} 条`}
                      </span>
                    </li>
                  ))}
                </ul>
                {tested.some((t) => !t.enough) && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    没测够就换打法，只能说明那一条拍得不好，说明不了这一计不行。
                  </p>
                )}
              </div>
            )}

            {/* AI 推荐候选 → 用户自己选 → 再出完整方案。
                直接出方案要跑三分钟才知道方向对不对，而且方案是"给"的不是"选"的 */}
            <button
              onClick={askCandidates}
              disabled={picking || busy}
              className="mb-4 w-full rounded-xl border border-primary/40 bg-primary/[0.08] py-2.5 text-[13px] font-medium text-primary disabled:opacity-50"
            >
              {picking ? `正在按你的条件挑… ${timer}` : '✨ 让 AI 先推荐几个，我再选'}
            </button>

            {candidates.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <p className="text-[12px] text-muted-foreground">
                  按你的资源条件挑出这几个，勾中意的再生成完整方案（可多选）：
                </p>
                {candidates.map((c) => {
                  const on = pickedTactics.includes(c.name)
                  return (
                    <button
                      key={c.name}
                      onClick={() => toggle(pickedTactics, setPickedTactics, c.name)}
                      aria-pressed={on}
                      className={`glass-interactive block w-full rounded-xl border px-4 py-3 text-left ${
                        on ? 'glass-selected' : 'glass-panel'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-[13px] font-medium ${on ? 'text-primary' : 'text-foreground'}`}>
                          {c.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          适合度 {c.fitLevel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{c.why}</p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-emerald-500">
                        第一条：{c.firstShot}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => setShowAllTactics((v) => !v)}
              className="mb-3 text-[12px] text-primary underline"
            >
              {showAllTactics ? '收起' : '或者从 37 计里自己圈定'}
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
            {handoffFrom && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-3.5 py-2.5 text-[12px] text-emerald-500">
                内容来自「{handoffFrom}」，已经替你填好了 ✓
              </div>
            )}

            {/*
              开篇钩子是给某条具体内容写开头的，而那条内容多半刚在选题页
              或脚本页生成过。让用户再手打一遍、或者回去复制，
              是白白把已经有的东西丢掉。
            */}
            {recentTopics.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-[12px] text-muted-foreground">
                  刚生成的选题，点一条直接用：
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentTopics.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      title={t}
                      className={`glass-interactive max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[12px] ${
                        topic === t ? 'glass-selected text-primary' : 'glass-panel text-foreground'
                      }`}
                    >
                      {t.length > 26 ? t.slice(0, 26) + '…' : t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recentScripts.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-[12px] text-muted-foreground">
                  刚写的脚本，点一条把开头调出来改：
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentScripts.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setTopic(s.title)
                        setCurrentOpening(extractOpening(s.body))
                      }}
                      title={s.title}
                      className="glass-interactive glass-panel max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[12px] text-foreground"
                    >
                      {s.title.length > 22 ? s.title.slice(0, 22) + '…' : s.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/*
              下一步出口。用户手动圈定过就用他圈的；没圈就从正文里认——
              模型挑了哪一计只写在文字里，不认出来的话这个信息就断在这一页了。
            */}
            {result && !busy && (
              <div className="mt-6 border-t border-border/60 pt-4">
                <div className="mb-2 text-[12px] text-muted-foreground">下一步</div>
                <div className="flex flex-wrap gap-2">
                  {tab === 'plan' ? (
                    <button
                      onClick={() => {
                        const picked = pickedTactics.length ? pickedTactics : detectTactics(result)
                        if (!picked.length) {
                          notify('没认出用的是哪一计，先在上面圈一个')
                          return
                        }
                        putHandoff({ from: '起号打法', tactic: picked[0] })
                        router.push('/dashboard/topic')
                      }}
                      className="glass-panel rounded-lg px-3 py-1.5 text-[12px] text-foreground hover:text-primary"
                    >
                      按这一计去选题
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          const cards = pickedCards.length ? pickedCards : detectOpeningCards(result)
                          putHandoff({
                            from: '开篇钩子',
                            topic,
                            openingCards: cards.slice(0, 3),
                          })
                          router.push('/dashboard/title')
                        }}
                        className="glass-panel rounded-lg px-3 py-1.5 text-[12px] text-foreground hover:text-primary"
                      >
                        用这个钩子起标题
                      </button>
                      <button
                        onClick={() => {
                          putHandoff({ from: '开篇钩子', topic })
                          router.push('/dashboard/script')
                        }}
                        className="glass-panel rounded-lg px-3 py-1.5 text-[12px] text-foreground hover:text-primary"
                      >
                        写成脚本
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
