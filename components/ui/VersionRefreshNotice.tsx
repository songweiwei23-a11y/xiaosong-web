'use client'

import { useEffect, useState } from 'react'

/*
 * 部署之后，还开着旧页面的标签会找不到新版本的脚本或服务端动作（「Failed to find Server Action」等），
 * 操作直接报错，用户看到的只是一句看不懂的话。这里检测到这类错误，给一条明确的「刷新」提示。
 * 只识别版本错配的错误，其他报错照常处理，不在这里吞掉。
 */
const STALE_BUILD = /Failed to find Server Action|Failed to load chunk|Loading chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

function messageOf(value: unknown): string {
  if (value instanceof Error) return `${value.name} ${value.message}`
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'message' in value) return String((value as { message: unknown }).message)
  return ''
}

export function VersionRefreshNotice() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const check = (value: unknown) => { if (STALE_BUILD.test(messageOf(value))) setStale(true) }
    const onError = (e: ErrorEvent) => check(e.error ?? e.message)
    const onRejection = (e: PromiseRejectionEvent) => check(e.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!stale) return null

  return (
    <div role="alert" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-background px-4 py-3 text-[13px] shadow-lg">
      <span className="text-foreground">页面已经更新，刚才那次操作没有成功。刷新后再试一次。</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground"
      >
        刷新
      </button>
    </div>
  )
}
