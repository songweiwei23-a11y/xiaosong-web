'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/components/ui/feedback'
import { throwApiError } from '@/lib/api-error'
import { readDifyStream } from '@/lib/sse-stream'
import { saveGenerationHistory } from '@/lib/history'
import { getActiveProfileId, onActiveProfileChange } from '@/lib/active-profile'
import { invalidateCreatorContext } from '@/hooks/useCreatorContext'
import {
  BRIEF_FIELDS,
  BRIEF_TYPE,
  buildBriefPrompt,
  parseBrief,
  serializeBrief,
  briefCompleteness,
  readerLabels,
} from '@/lib/creative-brief'

/**
 * 创作简报。
 *
 * 【解决什么】账号定位 12466 字，各板块注入时按 2000 字截断，实测只有前 16%
 * 进得去——而且进去的是行业分析和半截前采问题，人设、人群、语气、禁忌
 * 一个都没到达。简报把定位转译成按板块切好片的创作指令，各板块只取自己那几段。
 *
 * 【为什么能自由改】用户原话：账号一直都在变化。所以分字段可编辑，
 * 也允许在任一字段里自由补充，改完存下来立刻对所有板块生效。
 */

interface Row {
  id: string
  profile_id: string
  positioning_type: string
  full_content: string
  created_at: string
}

