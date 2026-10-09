'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/components/ui/feedback'
import { throwApiError, fetchGeneration } from '@/lib/api-error'
import { readDifyStream } from '@/lib/sse-stream'
import { saveGenerationHistory } from '@/lib/history'
import { getActiveProfileId, onActiveProfileChange } from '@/lib/active-profile'
import { useCreationBridge } from '@/hooks/useCreationBridge'
import { incomingNote } from '@/lib/creation-flow'
import { CreationLinks } from '@/components/workspace/CreationLinks'
import { invalidateCreatorContext } from '@/hooks/useCreatorContext'
import {
  BRIEF_FIELDS,
  BRIEF_TYPE,
  profileFactsFingerprint,
  briefFactsChanged,
  buildBriefPrompt,
  parseBrief,
  serializeBrief,
  briefCompleteness,
  readerLabels,
} from '@/lib/creative-brief'
import { postSafely } from '@/lib/safe-post'
import { buildProfileSummary } from '@/lib/profile-summary'
import { resolveMix, mixPromptBlock, type MixSetting } from '@/lib/content-mix'
import { taboosPromptBlock } from '@/lib/taboos'
import { ContentMixBar } from '@/components/workspace/ContentMix'

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
  /** 生成 / 保存时档案事实的指纹（lib/creative-brief 的 profileFactsFingerprint） */
  positioning_description?: string | null
}

