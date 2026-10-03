'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Copy, Check, Loader2, Wand2, Eye, Pencil, GitCompare, Save } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { CreationLinks } from '@/components/workspace/CreationLinks'
import { notify } from '@/components/ui/feedback'
import { fetchGeneration, throwApiError } from '@/lib/api-error'
import { applyChatAnswer } from '@/lib/chat-stream-answer'
import { notifyGenerated } from '@/lib/upgrade'
import {
  CANVAS_TASK_TYPE, addVersion, buildRewritePrompt, cleanRewriteOutput, lineDiff, replaceSelection, type CanvasVersion,
} from '@/lib/canvas'
import type { CreationContext } from '@/lib/creation-flow'

/**
 * 自由对话的结果画布（2026-10-03）。逻辑在 lib/canvas。
 * - 直接改：编辑框里改完点「保存这一版」
 * - 让 AI 改：选中一段 → 写要求 → 只改这一段；不选就整篇改
 * - 版本：每次保存 / 改写都是一版，可以切换，「对比上一版」逐行标出增删
 * - 改好的版本可以复制、收藏、继续创作（接创作闭环）
 */
export function ResultCanvas({
  versions,
  onChange,
  onClose,
  profileContext,
  profileId,
  creationContext,
}: {
  versions: CanvasVersion[]
  onChange: (versions: CanvasVersion[]) => void
  onClose: () => void
  /** 账号背景（口吻、禁忌），改写时带上 */
  profileContext: string
  profileId: string | null
  creationContext?: CreationContext
}) {
  const [index, setIndex] = useState(versions.length - 1)
  const [draft, setDraft] = useState(versions[versions.length - 1]?.content ?? '')
  const [mode, setMode] = useState<'edit' | 'preview' | 'diff'>('edit')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const abort = useRef<AbortController | null>(null)

  // 外面加了新版（比如改写完）就跳到最新
  useEffect(() => {
    setIndex(versions.length - 1)
    setDraft(versions[versions.length - 1]?.content ?? '')
  }, [versions.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abort.current?.abort(), [])

  const current = versions[index]
  const dirty = draft !== (current?.content ?? '')
  const selectedText = sel && sel.end > sel.start ? draft.slice(sel.start, sel.end) : ''
  const diff = useMemo(() => (index > 0 ? lineDiff(versions[index - 1].content, versions[index].content) : []), [versions, index])

  const pick = (i: number) => {
    if (dirty && !confirm('这一版改了还没保存，切换后改动会丢掉。继续吗？')) return
    setIndex(i)
    setDraft(versions[i].content)
    setSel(null)
  }

  const saveDraft = (note = '手动修改') => {
    if (!dirty) return
    onChange(addVersion(versions, draft, note))
    notify('已保存为新的一版')
  }

  const trackSelection = () => {
    const el = area.current
    if (el) setSel({ start: el.selectionStart, end: el.selectionEnd })
  }

  const rewrite = async () => {
    const ask = instruction.trim()
    if (!ask) { notify('先写一句要怎么改，比如"口语一点""压到 30 秒"'); return }
    if (busy) return
    const doc = draft
    const range = selectedText ? { ...sel!, text: selectedText } : null
    setBusy(true)
    const controller = new AbortController()
    abort.current = controller
    let text = ''
    try {
      const res = await fetchGeneration('/api/dify/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          // 单独开会话：「画布改写」在 ISOLATED_TASKS 里，不读也不写这个档案共用的记忆
          taskType: CANVAS_TASK_TYPE,
          query: buildRewritePrompt({ doc, selection: range?.text, instruction: ask, context: profileContext }),
          question: ask,
          profileId,
          webSearchMode: 'off',
        }),
      })
      if (!res.ok) await throwApiError(res, '改写失败')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim().startsWith('data: ')) continue
          let data: Record<string, unknown>
          try { data = JSON.parse(line.trim().slice(6)) } catch { continue }
          if (data.event === 'error') throw new Error(String(data.message || data.error || '改写失败'))
          if (data.answer && ['message', 'agent_message', 'message_replace'].includes(String(data.event))) text = applyChatAnswer(text, data as never)
        }
      }
      const out = cleanRewriteOutput(text)
      if (!out) throw new Error('这次没改出内容，换个说法再试一次')
      const next = range ? replaceSelection(doc, range.start, range.end, range.text, out) : out
      if (next === null) throw new Error('改写期间稿子被改动过，选中的位置对不上了，请重新选中再改')
      onChange(addVersion(dirty ? addVersion(versions, doc, '手动修改') : versions, next, `改写：${ask}`.slice(0, 60)))
      setInstruction('')
      setSel(null)
      notifyGenerated()
    } catch (e) {
      if (!controller.signal.aborted) notify((e as Error).message || '改写失败，请重试')
    } finally {
      setBusy(false)
      abort.current = null
    }
  }

  const copy = () => {
    navigator.clipboard?.writeText(draft).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }, () => notify('复制失败'))
  }

  const btn = (on: boolean) => `inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] ${on ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`

  return (
    <aside
      aria-label="结果画布"
      className="fixed inset-0 z-40 flex flex-col bg-card md:static md:z-auto md:w-[min(52vw,760px)] md:shrink-0 md:border-l"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">结果画布</span>
        <select
          aria-label="版本"
          value={index}
          onChange={(e) => pick(Number(e.target.value))}
          className="max-w-[220px] rounded-lg border border-border bg-background px-2 py-1 text-[12px]"
        >
          {versions.map((v, i) => (
            <option key={i} value={i}>第 {i + 1} 版 · {v.note || '修改'}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setMode('edit')} className={btn(mode === 'edit')}><Pencil className="h-3.5 w-3.5" />编辑</button>
          <button type="button" onClick={() => setMode('preview')} className={btn(mode === 'preview')}><Eye className="h-3.5 w-3.5" />预览</button>
          <button type="button" disabled={index === 0} onClick={() => setMode('diff')} className={`${btn(mode === 'diff')} disabled:opacity-40`} title={index === 0 ? '第一版没有可对比的' : '和上一版逐行对比'}>
            <GitCompare className="h-3.5 w-3.5" />对比上一版
          </button>
          <button type="button" onClick={copy} className={btn(false)}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '已复制' : '复制'}</button>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭画布"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {mode === 'edit' && (
          <textarea
            ref={area}
            aria-label="画布内容"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onSelect={trackSelection}
            onKeyUp={trackSelection}
            onMouseUp={trackSelection}
            className="h-full min-h-[50vh] w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-foreground focus:border-primary focus:outline-none"
          />
        )}
        {mode === 'preview' && (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-[14px] prose-p:leading-[1.8]">
            <Markdown>{draft}</Markdown>
          </div>
        )}
        {mode === 'diff' && (
          <div className="space-y-0.5 font-mono text-[12.5px] leading-relaxed">
            <p className="mb-2 font-sans text-[12px] text-muted-foreground">第 {index} 版 → 第 {index + 1} 版：绿色是新加的，红色划线是删掉的</p>
            {diff.map((d, i) => (
              <div key={i} className={d.type === 'add' ? 'rounded bg-emerald-500/12 px-1 text-emerald-700 dark:text-emerald-300' : d.type === 'del' ? 'rounded bg-rose-500/10 px-1 text-rose-700 line-through dark:text-rose-300' : 'px-1 text-muted-foreground'}>
                {d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}{d.text || ' '}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t px-3 py-3">
        {dirty && mode === 'edit' && (
          <button type="button" onClick={() => saveDraft()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/12 px-3 py-1.5 text-[12.5px] text-primary">
            <Save className="h-3.5 w-3.5" />保存这一版
          </button>
        )}
        <p className="text-[11.5px] text-muted-foreground">
          {selectedText ? `已选中 ${selectedText.length} 个字：只改这一段` : '在上面选中一段只改那段；不选就整篇按要求改'}
        </p>
        <div className="flex gap-2">
          <input
            aria-label="改写要求"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void rewrite() } }}
            placeholder={selectedText ? '这段怎么改？例如：口语一点、更狠一点' : '整篇怎么改？例如：压到 30 秒、开头换成反问'}
            disabled={busy || mode !== 'edit'}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background/50 px-3 py-2 text-[13px] focus:border-primary focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => (busy ? abort.current?.abort() : void rewrite())}
            disabled={mode !== 'edit'}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl brand-gradient px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />停止</> : <><Wand2 className="h-4 w-4" />{selectedText ? '改这段' : '整篇改'}</>}
          </button>
        </div>
        {/* 改好的版本直接收藏 / 去下一个板块（创作闭环） */}
        {!dirty && draft.trim() && <CreationLinks body={draft} context={creationContext} embedded />}
      </div>
    </aside>
  )
}
