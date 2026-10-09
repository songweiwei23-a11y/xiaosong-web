/**
 * 两套打法（四大脚本 / 起号 36 计）每个板块都要接上。
 *
 * 原来 36 计只有用户手动挑了某一计才会出现，默认流程全走四大脚本；
 * 定位里只给计名不给公式。这些都不报错，只是产出里看不见 36 计——所以用扫描守住。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  AUTO_TACTIC, ROUTE_LIST, ROUTES_GUIDE, routeAssignment, tacticIndex, tacticInText,
  tacticsBlockedBy, topicTacticsOf,
} from '@/lib/creative-routes';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { tacticsBlockedBy as reexported, buildGrowthPlanPrompt } from '@/lib/growth-standards';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildSectionPrompt } from '@/lib/positioning-sections';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildReviewPrompt } from '@/lib/review-standards';
import { BRIEF_FIELDS } from '@/lib/creative-brief';
import { readCode } from './helpers/source';

const profileSummary = '- 平台：抖音\n- 赛道：装修';

describe('36 计清单', () => {
  it('每一计都带公式，名字和计名表一字不差', () => {
    const idx = tacticIndex();
    expect(GROWTH_TACTICS.length).toBeGreaterThanOrEqual(37);
    for (const t of GROWTH_TACTICS) {
      expect(idx, `缺第${t.no}计`).toContain(`**${t.name}**`);
      expect(idx, `第${t.no}计没带公式`).toContain(t.formula);
    }
  });

  it('按目的筛、按禁忌排除', () => {
    const only = tacticIndex({ roles: ['人设型'] });
    expect(only).toContain('一句话设定故事感');
    expect(only).not.toContain('**反向操作**');
    const blocked = tacticsBlockedBy('不能揭秘行业内幕');
    expect(blocked).toContain('内幕揭秘');
    expect(tacticIndex({ exclude: blocked })).not.toContain('内幕揭秘');
    // 起号模块原来的出口还在
    expect(reexported('不许整蛊')).toEqual(['整蛊']);
  });
});

describe('从选题里认出用的哪一计', () => {
  it('认标了"36计·第N计"的那一行，长名优先', () => {
    expect(tacticInText('**🅰 打法**\n- 36计·第10计 情境还原：……')).toBe('情境还原');
    expect(tacticInText('用的计：36计·第15计 正确做法VS错误做法')).toBe('正确做法VS错误做法');
  });

  it('正文里顺嘴提到的短计名不算——讲冷知识的四大脚本选题不能被认成第 36 计', () => {
    expect(tacticInText('**🅰 打法**\n- 四大脚本·教知识：讲装修的冷知识')).toBeUndefined();
    expect(tacticInText('')).toBeUndefined();
  });

  it('一批选题：每条对上各自的计，没用计的不列', () => {
    const md = [
      '## 选题1：装修里最贵的错误',
      '**🅰 打法**',
      '- 36计·第15计 正确做法VS错误做法：现场演错的和对的',
      '## 选题2：我为什么不接低价单',
      '**🅰 打法**',
      '- 四大脚本·聊观点：讲我的边界',
    ].join('\n');
    expect(topicTacticsOf(md)).toEqual({ 装修里最贵的错误: '正确做法VS错误做法' });
    expect(topicTacticsOf('## 选题1：x\n四大脚本')).toBeUndefined();
  });
});

describe('两套打法的说明', () => {
  it('讲清各自的短板和怎么互补', () => {
    expect(ROUTES_GUIDE).toMatch(/太依赖爆款元素/);
    expect(ROUTES_GUIDE).toMatch(/不容易落地/);
    expect(ROUTES_GUIDE).toMatch(/讲不清成交理由/);
    expect(ROUTES_GUIDE).toMatch(/计管\*\*片子里发生什么\*\*/);
  });

  it('选题三种分配都说得清', () => {
    expect(ROUTE_LIST).toEqual(['两种都出', '四大脚本', '三十六计']);
    expect(routeAssignment('两种都出', 10)).toMatch(/约 5 条用\*\*起号 36 计\*\*/);
    expect(routeAssignment('四大脚本', 10)).not.toMatch(/36 计/);
    expect(routeAssignment('三十六计', 10)).toMatch(/每条套一计/);
  });
});

