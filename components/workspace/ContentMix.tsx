'use client'

import { useState } from 'react'
import { CONTENT_ROLE_LIST, type ContentRole } from '@/lib/content-roles'
import {
  PRESETS, normalizeMix, resolveMix, formatMix, mixToCounts, checkMix,
  type ContentMix, type MixSetting, type ResolvedMix,
} from '@/lib/content-mix'

/**
 * 内容配比的三个界面件（规则都在 lib/content-mix）：
 * - ContentMixPicker：档案里设默认配比
 * - ContentMixBar：各板块顶上显示"这次按什么配比"，可以临时改
 * - MixCheckLine：生成完数一遍，对不上就标黄
 */

const COLORS: Record<ContentRole, string> = {
  流量型: 'bg-sky-500',
  人设型: 'bg-violet-500',
  变现型: 'bg-amber-500',
}

/** 一条三色比例条 */
export function MixBarGraphic({ mix, counts }: { mix: ContentMix; counts?: Record<ContentRole, number> }) {
  return (
    <div className="space-y-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
        {CONTENT_ROLE_LIST.map((r) => (
          <div key={r} className={COLORS[r]} style={{ width: `${mix[r]}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
        {CONTENT_ROLE_LIST.map((r) => (
          <span key={r} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${COLORS[r]}`} />
            {r} {mix[r]}%{counts ? `（${counts[r]} 条）` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 三个滑条，拖一个，另外两个按原比例让出/补回，总和始终 100 */
function CustomSliders({ value, onChange }: { value: ContentMix; onChange: (m: ContentMix) => void }) {
  const set = (role: ContentRole, v: number) => {
    const others = CONTENT_ROLE_LIST.filter((r) => r !== role)
    const rest = 100 - v
    const before = others.reduce((a, r) => a + value[r], 0)
    const next = { ...value, [role]: v } as ContentMix
    others.forEach((r) => { next[r] = before > 0 ? (value[r] / before) * rest : rest / others.length })
    onChange(normalizeMix(next))
  }
  return (
    <div className="space-y-2">
      {CONTENT_ROLE_LIST.map((r) => (
        <label key={r} className="flex items-center gap-3 text-[12.5px] text-foreground">
          <span className="w-12 shrink-0">{r}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value[r]}
            aria-label={`${r}占比`}
            onChange={(e) => set(r, Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="w-10 shrink-0 text-right tabular-nums">{value[r]}%</span>
        </label>
      ))}
    </div>
  )
}

interface PickerProps {
  value: MixSetting | null
  onChange: (s: MixSetting) => void
  /** 用来算"系统推荐"是多少：账号阶段、变现方式 */
  profile: Record<string, unknown> | null | undefined
  goal?: string
}

/** 档案里设默认配比，也给板块上的"这次改一下"复用 */
export function ContentMixPicker({ value, onChange, profile, goal }: PickerProps) {
  const setting = value ?? { preset: 'auto' as const }
  // 选"系统推荐"时算推荐值；档案还没存这一栏时也一样
  const resolved = resolveMix({ ...(profile ?? {}), content_mix: undefined }, setting, goal)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {PRESETS.map((p) => {
          const on = setting.preset === p.id
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              title={p.hint}
              onClick={() => onChange(p.id === 'custom' ? { preset: 'custom', custom: setting.custom ?? resolved.mix } : { preset: p.id })}
              className={`glass-interactive rounded-xl border px-2.5 py-2 text-[12.5px] font-medium ${on ? 'glass-selected text-primary' : 'glass-panel text-foreground'}`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      {setting.preset === 'custom' ? (
        <CustomSliders value={setting.custom ?? resolved.mix} onChange={(m) => onChange({ preset: 'custom', custom: m })} />
      ) : null}
      <MixBarGraphic mix={resolved.mix} />
      {setting.preset === 'auto' && resolved.reason && (
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">为什么是这个比例：{resolved.reason}</p>
      )}
    </div>
  )
}

interface BarProps {
  profile: Record<string, unknown> | null | undefined
  /** 这次临时改的；null = 跟着档案走 */
  override: MixSetting | null
  onOverride: (s: MixSetting | null) => void
  /** 这批出几条（有的话显示每种几条） */
  count?: number
  goal?: string
  className?: string
}

/** 板块上的配比条：默认跟档案，点"这次改一下"临时调 */
export function ContentMixBar({ profile, override, onOverride, count, goal, className = '' }: BarProps) {
  const [open, setOpen] = useState(false)
  const r = resolveMix(profile, override, goal)
  const counts = count ? mixToCounts(r.mix, count) : undefined
  return (
    <div className={`rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-[12px] ${className}`}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-foreground">
          内容配比：<span className="font-medium">{r.label}</span>
        </span>
        <span className="flex gap-2">
          {override && (
            <button type="button" onClick={() => { onOverride(null); setOpen(false) }} className="text-muted-foreground underline">
              恢复档案设置
            </button>
          )}
          <button type="button" onClick={() => setOpen(!open)} className="text-primary underline">
            {open ? '收起' : '这次改一下'}
          </button>
        </span>
      </div>
      <MixBarGraphic mix={r.mix} counts={counts} />
      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <ContentMixPicker value={override ?? { preset: 'auto' }} onChange={(s) => onOverride(s)} profile={profile} goal={goal} />
          <p className="mt-2 text-[11px] text-muted-foreground">只对这一次生成有效。想长期改，去账号档案里设。</p>
        </div>
      )}
    </div>
  )
}

/** 生成完数一遍：每种目的几条，和要求对不对得上 */
export function MixCheckLine({ text, resolved, count }: { text: string; resolved: ResolvedMix; count: number }) {
  const c = checkMix(text, resolved, count)
  if (!c.counted) return null
  return (
    <p className={`rounded-lg px-3 py-2 text-[12px] ${c.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
      {c.ok
        ? `✓ 这批 ${c.got.total} 条：${c.summary}，符合配比（${formatMix(resolved.mix)}）`
        : `⚠️ 这批 ${c.got.total} 条：${c.summary}${c.got.unknown ? `，另有 ${c.got.unknown} 条没标目的` : ''}；要求是 ${c.expected}。可以重新生成，或者手动调整`}
    </p>
  )
}
