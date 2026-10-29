/**
 * 爆款元素按行业适配 + 创意难度决定流量选题每条用几个（2026-10-27）。
 * 八个元素不是都适合所有行业；流量选题每条用几个由「创意」开关定：容易执行 1、中等创意 2、高创意 3。
 * 人设、变现的选题不套爆款元素。
 */
import { describe, it, expect } from 'vitest';
import { VIRAL_ELEMENTS, industryKeysOf, elementsFitting, elementsPerTopic, elementFitNote, viralElementById } from '@/lib/viral-elements';
import { assignTopicSlots, roleSequence, topicSlotsBlock, audiencePool } from '@/lib/topic-slots';
import { bigTrafficStandard, roleBrief, VIRAL_ELEMENT_NAMES } from '@/lib/content-roles';
import { buildTopicBoardQuery, type TopicBoardInput } from '@/lib/boards/topic-query';
import { resolveMix } from '@/lib/content-mix';
import { PROFILE_CHOICES } from '@/lib/profile-fields';
import type { CreatorContext } from '@/lib/creator-context';

const ALL = VIRAL_ELEMENTS.map((e) => e.id);

describe('行业适配的数据：限定和排除的行业名都是档案的标准选项', () => {
  it('only / avoid 里写的行业名，都能在档案的赛道或产品品类里找到（拼错就红）', () => {
    const std = new Set<string>([...PROFILE_CHOICES.account_track, ...PROFILE_CHOICES.product_category]);
    for (const e of VIRAL_ELEMENTS) {
      for (const k of [...(e.only ?? []), ...(e.avoid ?? [])]) {
        expect(std.has(k), `${e.name} 写了不存在的行业名「${k}」`).toBe(true);
      }
    }
  });
});

describe('行业关键词：从档案的赛道和产品品类取', () => {
  it('两处都算、数组和字符串都认、去重', () => {
    expect(industryKeysOf({ account_track: ['时尚穿搭'], product_category: ['服装配饰', '时尚穿搭'] })).toEqual(['时尚穿搭', '服装配饰']);
    expect(industryKeysOf({ account_track: '美食烹饪、本地服务', product_category: '餐饮' })).toEqual(['美食烹饪', '本地服务', '餐饮']);
    expect(industryKeysOf(null)).toEqual([]);
  });
});

describe('按行业筛选', () => {
  it('荷尔蒙只给穿搭、美妆、健身、情感这类讲颜值和恋爱的行业', () => {
    const hormone = (keys: string[]) => elementsFitting(ALL, keys).ids.includes('hormone');
    expect(hormone(['时尚穿搭'])).toBe(true);
    expect(hormone(['服装配饰'])).toBe(true);
    expect(hormone(['数码科技'])).toBe(false);
    expect(hormone(['母婴育儿'])).toBe(false);
    expect(hormone(['美食烹饪'])).toBe(false);
  });

  it('奇葩（猎奇内幕）不放到母婴育儿上', () => {
    expect(elementsFitting(ALL, ['母婴育儿']).ids).not.toContain('curious');
    expect(elementsFitting(ALL, ['数码科技']).ids).toContain('curious');
  });

  it('没有行业信息（没选档案）时不筛，原样用', () => {
    expect(elementsFitting(ALL, [])).toEqual({ ids: ALL, dropped: [], fellBack: false });
  });

  it('所选的部分不适用：只去掉不适用的，顺序保留，并报出被挑掉的', () => {
    expect(elementsFitting(['hormone', 'celebrity', 'curious'], ['数码科技'])).toEqual({
      ids: ['celebrity', 'curious'],
      dropped: ['hormone'],
      fellBack: false,
    });
  });

  it('所选的全都不适用：退回全行业通用的元素，不让这批没有元素可用', () => {
    const r = elementsFitting(['hormone'], ['数码科技']);
    expect(r.fellBack).toBe(true);
    expect(r.ids).not.toContain('hormone');
    expect(r.ids.length).toBeGreaterThan(0);
    expect(r.dropped).toEqual(['hormone']);
  });
});