export default function CreativeBriefPage() {
  const router = useRouter()
  const [profileName, setProfileName] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileSummary, setProfileSummary] = useState('')
  const [positioning, setPositioning] = useState<Row | null>(null)
  const [brief, setBrief] = useState<Row | null>(null)
  const [business, setBusiness] = useState<Row | null>(null)
  const [contentPos, setContentPos] = useState<Row | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const id = getActiveProfileId()
      const profRes = await fetch('/api/profiles')
      const list = profRes.ok ? await profRes.json() : []
      const p = Array.isArray(list) && list.length ? list.find((x: any) => x.id === id) || list[0] : null
      setProfileId(p?.id ?? null)
      setProfileName(p?.profile_name || '')
      setProfileSummary(
        p
          ? Object.entries(p)
              .filter(([k, v]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(k) && v && (!Array.isArray(v) || v.length))
              .map(([k, v]) => `- ${k}：${Array.isArray(v) ? v.join('、') : v}`)
              .join('\n')
          : ''
      )

      if (p) {
        // 商业定位和内容定位也取回来。它们生成完原本躺在库里没人读，
        // 简报是唯一能把结论下传到创作环节的通道
        const get = (t: string) =>
          fetch(`/api/positioning?profileId=${p.id}&type=${encodeURIComponent(t)}`)
        const [posRes, briefRes, bizRes, conRes] = await Promise.all([
          get('账号定位'),
          get(BRIEF_TYPE),
          get('商业定位'),
          get('内容定位'),
        ])
        const first = async (r: Response) => {
          if (!r.ok) return null
          const j = await r.json().catch(() => null)
          return Array.isArray(j) && j[0] ? j[0] : null
        }
        setPositioning(await first(posRes))
        setBusiness(await first(bizRes))
        setContentPos(await first(conRes))
        const b = await first(briefRes)
        setBrief(b)
        setValues(parseBrief(b?.full_content))
        setDirty(false)
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

  /** 定位比简报新 = 简报过期。提醒，但旧的继续用 */
  const stale =
    !!brief && !!positioning && new Date(positioning.created_at) > new Date(brief.created_at)

  const generate = async () => {
    if (!positioning) return
    setIsGenerating(true)
    let full = ''
    try {
      const res = await fetch('/api/dify/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: '创作简报',
          profileId,
          query: buildBriefPrompt({
            positioningFull: positioning.full_content,
            businessPositioning: business?.full_content,
            contentPositioning: contentPos?.full_content,
            profileSummary,
            notes,
          }),
        }),
      })
      if (!res.ok) await throwApiError(res)

      full = await readDifyStream(res, {
        onChunk: (_p, all) => setValues(parseBrief(all)),
      })

      if (full) {
        await save(full)
        await saveGenerationHistory('创作简报', { notes }, full)
        notify('简报已生成，各板块马上就会用上')
      }
    } catch (e: unknown) {
      console.error('生成失败:', e)
      notify((e as Error)?.message || '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const save = async (content: string) => {
    if (!profileId) return
    const res = await fetch('/api/positioning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        positioning_type: BRIEF_TYPE,
        positioning_name: `${profileName || '账号'}的创作简报`,
        full_content: content,
        is_active: false,
      }),
    })
    if (res.ok) {
      const row = await res.json()
      setBrief(row)
      setValues(parseBrief(content))
      setDirty(false)
      // 各板块缓存的上下文要作废，否则接着生成用的还是旧简报
      invalidateCreatorContext()
    }
    return res.ok
  }

  const saveEdits = async () => {
    setSaving(true)
    try {
      const ok = await save(serializeBrief(values))
      notify(ok ? '已保存，各板块立刻生效' : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const pct = briefCompleteness(serializeBrief(values))
  const hasAny = Object.values(values).some((v) => v?.trim())

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-[13px] text-muted-foreground">加载中…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">创作简报</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            把账号定位转译成各板块能直接用的创作指令。选题、脚本、分镜、审稿、标题
            会各取所需——分镜只读「怎么拍」，选题只读「内容方向」和「说给谁听」。
          </p>
        </div>

        {/* 前置条件：没有定位就先去做定位 */}
        {!profileId ? (
          <div className="glass-panel rounded-2xl p-6 text-[13px] text-destructive">
            还没有账号档案。
            <button onClick={() => router.push('/dashboard/profiles/new')} className="ml-1 underline">
              去创建
            </button>
          </div>
        ) : !positioning ? (
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-[13px] text-amber-500">
              这个档案还没有生成过账号定位。简报是基于定位转译出来的，**必须先有定位**。
            </p>
            <button
              onClick={() => router.push('/dashboard/positioning')}
              className="mt-4 rounded-xl bg-primary px-5 py-2 text-[13px] text-primary-foreground"
            >
              先去生成账号定位
            </button>
          </div>
        ) : (
          <>
            <div className="glass-panel mb-6 rounded-2xl p-6">
              <div className="mb-4 space-y-1.5 rounded-xl border border-border bg-foreground/[0.03] p-4 text-[12.5px]">
                <p className="text-foreground">
                  当前档案：<span className="font-medium">{profileName || '未命名'}</span>
                </p>
                <p className="text-emerald-500">
                  已读到账号定位（{new Date(positioning.created_at).toLocaleDateString()}），
                  简报会基于它转译 ✓
                </p>
                {/* 让用户看见简报吸收了哪几份东西——
                    商业定位和内容定位以前生成完就躺在库里没人读 */}
                {(business || contentPos) && (
                  <p className="text-emerald-500">
                    同时会吸收{business ? '商业定位' : ''}
                    {business && contentPos ? '和' : ''}
                    {contentPos ? '内容定位' : ''}的结论 ✓
                  </p>
                )}
                {!business && !contentPos && (
                  <p className="text-muted-foreground">
                    还没做过商业定位/内容定位。做了的话，简报会把它们的结论一起吸收进来。
                  </p>
                )}
                {stale && (
                  <p className="text-amber-500">
                    ⚠️ 账号定位在这份简报之后更新过。旧简报仍在生效，建议重新生成一份。
                  </p>
                )}
              </div>

              <label className="mb-2 block text-[13px] font-medium text-foreground">
                这次的额外要求（选填）
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="比如：这阵子主攻餐饮客户、口吻再放松一点"
                className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <button
                onClick={generate}
                disabled={isGenerating}
                className="mt-4 w-full rounded-xl bg-primary py-2.5 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {isGenerating
                  ? `正在转译… 已用 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
                  : hasAny
                    ? '重新生成简报'
                    : '生成创作简报'}
              </button>
              {isGenerating && (
                <p className="mt-2 text-center text-[12px] text-muted-foreground">
                  简报比定位短得多，通常 1 分钟左右。
                </p>
              )}
            </div>

            {hasAny && (
              <div className="glass-panel rounded-2xl p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-foreground">简报内容</h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      每一段都可以直接改。账号在变，简报就该跟着变——改完点保存，所有板块立刻生效。
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-muted-foreground">完整度 {pct}%</span>
                </div>

                <div className="space-y-5">
                  {BRIEF_FIELDS.map((f) => (
                    <div key={f.key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <label className="text-[13px] font-medium text-foreground">{f.label}</label>
                        {/* 谁会读这一段，读的是 lib/context-manifest 那张清单——
                            界面和分发逻辑用同一个来源，不会对不上 */}
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {readerLabels(f.key)}
                        </span>
                      </div>
                      <p className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground">{f.hint}</p>
                      <textarea
                        value={values[f.key] ?? ''}
                        onChange={(e) => {
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                          setDirty(true)
                        }}
                        rows={Math.min(10, Math.max(3, (values[f.key] ?? '').split('\n').length + 1))}
                        placeholder="还没有内容，可以自己写，也可以点上面生成"
                        className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
                  <span className="text-[12px] text-muted-foreground">
                    {dirty ? '有未保存的修改' : brief ? '已保存' : ''}
                  </span>
                  <button
                    onClick={saveEdits}
                    disabled={saving || !dirty}
                    className="rounded-xl bg-primary px-6 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-40"
                  >
                    {saving ? '保存中…' : '保存修改'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

