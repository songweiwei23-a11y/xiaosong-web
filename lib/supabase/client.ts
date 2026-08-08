'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * 规范的浏览器端 Supabase 客户端。
 * 基于 @supabase/ssr，自动通过 Cookie 与服务端/middleware 共享同一会话。
 * 全站客户端组件统一从这里导入 supabase，避免多客户端造成的会话不一致。
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
