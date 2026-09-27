'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getActiveProfileId } from '@/lib/active-profile'
import { setupSteps, type SetupStep } from '@/lib/setup-progress'
import { SetupChecklist } from '@/components/onboarding/SetupChecklist'
import { LoadingRings } from '@/components/auth/LoadingRings'

/**
 * 上手引导。
 *
 * 【原来是什么】三张静态欢迎页（欢迎 / 免费额度 / 准备好了吗），
 * 末尾两个按钮丢去脚本或选题。而且**全站没有任何地方跳转过来**——
 * 写了 147 行，一个用户都没看到过。
 *
 * 【为什么重做】线上漏斗：100% 的人建了档案，40% 做完账号定位，
 * 只有 10% 做到创作简报。而简报正是让选题、脚本真正用上账号信息的
 * 那一环——90% 的人从没体验过这个产品值钱的部分，然后就走了。
 *
 * 所以引导不能是走马灯，得是一张**照着做的清单**：读真实状态、
 * 标出做完了哪几步、把下一步做成唯一显眼的那个按钮。
 *
 * 这个文件只负责取数和登录校验，画在 components/onboarding/SetupChecklist。
 */
export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<SetupStep[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const profRes = await fetch('/api/profiles').catch(() => null)
        const raw = profRes?.ok ? await profRes.json() : []
        const list: Array<{ id: string }> = Array.isArray(raw) ? raw : []

        // 定位挂在某个档案下，没档案就无从查起
        let types: string[] = []
        if (list.length > 0) {
          const activeId = getActiveProfileId()
          const profileId = list.find((p) => p.id === activeId)?.id ?? list[0].id
          const posRes = await fetch(`/api/positioning?profileId=${profileId}`).catch(() => null)
          if (posRes?.ok) {
            const rows = await posRes.json()
            if (Array.isArray(rows)) {
              types = rows.map((r: { positioning_type?: string }) => r.positioning_type ?? '')
            }
          }
        }

        setSteps(setupSteps({ profileCount: list.length, positioningTypes: types }))
      } catch {
        // 查不到就按"一步都没做"处理：引导本来就是给新用户看的，
        // 宁可多引导一次，也不要因为一次请求失败把人卡在空白页
        setSteps(setupSteps({ profileCount: 0, positioningTypes: [] }))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingRings size={72} />
          <p className="mt-5 text-[13px] text-muted-foreground">正在看你做到哪一步了…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 pb-12 pt-4 sm:pt-8">
      {/*
        顶上给个出口。这一页不在工作台的框架里，没有侧栏也没有顶栏，
        原来只有清单最底下一行小字能走——手机上要翻到底才找得到，
        全部做完时连那行都没有。
      */}
      <div className="mx-auto mb-4 max-w-2xl sm:mb-8">
        <Link
          href="/dashboard"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          进入工作台
        </Link>
      </div>

      {/*
        新手课入口：很多人注册时压根不了解抖音。先懂"抖音怎么推荐、怎么拍、怎么发"，
        后面建档案、做定位才知道为什么要做。放在清单上面，但不挡清单——想直接开干的照样往下走。
      */}
      <Link
        href="/dashboard/course"
        className="glass-panel mx-auto mb-6 flex max-w-2xl items-center gap-4 rounded-2xl border border-primary/30 p-4 transition-colors hover:border-primary/60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <GraduationCap className="h-6 w-6 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">完全不了解抖音？先花 20 分钟上新手课</span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">6 关闯完，就知道抖音怎么推荐、怎么拍、怎么发</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
      </Link>

      <SetupChecklist steps={steps} />
    </div>
  )
}
