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
    // 2026-10-29 产品方定义：三有「之一」、人货场「其中一个」、根据内容定位站在用户群体
    expect(BIG_TRAFFIC_STANDARD).toContain('符合三有（有用、有趣、有共鸣）之一')
    expect(BIG_TRAFFIC_STANDARD).toContain('围绕人、货、场其中一个')
    expect(BIG_TRAFFIC_STANDARD).toContain('根据内容定位，站在这个号的用户群体')
    expect(BIG_TRAFFIC_STANDARD).toContain('必填，至少一个')
    expect(VIRAL_ELEMENT_NAMES).toHaveLength(8)
    for (const el of VIRAL_ELEMENTS) {
      const name = el.name.replace(/选题$/, '')
      expect(BIG_TRAFFIC_STANDARD, name).toContain(name)
    }
  })

  it('做法按顺序：先看内容定位和用户群体，再定出发点（人货场之一、三有之一），再用元素设计，有落地检查，最后选形式', () => {
    const order = ['1. 先看内容定位和这个号的用户群体', '2. 带着目的，选出发点', '3. 符合三有之一', '4. 用爆款元素设计', '5. 落地检查', '6. 最后选形式']
    let at = -1
    for (const step of order) {
      const i = BIG_TRAFFIC_METHOD.indexOf(step)
      expect(i, step).toBeGreaterThan(at)
      at = i
    }
    expect(BIG_TRAFFIC_METHOD).toContain('不为爆款而爆款')
  })

  // 2026-10-29 撤回 10-26 的分层：方向没有出发点，选题只能硬套句式。方向要带知识库的大流量标准和做法
  it.skip('创作方向：带上大流量标准和做法（出发点在方向层定）', () => {
    const p = buildDirectionPrompt(base)
    expect(p).not.toContain('视频目的是流量型（大流量）的方向')
    expect(p).toContain(BIG_TRAFFIC_STANDARD)
    // 2026-10-29 瘦身：六步做法收进「好方向的标准」，落地检查成了「这个号凭什么拍得出」
    expect(p).toContain('这个号凭什么拍得出')
  })

  it('大流量不带成交理由：过滤函数只放行非流量；创作设置块里流量型不出现成交理由', () => {
    expect(dealReasonsForPurpose('流量型', ['包邮'])).toEqual([])
    expect(dealReasonsForPurpose('变现型', ['包邮'])).toEqual(['包邮'])
    expect(dealReasonsForPurpose('人设型', ['包邮'])).toEqual(['包邮'])
    expect(dealReasonsForPurpose(undefined, ['包邮'])).toEqual(['包邮'])
    expect(creationSettingsBlock({ purpose: '流量型', dealReasons: ['包邮'], topic: '选题' })).not.toContain('成交理由')
    expect(creationSettingsBlock({ purpose: '变现型', dealReasons: ['包邮'], topic: '选题' })).toContain('成交理由：包邮')
  })

  // 2026-10-29：内容规划每个方向写出发点，带上知识库的大流量做法（10-26 删掉后，方向只剩「品类 × 拍摄地点」）
  it.skip('内容规划：定目的、条数和出发点，带上大流量做法', () => {
    const p = buildContentPlanPrompt(planBase)
    expect(p).not.toContain('流量型方向还要满足大流量标准')
    expect(p).toContain('这个号凭什么拍得出')
    expect(p).toContain(BIG_TRAFFIC_STANDARD)
    expect(p).toContain('- **视频目的**：流量型 / 人设型 / 变现型 选一个')
    expect(p).toContain('- **本月条数**：N 条')
  })
})
