/**
 * 出发点按知识库接回来，并且一路传到选题（2026-10-29 方案 A）。
 *
 * 根因：10-26 分层时，内容规划、创作方向的出发点和知识库的三种做法被删掉（提交 beb32c0），
 * 方向种子也不带出发点，选题只能让代码另配爆款元素和句式，和上游的话题硬拼。
 * 这里不调用模型，只守住指令层：两个板块必须带知识库方法；方向写的出发点要进种子；选题沿用种子里的元素。
 */
import { describe, expect, it } from 'vitest';
import { BIG_TRAFFIC_STANDARD, TRAFFIC_DIRECTION_TYPES } from '@/lib/content-roles';
import { directionStandard } from '@/lib/direction-standard';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { buildDirectionPrompt } from '@/lib/direction';
import { directionSeedOf, elementsOfSeed, DIRECTION_SEED_HEAD } from '@/lib/direction-seed';
import { buildTopicBoardQuery, type TopicBoardInput } from '@/lib/boards/topic-query';
import { resolveMix } from '@/lib/content-mix';

const PROFILE = { profile_name: '大码测试号', account_track: ['时尚穿搭'], product_category: ['大码女装'], target_age: ['25-30岁'], target_occupation: ['宝妈', '学生'] };

const DIRECTION = `### 方向1：十年前的爆款外套，今天还能穿吗
- **核心目的**：涨粉曝光——用一代人的记忆让陌生人停下来
- **出发点**：爆款元素：怀旧｜三有：有用（看出旧外套还能不能穿）、有趣（翻出当年的样子）、有共鸣（人人都有一件）｜看点：每个人衣柜里都有一件当年舍不得扔的外套
- **内容方向**：大码女装；25—40 岁宝妈和学生；大众切口：面子
- **切入角度**：
  - 衣柜里的旧外套 ｜ 当年为什么买它 ｜ 时间线 ｜ 从买的那天切入
- **思路提示**：往「当年流行什么」上想`;

function topicInput(sourceReference: string): TopicBoardInput {
  return {
    creatorContext: { profile: PROFILE, positioning: null, dealReasons: [] } as never,
    selectedProfile: PROFILE as never, positioningForCtx: null, topicCount: 5, topicType: '流量型选题', topicRole: '流量型', mode: 'quick',
    sourceReference, sourceFrom: '创作方向', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '', personalRequirement: '', currentSettings: {},
    accountStage: '', fansLevel: '', avgViewsInput: '', selectedPlatforms: ['抖音'], selectedTracks: [], selectedContentTypes: [], selectedStyles: [],
    positioningExtra: '', selectedElements: [], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意', withHook: true,
    tactic: '', route: '两种都出', routeExplicit: false, resolvedMix: resolveMix(null), quickTopics: false,
  } as never;
}

describe('指令层：两个板块都带知识库找出发点的方法', () => {
  const plan = buildContentPlanPrompt({ lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '', resolved: resolveMix(null), industry: '大码女装' });
  const direction = buildDirectionPrompt({ purposes: ['fans'], formats: ['any'], count: 10, depth: 'quick', industry: '大码女装' });

  // 2026-10-29 瘦身：方法块收进「好方向的标准」，三种目的、切口参考、元素都在里面
  it('内容规划、创作方向都带好方向的标准（大流量定义、三种目的、切口参考、元素）', () => {
    for (const p of [plan, direction]) expect(p).toContain(directionStandard().split('起号 36 计（计名）')[0]);
    expect(TRAFFIC_DIRECTION_TYPES).toHaveLength(9);
  });

  // 2026-10-25 产品方定、2026-10-29 再次强调：任何脚本结构配上爆款元素都是大流量，形式不定义大流量
  it('大流量由出发点定义：写明任何脚本结构配上爆款元素都是大流量；九类切口只是参考，不是必填', () => {
    const block = directionStandard();
    expect(block).toContain(BIG_TRAFFIC_STANDARD);
    expect(BIG_TRAFFIC_STANDARD).toContain('任何脚本结构配上爆款元素都是大流量');
    expect(block).toContain('常见切口也可以参考');
    for (const p of [plan, direction]) {
      expect(p).not.toContain('九类里的哪一类');
      expect(p).not.toContain('流量方向的类型');
    }
  });

  it('内容规划不再要求「场景至少换三种」，也不让「为什么」只报档案事实', () => {
    expect(plan).not.toContain('出镜的人和拍摄的场各至少换三种');
    expect(plan).not.toContain('必须点出档案里的一个具体事实');
    expect(plan).toContain('也不能只是一个拍摄地点');
  });
});

describe('交接：方向的出发点进种子，选题沿用它的爆款元素', () => {
  const seed = directionSeedOf(DIRECTION)!;

  it('种子带上出发点', () => {
    expect(seed).toContain('出发点：爆款元素：怀旧｜三有：');
    expect(seed).toContain('看点：每个人衣柜里都有一件当年舍不得扔的外套');
  });

  it('从种子里读出元素：只认爆款元素那一段、只认这个行业适用的', () => {
    expect(elementsOfSeed(seed, ['怀旧', '反差', '最差'])).toEqual(['怀旧']);
    expect(elementsOfSeed(seed, ['反差', '最差'])).toEqual([]);
    expect(elementsOfSeed('方向：没写出发点', ['怀旧'])).toEqual([]);
  });

  it('选题：方向元素是参考，候选仍有其他元素', () => {
    const { query } = buildTopicBoardQuery(topicInput(`${DIRECTION_SEED_HEAD}\n${seed}`));
    expect(query).toContain('【方向出发点参考】');
    expect(query).toContain('爆款元素：怀旧');
    const table = query.slice(query.indexOf('【本批每条的分配'), query.indexOf('【方向出发点参考】'));
    expect(table).toMatch(/爆款元素=候选 怀旧/);
    expect(table).toMatch(/爆款元素=候选 (反差|最差|头牌|人群|成本|奇葩)/);
    expect(query).toContain('不锁定整批');
  });

  it('没有上游出发点：照旧从适用的元素里给候选，不写「沿用」', () => {
    const { query } = buildTopicBoardQuery(topicInput(''));
    expect(query).not.toContain('【沿用方向的出发点】');
  });

  it('内容规划的方向也能做成种子：有「内容方向」和「出发点」两栏', () => {
    const planBlock = `### 方向1：十年前的爆款外套\n- **视频目的**：流量型\n- **出发点**：爆款元素：怀旧｜三有：有用、有趣、有共鸣都在｜看点：人人都有旧外套\n- **内容方向**：大码女装里的旧款新穿`;
    expect(directionSeedOf(planBlock)).toContain('出发点：爆款元素：怀旧');
  });
});
