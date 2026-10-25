'use client'

import { SCRIPT_SHARE_STEP, TACTIC_MIX_PRESETS, normalizeScriptShare, tacticSplit } from '@/lib/tactic-mix'

/**
 * 36 计与四大脚本的搭配比例（规则都在 lib/tactic-mix）。
 * 对所有目的生效：36 计和四大脚本都是拍法的形式，大流量由出发点（人货场、三有、爆款元素）决定。
 */
export function TacticMixBar({ value, onChange, className = '' }: { value: number; onChange: (share: number) => void; className?: string }) {
  const share = normalizeScriptShare(value)
  const split = tacticSplit(share)
  return (
    <div className={`rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-[12px] ${className}`}>
      <div className="mb-2 text-foreground">
        36 计与四大脚本：<span className="font-medium">36 计 {split.tactic}% ｜ 四大脚本 {split.scripts}%</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {TACTIC_MIX_PRESETS.map((p) => {
          const on = share === p.share
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              title={p.hint}
              onClick={() => onChange(p.share)}
              className={`glass-interactive rounded-xl border px-2.5 py-2 text-[12.5px] font-medium ${on ? 'glass-selected text-primary' : 'glass-panel text-foreground'}`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <label className="mt-2.5 flex items-center gap-3 text-[12.5px] text-foreground">
        <span className="w-16 shrink-0">四大脚本</span>
        <input
          type="range"
          min={0}
          max={100}
          step={SCRIPT_SHARE_STEP}
          value={share}
          aria-label="四大脚本占比"
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{share}%</span>
      </label>
      <p className="mt-2 text-[11px] text-muted-foreground">两种形式都能拍大流量，比例不分目的；大流量看人货场、三有和爆款元素，不看用了哪套形式。</p>
    </div>
  )
}