describe('创意难度 → 流量选题每条用几个', () => {
  it('容易执行 1 个、中等创意 2 个、高创意 3 个；助理的说法也认；认不出的按中等', () => {
    expect(elementsPerTopic('容易执行')).toBe(1);
    expect(elementsPerTopic('中等创意')).toBe(2);
    expect(elementsPerTopic('高创意')).toBe(3);
    expect(elementsPerTopic('简单易上手')).toBe(1);
    expect(elementsPerTopic('高难度')).toBe(3);
    expect(elementsPerTopic('乱写')).toBe(2);
  });
});

describe('页面提示：所选的元素被行业挑掉时明说', () => {
  it('挑掉一个：说清楚哪个、哪个行业、不会用它', () => {
    const note = elementFitNote(['hormone', 'celebrity'], ['数码科技']);
    expect(note).toBe('荷尔蒙不适用于「数码科技」，这批不会用它');
  });
  it('全都挑掉：说明改用适合这个行业的元素', () => {
    expect(elementFitNote(['hormone'], ['数码科技'])).toContain('改用适合这个行业的元素');
  });
  it('都适用、没选、没有行业，都不出提示', () => {
    expect(elementFitNote(['celebrity'], ['数码科技'])).toBe('');
    expect(elementFitNote([], ['数码科技'])).toBe('');
    expect(elementFitNote(['hormone'], [])).toBe('');
  });
});

describe('槽位分配：每条用 k 个元素', () => {
  it('k=1 时和原来一样：一条一个，6 条互不相同', () => {
    const slots = assignTopicSlots({ count: 6, audiences: ['a'], elements: ['头牌', '怀旧', '反差', '最差', '荷尔蒙', '奇葩', '人群', '成本'], tactics: ['x'], perTopic: 1 });
    expect(slots.every((s) => s.elements.length === 1)).toBe(true);
    expect(new Set(slots.map((s) => s.elements[0])).size).toBe(6);
  });

  it('k=2：每条两个且不重复；各条的组合互不相同；8 个元素都轮到', () => {
    const pool = ['头牌', '怀旧', '反差', '最差', '荷尔蒙', '奇葩', '人群', '成本'];
    const slots = assignTopicSlots({ count: 6, audiences: ['a'], elements: pool, tactics: ['x'], perTopic: 2 });
    for (const s of slots) {
      expect(s.elements).toHaveLength(2);
      expect(new Set(s.elements).size).toBe(2);
    }
    expect(new Set(slots.map((s) => s.elements.join('|'))).size).toBe(6);
    expect(new Set(slots.flatMap((s) => s.elements)).size).toBe(8);
  });

  it('k=3：每条三个；k 超过元素数时按元素数，不报错', () => {
    const three = assignTopicSlots({ count: 4, audiences: [], elements: ['a', 'b', 'c', 'd'], tactics: [], perTopic: 3 });
    expect(three.every((s) => s.elements.length === 3)).toBe(true);
    const capped = assignTopicSlots({ count: 2, audiences: [], elements: ['a', 'b'], tactics: [], perTopic: 3 });
    expect(capped.every((s) => s.elements.length === 2)).toBe(true);
  });

  // 2026-10-29：多个元素是候选，挑最贴的用好；都贴才一起用（原来要求同时用，出了两个元素硬拼的标题）
  it('分配表：多个元素写成候选，挑最贴的；都贴才一起用', () => {
    const block = topicSlotsBlock(assignTopicSlots({ count: 2, audiences: ['宝妈'], elements: ['反差', '荷尔蒙', '头牌'], tactics: ['反向操作'], perTopic: 2 }));
    expect(block).toMatch(/爆款元素=候选 [^；、]+、[^；（]+（挑最贴这条话题的用，不贴就换一个更贴的）/);
    expect(block).toContain('候选不止一个的，挑最贴的那个用好；几个都贴这条话题时才一起用');
    expect(block).not.toContain('这几个同时用');
  });
});