export default function CreativeBriefPage() {
  const router = useRouter()
  const [profileName, setProfileName] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileSummary, setProfileSummary] = useState('')
  // 内容配比按哪个档案算；这次临时改的（null = 跟档案 / 系统推荐）
  const [profileRow, setProfileRow] = useState<Record<string, unknown> | null>(null)
  const [mixOverride, setMixOverride] = useState<MixSetting | null>(null)
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
  const bridge = useCreationBridge('创作简报', 'creative-brief', profileId, loading)
  useEffect(() => {
    if (bridge.payload?.sourceContent) setNotes(incomingNote(bridge.payload))
  }, [bridge.payload])

  const load = async () => {
    setLoading(true)
    try {
      const id = getActiveProfileId()
      const profRes = await fetch('/api/profiles')
      const list = profRes.ok ? await profRes.json() : []
      const p = Array.isArray(list) && list.length ? list.find((x: any) => x.id === id) || list[0] : null
      setProfileId(p?.id ?? null)
      setProfileName(p?.profile_name || '')
      setProfileRow(p || null)
      /*
       * 用和定位板块同一份档案摘要。原来是把档案每一栏原样倒进去，
       * 连前采原始记录（interview_notes）也在里面——2026-10-02 线上：前采原文写着
       * 「南乐定居 18 年」，后来档案改成了「9 年川菜厨师」，简报照样按原文写成
       * 「在南乐扎根 18 年」，全站跟着错。原始记录不是档案结论，不该喂给简报
       */
      setProfileSummary(p ? buildProfileSummary(p) : '')

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
  }, [])

  /*
   * 从定位页「一键生成创作简报」进来时，自动开跑。
   *
   * 线上漏斗：40% 的人做完账号定位，只有 10% 做到简报。中间这一步
   * 全靠用户自己想起来去侧边栏找——而简报正是让其他板块真正用上
   * 账号信息的那一环，不做它，生成出来的东西和直接问 AI 没区别。
   *
   * 等 load() 把定位取回来再跑：没有定位就没法生成，
   * 此时 autoRan 保持 false，定位一到就会触发。
   */
  const [autoRan, setAutoRan] = useState(false)
  useEffect(() => {
    if (autoRan || loading || !positioning || isGenerating) return
    const handed = bridge.payload
    if (handed?.from !== '账号定位') return
    setAutoRan(true)
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, positioning, isGenerating, autoRan, bridge.payload])

  useEffect(() => {
    if (!isGenerating) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [isGenerating])

  /** 定位比简报新 = 简报过期。提醒，但旧的继续用 */
  const stale =
    !!brief && !!positioning && new Date(positioning.created_at) > new Date(brief.created_at)
  /**
   * 简报是按旧档案写的：人设、经历、品类、人群这些事实在简报之后改过。
   * 原来比档案更新时间，成交理由同步一下卖点就误报（2026-10-02），改成比内容指纹
   */
  const profileNewer = !!brief && briefFactsChanged(brief.positioning_description, profileRow)

  const generate = async () => {
    if (!positioning && !bridge.sourceReference) return
    setIsGenerating(true)
    let full = ''
    try {
      const res = await fetchGeneration('/api/dify/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: '创作简报',
          profileId,
          creationSettings: bridge.creationSettings,
          query: buildBriefPrompt({
            positioningFull: positioning?.full_content || bridge.sourceReference,
            businessPositioning: business?.full_content,
            contentPositioning: contentPos?.full_content,
            profileSummary,
            notes,
            mixBlock: mixPromptBlock(resolveMix(profileRow, mixOverride, notes)),
            taboos: profileRow ? taboosPromptBlock(profileRow) : undefined,
          }) + bridge.prompt,
        }),
      })
      if (!res.ok) await throwApiError(res)

      full = await readDifyStream(res, {
        onChunk: (_p, all) => setValues(parseBrief(all)),
      })

      if (full) {
        await save(full)
        const historyInput = { notes, profileId, creationSettings: bridge.creationSettings, originContent: bridge.originContent || notes }
        await saveGenerationHistory('创作简报', historyInput, full)
        bridge.rememberResult(full, historyInput)
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
    const res = await postSafely('/api/positioning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        positioning_type: BRIEF_TYPE,
        positioning_name: `${profileName || '账号'}的创作简报`,
        // 记下此刻档案事实的指纹：之后只有这些事实真变了，各板块才提示简报过时
        positioning_description: profileRow ? profileFactsFingerprint(profileRow) : null,
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
      const content = serializeBrief(values)
      const prior = bridge.flowContext(brief?.full_content || content)
      const ok = await save(content)
      if (ok) {
        const historyInput = { notes, profileId, creationSettings: prior.settings || bridge.creationSettings, originContent: prior.originContent || bridge.originContent || notes }
        await saveGenerationHistory('创作简报', historyInput, content)
        bridge.rememberResult(content, historyInput)
      }
      notify(ok ? '已保存，各板块立刻生效' : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const pct = briefCompleteness(serializeBrief(values))
  const hasAny = Object.values(values).some((v) => v?.trim())

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8" aria-busy="true" aria-label="加载中">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4 px-4 sm:px-6 lg:px-8">
          <div className="h-7 w-32 rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
        </div>
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
          <div className="glass-panel rounded-2xl p-4 sm:p-6 text-[13px] text-destructive">
            还没有账号档案。
            <button onClick={() => router.push('/dashboard/profiles/new')} className="ml-1 underline">
              去创建
            </button>
          </div>
        ) : !positioning && !bridge.sourceReference ? (
          <div className="glass-panel rounded-2xl p-4 sm:p-6">
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
            <div className="glass-panel mb-6 rounded-2xl p-4 sm:p-6">
              <div className="mb-4 space-y-1.5 rounded-xl border border-border bg-foreground/[0.03] p-4 text-[12.5px]">
                <p className="text-foreground">
                  当前档案：<span className="font-medium">{profileName || '未命名'}</span>
                </p>
                <p className="text-emerald-500">
                  {positioning ? `已读到账号定位（${new Date(positioning.created_at).toLocaleDateString()}），简报会基于它转译 ✓` : '已带入当前创作材料，简报会承接你的想法 ✓'}
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
                {profileNewer && (
                  <p className="text-amber-500">
                    ⚠️ 账号档案在这份简报之后改过，简报里的人设、年限、经历可能还是旧的。
                    各板块生成时会以档案为准；想让简报也跟上，重新生成一份，或者直接在下面改。
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
              {/* 简报「三种视频的配比」按它写 */}
              <ContentMixBar className="mt-3" profile={profileRow} override={mixOverride} onOverride={setMixOverride} goal={notes} />

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
              <div className="glass-panel rounded-2xl p-4 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-foreground">简报内容</h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      每一段都可以直接改。账号在变，简报就该跟着变——改完点保存，所有板块立刻生效。
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-muted-foreground" title="仅表示八个栏目是否填写，不代表事实已确认或内容质量">栏目填写 {pct}%</span>
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

            {/* 原来生成完没有下一步。简报本身会自动进各板块，这里是让人顺手接着去出选题、写脚本；
                也可以只勾「内容方向」那一段带过去 */}
            {hasAny && !isGenerating && (
              <div className="mt-6">
                <CreationLinks body={serializeBrief(values)} context={bridge.flowContext(brief?.full_content || serializeBrief(values))} heading="简报好了，接着创作 · 内容自动带入" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

