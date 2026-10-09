'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/components/ui/feedback'
import { throwApiError, fetchGeneration } from '@/lib/api-error'
import { readDifyStream } from '@/lib/sse-stream'
import { saveGenerationHistory } from '@/lib/history'
import { getActiveProfileId, onActiveProfileChange } from '@/lib/active-profile'
import { postSafely } from '@/lib/safe-post'
import { buildProfileSummary } from '@/lib/profile-summary'
import { taboosPromptBlock } from '@/lib/taboos'
import { performancePromptBlock, type PerformanceSummary } from '@/lib/performance'
import { invalidateCreatorContext } from '@/hooks/useCreatorContext'
import { Markdown } from '@/components/markdown'
import { CreationLinks } from '@/components/workspace/CreationLinks'
import {
  ADVICE_TYPE,
  ADVICE_PURPOSES,
  ADVICE_STAGES,
  buildIndustryAdvicePrompt,
  type AdvicePurposeKey,
  type AdviceStageKey,
} from '@/lib/industry-advice'

/**
 * 行业建议（药方）。
 *
 * 账号定位是体检，内容定位是查病根，这里开药方：按这个号选定的目的和当前阶段，
 * 写出每一步针对谁、要达到什么、怎么拍、何时换阶段。存进定位库，
 * 创作上下文（lib/creator-context）会把它注入所有创作板块。
 *
 * 目的和阶段、现状存在 positioning_description 里（JSON），回到页面能还原选择。
 */

interface Row {
  id: string
  profile_id: string
  positioning_type: string
  full_content: string
  created_at: string
  positioning_description?: string | null
}

interface Choice {
  purpose: AdvicePurposeKey
  stage: AdviceStageKey
  situation: string
  goal: string
}

const DEFAULT_CHOICE: Choice = { purpose: 'staged', stage: 'start', situation: '', goal: '' }

function parseChoice(raw: string | null | undefined): Choice | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw)
    if (!j || typeof j !== 'object') return null
    return {
      purpose: ADVICE_PURPOSES.some((p) => p.key === j.purpose) ? j.purpose : DEFAULT_CHOICE.purpose,
      stage: ADVICE_STAGES.some((s) => s.key === j.stage) ? j.stage : DEFAULT_CHOICE.stage,
      situation: typeof j.situation === 'string' ? j.situation : '',
      goal: typeof j.goal === 'string' ? j.goal : '',
    }
  } catch {
    return null
  }
}

