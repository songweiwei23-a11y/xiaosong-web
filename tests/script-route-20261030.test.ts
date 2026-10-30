/**
 * 脚本打法：两派只选一派（2026-10-30，lib/script-route）。
 *
 * 守的是：四大脚本（讲怎么讲）和 36 计（怎么拍）不叠加；选题标了哪一派就用哪一派；
 * 脚本页两派放在同一个版式里，默认跟随上游；内容规划、创作方向的手选和比例只用其中一派。
 */
import { describe, expect, it } from 'vitest';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { FOUR_SCRIPT_CHOICES } from '@/lib/creation-settings';
import {
  routeOptions, routeKeyOf, routeFields, topicRouteOf, topicRoutesOf, tacticOfRoute, planRouteRule, ONE_SCHOOL_RULE,
} from '@/lib/script-route';
import { AUTO_TACTIC } from '@/lib/creative-routes';
import { buildScriptBoardQuery } from '@/lib/boards/script-query';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { buildDirectionPrompt } from '@/lib/direction';
import { resolveMix } from '@/lib/content-mix';

describe('两派的选项：同一个列表，两派都在', () => {
  it('四大脚本 7 种 + 36 计全部，每一项都有标题、派别和适合的目的', () => {
    const opts = routeOptions();
    expect(opts.filter((o) => o.school === 'four')).toHaveLength(FOUR_SCRIPT_CHOICES.length);
    expect(opts.filter((o) => o.school === 'tactic')).toHaveLength(GROWTH_TACTICS.length);
    for (const o of opts) {
      expect(o.title).not.toBe('');
      expect(o.fit).not.toBe('');
    }
    expect(new Set(opts.map((o) => o.key)).size).toBe(opts.length);
  });
});

describe('一个选项只属于一派：页面字段 → 选项 key → 写回字段', () => {
  it('36 计优先：两个字段都有时只认 36 计', () => {
    const key = routeKeyOf('反向操作', 'show-fire');
    expect(key).toBe('tactic:反向操作');
    expect(routeFields(key)).toEqual({ tactic: '反向操作', structure: 'auto' });
  });

  it('只有四大脚本：写回 tactic 为 AI 占位，structure 为那一种', () => {
    const four = FOUR_SCRIPT_CHOICES[0];
    const key = routeKeyOf(AUTO_TACTIC, four.structure);
    expect(key).toBe(`four:${four.structure}`);
    expect(routeFields(key)).toEqual({ tactic: AUTO_TACTIC, structure: four.structure });
  });

  it('什么都没有：空 key，两个字段都是 AI 挑', () => {
    expect(routeKeyOf(AUTO_TACTIC, 'auto')).toBe('');
    expect(routeFields('')).toEqual({ tactic: AUTO_TACTIC, structure: 'auto' });
  });

  it('tacticOfRoute 只对 36 计返回计名', () => {
    expect(tacticOfRoute('tactic:反向操作')).toBe('反向操作');
    expect(tacticOfRoute(`four:${FOUR_SCRIPT_CHOICES[0].structure}`)).toBeUndefined();
  });
});

describe('选题标了哪一派，跳到脚本就用哪一派', () => {
  it('正文标了「第N计」的，归 36 计', () => {
    expect(topicRouteOf('**🅰 打法**\n- 36计·第1计 反向操作：把顺序倒过来')).toBe('tactic:反向操作');
  });

  it('只标四大脚本的，归四大脚本', () => {
    expect(topicRouteOf('- 四大脚本·晒过程·火车节：按时间顺序拍')).toBe(`four:${FOUR_SCRIPT_CHOICES.find((c) => c.name === '晒过程·火车节')!.structure}`);
  });

  it('什么都没标的，返回空（脚本页让 AI 挑一派）', () => {
    expect(topicRouteOf('这条选题讲一个故事，没有写打法')).toBe('');
  });

  it('一批选题：每条各自的派别，互不影响', () => {
    const md = [
      '## 选题1：装修里最贵的错误',
      '- 36计·第1计 反向操作：把顺序倒过来',
      '## 选题2：聊聊我的边界',
      '- 四大脚本·聊观点：讲我的判断',
    ].join('\n');
    const got = topicRoutesOf(md);
    expect(got['装修里最贵的错误']).toBe('tactic:反向操作');
    // 只写了类型「聊观点」没写结构：不替编导选第一种，派别留空，脚本页提示手选（2026-10-31）
    expect(got['聊聊我的边界']).toBeUndefined();
  });
});

