'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { INDUSTRIES, PLATFORM_TABOOS, industriesOf, type Taboo, type TabooSettings } from '@/lib/taboos'

/**
 * 档案里的「禁忌与红线」（规则见 lib/taboos）。
 * 平台红线常开（只有站外导流能关）；行业禁忌按赛道、品类自动带出，可逐条关；认不出行业可以手动加；
 * 还能自己补充。设好后所有板块生成时都会避开，生成完还会扫一遍。
 */

const KIND_LABEL: Record<Taboo['kind'], string> = { direction: '不能拍的方向', say: '不能说', shoot: '不能拍' }

function Row({ t, on, locked, onToggle }: { t: Taboo; on: boolean; locked?: boolean; onToggle?: () => void }) {
  return (
    <label className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12.5px] ${locked ? '' : 'cursor-pointer hover:bg-foreground/[0.04]'}`}>
      {locked ? (
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="常开" />
      ) : (
        <input type="checkbox" checked={on} onChange={onToggle} className="mt-0.5 accent-primary" aria-label={t.text} />
      )}
      <span className={on ? 'text-foreground' : 'text-muted-foreground line-through'}>
        <span className="mr-1.5 rounded bg-foreground/[0.06] px-1 py-px text-[10.5px] text-muted-foreground">{KIND_LABEL[t.kind]}</span>
        {t.text}
        <span className="ml-1 text-[11px] text-muted-foreground">— {t.why}</span>
      </span>
    </label>
  )
}

export function TabooEditor({
  value,
  onChange,
  profile,
}: {
  value: TabooSettings
  onChange: (s: TabooSettings) => void
  /** 表单当前填的赛道、品类、名称，用来认行业 */
  profile: Record<string, unknown>
}) {
  const [adding, setAdding] = useState(false)
  const matched = industriesOf({ ...profile, taboo_settings: value })
  const off = new Set(value.disabled)
  const toggle = (id: string) =>
    onChange({ ...value, disabled: off.has(id) ? value.disabled.filter((x) => x !== id) : [...value.disabled, id] })
  const notMatched = INDUSTRIES.filter((i) => !matched.some((m) => m.id === i.id))

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[12.5px] font-medium text-foreground">平台红线（所有账号都要守）</p>
        {PLATFORM_TABOOS.map((t) => (
          <Row key={t.id} t={t} on={!off.has(t.id)} locked={!t.closable} onToggle={() => toggle(t.id)} />
        ))}
        <p className="mt-1 px-2 text-[11px] text-muted-foreground">「加微信」那条可以关：视频号、做私域为主的号确实要留联系方式，抖音上建议开着。</p>
      </div>

      {matched.length > 0 ? (
        matched.map((ind) => (
          <div key={ind.id}>
            <p className="mb-1 flex items-center justify-between text-[12.5px] font-medium text-foreground">
              <span>{ind.name}行业（按你的档案自动带出）</span>
              {value.added.includes(ind.id) && (
                <button type="button" onClick={() => onChange({ ...value, added: value.added.filter((x) => x !== ind.id) })} className="text-[11px] font-normal text-muted-foreground underline">
                  移除这个行业
                </button>
              )}
            </p>
            {ind.items.map((t) => (
              <Row key={t.id} t={t} on={!off.has(t.id)} onToggle={() => toggle(t.id)} />
            ))}
          </div>
        ))
      ) : (
        <p className="rounded-lg bg-foreground/[0.04] px-3 py-2 text-[12px] text-muted-foreground">
          还没认出你的行业：在第 1 步填好赛道、第 6 步填好产品品类，会自动带出这个行业的禁忌；也可以在下面手动加。
        </p>
      )}

      <div>
        <button type="button" onClick={() => setAdding(!adding)} className="text-[12px] text-primary underline">
          {adding ? '收起' : '没认对？手动加一个行业'}
        </button>
        {adding && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {notMatched.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => { onChange({ ...value, added: [...value.added, i.id] }); setAdding(false) }}
                className="glass-panel glass-interactive rounded-lg border px-2.5 py-1 text-[12px] text-foreground"
              >
                + {i.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-[12.5px] font-medium text-foreground">排除清单（当它不存在）</p>
        <p className="mb-1.5 text-[11.5px] text-muted-foreground">
          前采建档时没选的会自动记在这里。所有板块都不会引用、也不会拿它当依据——档案别的栏里还残留相关说法也一样忽略。
        </p>
        {value.excluded.length > 0 ? (
          <ul className="space-y-1">
            {value.excluded.map((x) => (
              <li key={x} className="flex items-start justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5 text-[12.5px] text-foreground">
                <span>{x}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, excluded: value.excluded.filter((y) => y !== x) })}
                  className="shrink-0 text-[11px] text-muted-foreground underline"
                  title="恢复：以后又可以用这条信息"
                >
                  恢复
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted-foreground">还没有。</p>
        )}
        <input
          placeholder="手动加一条，回车确认（例如：不提直播、公益相关的事）"
          onKeyDown={(e) => {
            const v = e.currentTarget.value.trim()
            if (e.key === 'Enter' && v) {
              e.preventDefault()
              onChange({ ...value, excluded: Array.from(new Set([...value.excluded, v])) })
              e.currentTarget.value = ''
            }
          }}
          className="mt-1.5 w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="mb-1 block text-[12.5px] font-medium text-foreground">我自己补充的（一行一条）</label>
        <textarea
          value={value.extra.join('\n')}
          onChange={(e) => onChange({ ...value, extra: e.target.value.split('\n') })}
          onBlur={() => onChange({ ...value, extra: value.extra.map((x) => x.trim()).filter(Boolean) })}
          rows={3}
          placeholder={'例如：\n不拍老板娘\n不提之前那家店的名字'}
          className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  )
}
