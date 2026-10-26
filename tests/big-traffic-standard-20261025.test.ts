import { describe, expect, it } from 'vitest'
import { BIG_TRAFFIC_METHOD, BIG_TRAFFIC_STANDARD, VIRAL_ELEMENT_NAMES } from '@/lib/content-roles'
import { buildDirectionPrompt } from '@/lib/direction'
import { buildContentPlanPrompt } from '@/lib/content-plan'
import { resolveMix } from '@/lib/content-mix'
import { VIRAL_ELEMENTS } from '@/lib/viral-elements'
import { dealReasonsForPurpose } from '@/lib/content-roles'
import { creationSettingsBlock } from '@/lib/creation-settings'

const base = { purposes: ['fans'], formats: ['any'], count: 5, depth: 'quick' as const }
const planBase = {
  lastMonth: '' as const, recordedLastMonth: null, count: 8, focus: [], events: '', notes: '',
  resolved: resolveMix(null, null, ''), today: new Date(2026, 9, 25),
}

describe('大流量标准', () => {
  it('写明三有和出发点，八大爆款元素名单与知识库「八大爆款元素选题」一致', () => {
    expect(BIG_TRAFFIC_STANDARD).toContain('有用、有趣、有共鸣至少符合其中一条')
    expect(BIG_TRAFFIC_STANDARD).toContain('必须用上至少一个八大爆款元素')
    expect(VIRAL_ELEMENT_NAMES).toHaveLength(8)
    for (const el of VIRAL_ELEMENTS) {
      const name = el.name.replace(/选题$/, '')
      expect(BIG_TRAFFIC_STANDARD, name).toContain(name)
    }
  })

  it('做法按顺序：先看档案，再挑元素，有落地检查，最后选形式', () => {
    const order = ['1. 先看档案', '2. 先把爆款元素设计进内容', '3. 围绕所选元素按三有检查', '4. 把人、货、场搭进去', '5. 落地检查', '6. 最后选形式']
    let at = -1
    for (const step of order) {
      const i = BIG_TRAFFIC_METHOD.indexOf(step)
      expect(i, step).toBeGreaterThan(at)
      at = i
    }
    expect(BIG_TRAFFIC_METHOD).toContain('不为爆款而爆款')
  })

  it('创作方向：不写大流量标准和做法（出发点留给选题层）', () => {
    const p = buildDirectionPrompt(base)
    expect(p).not.toContain('视频目的是流量型（大流量）的方向')
    expect(p).not.toContain(BIG_TRAFFIC_STANDARD)
    expect(p).not.toContain('先看档案')
    expect(p).not.toContain('落地检查')
  })

  it('大流量不带成交理由：过滤函数只放行非流量；创作设置块里流量型不出现成交理由', () => {
    expect(dealReasonsForPurpose('流量型', ['包邮'])).toEqual([])
    expect(dealReasonsForPurpose('变现型', ['包邮'])).toEqual(['包邮'])
    expect(dealReasonsForPurpose('人设型', ['包邮'])).toEqual(['包邮'])
    expect(dealReasonsForPurpose(undefined, ['包邮'])).toEqual(['包邮'])
    expect(creationSettingsBlock({ purpose: '流量型', dealReasons: ['包邮'], topic: '选题' })).not.toContain('成交理由')
    expect(creationSettingsBlock({ purpose: '变现型', dealReasons: ['包邮'], topic: '选题' })).toContain('成交理由：包邮')
  })

  it('内容规划：只定类别、目的、条数和取材范围，不写大流量做法（留给选题层）', () => {
    const p = buildContentPlanPrompt(planBase)
    expect(p).not.toContain('流量型方向还要满足大流量标准')
    expect(p).not.toContain('落地检查')
    expect(p).toContain('- **视频目的**：流量型 / 人设型 / 变现型 选一个')
    expect(p).toContain('- **本月条数**：N 条')
  })
})