describe('脚本提示词：36 计和四大脚本不叠加', () => {
  const input = {
    topic: '装修里最贵的错误', platform: '抖音', scriptType: 'discuss', autoScriptType: false, effectiveRole: '人设型' as const, isAd: false,
    industry: '装修', customIndustry: '', targetGroup: '', customTargetGroup: '', style: '专业', customStyle: '', durationMode: 'preset' as const,
    duration: '60秒', customDuration: '', profile: null, positioningContent: null, scriptStructure: 'argue', hookType: 'auto', boomElements: [],
    directorThoughts: [], tactic: '反向操作', openingLine: '', openingCard: '', productInfo: '', priceInfo: '', scene: '室内', device: '手机',
    budget: '低成本(0-500)', personnel: '一人', accountPositioning: '', additionalInfo: '', dealReasons: [], originContent: '', focusContent: '',
    currentSettings: {},
  } as never;

  it('选了 36 计：提示词只说用这一计，不再带四大脚本结构', () => {
    const q = buildScriptBoardQuery(input);
    expect(q).toContain('只用这一计，不另套四大脚本结构');
    expect(q).not.toContain('两者叠加');
    expect(q).not.toContain('两者同时成立');
  });

  it('什么都没选：让 AI 只挑一派，不叠加', () => {
    const q = buildScriptBoardQuery({ ...(input as object), tactic: AUTO_TACTIC, scriptStructure: 'auto' } as never);
    expect(q).toContain('两派只选一派');
    expect(q).not.toContain('叠一计');
    expect(q).not.toContain('两者叠加');
  });

  it('选了四大脚本：不再挑 36 计', () => {
    const four = FOUR_SCRIPT_CHOICES[0];
    const q = buildScriptBoardQuery({ ...(input as object), tactic: AUTO_TACTIC, scriptStructure: four.structure } as never);
    expect(q).toContain(`本条用四大脚本「${four.name}」，不叠 36 计`);
  });
});

describe('内容规划、创作方向：手选优先，其次比例，都没有就全用 36 计', () => {
  it('手选：只列出选中的，写明没列的一概不用', () => {
    const picked = [`tactic:反向操作`, `four:${FOUR_SCRIPT_CHOICES[0].structure}`];
    const r = planRouteRule({ picked, share: 80 });
    expect(r).toContain('这批只用下面这些打法，没列的一概不用');
    expect(r).toContain('36计·反向操作');
    expect(r).toContain(`四大脚本·${FOUR_SCRIPT_CHOICES[0].name}`);
    expect(r).not.toContain('大约 80%');
  });

  it('比例：按比例写，并说明两派只选一派', () => {
    const r = planRouteRule({ share: 50 });
    expect(r).toContain('大约 50%');
    expect(r).toContain('两派只选一派，不叠加');
  });

  it('默认：全用 36 计，不写四大脚本的结构名', () => {
    const r = planRouteRule({});
    expect(r).toContain('全部用 36 计');
    expect(r).toContain('不用四大脚本的结构名');
  });

  it('规则文字：两派只选一派的说明统一', () => {
    expect(ONE_SCHOOL_RULE).toContain('一条内容只用一派');
  });

  it('内容规划提示词：手选的打法进了提示词；默认没有手选时不带手选的字样', () => {
    const base = {
      lastMonth: '' as const, recordedLastMonth: null, count: 12, focus: [], events: '', notes: '',
      resolved: resolveMix(null, null, ''), profileSummary: '- 档案名称：测试', industry: '测试行业',
    } as never;
    const plain = buildContentPlanPrompt(base);
    expect(plain).toContain('全部用 36 计');
    const picked = buildContentPlanPrompt({ ...(base as object), pickedRoutes: ['tactic:反向操作'] } as never);
    expect(picked).toContain('这批只用下面这些打法');
    expect(picked).not.toContain('全部用 36 计');
  });

  it('创作方向提示词：内容类型那一行改成两派只选一派，不再同时要求 36 计和讲法', () => {
    const p = buildDirectionPrompt({
      purposes: ['流量型'], formats: [], count: 6, depth: 'quick', profileSummary: '- 档案名称：测试', contextBlock: '', industry: '测试行业',
      pickedRoutes: [`four:${FOUR_SCRIPT_CHOICES[0].structure}`],
    } as never);
    expect(p).toContain('这批只用下面这些打法');
    expect(p).toContain('二者只选一派');
    expect(p).not.toContain('- **讲法**：从四大脚本里挑一个结构');
  });
});
