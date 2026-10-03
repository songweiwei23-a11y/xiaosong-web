'use client'

import { useEffect } from 'react'
import { installClipboardFallback } from '@/lib/clipboard'

/** http 访问时浏览器不给剪贴板接口，全站复制按钮都会失效。挂在根布局里补上（见 lib/clipboard） */
export function ClipboardFallback() {
  useEffect(() => {
    installClipboardFallback()
  }, [])
  return null
}
