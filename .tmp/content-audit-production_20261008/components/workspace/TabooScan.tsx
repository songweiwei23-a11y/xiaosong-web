'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCreatorContext } from '@/hooks/useCreatorContext'
import { scanTaboos, fixRequest } from '@/lib/taboos'
import { setDialogDraft } from '@/lib/dialog-draft'
import { notify } from '@/components/ui/feedback'

/**
 * 生成完扫一遍禁忌词（平台红线 + 这个号所在行业的，见 lib/taboos）。
 * 提示词里已经写了禁忌，这里是兜底：模型偶尔还是会冒出「全城最正宗」。
 * 有「继续对话」的板块，点「让 AI 改掉」会打开对话框并填好修改要求；没有的就复制要求。
 */
export function TabooScan({ body, onContinue }: { body: string; onContinue?: () => void }) {
  const { context } = useCreatorContext()
  const hits = useMemo(() => scanTaboos(body, context.profile), [body, context.profile])
  if (hits.length === 0) return null

  const fix = () => {
    const text = fixRequest(hits)
    if (onContinue) {
      setDialogDraft(text)
      onContinue()
    } else {
      navigator.clipboard?.writeText(text)
      notify('修改要求已复制，粘贴给 AI 就能改')
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-[12.5px]">
      <p className="mb-2 flex items-center gap-1.5 font-medium text-amber-500">
        <AlertTriangle className="h-4 w-4" />
        有 {hits.length} 处可能踩禁忌，发布前改一下
      </p>
      <ul className="space-y-1.5 text-foreground">
        {hits.slice(0, 8).map((h) => (
          <li key={`${h.taboo.id}-${h.word}`} className="leading-relaxed">
            <span className="rounded bg-amber-500/15 px-1 font-medium text-amber-600 dark:text-amber-400">{h.word}</span>
            <span className="ml-1.5 text-muted-foreground">
              {h.taboo.why}
              {h.taboo.instead ? `，可以换成：${h.taboo.instead}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={fix} className="mt-2.5 rounded-lg bg-amber-500/90 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-500">
        {onContinue ? '让 AI 改掉' : '复制修改要求'}
      </button>
    </div>
  )
}
