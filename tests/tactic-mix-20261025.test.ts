import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SCRIPT_STRUCTURE_NAMES, SCRIPT_SHARE_STEP, TACTIC_MIX_PRESETS,
  normalizeScriptShare, tacticMixRule, tacticSplit,
} from '@/lib/tactic-mix'
import { buildDirectionPrompt } from '@/lib/direction'
import { buildContentPlanPrompt, checkPlan, monthlyRepairPlan, parsePlanDirections } from '@/lib/content-plan'
import { resolveMix } from '@/lib/content-mix'
import { settingsFromText } from '@/lib/creation-settings'
import { planHookRepair, planRouteIssue } from '@/lib/script-route'

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
    expect(r).toContain('讲故事·小有成就型')
    expect(r).toContain('晒过程·火车节')
    expect(r).toContain('这个比例不分目的')
  })

  it('100 时写「全部」而不是「大约」', () => {
    const r = tacticMixRule(100)
    expect(r).toContain('全部')
    expect(r).not.toContain('大约')
  })

  it('每个四大脚本结构名都能被下一页的 settingsFromText 认回结构', () => {
    const expected: Record<string, string> = {
      '晒过程·火车节': 'train', '晒过程·过程展示': 'observe', '教知识·解题型': 'problem',
      '教知识·推荐型': 'recommend', '教知识·案例型': 'case', '聊观点·论证型': 'argue',
      '教知识·揭秘型': 'expose', '晒过程·挑战型': 'challenge', '晒过程·测评型': 'review', '晒过程·事件体验': 'event',
      '讲故事·小有成就型': 'achieve', '讲故事·成功案例型': 'success_case', '讲故事·平凡英雄型': 'hero', '讲故事·苦难经历型': 'hardship',
    }
    for (const names of [SCRIPT_STRUCTURE_NAMES]) {
      for (const name of names) {
        const s = settingsFromText(`内容类型：${name}`)
        expect(s.structure, name).toBe(expected[name])
      }
    }
  })
})

describe('提示词接入', () => {
  it('创作方向：默认五个分为四加一，显式零全给36计', () => {
    expect(buildDirectionPrompt({ ...base, scriptsShare: 0 })).toContain('四大脚本 0，36计 5')
    expect(buildDirectionPrompt(base)).toContain('四大脚本 4，36计 1')
  })

  it('创作方向：搭配比例进提示词（2026-10-30 产品方要求：规划、方向可自由选 36 计与四大脚本的比例）', () => {
    const p = buildDirectionPrompt({ ...base, scriptsShare: 50 })
    expect(p).toContain('大约 50%')
    expect(p).toContain('两派只选一派，不叠加')
  })

  it('内容规划：搭配比例进提示词；100 = 全用四大脚本', () => {
    expect(buildContentPlanPrompt({ ...planBase, scriptsShare: 100 })).not.toBe(buildContentPlanPrompt(planBase))
    expect(buildContentPlanPrompt({ ...planBase, scriptsShare: 100 })).toContain('全部的内容类型写四大脚本的结构名')
    expect(buildContentPlanPrompt({ ...planBase, scriptsShare: 0 })).toContain('四大脚本 0，36计 8')
  })
})

