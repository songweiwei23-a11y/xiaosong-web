'use client'

import Link from 'next/link'
import { useCreatorContext } from '@/hooks/useCreatorContext'
import { parseBrief, BRIEF_FIELDS } from '@/lib/creative-brief'
import { manifestOf, type Board } from '@/lib/context-manifest'
import { briefOlderThanProfile } from '@/lib/creator-context'
import { activeTaboos, countTaboos } from '@/lib/taboos'

/**
 * 各板块顶部的「已自动带上什么」状态条。
 *
 * 【替掉了什么】选题页和脚本页原来各有一组「账号档案 / 账号定位」下拉框，
 * 让用户每次生成前再选一次。现在档案统一跟侧边栏走、方向统一由创作简报下发，
 * 这两个下拉框既冗余又会打架——用户在这儿选了 A 号，侧边栏还是 B 号，
 * 而简报读的是侧边栏那个。
 *
 * 【为什么不是静默生效】自动带上但不告诉用户，等于把"用了什么"变成黑箱。
 * 产出不对的时候他没法判断是档案错了、简报错了，还是提示词不行。
 * 所以这里明确列出：用的是哪个档案、这个板块从简报里读了哪几段。
 */

interface Props {
  board: Board
  className?: string
}

export function ContextBadge({ board, className = '' }: Props) {
  const { context, loading } = useCreatorContext()
  const manifest = manifestOf(board)
  if (!manifest) return null

  const profileName = context.profile?.profile_name?.trim()
  const values = parseBrief(context.brief)
  const used = manifest.brief
    .map((k) => (values[k]?.trim() ? BRIEF_FIELDS.find((f) => f.key === k)?.label : null))
    .filter(Boolean) as string[]

  const base =
    'rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-[12px] leading-relaxed'

  if (loading) {
    return <div className={`${base} text-muted-foreground ${className}`}>正在读取账号信息…</div>
  }

  if (!profileName) {
    return (
      <div className={`${base} text-amber-500 ${className}`}>
        还没有账号档案，这次生成拿不到你的人群、卖点和禁忌。
        <Link href="/dashboard/profiles/new" className="ml-1 underline">
          去创建
        </Link>
      </div>
    )
  }

  return (
    <div className={`${base} space-y-1 ${className}`}>
      <p className="text-foreground">
        已自动使用档案：<span className="font-medium">{profileName}</span>
        <Link href="/dashboard/profiles" className="ml-2 text-primary underline">
          换一个
        </Link>
      </p>

      {manifest.profile.includes('restrictions') && (() => {
        const a = activeTaboos(context.profile)
        const names = a.industries.map((x) => x.industry.name).join('、')
        return (
          <p className="text-muted-foreground">
            已避开 {countTaboos(a)} 条禁忌（平台红线{names ? ` + ${names}` : ''}）
            <Link href="/dashboard/profiles" className="ml-1 underline">在档案里调整</Link>
          </p>
        )
      })()}

      {used.length > 0 ? (
        <>
          <p className="text-emerald-500">
            创作简报已带上：{used.join('、')} ✓
          </p>
          {briefOlderThanProfile(context) && (
            <p className="text-amber-500">
              档案在简报之后改过，简报里的人设、年限可能是旧的（生成时会以档案为准）。
              <Link href="/dashboard/creative-brief" className="ml-1 underline">
                重新生成简报
              </Link>
            </p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">
          还没生成创作简报，这次只能用档案里的字段。
          <Link href="/dashboard/creative-brief" className="ml-1 underline">
            去生成
          </Link>
          （做完选题、脚本、分镜都会自动用上）
        </p>
      )}
    </div>
  )
}

export default ContextBadge
