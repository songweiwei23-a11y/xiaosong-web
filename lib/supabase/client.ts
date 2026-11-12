'use client'

import { createBrowserClient } from '@supabase/ssr'
import { attachLoginNameCleanup } from '@/lib/login-memory'
import { supabaseFetch } from './fetch'

/**
 * 规范的浏览器端 Supabase 客户端。
 * 基于 @supabase/ssr，自动通过 Cookie 与服务端/middleware 共享同一会话。
 * 全站客户端组件统一从这里导入 supabase，避免多客户端造成的会话不一致。
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: supabaseFetch } }
)

// 全站只有这一处听 SIGNED_OUT。各页面自己的 onAuthStateChange 只关心「现在有没有会话」，
// 不负责清登录页记住的名字。服务端渲染没有 window，不在这里订阅。
if (typeof window !== 'undefined') attachLoginNameCleanup(supabase.auth)
