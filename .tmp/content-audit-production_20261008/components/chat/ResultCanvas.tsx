'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Copy, Check, Loader2, Wand2, Eye, Pencil, GitCompare, Save } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { CreationLinks } from '@/components/workspace/CreationLinks'
import { notify } from '@/components/ui/feedback'
import { fetchGeneration, throwApiError } from '@/lib/api-error'
import { applyChatAnswer } from '@/lib/chat-stream-answer'
import { notifyGenerated } from '@/lib/upgrade'
import { supabase } from '@/lib/supabase/client'
import { browserDraftStorage, canvasDraftKey, clearCanvasDraft, readCanvasDraft, writeCanvasDraft } from '@/lib/canvas-draft'
import {
  CANVAS_TASK_TYPE, REWRITE_PRESETS, preservesLockedText, addVersion, buildRewritePrompt, cleanRewriteOutput, lineDiff, replaceSelection, type CanvasVersion,
} from '@/lib/canvas'
import type { CreationContext } from '@/lib/creation-flow'
import { creationSettingsBlock } from '@/lib/creation-settings'

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
  draftKey,
  onDirtyChange,
  onLocksChange,
}: {
  versions: CanvasVersion[]
  /** false 表示云端未成功，草稿保留，可再次保存重试。 */
  onChange: (versions: CanvasVersion[]) => boolean | void | Promise<boolean | void>
  onClose: () => void
  /** 账号背景（口吻、禁忌），改写时带上 */
  profileContext: string
  profileId: string | null
  creationContext?: CreationContext
  /** 持久作品 / 会话 + 消息标识；组件会再加真实登录账号和档案隔离。 */
  draftKey?: string
  onDirtyChange?: (dirty: boolean) => void
  onLocksChange?: (texts: string[]) => void
}) {
  const [index, setIndex] = useState(versions.length - 1)
  const [draft, setDraft] = useState(versions[versions.length - 1]?.content ?? '')
  const [mode, setMode] = useState<'edit' | 'preview' | 'diff'>('edit')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null)
  const [lockedTexts, setLockedTexts] = useState<string[]>(creationContext?.settings?.lockedTexts || [])
  const [storageKey, setStorageKey] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [sync, setSync] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [compareIndex, setCompareIndex] = useState(Math.max(0, versions.length - 2))
  const [diffWindow, setDiffWindow] = useState(300)
  const latestDraft = useRef(draft)
  latestDraft.current = draft
  const area = useRef<HTMLTextAreaElement>(null)
  const abort = useRef<AbortController | null>(null)

  // 外面加了新版（比如改写完）就跳到最新
  useEffect(() => {
    setIndex(versions.length - 1)
    setDraft(versions[versions.length - 1]?.content ?? '')
    setCompareIndex(Math.max(0, versions.length - 2))
  }, [versions.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abort.current?.abort(), [])

  const current = versions[index]
  const dirty = draft !== (current?.content ?? '')
  const selectedText = sel && sel.end > sel.start ? draft.slice(sel.start, sel.end) : ''
  const diff = useMemo(() => lineDiff(versions[compareIndex]?.content || '', draft), [versions, compareIndex, draft])
  useEffect(() => { setDiffWindow(300) }, [compareIndex, index])

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.user.id || !draftKey) return
      const key = canvasDraftKey(session.user.id, profileId, draftKey)
      const saved = readCanvasDraft(browserDraftStorage, key)
      if (saved) {
        const baseIndex = versions.findIndex(v => v.at === saved.baseAt && v.content === saved.baseContent)
        if (baseIndex >= 0) setIndex(baseIndex)
        setDraft(saved.content)
        setLockedTexts(saved.lockedTexts)
        onLocksChange?.(saved.lockedTexts)
        if (saved.needsSync) setSync('failed')
        setDraftSaved(true)
        if (saved.content !== saved.baseContent) notify('已恢复本机画布草稿；保存这一版后会同步云端')
      }
      setStorageKey(key)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [draftKey, profileId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDirtyChange?.(dirty || sync === 'failed' || sync === 'saving' || busy)
    if (!storageKey) return
    if (dirty || sync === 'failed' || lockedTexts.length) {
      setDraftSaved(writeCanvasDraft(browserDraftStorage, storageKey, { content: draft, baseContent: current?.content || '', baseAt: current?.at || 0, updatedAt: Date.now(), lockedTexts, ...(sync === 'failed' ? { needsSync: true } : {}) }))
    } else if (sync !== 'saving') {
      clearCanvasDraft(browserDraftStorage, storageKey)
      setDraftSaved(false)
    }
  }, [draft, dirty, storageKey, current, lockedTexts, sync, busy, onDirtyChange])

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!dirty && sync !== 'failed' && sync !== 'saving' && !busy) return
      event.preventDefault(); event.returnValue = ''
    }
    const protectLink = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || (!dirty && sync !== 'failed' && sync !== 'saving' && !busy)) return
      if (!confirm(draftSaved ? '修改已保留在本机草稿，尚未确认同步云端。离开此页吗？' : '修改尚未保存成功。建议先保存或复制内容，仍要离开吗？')) {
        event.preventDefault(); event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', protect)
    document.addEventListener('click', protectLink, true)
    return () => { window.removeEventListener('beforeunload', protect); document.removeEventListener('click', protectLink, true) }
  }, [dirty, sync, busy, draftSaved])

  const close = () => {
    if ((dirty || sync === 'failed' || sync === 'saving' || busy) && !confirm(draftSaved ? '修改已保留在本机草稿，重新打开可恢复。关闭画布吗？' : '修改尚未同步；请先保存或复制。仍要关闭画布吗？')) return
    onClose()
  }

  const pick = (i: number) => {
    if ((dirty || sync === 'failed') && !confirm('当前修改尚未同步云端。请先保存这一版；切换版本会替换编辑内容，继续吗？')) return
    setIndex(i)
    setCompareIndex(Math.max(0, i - 1))
    setDraft(versions[i].content)
    setSel(null)
  }

  const persistVersion = async (next: CanvasVersion[]) => {
    setSync('saving')
    try {
      const ok = await onChange(next)
      setSync(ok === false ? 'failed' : 'saved')
      if (ok === false) notify('云端未保存成功，修改保留在本机；请重试保存')
      else { if (storageKey) clearCanvasDraft(browserDraftStorage, storageKey); notify('版本已保存') }
    } catch {
      setSync('failed'); notify('保存失败，修改仍在画布中；请重试或先复制')
    }
  }

  const saveDraft = async (note = '手动修改') => {
    if ((!dirty && sync !== 'failed') || sync === 'saving' || busy) return
    await persistVersion(addVersion(versions, draft, index < versions.length - 1 ? `从第${index + 1}版分支：${note}` : note, current?.at))
  }

  const changeLocks = (texts: string[]) => {
    setLockedTexts(texts)
    onLocksChange?.(texts)
  }

  const trackSelection = () => {
    const el = area.current
    if (el) setSel({ start: el.selectionStart, end: el.selectionEnd })
  }

  const rewrite = async () => {
    const ask = instruction.trim()
    if (!ask) { notify('先写一句要怎么改，比如"口语一点""压到 30 秒"'); return }
    if (busy) return
    if (lockedTexts.includes(selectedText || draft)) { notify('要改的内容已锁定，请先解锁或选择其他段落'); return }
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
          query: buildRewritePrompt({ doc, selection: range?.text, instruction: ask, context: profileContext + creationSettingsBlock(creationContext?.settings || {}), lockedTexts }),
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
      if (latestDraft.current !== doc) throw new Error('改写期间正文已改变，已保留当前稿件，请重新选中再改')
      if (!preservesLockedText(doc, next, lockedTexts)) throw new Error('改写触及了锁定内容，未替换原稿；请调整要求再试')
      setDraft(next)
      await persistVersion(addVersion(dirty ? addVersion(versions, doc, '手动修改', current?.at) : versions, next, `改写：${ask}`.slice(0, 60), current?.at))
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
          disabled={busy || sync === 'saving'}
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
          <button type="button" disabled={versions.length < 2} onClick={() => setMode('diff')} className={`${btn(mode === 'diff')} disabled:opacity-40`} title="选择任意版本和当前稿件比较">
            <GitCompare className="h-3.5 w-3.5" />比较版本
          </button>
          <button type="button" onClick={copy} className={btn(false)}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '已复制' : '复制'}</button>
          <button type="button" onClick={close} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭画布"><X className="h-4 w-4" /></button>
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
            <label className="mb-2 flex items-center gap-2 font-sans text-[12px] text-muted-foreground">比较基准
              <select aria-label="比较基准版本" value={compareIndex} onChange={e => setCompareIndex(Number(e.target.value))} className="rounded border bg-background p-1">
                {versions.map((v, i) => <option key={i} value={i}>第 {i + 1} 版 · {v.note}</option>)}
              </select>
              → 当前稿件：绿色新增，红色删除
            </label>
            {diff.slice(0, diffWindow).map((d, i) => (
              <div key={i} className={d.type === 'add' ? 'rounded bg-emerald-500/12 px-1 text-emerald-700 dark:text-emerald-300' : d.type === 'del' ? 'rounded bg-rose-500/10 px-1 text-rose-700 line-through dark:text-rose-300' : 'px-1 text-muted-foreground'}>
                {d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}{d.text || ' '}
              </div>
            ))}
            {diff.length > diffWindow && <button type="button" onClick={() => setDiffWindow(n => n + 300)} className="mt-3 rounded border px-3 py-2 font-sans text-xs text-muted-foreground">继续显示差异（共 {diff.length} 行，已显示 {diffWindow} 行）</button>}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t px-3 py-3">
        <p role="status" className={`text-[11.5px] ${sync === 'failed' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
          {sync === 'saving' ? '正在保存版本…' : sync === 'failed' ? (draftSaved ? '云端同步失败 · 本机草稿已保留' : '云端同步失败 · 请重试或复制内容') : dirty ? (draftSaved ? '本机草稿已自动保存 · 尚未同步云端' : '尚未保存 · 请保存版本或复制内容') : sync === 'saved' ? '版本已保存' : '正在编辑所选版本'}
        </p>
        {(dirty || sync === 'failed') && mode === 'edit' && (
          <button type="button" disabled={sync === 'saving' || busy} onClick={() => void saveDraft()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/12 px-3 py-1.5 text-[12.5px] text-primary disabled:opacity-50">
            <Save className="h-3.5 w-3.5" />{sync === 'failed' ? '重试保存' : index < versions.length - 1 ? '从此版创建分支' : '保存这一版'}
          </button>
        )}
        <div className="flex flex-wrap gap-1.5">
          {REWRITE_PRESETS.map(preset => <button type="button" key={preset} disabled={busy} onClick={() => { setInstruction(preset); setMode('edit') }} className="rounded-lg border px-2 py-1 text-[11px] text-muted-foreground hover:text-primary disabled:opacity-40">{preset}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>按原文事实改写 · 锁定片段逐字保留</span>
          {selectedText && <button type="button" disabled={busy} onClick={() => changeLocks(lockedTexts.includes(selectedText) ? lockedTexts : [...lockedTexts, selectedText])} className="rounded border px-2 py-1 disabled:opacity-40">锁定所选原文</button>}
          {lockedTexts.map((text, i) => <button type="button" disabled={busy} key={i} title={`点击解除锁定：${text}`} onClick={() => changeLocks(lockedTexts.filter((_, n) => n !== i))} className="max-w-[180px] truncate rounded border border-primary/30 px-2 py-1 text-primary disabled:opacity-40">已锁定：{text.slice(0, 25)} ×</button>)}
        </div>
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
        {!dirty && draft.trim() && <CreationLinks body={draft} context={{ ...creationContext, settings: { ...creationContext?.settings, lockedTexts } }} embedded />}
      </div>
    </aside>
  )
}
