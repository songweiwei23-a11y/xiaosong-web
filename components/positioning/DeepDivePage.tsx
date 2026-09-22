'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/components/ui/feedback'
import { throwApiError } from '@/lib/api-error'
import { readDifyStream } from '@/lib/sse-stream'
import { saveGenerationHistory } from '@/lib/history'
import { getActiveProfileId, onActiveProfileChange } from '@/lib/active-profile'
import { buildPositioningPrompt, type PositioningFocus } from '@/lib/positioning-standards'
import { Markdown } from '@/components/markdown'
import ContinuousDialog from '@/components/ContinuousDialog'

/**
 * 商业定位 / 内容定位 的共用页面。
 *
 * 这两块本来就是六维地基里的「变现定位」和「内容定位」两维，
 * 所以不另起炉灶：先读这个档案已有的账号定位当地基，再往下深挖一层。
 * 这样用户不用重填信息，两份产出也不会互相打架。
 *
 * 没有地基时不拦着生成——只提示一句，因为有的用户就想先看变现思路。
 * 但会在提示词里说明"没有已确定的定位"，让模型自己把话说圆。
 */

interface Props {
  focus: Exclude<PositioningFocus, 'full'>
  /** Dify 侧的任务类型，决定知识库检索词与会话隔离 */
  taskType: string
  title: string
  subtitle: string
  /** 这一页解决什么问题，写给用户看 */
  bullets: string[]
  generatingHint: string
}

interface Profile {
  id: string
  profile_name?: string
  [k: string]: unknown
}

const asText = (v: unknown, fallback = '') => {
  if (v == null) return fallback
  const s = Array.isArray(v) ? v.filter(Boolean).join('、') : String(v)
  return s.trim() || fallback
}

/** 把档案摊成提示词里那段「这个账号的情况」 */
function profileSummary(p: Profile): string {
  const line = (label: string, v: unknown) => {
    const t = asText(v)
    return t ? `- ${label}：${t}` : ''
  }
  return [
    `- 档案名称：${asText(p.profile_name, '未命名')}`,
    line('平台', p.account_platform),
    line('赛道', p.account_track),
    line('账号阶段', p.account_stage),
    line('粉丝量级', p.fans_level),
    line('目标人群', [asText(p.target_age), asText(p.target_gender), asText(p.target_occupation)].filter(Boolean).join(' · ')),
    line('地域', p.target_region),
    line('客人最担心', p.target_pain_points),
    line('他们真正想要', p.target_needs),
    line('客人常问', p.fan_common_questions),
    line('核心卖点', p.unique_selling_point),
    line('想让观众发生的变化', p.content_value),
    line('内容风格', p.content_style),
    line('内容形式', p.content_format),
    line('语言风格', p.content_tone),
    line('数据最好的内容类型', p.viral_content_pattern),
    line('团队', p.team_structure),
    line('设备', p.equipment),
    line('场地', p.shooting_location),
    line('后期能力', p.editing_capability),
    line('单条预算', p.budget_per_video),
    line('变现方式', p.monetization_model),
    line('产品品类', p.product_category),
    line('价格区间', p.price_range),
    line('成交路径', p.conversion_path),
    line('成交障碍', p.conversion_barriers),
    line('手上的资源', p.unique_resources),
    line('目前的短板', p.competitive_weakness),
  ]
    .filter(Boolean)
    .join('\n')
}