describe('每个板块都接上了', () => {
  it('账号定位三种 focus 都带两套打法和带公式的清单；商业定位只给变现型的计', () => {
    for (const focus of ['full', 'content', 'business'] as const) {
      const p = buildPositioningPrompt({ profileSummary, additionalNotes: '', focus });
      expect(p, focus).toContain('两套打法');
      expect(p, focus).toContain('情境还原');
    }
    const biz = buildPositioningPrompt({ profileSummary, additionalNotes: '', focus: 'business' });
    expect(biz).not.toContain('**反向操作**');
  });

  it('定位输出要求两套都给，系列里两套至少各一个', () => {
    const full = buildPositioningPrompt({ profileSummary, additionalNotes: '', focus: 'full' });
    expect(full).toMatch(/两套打法都给/);
    const con = buildPositioningPrompt({ profileSummary, additionalNotes: '', focus: 'content' });
    expect(con).toMatch(/两套至少各有一个/);
    expect(con).toMatch(/36 计也能做成系列/);
  });

  it('定位禁忌里写了不揭秘，清单就不给「内幕揭秘」', () => {
    const p = buildPositioningPrompt({ profileSummary, additionalNotes: '', restrictions: '不揭秘内幕' });
    expect(p).not.toContain('**内幕揭秘**');
  });

  it('单节重写「内容定位」带两套打法', () => {
    expect(buildSectionPrompt({ sectionKey: 'content', positioningFull: '', note: '' })).toContain('两套打法');
  });

  it('起号方案每一计都要配讲法', () => {
    const p = buildGrowthPlanPrompt({});
    expect(p).toContain('两套打法');
    expect(p).toContain('配什么脚本讲');
  });

  it('分镜和审稿都会看"用的计"', () => {
    const sb = buildStoryboardPrompt({
      scriptContent: '稿子', platform: '抖音', duration: '60秒', contentType: 'talking',
      visualStyle: 'x', visualStyleLabel: 'x', additionalInfo: '',
    });
    const rv = buildReviewPrompt({
      draftContent: '稿子', platform: '抖音', duration: '60秒', scriptType: '教知识',
      reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: false,
    });
    expect(sb).toContain('用的计');
    expect(rv).toContain('用的计');
  });

  it('创作简报记下两套打法各用什么', () => {
    expect(BRIEF_FIELDS.find((f) => f.key === 'direction')!.spec).toMatch(/两套打法/);
  });
});

describe('页面', () => {
  it('选题页：默认两种都出，每条写「🅰 打法」，计带到脚本页', () => {
    const src = readCode('app/dashboard/topic/page.tsx');
    expect(src).toMatch(/useState<CreativeRoute>\('两种都出'\)/);
    expect(src).toContain('🅰 打法');
    expect(src).toMatch(/topicRoutePrompt\(\{ route, count: topicCount, sourced, explicit: routeExplicit \}\)/);
    expect(src).toMatch(/tacticIndex\(/);
    expect(src).toMatch(/topicTactics: /);
  });

  it('脚本页：默认让 AI 按目的挑一计，挑中的计记进历史而不是占位值', () => {
    const src = readCode('app/dashboard/script/page.tsx');
    expect(src).toMatch(/useState\(AUTO_TACTIC\)/);
    expect(src).toMatch(/tactic === AUTO_TACTIC \? tacticInText\(fullResult\)/);
    expect(src).toMatch(/handoffTopicTactics\[t\]/);
    expect(AUTO_TACTIC).not.toBe('');
    expect(GROWTH_TACTICS.some((t) => t.name === AUTO_TACTIC)).toBe(false);
  });

  it('Dify 系统提示词带两套打法和 36 计清单', () => {
    const md = fs.readFileSync(path.join(process.cwd(), 'docs/dify/system-prompt.md'), 'utf8');
    expect(md).toContain('【两套打法：四大脚本（薛老师）和起号36计（小黄）】');
    for (const t of GROWTH_TACTICS) expect(md, `系统提示词缺第${t.no}计`).toContain(t.name);
  });
});
