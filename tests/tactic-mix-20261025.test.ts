import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SCRIPT_STRUCTURES_FOR, SCRIPT_SHARE_STEP, TACTIC_MIX_PRESETS,
  normalizeScriptShare, tacticMixRule, tacticSplit,
} from '@/lib/tactic-mix'
import { buildDirectionPrompt } from '@/lib/direction'
import { buildContentPlanPrompt } from '@/lib/content-plan'
import { resolveMix } from '@/lib/content-mix'
import { settingsFromText } from '@/lib/creation-settings'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const base = { purposes: ['fans'], formats: ['any'], count: 5, depth: 'quick' as const }
const planBase = {
  lastMonth: '' as const, recordedLastMonth: null, count: 8, focus: [], events: '', notes: '',
  resolved: resolveMix(null, null, ''), today: new Date(2026, 9, 25),
}

describe('比例归一', () => {
  it('步长 10，夹在 0–100 之间，非数字当 0', () => {
    expect(SCRIPT_SHARE_STEP).toBe(10)
    expect(normalizeScriptShare(0)).toBe(0)
    expect(normalizeScriptShare(33)).toBe(30)
    expect(normalizeScriptShare(55)).toBe(60)
    expect(normalizeScriptShare(-5)).toBe(0)
    expect(normalizeScriptShare(250)).toBe(100)
    expect(normalizeScriptShare('abc')).toBe(0)
    expect(normalizeScriptShare(undefined)).toBe(0)
  })

  it('36 计与四大脚本两边加起来是 100', () => {
    expect(tacticSplit(30)).toEqual({ tactic: 70, scripts: 30 })
    expect(tacticSplit(0)).toEqual({ tactic: 100, scripts: 0 })
  })

  it('三个预设：36计为主 0、均衡 50、四大脚本为主 100', () => {
    expect(TACTIC_MIX_PRESETS.map((p) => p.share)).toEqual([0, 50, 100])
  })
})

describe('搭配规则文字', () => {
  it('0 时不产生任何规则文字，提示词保持原样', () => {
    expect(tacticMixRule(0)).toBe('')
  })

  it('50 时写「大约 50%」，并列出人设、变现两类能用的四大脚本结构名', () => {
    const r = tacticMixRule(50)
    expect(r).toContain('大约 50%')
    expect(r).toContain('讲故事·故事型')
    expect(r).toContain('晒过程·火车节')
    expect(r).toContain('流量型方向一律只写 36 计的流量计')
  })

  it('100 时写「全部」而不是「大约」', () => {
    const r = tacticMixRule(100)
    expect(r).toContain('全部')
    expect(r).not.toContain('大约')
  })

  it('每个四大脚本结构名都能被下一页的 settingsFromText 认回结构', () => {
    const expected: Record<string, string> = {
      '晒过程·火车节': 'train', '晒过程·观察型': 'observe', '教知识·解题型': 'problem',
      '教知识·推荐型': 'recommend', '教知识·案例型': 'case', '讲故事·故事型': 'story', '聊观点·论证型': 'argue',
    }
    for (const names of Object.values(SCRIPT_STRUCTURES_FOR)) {
      for (const name of names ?? []) {
        const s = settingsFromText(`内容类型：${name}`)
        expect(s.structure, name).toBe(expected[name])
      }
    }
  })
})

describe('提示词接入', () => {
  it('创作方向：不传或传 0，提示词和原来逐字相同', () => {
    expect(buildDirectionPrompt({ ...base, scriptsShare: 0 })).toBe(buildDirectionPrompt(base))
    expect(buildDirectionPrompt(base)).not.toContain('写四大脚本的结构名')
  })

  it('创作方向：传 50 时内容类型那一条带上搭配规则', () => {
    const p = buildDirectionPrompt({ ...base, scriptsShare: 50 })
    expect(p).toContain('大约 50%')
    expect(p).toContain('晒过程·火车节')
  })

  it('内容规划：不传或传 0，提示词逐字相同；传 100 时写「全部」', () => {
    expect(buildContentPlanPrompt({ ...planBase, scriptsShare: 0 })).toBe(buildContentPlanPrompt(planBase))
    expect(buildContentPlanPrompt({ ...planBase, scriptsShare: 100 })).toContain('全部')
  })
})

describe('页面接入', () => {
  it('创作方向页和内容规划页都放了搭配条，并把比例传进提示词和历史记录', () => {
    for (const page of ['app/dashboard/direction/page.tsx', 'app/dashboard/content-plan/page.tsx']) {
      const src = read(page)
      expect(src, page).toMatch(/import \{ TacticMixBar \} from "@\/components\/workspace\/TacticMix"/)
      expect(src, page).toMatch(/<TacticMixBar value=\{scriptsShare\} onChange=\{setScriptsShare\} \/>/)
      expect(src, page).toMatch(/const \[scriptsShare, setScriptsShare\] = useState\(0\)/)
      expect(src, page).toMatch(/scriptsShare/)
    }
    expect(read('app/dashboard/direction/page.tsx')).toMatch(/mixBlock: useMix \? mixPromptBlock\(resolvedMix, \{ count, unit: "个" \}\) : undefined,\n\s+scriptsShare,/)
    expect(read('app/dashboard/content-plan/page.tsx')).toMatch(/resolved: resolvedMix, scriptsShare,/)
  })

  it('搭配条组件只在人设、变现上生效，流量型写明不动', () => {
    const src = read('components/workspace/TacticMix.tsx')
    expect(src).toMatch(/TACTIC_MIX_PRESETS/)
    expect(src).toMatch(/流量型一律用 36 计的流量计/)
  })
})
