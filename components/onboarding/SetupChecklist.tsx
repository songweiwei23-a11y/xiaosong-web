'use client'

import Link from 'next/link'
import { Check, ArrowRight, Lightbulb } from 'lucide-react'
import type { SetupStep } from '@/lib/setup-progress'

/**
 * 「先打地基」三步的清单。
 *
 * 只负责画，不负责取数——取数在 app/onboarding/page.tsx。
 * 分开是因为这块界面要能单独看、单独测：页面本身带登录校验，
 * 混在一起时想看一眼长什么样都得先登录。
 *
 * 【为什么每一步都要写"为什么"】线上漏斗：100% 的人建了档案，
 * 40% 做完账号定位，只有 10% 做到创作简报。不说清楚这一步有什么用，
 * 人就会跳过——而简报恰恰是让整个产品真正生效的那一步。
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length
  const total = steps.length
  const next = steps.find((s) => !s.done) ?? null
  const allDone = next === null

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          {allDone ? '地基打好了' : '先花几分钟打个地基'}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
          {allDone
            ? '现在生成出来的每条内容，都会带上你这个号的信息。'
            : '这三步做完，选题和脚本才会真的贴着你的号来写；跳过的话，它给你的和直接问 AI 差不多。'}
        </p>

        <div className="mx-auto mt-5 flex max-w-xs items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(done / Math.max(1, total)) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
        </div>
      </header>

      <div className="space-y-3">
        {steps.map((s) => {
          const isNext = !s.done && s.key === next?.key
          return (
            <div
              key={s.key}
              className={`rounded-2xl border p-5 transition-colors ${
                s.done
                  ? 'border-border bg-foreground/[0.02]'
                  : isNext
                    ? 'border-primary/40 bg-primary/[0.06]'
                    : 'border-border bg-foreground/[0.02] opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-medium ${
                    s.done
                      ? 'bg-primary/15 text-primary'
                      : isNext
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/10 text-muted-foreground'
                  }`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : s.index}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[15px] font-medium ${
                      s.done ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {s.title}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {s.why}
                  </p>
                </div>

                {/* 只有「下一步」那一个是实心按钮。三个都显眼等于都不显眼 */}
                {!s.done && (
                  <Link
                    href={s.href}
                    className={`shrink-0 rounded-xl px-4 py-2 text-[13px] font-medium ${
                      isNext
                        ? 'bg-primary text-primary-foreground'
                        : 'glass-panel text-muted-foreground'
                    }`}
                  >
                    {isNext ? '去做' : '待解锁'}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {allDone ? (
        <div className="mt-8 text-center">
          <Link
            href="/dashboard/topic"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground"
          >
            <Lightbulb className="h-4 w-4" />
            生成第一条选题
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <p className="mt-8 text-center text-[12px] text-muted-foreground">
          <Link href="/dashboard" className="underline underline-offset-4 hover:text-foreground">
            先随便逛逛
          </Link>
          　也可以，这个清单在工作台首页随时能找回来
        </p>
      )}
    </div>
  )
}
