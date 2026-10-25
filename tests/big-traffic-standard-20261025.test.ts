import { describe, expect, it } from 'vitest'
import { BIG_TRAFFIC_STANDARD } from '@/lib/content-roles'
import { buildDirectionPrompt } from '@/lib/direction'
import { buildContentPlanPrompt } from '@/lib/content-plan'
import { resolveMix } from '@/lib/content-mix'
import { BOOM_ELEMENTS } from '@/app/dashboard/script/constants'

const base = { purposes: ['fans'], formats: ['any'], count: 5, depth: 'quick' as const }
const planBase = {
  lastMonth: '' as const, recordedLastMonth: null, count: 8, focus: [], events: '', notes: '',
  resolved: resolveMix(null, null, ''), today: new Date(2026, 9, 25),
}

describe('大流量标准', () => {
  it('写明三有和爆款元素，爆款元素与页面上的八个一致', () => {
    expect(BIG_TRAFFIC_STANDARD).toContain('有用、有趣、有共鸣三条都要有')
    for (const el of BOOM_ELEMENTS) {
      const name = el.label.replace(/^\S+\s*/, '')
      expect(BIG_TRAFFIC_STANDARD, name).toContain(name)
    }
  })

  it('创作方向：流量型方向的提示词带上大流量标准', () => {
    expect(buildDirectionPrompt(base)).toContain(`视频目的是流量型（大流量）的方向，必须满足大流量标准：${BIG_TRAFFIC_STANDARD}`)
  })

  it('内容规划：流量型的要求里带上大流量标准', () => {
    expect(buildContentPlanPrompt(planBase)).toContain(`- 流量型方向还要满足大流量标准：${BIG_TRAFFIC_STANDARD}`)
  })
})