describe('大流量标准：元素名单跟着行业走', () => {
  it('默认仍是全部八个（旧的脚本、内容规划不受影响）', () => {
    expect(bigTrafficStandard()).toContain(`写明用哪个，可选：${VIRAL_ELEMENT_NAMES.join('、')}`);
  });
  it('传了名单就只列名单里的', () => {
    const s = bigTrafficStandard(['头牌', '成本']);
    expect(s).toContain('写明用哪个，可选：头牌、成本）');
    expect(s).not.toContain('荷尔蒙');
  });
  it('流量型的单条说明用的是传入的名单，别的目的不带大流量标准', () => {
    expect(roleBrief('流量型', ['头牌'])).toContain('写明用哪个，可选：头牌）');
    expect(roleBrief('人设型', ['头牌'])).not.toContain('大流量标准');
  });
});

describe('切入角度：带着方向来的，每条切进一个不同的角度', () => {
  it('角度按条轮流分，分配表写明「切入角度=」，没有方向就不写', () => {
    const angles = ['出门前反复换 ｜ 为什么明明有衣服还不敢穿 ｜ 问题', '坐下的那一刻 ｜ 为什么站着好看坐下不自在 ｜ 对比', '家人一句话 ｜ 为什么无心的评价会改变穿衣 ｜ 冲突'];
    const slots = assignTopicSlots({ count: 4, audiences: ['宝妈'], elements: ['头牌'], tactics: ['x'], perTopic: 1, angles });
    expect(slots.map((s) => s.angle)).toEqual([angles[0], angles[1], angles[2], angles[0]]);
    const block = topicSlotsBlock(slots);
    expect(block).toContain(`第1条：人群=宝妈；切入角度=${angles[0]}；爆款元素=候选 头牌（挑最贴这条话题的用，不贴就换一个更贴的）；`);
    expect(block).toContain('带「切入角度=」的那条，就从这个角度切进去');
    expect(topicSlotsBlock(assignTopicSlots({ count: 1, audiences: ['宝妈'], elements: ['头牌'], tactics: ['x'] }))).not.toContain('切入角度=');
  });
});

describe('人群带上档案的性别；成交理由按变现型的条轮流分', () => {
  it('女性为主的档案，人群标签前面写「女性」；不限就不写，不编出档案没有的性别', () => {
    const female = audiencePool({ target_gender: '女性为主', target_age: ['25-30岁'], target_occupation: ['宝妈', '学生'] });
    expect(female).toEqual(['女性 25-30岁 宝妈', '女性 25-30岁 学生']);
    expect(audiencePool({ target_gender: '不限', target_age: ['25-30岁'], target_occupation: ['宝妈'] })).toEqual(['25-30岁 宝妈']);
    expect(audiencePool({ target_gender: '女性为主', target_interests: '大码女装' })).toEqual(['女性 大码女装']);
  });

  it('变现型的条按选中的理由轮流：每个理由都能轮到；流量型的条不分成交理由', () => {
    const slots = assignTopicSlots({
      count: 6,
      audiences: ['宝妈'],
      elements: ['头牌', '怀旧'],
      tactics: ['反向操作'],
      perTopic: 1,
      roles: ['变现型', '流量型', '变现型', '变现型', '流量型', '变现型'],
      reasons: ['价格透明', '现场试穿'],
    });
    expect(slots.filter((s) => s.role === '变现型').map((s) => s.reason)).toEqual(['价格透明', '现场试穿', '价格透明', '现场试穿']);
    expect(slots.filter((s) => s.role === '流量型').every((s) => s.reason === '')).toBe(true);
  });

  it('分配表：写明每条的成交理由；没有选理由时不出现这一项', () => {
    const block = topicSlotsBlock(
      assignTopicSlots({ count: 2, audiences: ['宝妈'], elements: [], tactics: ['反向操作'], roles: ['变现型', '变现型'], reasons: ['价格透明', '现场试穿'] }),
    );
    expect(block).toContain('第1条：目的=变现型；人群=宝妈；爆款元素=无（变现型不套爆款元素）；成交理由=价格透明；拍法=反向操作');
    expect(block).toContain('第2条：目的=变现型；人群=宝妈；爆款元素=无（变现型不套爆款元素）；成交理由=现场试穿；拍法=反向操作');
    expect(block).toContain('带「成交理由=」的那条只押这一个理由');
    const none = topicSlotsBlock(assignTopicSlots({ count: 1, audiences: ['宝妈'], elements: [], tactics: ['x'], roles: ['变现型'] }));
    expect(none).not.toContain('成交理由=');
  });
});

