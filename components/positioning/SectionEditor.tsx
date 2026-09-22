'use client'

import { useState } from 'react'
import { notify } from '@/components/ui/feedback'
import { throwApiError } from '@/lib/api-error'
import { readDifyStream } from '@/lib/sse-stream'
import {
  SECTIONS,
  parsePositioning,
  replaceSection,
  buildSectionPrompt,
} from '@/lib/positioning-sections'

/**
 * 定位的分节编辑与单节重生成。
 *
 * 【为什么要有】定位 12466 字、跑一次 5 分钟。用一段时间发现某个细节不对，
 * 原来唯一的路是整份重生成——其他九成对的内容也跟着变，
 * 等于为改一句话把整份方案重赌一次。后果是**用户不敢点重新生成**。
 *
 * 所以给两条轻的路：
 *   直接改      0 秒，覆盖八成场景
 *   单节重生成  20-30 秒，只动这一节，其余一个字不动
 * 整份重生成留给"方向整个变了"。
 */

interface Props {
  /** 定位全文 */
  content: string
  profileId: string | null
  profileSummary?: string
  /** 保存改动。返回是否成功 */
  onSave: (next: string) => Promise<boolean>
}

export function SectionEditor({ content, profileId, profileSummary, onSave }: Props) {
  const parsed = parsePositioning(content)
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'save' | 'regen' | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const present = SECTIONS.filter((s) => parsed[s.key]?.trim())
  if (present.length === 0) return null

  const start = (key: string) => {
    setOpen(key)
    setDraft(parsed[key] || '')
    setNote('')
  }

  const save = async (body: string) => {
    if (!open) return
    setBusy('save')
    try {
      const ok = await onSave(replaceSection(content, open, body))
      if (ok) {
        notify('已保存')
        setOpen(null)
      } else {
        notify('保存失败，请重试')
      }
    } finally {
      setBusy(null)
    }
  }

  const regenerate = async () => {
    if (!open) return
    const def = SECTIONS.find((s) => s.key === open)!
    setBusy('regen')
    setElapsed(0)
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000)
    try {
      const res = await fetch('/api/dify/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: '账号定位',
          profileId,
          query: buildSectionPrompt({
            sectionKey: open,
            positioningFull: content,
            note,
            profileSummary,
          }),
        }),
      })
      if (!res.ok) await throwApiError(res)

      // 边生成边显示在编辑框里，改完直接就能存
      const full = await readDifyStream(res, { onChunk: (_p, all) => setDraft(all) })
      if (full.trim()) {
        await save(full.trim())
        notify(`「${def.label}」已重写，其余各节未改动`)
      }
    } catch (e: unknown) {
      console.error('单节重生成失败:', e)
      notify((e as Error)?.message || '重新生成失败，请重试')
    } finally {
      clearInterval(timer)
      setBusy(null)
    }
  }

  return (
    <div className="glass-panel mt-6 rounded-2xl p-6">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-foreground">逐节调整</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          哪一节不对就改哪一节。直接改是立刻生效的；点「重新生成这一节」会带上你说的问题重写，
          <span className="text-foreground">其余各节一个字都不会动</span>。
        </p>
      </div>

      <div className="space-y-1.5">
        {present.map((s) => {
          const editing = open === s.key
          return (
            <div key={s.key} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => (editing ? setOpen(null) : start(s.key))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-foreground/[0.04]"
              >
                <span className="min-w-0">
                  <span className="text-[13px] font-medium text-foreground">{s.label}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">{s.hint}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {editing ? '收起' : '改这节'}
                </span>
              </button>

              {editing && (
                <div className="space-y-3 border-t border-border px-4 py-4">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={Math.min(18, Math.max(5, draft.split('\n').length + 1))}
                    className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-foreground">
                      这一节哪里不对？（想让 AI 重写时填）
                    </label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="比如：人设标签太泛了，我想突出「先干活后收钱」"
                      className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => save(draft)}
                      disabled={busy !== null}
                      className="rounded-xl bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {busy === 'save' ? '保存中…' : '保存修改'}
                    </button>
                    <button
                      type="button"
                      onClick={regenerate}
                      disabled={busy !== null}
                      className="glass-panel rounded-xl px-5 py-2 text-[13px] text-foreground disabled:opacity-50"
                    >
                      {busy === 'regen'
                        ? `重写中 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
                        : '重新生成这一节'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      disabled={busy !== null}
                      className="px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      取消
                    </button>
                    {busy === 'regen' && (
                      <span className="text-[11px] text-muted-foreground">
                        只重写这一节，通常 20-40 秒
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        改完之后，创作简报里对应的内容可能就过期了——去简报页看一眼，它会提示要不要重新生成。
        商业定位和内容定位不会自动重跑，需要时你自己点。
      </p>
    </div>
  )
}

export default SectionEditor