export default function IndustryAdvicePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [profileName, setProfileName] = useState('')
  const [baseline, setBaseline] = useState('')
  const [choice, setChoice] = useState<Choice>(DEFAULT_CHOICE)
  const [result, setResult] = useState('')
  const [saved, setSaved] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const id = getActiveProfileId()
      const profRes = await fetch('/api/profiles')
      const list = profRes.ok ? await profRes.json() : []
      const p = Array.isArray(list) && list.length ? list.find((x: any) => x.id === id) || list[0] : null
      setProfile(p || null)
      setProfileName(p?.profile_name || '')

      if (p) {
        const get = (t: string) => fetch(`/api/positioning?profileId=${p.id}&type=${encodeURIComponent(t)}`)
        const first = async (r: Response) => {
          if (!r.ok) return null
          const j = await r.json().catch(() => null)
          return Array.isArray(j) && j[0] ? (j[0] as Row) : null
        }
        const [baseRes, mineRes] = await Promise.all([get('账号定位'), get(ADVICE_TYPE)])
        setBaseline((await first(baseRes))?.full_content || '')
        const mine = await first(mineRes)
        setSaved(mine)
        if (mine) {
          setResult((current) => current || mine.full_content || '')
          setChoice(parseChoice(mine.positioning_description) || DEFAULT_CHOICE)
        }
      }
    } catch (e) {
      console.error('加载失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return onActiveProfileChange(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isGenerating) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [isGenerating])

  const generate = async () => {
    if (!profile) {
      notify('请先创建一份账号档案')
      router.push('/dashboard/profiles/new')
      return
    }
    setIsGenerating(true)
    setResult('')
    let full = ''
    const profileId = profile.id as string
    try {
      // 作品数据：有录过数据才带上，没有就不带
      let performance: PerformanceSummary | null = null
      const perfRes = await fetch(`/api/works/performance?profileId=${encodeURIComponent(profileId)}`).catch(() => null)
      if (perfRes?.ok) {
        const d = await perfRes.json().catch(() => null)
        if (d && typeof d.count === 'number' && d.count > 0) performance = d
      }

      const query = buildIndustryAdvicePrompt({
        profileSummary: buildProfileSummary(profile as any),
        baseline: baseline || undefined,
        input: { purpose: choice.purpose, stage: choice.stage, situation: choice.situation, goal: choice.goal },
        performanceBlock: performancePromptBlock(performance),
        taboos: taboosPromptBlock(profile as any),
      })

      const res = await fetchGeneration('/api/dify/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: ADVICE_TYPE,
          profileId,
          query,
          additionalNotes: choice.situation || '无补充说明',
        }),
      })
      if (!res.ok) await throwApiError(res)

      full = await readDifyStream(res, {
        onChunk: (_p, all) => setResult(all),
      })

      if (full) {
        await save(full)
        await saveGenerationHistory(ADVICE_TYPE, { profileId, notes: choice.situation }, full)
      }
    } catch (e: unknown) {
      console.error('生成失败:', e)
      notify((e as Error)?.message || '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const save = async (content: string) => {
    if (!profile) return
    const profileId = profile.id as string
    const firstLine = content.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').trim() || ''
    const res = await postSafely('/api/positioning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        positioning_type: ADVICE_TYPE,
        positioning_name: firstLine.slice(0, 50) || `${profileName || '账号'}的行业建议`,
        positioning_description: JSON.stringify(choice),
        full_content: content,
        is_active: false,
      }),
    })
    if (res.ok) {
      const row = (await res.json().catch(() => null)) as Row | null
      setSaved(row)
      invalidateCreatorContext()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-[13px] text-muted-foreground">加载中…</p>
      </div>
    )
  }

  const stageDesc = ADVICE_STAGES.find((s) => s.key === choice.stage)?.desc
  const purposeDesc = ADVICE_PURPOSES.find((p) => p.key === choice.purpose)?.desc

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">行业建议</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            账号定位是体检，内容定位是查病根，这里开药方：按这个号的目的和当前阶段，
            告诉你每一步针对谁、要达到什么、怎么拍、什么时候换阶段。
            存好之后，选题、脚本、方向、起号等所有创作板块都会照它执行。
          </p>
        </div>

        {!profile ? (
          <div className="glass-panel rounded-2xl p-4 sm:p-6 text-[13px] text-destructive">
            还没有账号档案。
            <button onClick={() => router.push('/dashboard/profiles/new')} className="ml-1 underline">
              去创建
            </button>
          </div>
        ) : (
          <>
            <div className="glass-panel mb-6 rounded-2xl p-4 sm:p-6">
              <div className="mb-5 space-y-1.5 rounded-xl border border-border bg-foreground/[0.03] p-4 text-[12.5px]">
                <p className="text-foreground">
                  当前档案：<span className="font-medium">{profileName || '未命名'}</span>
                </p>
                {baseline ? (
                  <p className="text-emerald-500">已读到账号定位，药方会与它保持一致 ✓</p>
                ) : (
                  <p className="text-amber-500">
                    还没有账号定位。可以先开方，但先做体检（账号定位）药方会更准。
                    <button onClick={() => router.push('/dashboard/positioning')} className="ml-1 underline">
                      去生成
                    </button>
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-[13px] font-medium text-foreground">这个号做什么目的</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ADVICE_PURPOSES.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setChoice((c) => ({ ...c, purpose: p.key }))}
                      className={`rounded-xl border px-3 py-2 text-[13px] ${choice.purpose === p.key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {purposeDesc && <p className="mt-2 text-[12px] text-muted-foreground">{purposeDesc}</p>}
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-[13px] font-medium text-foreground">目前处在哪个阶段</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ADVICE_STAGES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setChoice((c) => ({ ...c, stage: s.key }))}
                      className={`rounded-xl border px-3 py-2 text-[13px] ${choice.stage === s.key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {stageDesc && <p className="mt-2 text-[12px] text-muted-foreground">{stageDesc}</p>}
              </div>

              <label className="mb-2 block text-[13px] font-medium text-foreground">现状</label>
              <textarea
                value={choice.situation}
                onChange={(e) => setChoice((c) => ({ ...c, situation: e.target.value }))}
                rows={3}
                placeholder="比如：发了 12 条，最好的一条 3000 播放，非关注占比低；来咨询的基本都是老客户转介绍"
                className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <label className="mb-2 mt-4 block text-[13px] font-medium text-foreground">这一阶段想达到的结果（选填）</label>
              <textarea
                value={choice.goal}
                onChange={(e) => setChoice((c) => ({ ...c, goal: e.target.value }))}
                rows={2}
                placeholder="比如：两个月内非关注播放破 1 万，主页访问稳定在每天 50 次以上"
                className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <button
                onClick={generate}
                disabled={isGenerating}
                className="mt-5 w-full rounded-xl bg-primary py-2.5 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {isGenerating
                  ? `正在开方… 已用 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
                  : result
                    ? '重新开方'
                    : '生成行业建议'}
              </button>
              {isGenerating && (
                <p className="mt-2 text-center text-[12px] text-muted-foreground">开方大约需要几分钟，生成后会自动存进定位库。</p>
              )}
            </div>

            {(result || isGenerating) && (
              <div className="glass-panel rounded-2xl px-7 py-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    行业建议
                    {saved?.created_at && !isGenerating && (
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        {new Date(saved.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        生成，已生效
                      </span>
                    )}
                  </h2>
                  {result && !isGenerating && (
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
                <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:tracking-tight prose-p:text-[14px] prose-p:leading-[1.85] prose-li:text-[14px]">
                  <Markdown>{result}</Markdown>
                </div>
                {result && !isGenerating && (
                  <div className="mt-5">
                    <CreationLinks body={result} context={{ from: ADVICE_TYPE, originContent: choice.situation || undefined }} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