describe('目的按配比排好：只有流量型条分爆款元素', () => {
  it('roleSequence：条数不变，目的交错排，第一条是条数最多的', () => {
    const seq = roleSequence({ 流量型: 4, 人设型: 1, 变现型: 1 });
    expect(seq).toHaveLength(6);
    expect(seq.filter((r) => r === '流量型')).toHaveLength(4);
    expect(seq.filter((r) => r === '人设型')).toHaveLength(1);
    expect(seq.filter((r) => r === '变现型')).toHaveLength(1);
    expect(seq[0]).toBe('流量型');
  });

  it('assignTopicSlots 带 roles：只有流量型的条分到元素，人设、变现的条元素为空', () => {
    const slots = assignTopicSlots({
      count: 4,
      audiences: ['宝妈'],
      elements: ['头牌', '怀旧', '荷尔蒙'],
      tactics: ['反向操作'],
      perTopic: 2,
      roles: ['流量型', '人设型', '流量型', '变现型'],
    });
    expect(slots.map((s) => s.role)).toEqual(['流量型', '人设型', '流量型', '变现型']);
    expect(slots[1].elements).toEqual([]);
    expect(slots[3].elements).toEqual([]);
    expect(slots[0].elements).toHaveLength(2);
    expect(slots[2].elements).toHaveLength(2);
    expect(slots[0].elements.join('|')).not.toBe(slots[2].elements.join('|'));
  });

  it('分配表：写明每条目的，非流量的条写「无」', () => {
    const block = topicSlotsBlock(
      assignTopicSlots({ count: 2, audiences: ['宝妈'], elements: ['反差', '头牌'], tactics: ['反向操作'], perTopic: 1, roles: ['流量型', '人设型'] }),
    );
    expect(block).toContain('第1条：目的=流量型；人群=宝妈；爆款元素=候选 反差（挑最贴这条话题的用，不贴就换一个更贴的）；');
    expect(block).toContain('第2条：目的=人设型；人群=宝妈；爆款元素=无（人设型不套爆款元素）；');
    expect(block).toContain('每条的目的按分配表写，不要自己换');
  });
});