export function DeepDivePage({ focus, taskType, title, subtitle, bullets, generatingHint }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [baseline, setBaseline] = useState<string>('')
  const [loadingCtx, setLoadingCtx] = useState(true)
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()

  const load = async () => {
    setLoadingCtx(true)
    try {
      const id = getActiveProfileId()
      const profRes = await fetch('/api/profiles')
      const list = profRes.ok ? await profRes.json() : []
      const p: Profile | null = Array.isArray(list) && list.length
        ? list.find((x: Profile) => x.id === id) || list[0]
        : null
      setProfile(p)

      if (p) {
        // 取这个档案已确定的六维地基当基础
        const res = await fetch(
          `/api/positioning?profileId=${p.id}&type=${encodeURIComponent('账号定位')}`
        )
        const rows = res.ok ? await res.json() : []
        setBaseline(Array.isArray(rows) && rows[0]?.full_content ? rows[0].full_content : '')
      } else {
        setBaseline('')
      }
    } catch (e) {
      console.error('加载上下文失败:', e)
    } finally {
      setLoadingCtx(false)
    }
  }

  useEffect(() => {
    load()
    return onActiveProfileChange(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generate = async () => {
    if (!profile) {
      notify('请先创建一份账号档案')
      router.push('/dashboard/profiles/new')
      return
    }

    setIsGenerating(true)
    setResult('')
    let full = ''
    let convId = ''

    const summary = profileSummary(profile)
    const query = buildPositioningPrompt({
      profileSummary: summary,
      additionalNotes: notes,
      platform: Array.isArray(profile.account_platform)
        ? (profile.account_platform[0] as string)
        : (profile.account_platform as string) || undefined,
      restrictions: (profile.content_restrictions as string) || undefined,
      focus,
      baseline: baseline || undefined,
    })

    try {
      const res = await fetch('/api/dify/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType,
          // 记忆按档案隔离，避免代运营多个账号时串台
          profileId: profile.id,
          query,
          profileInfo: summary,
          additionalNotes: notes || '无补充说明',
        }),
      })

      // 带出服务端文案，额度用完才不会被显示成「生成失败」
      if (!res.ok) await throwApiError(res)

      full = await readDifyStream(res, {
        onChunk: (_p, all) => setResult(all),
        onConversationId: (id) => {
          convId = id
        },
      })

      if (full) {
        await save(full)
        await saveGenerationHistory(taskType, { profileSummary: summary, notes }, full)
        setConversationId(convId || undefined)
        setShowDialog(true)
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
    try {
      const firstLine = content.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').trim() || ''
      await fetch('/api/positioning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profile.id,
          positioning_type: title,
          positioning_name: firstLine.slice(0, 50) || `${asText(profile.profile_name, '账号')}的${title}`,
          full_content: content,
          // is_active 只用来标记当前生效的六维地基，深挖结果不参与
          is_active: false,
        }),
      })
    } catch (e) {
      console.error('保存失败:', e)
    }
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="glass-panel mb-6 rounded-2xl p-6">
          <ul className="mb-5 space-y-1.5">
            {bullets.map((b) => (
              <li key={b} className="text-[13px] text-muted-foreground">
                · {b}
              </li>
            ))}
          </ul>

          {/* 用哪个档案、有没有地基，必须让用户一眼看见——
              否则生成完才发现用错了档案，白等三分钟 */}
          <div className="mb-5 space-y-2 rounded-xl border border-border bg-foreground/[0.03] p-4 text-[12.5px]">
            {loadingCtx ? (
              <p className="text-muted-foreground">正在读取档案…</p>
            ) : !profile ? (
              <p className="text-destructive">
                还没有账号档案。
                <button onClick={() => router.push('/dashboard/profiles/new')} className="ml-1 underline">
                  去创建
                </button>
              </p>
            ) : (
              <>
                <p className="text-foreground">
                  当前档案：<span className="font-medium">{asText(profile.profile_name, '未命名')}</span>
                  <button
                    onClick={() => router.push(`/dashboard/profiles/${profile.id}/edit`)}
                    className="ml-2 text-primary underline"
                  >
                    编辑档案
                  </button>
                </p>
                {baseline ? (
                  <p className="text-emerald-500">
                    已读到这个号的账号定位，会在它的基础上往下深挖 ✓
                  </p>
                ) : (
                  <p className="text-amber-500">
                    还没有生成过账号定位。可以直接做，但先出一份六维地基会更准。
                    <button
                      onClick={() => router.push('/dashboard/positioning')}
                      className="ml-1 underline"
                    >
                      去生成
                    </button>
                  </p>
                )}
              </>
            )}
          </div>

          <label className="mb-2 block text-[13px] font-medium text-foreground">补充说明（选填）</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="这次特别想解决什么？比如：想把客单价提上去、只做同城、想先跑通团购"
            className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <button
            onClick={generate}
            disabled={isGenerating || loadingCtx}
            className="mt-4 w-full rounded-xl bg-primary py-2.5 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {isGenerating ? generatingHint : `生成${title}方案`}
          </button>
        </div>

        {(result || isGenerating) && (
          <div className="glass-panel rounded-2xl px-7 py-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">{title}方案</h2>
              {result && !isGenerating && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(result)
                      notify('已复制')
                    }}
                    className="glass-panel rounded-lg px-3 py-1.5 text-[12px] text-foreground"
                  >
                    复制
                  </button>
                  <button
                    onClick={() => setShowDialog(true)}
                    className="glass-panel rounded-lg px-3 py-1.5 text-[12px] text-foreground"
                  >
                    继续对话
                  </button>
                </div>
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
            {isGenerating && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
            )}
          </div>
        )}
      </div>

      {showDialog && (
        <ContinuousDialog
          isOpen={showDialog}
          onClose={() => setShowDialog(false)}
          taskType={taskType}
          initialContent={result}
          conversationId={conversationId}
        />
      )}
    </div>
  )
}

export default DeepDivePage