describe('页面接入', () => {
  it.each([4, 15, 30])('月度修正版的 %i 条在周表、目的和派别三处吻合', total => {
    const resolved = resolveMix(null, null, '');
    const plan = monthlyRepairPlan(total, resolved.mix, 80, [], '2026年11月');
    const cards = [...plan.prompt.matchAll(/^(\d+) (?:流量型|变现型|人设型) (四大脚本|36计) \d+条$/gm)].map((m, i) => ({
      slot: Number(m[1]), title: '取材范围' + i, route: m[2] === '四大脚本' ? '晒过程·事件体验' : ['街头采访','冷知识','反向操作'][i % 3], element: '成本', hook: '实走到店路线记录耗时', scope: '在街口和店门间计时', why: '用走访记录核对选址',
    }));
    expect(plan.render(JSON.stringify({ cards: cards.slice(1).reverse(), strategy: '从现有街区取材', avoid: ['避开长时间跟拍'] }))).toBeNull();
    expect(plan.remainingPrompt()).toContain('仅补充这些缺失名额');
    const result = plan.render(JSON.stringify({ cards: [cards[0]] }))!;
    expect(planRouteIssue(result, total, 80, true)).toBe('');
    expect(checkPlan(result, resolved, total).ok).toBe(true);
    expect(parsePlanDirections(result)).toHaveLength(15);
    expect([...result.matchAll(/\| 第\d周 \| (\d+) \|/g)].reduce((sum, m) => sum + Number(m[1]), 0)).toBe(total);
  });
  it('单派的具体看点与自动选择36计的多样性都要通过', () => {
    const direction = (n: number, label: string, hook: string) => '### 方向' + n + '：进店路线\n- **内容类型**：' + label + '\n- **爆款元素**：' + hook;
    expect(planRouteIssue(direction(1, '四大脚本·晒过程·过程展示', '【待确认：填写素材】'), 1, 100, false)).toContain('看点');
    expect(planRouteIssue(direction(1, '晒过程·过程展示、街头采访', '成本｜现场记录等候时间'), 1, 100, false)).toContain('一种');
    const invented = direction(1, '讲故事·平凡英雄型', '反差｜讲你帮小店起死回生的真实事件');
    expect(planRouteIssue(invented, 1, 100, false, [], '一人拍摄，能走访门店')).toContain('尚未确认');
    expect(planRouteIssue(invented, 1, 100, false, [], '当事人已确认这次合作帮小店起死回生，并有完整记录。')).toBe('');
    const repeats = [1, 2, 3].map(n => direction(n, '南北/地域差异', '')).join('\n');
    expect(planRouteIssue(repeats, 3, 0, false)).toContain('全部沿用同一计');
    expect(planRouteIssue(repeats, 3, 0, false, ['tactic:南北/地域差异'])).toBe('');
  });
  it('方向配额已对时，单张卡补回真实看点，其余四大脚本和36计正文原样保留', () => {
    const head = '# 本轮方向\n';
    const first = '### 方向1：开店成本\n- **内容类型**：四大脚本·教知识·解题型\n- **爆款元素**：——\n- **内容方向**：核对一张已脱敏租约。\n';
    const second = '### 方向2：进店路线\n- **内容类型**：街头采访\n- **内容方向**：问第一次到店的人在哪里转弯。';
    const repair = planHookRepair(head + first + second)!;
    const fixed = repair.apply(JSON.stringify({ hooks: [{ id: 1, element: '成本', evidence: '以租约上的实际计费周期核对每月支出' }] }));
    expect(fixed).toBe(head + first.replace('——', '成本｜以租约上的实际计费周期核对每月支出') + second);
    expect(planRouteIssue(fixed, 2, 50, false)).toBe('');
  });
  it('月度按排期权重数，方向按张数数，手选按具体结构数', () => {
    const cards = '### 方向1：选址\n- **内容类型**：四大脚本·晒过程·过程展示\n- **爆款元素**：成本｜记录步行到店用时\n- **本月条数**：12 条\n### 方向2：客流\n- **内容类型**：36计·第35计 街头采访\n- **本月条数**：3 条\n### 方向3：备选\n- **内容类型**：36计·第36计 冷知识\n- **本月条数**：0 条';
    expect(planRouteIssue(cards, 15, 80, true)).toBe('');
    expect(planRouteIssue(cards, 15, 60, true)).not.toBe('');
    expect(planRouteIssue(cards, 3, 30, false)).toBe('');
    expect(planRouteIssue(cards, 3, 100, false)).not.toBe('');
    expect(planRouteIssue(cards, 3, 0, false, ['tactic:街头采访'])).not.toBe('');
  })
  it('创作方向页和内容规划页都放「脚本打法」区（开关 + 比例或手选），并把两个字段传给提示词', () => {
    for (const page of ['app/dashboard/direction/page.tsx', 'app/dashboard/content-plan/page.tsx']) {
      const src = read(page)
      expect(src, page).toMatch(/<ScriptRouteSection/)
      expect(src, page).toMatch(/routeManual/)
    }
    expect(read('app/dashboard/direction/page.tsx')).toMatch(/scriptsShare: routeManual \? 0 : scriptsShare,\n\s+pickedRoutes: routeManual \? pickedRoutes : \[\],/)
    expect(read('app/dashboard/content-plan/page.tsx')).toMatch(/resolved: resolvedMix, scriptsShare: routeManual \? 0 : scriptsShare, pickedRoutes: routeManual \? pickedRoutes : \[\],/)
  })

  it('搭配条组件只在人设、变现上生效，流量型写明不动', () => {
    const src = read('components/workspace/TacticMix.tsx')
    expect(src).toMatch(/TACTIC_MIX_PRESETS/)
    expect(src).toMatch(/比例不分目的/)
  })
})