describe('选题提示词：按档案行业和创意难度拼出来', () => {
  const CTX = { profile: null, positioning: null, dealReasons: [] } as unknown as CreatorContext;
  function input(over: Partial<TopicBoardInput> = {}): TopicBoardInput {
    return {
      creatorContext: CTX,
      selectedProfile: null,
      positioningForCtx: null,
      topicCount: 6,
      topicType: '流量型选题',
      topicRole: '流量型',
      mode: 'full',
      sourceReference: '',
      sourceFrom: '',
      incomingSetup: null,
      keyword1: '',
      keyword2: '',
      keyword3: '',
      personalRequirement: '',
      currentSettings: {},
      accountStage: '',
      fansLevel: '',
      avgViewsInput: '',
      selectedPlatforms: [],
      selectedTracks: [],
      selectedContentTypes: [],
      selectedStyles: [],
      positioningExtra: '',
      selectedElements: [],
      dealReasonLabels: [],
      benchmarkAccounts: '',
      viralCases: '',
      difficulty: '中等创意',
      withHook: false,
      tactic: '',
      route: '两种都出',
      routeExplicit: false,
      resolvedMix: resolveMix(null, null, ''),
      quickTopics: false,
      ...over,
    };
  }

  it('数码档案选了荷尔蒙和头牌：荷尔蒙不给、不写进句式、流量标准只列头牌；中等创意每条 1 个（只剩 1 个可用）', () => {
    const profile = { profile_name: '数码测试号', account_track: ['数码科技'], product_category: ['数码家电'], target_age: ['25-30岁'], target_occupation: ['白领'] };
    const { query } = buildTopicBoardQuery(input({ selectedProfile: profile as never, selectedElements: ['hormone', 'celebrity'] }));
    expect(query).toContain('【本档案行业适用的爆款元素】头牌。荷尔蒙不适用于这个行业，不要用');
    expect(query).toContain('每条流量选题最多用 1 个爆款元素');
    expect(query).not.toContain('异性会多看你两眼');
    expect(query).toContain('（必填，至少一个，写明用哪个，可选：头牌）');
    expect(query).toMatch(/爆款元素=候选 头牌（/);
    expect(query).not.toMatch(/爆款元素=荷尔蒙/);
  });

  it('时尚档案、高创意、不选元素：八个里挑，每条最多 3 个，分配表里给 3 个候选', () => {
    const profile = { profile_name: '穿搭测试号', account_track: ['时尚穿搭'], product_category: ['服装配饰'], target_age: ['25-30岁'], target_occupation: ['宝妈'] };
    const { query } = buildTopicBoardQuery(input({ selectedProfile: profile as never, difficulty: '高创意' }));
    expect(query).toContain('每条流量选题最多用 3 个爆款元素');
    expect(query).toMatch(/爆款元素=候选 [^；、]+、[^；、]+、[^；（]+（挑最贴/);
    expect(query).toContain('【本档案行业适用的爆款元素】');
    expect(query).not.toContain('不适用于这个行业');
  });

  it('按配比：每条的目的由代码排进分配表，人设条不套爆款元素', () => {
    const profile = { profile_name: '穿搭测试号', account_track: ['时尚穿搭'], product_category: ['服装配饰'], target_age: ['25-30岁'], target_occupation: ['宝妈'] };
    const { query } = buildTopicBoardQuery(input({ topicRole: '按配比', topicCount: 6, selectedProfile: profile as never }));
    expect(query).toMatch(/第\d条：目的=流量型；人群=/);
    expect(query).toMatch(/第\d条：目的=人设型；人群=[^；]+；爆款元素=无（人设型不套爆款元素）/);
    expect(query).toContain('每条的目的按分配表写，不要自己换');
  });

  it('经营品类：自定义模式（默认）补进基础信息；快速模式用档案上下文里的那一行，不重复写', () => {
    const profile = { profile_name: '大码测试号', account_track: ['时尚穿搭'], product_category: ['大码女装'], target_age: ['25-30岁'], target_occupation: ['宝妈'] };
    const custom = buildTopicBoardQuery(input({ topicRole: '按配比', selectedProfile: profile as never, mode: 'full' })).query;
    // 2026-10-29：「选题里都要体现」被读成每条三样同框，改成一批里轮流出现
    expect(custom).toContain('- 经营品类（档案里每一个都在卖，这批选题里轮流出现；单条不用同框）：大码女装');
    const quick = buildTopicBoardQuery(input({ topicRole: '按配比', selectedProfile: profile as never, mode: 'quick' })).query;
    expect(quick).toContain('**经营品类（每一个都在卖，一批内容里轮流出现；单条不用同框）**：大码女装');
    expect(quick).not.toContain('- 经营品类（档案里每一个都在卖');
  });

  it('没选档案：不出行业适用行，按创意难度给个数', () => {
    const { query } = buildTopicBoardQuery(input({ difficulty: '容易执行' }));
    expect(query).not.toContain('【本档案行业适用的爆款元素】');
    expect(query).toContain('每条流量选题最多用 1 个爆款元素');
  });
});
