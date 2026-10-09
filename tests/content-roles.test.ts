/**
 * 三种视频（流量型 / 人设型 / 变现型）——定义只有 lib/content-roles 一份，每个板块都要接上。
 *
 * 原来的毛病是"各说各的"：选题只分流量/变现两种、人设型没了；脚本结尾一次要
 * 点赞+评论+关注；旧兜底里躺着知识库没有的"起号期 流量60/人设30/变现10"。
 * 这些都不报错，只是产出悄悄偏——所以用扫描守住。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  CONTENT_ROLE_LIST, ROLE_SPECS, TACTIC_ROLES, ROLE_RULES,
  roleOfTactic, rolesGuide, roleBrief, roleInferRule, defaultRoleOfScriptType,
} from '@/lib/content-roles';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { tacticBrief, buildGrowthPlanPrompt, buildOpeningPrompt } from '@/lib/growth-standards';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildSectionPrompt } from '@/lib/positioning-sections';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildReviewPrompt } from '@/lib/review-standards';
import { enhancePromptWithMCNStandards } from '@/lib/enhance-prompt';
import { BRIEF_FIELDS } from '@/lib/creative-brief';
import { readCode } from './helpers/source';

const INFER_HEAD = '先判断这条视频的目的';

describe('三种视频的定义', () => {
  it('每种都有方向、结构、策划、结尾指令、钩子、镜头重点', () => {
    expect(CONTENT_ROLE_LIST).toEqual(['流量型', '人设型', '变现型']);
    for (const r of CONTENT_ROLE_LIST) {
      const s = ROLE_SPECS[r];
      for (const k of ['job', 'directions', 'scriptTypes', 'planning', 'metrics', 'cta', 'pitfalls', 'hook', 'shots'] as const) {
        expect(s[k].trim().length, `${r}.${k} 是空的`).toBeGreaterThan(5);
      }
      // 结构要写到能直接套：每条都有"名字：骨架"，骨架里有箭头
      expect(s.structures.length, `${r} 没有结构`).toBeGreaterThanOrEqual(3);
      for (const x of s.structures) expect(x, `${r} 的结构「${x}」没有骨架`).toMatch(/：.*→/);
    }
  });

  it('结尾指令每种只给一类动作，三种之间不混', () => {
    expect(ROLE_SPECS.流量型.cta).not.toMatch(/私信|到店|留资/);
    expect(ROLE_SPECS.人设型.cta).not.toMatch(/私信|到店|留资/);
    expect(ROLE_SPECS.变现型.cta).toMatch(/只选一个/);
  });

  it('流量型的结构不再用观点句式，大流量靠三十六计里标了流量型的打法', () => {
    const structures = ROLE_SPECS.流量型.structures.join('\n');
    expect(structures).not.toMatch(/观点并列|观点正反|争议开篇/);
    expect(ROLE_SPECS.流量型.scriptTypes).toMatch(/聊观点不是流量主力/);
    expect(ROLE_SPECS.人设型.structures.some((x) => x.startsWith('观点立场'))).toBe(true);
  });

  it('三十六计每一计都归到了一种视频，且只归一种（名字和计名表一字不差）', () => {
    const all = CONTENT_ROLE_LIST.flatMap((r) => TACTIC_ROLES[r]);
    const names = GROWTH_TACTICS.map((t) => t.name);
    // 扫描自证非空转：计名表本身得有东西
    expect(names.length).toBeGreaterThanOrEqual(37);
    expect(new Set(all).size, '有计被归了两次').toBe(all.length);
    for (const n of names) expect(roleOfTactic(n), `「${n}」没归类`).not.toBeNull();
    for (const n of all) expect(names, `「${n}」不是计名表里的名字`).toContain(n);
    // 知识库原话：三十六计大多是流量型
    expect(TACTIC_ROLES.流量型.length).toBeGreaterThan(names.length / 2);
  });

  it('脚本类型只给默认目的：观点→人设（观点拿不到大流量），故事→人设，其余→变现', () => {
    expect(defaultRoleOfScriptType('discuss')).toBe('人设型');
    expect(defaultRoleOfScriptType('聊观点')).toBe('人设型');
    expect(defaultRoleOfScriptType('story')).toBe('人设型');
    expect(defaultRoleOfScriptType('teach')).toBe('变现型');
    expect(defaultRoleOfScriptType('show')).toBe('变现型');
  });

  it('完整版和精简版都带三条铁律要点', () => {
    const g = rolesGuide();
    expect(g).toContain(ROLE_RULES);
    for (const r of CONTENT_ROLE_LIST) {
      expect(g).toContain(`#### ${r}`);
      expect(roleBrief(r)).toContain(ROLE_SPECS[r].cta);
    }
    expect(g).toMatch(/每条视频只选一个主目的/);
    expect(g).toMatch(/脚本类型不等于目的/);
    expect(g).toMatch(/一个系列只担一个主目的/);
  });

  it('单条板块的判断规则三种都列到，按板块给不同角度', () => {
    for (const f of ['hook', 'shots', 'review'] as const) {
      const t = roleInferRule(f);
      expect(t).toContain(INFER_HEAD);
      for (const r of CONTENT_ROLE_LIST) expect(t).toContain(r);
    }
    expect(roleInferRule('hook')).toContain(ROLE_SPECS.变现型.hook);
    expect(roleInferRule('shots')).toContain(ROLE_SPECS.人设型.shots);
    expect(roleInferRule('review')).toContain(ROLE_SPECS.流量型.cta);
  });
});

describe('每个板块都接上了', () => {
  const profileSummary = '- 平台：抖音\n- 赛道：美食';

  it('账号定位三种 focus 都带三种视频的完整说明', () => {
    for (const focus of ['full', 'business', 'content'] as const) {
      expect(buildPositioningPrompt({ profileSummary, additionalNotes: '', focus }), focus).toContain('#### 人设型');
    }
  });

  it('单节重写「内容定位」也带三种视频的说明', () => {
    const p = buildSectionPrompt({ sectionKey: 'content', positioningFull: '', note: '' });
    expect(p).toContain('#### 变现型');
  });

  it('起号方案带三种视频的说明，每一计标了适合哪种', () => {
    expect(buildGrowthPlanPrompt({})).toContain('#### 流量型');
    expect(tacticBrief('情境还原')).toContain('最适合做**：变现型');
    expect(tacticBrief('反向操作')).toContain('最适合做**：流量型');
  });

  it('开篇、标题、分镜、审稿都先判断目的', () => {
    const prompts = {
      开篇: buildOpeningPrompt({ topic: '装修避坑' }),
      标题: buildTitlePrompt({
        topic: '装修避坑', titleTypeLabel: '痛点式', titleFormulaValue: 'x', titleFormulaLabel: 'x',
        keywordStrategyLabel: 'x', keywordStrategyDesc: 'x', platform: '抖音', targetAudience: '', count: 3,
      }),
      分镜: buildStoryboardPrompt({
        scriptContent: '稿子', platform: '抖音', duration: '60秒', contentType: 'talking',
        visualStyle: 'x', visualStyleLabel: 'x', additionalInfo: '',
      }),
      审稿: buildReviewPrompt({
        draftContent: '稿子', platform: '抖音', duration: '60秒', scriptType: '教知识',
        reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: false,
      }),
    };
    for (const [k, p] of Object.entries(prompts)) expect(p, k).toContain(INFER_HEAD);
  });

  it('脚本增强按目的给结尾，只要一个动作——不再一次要点赞/评论/关注', () => {
    const detail = { name: '解题型', formula: 'a→b', keyPoints: ['x'], avoidMistakes: ['y'] };
    const hook = { requirements: ['z'] };
    for (const role of CONTENT_ROLE_LIST) {
      const { formatRequirements } = enhancePromptWithMCNStandards({
        structureDetail: detail, hookDetail: hook, elementsWithNames: '', duration: '60秒', role,
      });
      expect(formatRequirements, role).toContain(ROLE_SPECS[role].cta);
      expect(formatRequirements, role).not.toMatch(/点赞\/评论\/关注|到店\/团购\/加微信/);
    }
  });

  it('创作简报的内容方向按目的写配比，不再拿脚本类型当配比', () => {
    const spec = BRIEF_FIELDS.find((f) => f.key === 'direction')!.spec;
    expect(spec).toMatch(/流量型.*人设型.*变现型/);
    expect(spec).not.toMatch(/晒过程50%/);
  });
});

describe('页面和兜底里不能再有旧说法', () => {
  it('选题页：按目的出、每条标目的，不再"从19种结构里推荐"', () => {
    const src = readCode('app/dashboard/topic/page.tsx');
    expect(src).toMatch(/from "@\/lib\/content-roles"/);
    expect(src).toContain('这批选题的目的');
    expect(src).toContain('0️⃣ 视频目的');
    expect(src).not.toMatch(/19种结构/);
    expect(src).not.toMatch(/不选就是纯流量选题/);
  });

  it('脚本页：有目的选项，结尾不再一次要三个动作', () => {
    const src = readCode('app/dashboard/script/page.tsx');
    expect(src).toContain('这条视频的目的');
    expect(src).toMatch(/roleBrief\(effectiveRole\)/);
    expect(src).not.toMatch(/引导互动（点赞\/评论\/关注）/);
    expect(src).not.toMatch(/dealReasonsCount/);
  });

  it('接口路由里没有知识库里不存在的配比', () => {
    const src = readCode('app/api/dify/stream/route.ts');
    expect(src.length).toBeGreaterThan(1000);
    expect(src).not.toMatch(/流量型\s*\d+%/);
    expect(src).not.toMatch(/parts\.push\(/);
  });

  it('Dify 系统提示词：先定目的，没给成交理由不等于纯流量', () => {
    const md = fs.readFileSync(path.join(process.cwd(), 'docs/dify/system-prompt.md'), 'utf8');
    expect(md).toContain('0. 先定目的');
    expect(md).toContain('成交理由只属于变现型内容');
    expect(md).not.toContain('按纯流量内容处理');
    // 小有成就型的骨架按知识库来
    expect(md).toContain('结果钩子→阻碍1→转机1→阻碍2→转机2→感悟');
  });
});
