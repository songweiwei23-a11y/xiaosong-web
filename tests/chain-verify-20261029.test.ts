/**
 * 2026-10-29 修复后的逻辑链路核验（代码层，不调用模型）。
 *
 * 产品方定义：根据内容定位，站在用户群体，带着目的，围绕人、货、场其中一个，拍他们感兴趣的内容，
 * 符合三有之一，再用爆款元素设计选题和整个脚本结构。
 *
 * 这里守住的几件事：
 *   1. 内容定位的系列不被截断，下游（规划、方向、选题）都能看到，并且要归位
 *   2. 大流量的定义写对了（人货场其中一个、三有之一、元素设计结构、形式不定义大流量）
 *   3. 脚本、标题、分镜、审稿、二创、拆解都带上了出发点和元素
 *   4. 全部提示词里不再残留旧的错误说法
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildContextBlock } from '@/lib/creator-context';
import { contentSeriesOf, businessRouteOf, hasContentSeries, CONTENT_SERIES_HEADING } from '@/lib/content-series';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { buildDirectionPrompt } from '@/lib/direction';
import { directionSeedOf, elementsOfSeed } from '@/lib/direction-seed';
import { buildTopicBoardQuery, type TopicBoardInput } from '@/lib/boards/topic-query';
import { resolveMix } from '@/lib/content-mix';
import { BIG_TRAFFIC_STANDARD, BIG_TRAFFIC_METHOD } from '@/lib/content-roles';

const PROFILE = { profile_name: '大码测试号', account_track: ['时尚穿搭'], product_category: ['大码女装'], target_age: ['25-30岁'], target_occupation: ['宝妈', '学生'] };

/** 一份结构和真实内容定位一致的文档：系列前面塞了 3000 字配比（原来 2500 字截断就会丢掉系列） */
const FILLER = '这一段是配比的推导说明，用来把系列挤到原来截断线之后。'.repeat(120);
const POSITIONING_DOC = `# 💎 内容定位方案

## 长期价值主张
让本地大码女性穿得合身、出门有底气。

## 内容方向：多元四类还是单一主题
选 B 单一主题。${FILLER}

## 内容配比
${FILLER}

## 三种视频怎么拍
流量型、人设型、变现型各怎么拍。${FILLER}

## 内容系列（2-4 个）
### 系列一：《同一个人，换上店里的外套》
- 出发点：站在宝妈群体；围绕货（大码外套）；符合有趣；爆款元素：怀旧，设计在开场钩子
- 定量：同一个人、同一面镜子；变量：外套款式
- 前 10 集标题：《十年前的爆款外套，今天还能穿吗（怀旧）》

### 系列二：《试衣间里的第一句话》
- 出发点：站在学生群体；围绕人（店主）；符合有用；爆款元素：人群，设计在标题
- 定量：店主开口的第一句话；变量：顾客身份

## 选题来源
1. 知识储备：从顾客看不懂的画面差异挖
2. 经历与故事：从店主的判断改变挖

## 前 30 条节奏
第 1-10 条：验证系列一的怀旧元素有没有吸引力。

## ⚠️ 不要做什么
不拍未经同意的顾客正脸。`;

const BUSINESS_DOC = `# 💰 商业定位方案

## 🔍 先说这一行的生意逻辑
${FILLER}

## 变现全景
${FILLER}

## 主推产品
大码外套、大码裤子。

## 成交路径
1. 看到视频 2. 评论区问 3. 到店试穿`;

function blockFor(board: 'topic' | 'direction' | 'script') {
  return buildContextBlock({
    profile: PROFILE, positioning: null, dealReasons: [],
    contentPositioning: POSITIONING_DOC, businessPositioning: BUSINESS_DOC,
  } as never, board);
}

describe('1. 内容定位的系列不被截断，下游能看到', () => {
  it('系列、选题来源、节奏都取出来了，配比那一大段不进来', () => {
    const series = contentSeriesOf(POSITIONING_DOC);
    expect(series).toContain('### 系列一：《同一个人，换上店里的外套》');
    expect(series).toContain('### 系列二：《试衣间里的第一句话》');
    expect(series).toContain('## 选题来源');
    expect(series).toContain('## 前 30 条节奏');
    expect(series).not.toContain('## 内容配比');
    expect(series).not.toContain('## 长期价值主张');
  });

  it('选题、方向拿到的上下文里有系列（不是只截前 2500 字）', () => {
    for (const board of ['topic', 'direction'] as const) {
      const block = blockFor(board);
      expect(block, board).toContain(CONTENT_SERIES_HEADING);
      expect(block, board).toContain('### 系列二：《试衣间里的第一句话》');
      // 2026-10-29 产品方定：系列只是参考，不是限制（太限制创作）
      expect(block, board).toContain('系列是参考，不是框子');
      expect(block, board).not.toContain('归位到系列');
    }
  });

  it('脚本拿到商业定位的成交路径（结尾要对上），内容定位的系列不进脚本', () => {
    const block = blockFor('script');
    expect(block).toContain('## 💰 商业定位（成交路径）');
    expect(block).toContain('3. 到店试穿');
    expect(block).not.toContain(CONTENT_SERIES_HEADING);
  });

  it('商业定位的成交路径不会因为前面太长被截掉', () => {
    const route = businessRouteOf(BUSINESS_DOC);
    expect(route).toContain('## 成交路径');
    expect(route).toContain('3. 到店试穿');
    expect(route).not.toContain('## 变现全景');
  });

  it('老格式的定位（没有系列标题）：退回原文开头，不让下游空着', () => {
    expect(contentSeriesOf('## 内容定位\n- 系列A：烧烤做法')).toContain('系列A：烧烤做法');
  });
});

describe('2. 大流量的定义写对了（产品方定义）', () => {
  it('标准：根据内容定位站在用户群体、人货场其中一个、三有之一、元素设计选题和脚本结构、形式不定义大流量', () => {
    expect(BIG_TRAFFIC_STANDARD).toContain('根据内容定位，站在这个号的用户群体');
    expect(BIG_TRAFFIC_STANDARD).toContain('围绕人、货、场其中一个');
    expect(BIG_TRAFFIC_STANDARD).toContain('符合三有（有用、有趣、有共鸣）之一');
    expect(BIG_TRAFFIC_STANDARD).toContain('设计选题，以及整个脚本结构');
    expect(BIG_TRAFFIC_STANDARD).toContain('任何脚本结构配上爆款元素都是大流量');
  });

  it('做法：先看内容定位和用户群体，再定出发点，最后选形式；不再写「先看档案」', () => {
    expect(BIG_TRAFFIC_METHOD).toContain('1. 先看内容定位和这个号的用户群体');
    expect(BIG_TRAFFIC_METHOD).toContain('围绕人、货、场其中一个（写清是哪一个');
    expect(BIG_TRAFFIC_METHOD).not.toContain('1. 先看档案');
    expect(BIG_TRAFFIC_METHOD).not.toContain('画面里看得见人、货、场');
  });
});

describe('3. 内容规划、创作方向、选题：系列是参考，出发点按定义写', () => {
  const series = hasContentSeries(blockFor('direction'));
  it('内容规划：有系列时每个方向要写「所属系列」，并要求按系列主次分条数', () => {
    expect(series).toBe(true);
    const plan = buildContentPlanPrompt({
      lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '',
      resolved: resolveMix(null), contextBlock: blockFor('direction'),
    });
    expect(plan).toContain('- **所属系列**：能对上上面「内容定位（系列）」里的一个系列就写系列名；对不上写「系列外」');
    expect(plan).toContain('系列是参考');
    expect(plan).not.toContain('要和系列的主次一致');
    expect(plan).toContain('围绕：人、货、场里的哪一个');
  });

  it('内容规划：没有系列时不出现「所属系列」（不要求没有的东西）', () => {
    const plan = buildContentPlanPrompt({
      lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '',
      resolved: resolveMix(null), contextBlock: '',
    });
    expect(plan).not.toContain('所属系列');
  });

  it('创作方向：有系列时每个方向归到一个系列，并有归位规则', () => {
    const dir = buildDirectionPrompt({ purposes: ['fans'], formats: ['any'], count: 10, depth: 'quick', industry: '大码女装', contextBlock: blockFor('direction') });
    expect(dir).toContain('- **所属系列**：能对上上面「内容定位（系列）」里的一个系列就写系列名');
    expect(dir).toContain('系列是参考，不是框子');
    expect(dir).toContain('围绕：人、货、场里的哪一个');
  });

  it('选题：有系列时每条写「所属系列」，流量出发点按产品方定义写', () => {
    const input = {
      creatorContext: { profile: PROFILE, positioning: null, dealReasons: [], contentPositioning: POSITIONING_DOC, businessPositioning: BUSINESS_DOC } as never,
      selectedProfile: PROFILE as never, positioningForCtx: null, topicCount: 5, topicType: '流量型选题', topicRole: '流量型', mode: 'quick',
      sourceReference: '', sourceFrom: '', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '', personalRequirement: '', currentSettings: {},
      accountStage: '', fansLevel: '', avgViewsInput: '', selectedPlatforms: ['抖音'], selectedTracks: [], selectedContentTypes: [], selectedStyles: [],
      positioningExtra: '', selectedElements: [], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意', withHook: true,
      tactic: '', route: '两种都出', routeExplicit: false, resolvedMix: resolveMix(null), quickTopics: false,
    } as TopicBoardInput;
    const { query } = buildTopicBoardQuery(input);
    expect(query).toContain('**所属系列（只作标注）**');
    expect(query).toContain('系列只是参考');
    expect(query).toContain('根据内容定位，站在这个号的用户群体，带着目的，围绕人、货、场其中一个');
    expect(query).toContain('## 🧭 内容定位（系列）');
  });

  it('方向种子：所属系列和出发点一路带给选题；选题沿用元素', () => {
    const block = `### 方向1：十年前的爆款外套
- **所属系列**：《同一个人，换上店里的外套》
- **核心目的**：涨粉曝光
- **出发点**：围绕：货（大码外套）｜三有：有趣｜爆款元素：怀旧｜看点：人人都有旧外套
- **内容方向**：大码女装里的旧款新穿`;
    const seed = directionSeedOf(block)!;
    expect(seed).toContain('所属系列（参考，不限制）：《同一个人，换上店里的外套》');
    expect(elementsOfSeed(seed, ['怀旧', '反差'])).toEqual(['怀旧']);
  });
});

describe('4. 脚本、标题、分镜、审稿、二创、拆解：都带上出发点和元素', () => {
  const src = (f: string) => fs.readFileSync(f, 'utf8');

  it('脚本：用爆款元素设计整个结构，没勾选就沿用选题的元素或从八大里挑', () => {
    const q = src('lib/boards/script-query.ts');
    expect(q).toContain('8. **用爆款元素设计整个脚本结构**');
    expect(q).toContain('沿用带来的选题「1️⃣ 爆款元素」');
    expect(src('lib/script-design.ts')).toContain('流量脚本先定出发点再设计结构');
  });

  it('标题：围绕同一个出发点和元素，光看标题认得出元素', () => {
    expect(src('lib/title-standards.ts')).toContain('标题围绕出发点和元素');
  });

  it('分镜：镜头把脚本里的元素拍出来', () => {
    expect(src('lib/storyboard-standards.ts')).toContain('镜头围绕出发点和元素');
  });

  it('审稿：守住出发点，偏了要列进问题清单并改回来', () => {
    expect(src('lib/review-standards.ts')).toContain('出发点还在不在');
  });

  it('跨行业二创：借出发点，换成自己的人货场', () => {
    expect(src('lib/remix.ts')).toContain('借出发点，换成自己的人货场');
  });

  it('拆解和文字拆解：要写出原片的出发点（人货场哪一个、三有哪一条、元素设计在哪）', () => {
    expect(src('lib/viral-breakdown.ts')).toContain('出发点（2026-10-29）');
    expect(src('lib/text-breakdown.ts')).toContain('出发点（2026-10-29）');
  });
});

describe('6. 质检认得出同质批次和「对比动作」（用 10-29 真实跑出来的 5 个标题）', () => {
  const TITLES = ['站着合适VS坐下，裤腰差在哪？', '镜子里的裤腰VS本人感受', '同一条裤子，坐下前后差在哪？', '上课站着VS坐着，裤腰感受一样吗？', '照博主试裤VS本人坐下感受'];
  const batch = TITLES.map((t, i) => `## 选题${i + 1}：${t}\n\n**1️⃣ 爆款元素**\n- 反差：状态A vs 状态B\n\n**2️⃣ 开篇钩子**\n一句话`).join('\n\n---\n\n');

  it('整批只有一个元素、对比句式超过 2 条：都提醒', async () => {
    const { topicDiversityIssues } = await import('@/lib/topic-element-check');
    const issues = topicDiversityIssues(batch);
    // 下限按创意等级定，体检拿不到等级，只按最低一档（2 种）提醒
    expect(issues.some((d) => d.includes('爆款元素少于 2 种'))).toBe(true);
    expect(issues.some((d) => d.includes('超过 2 条使用对比句式'))).toBe(true);
  });

  it('每个「站着 vs 坐下」「镜子里 vs 本人」「坐下前后」都被认作对比动作', async () => {
    const { topicDiversityIssues } = await import('@/lib/topic-element-check');
    const flagged = topicDiversityIssues(batch).filter((d) => d.includes('对比动作或姿势'));
    expect(flagged.length).toBeGreaterThanOrEqual(4);
  });
});

describe('7. 第二轮真实核验暴露的问题（2026-10-29）', () => {
  const src = (f: string) => fs.readFileSync(f, 'utf8');

  it('内容定位：每个系列必须写「变量自检」，括号里只写八大元素', () => {
    const p = src('lib/positioning-standards.ts');
    expect(p).toContain('**变量自检**（必填');
    expect(p).toContain('**括号里只写八大元素的名字**');
  });

  it('爆款元素说明：例子里的东西不许照抄进标题', () => {
    expect(src('lib/viral-elements.ts')).toContain('不许照抄进标题');
  });

  it('质检认得出照抄的提示词例子，不误报正常标题', async () => {
    const { promptExampleLeaks } = await import('@/lib/topic-element-check');
    expect(promptExampleLeaks('## 选题2：《当年最火的校服外套，还排在第一吗？》')).toHaveLength(1);
    expect(promptExampleLeaks('## 选题1：《花小钱办大事：大码衣服先留给谁？》')).toEqual([]);
  });

  it('脚本策略卡：流量型写明出发点和元素设计在哪一段（两套脚本提示词都有）', () => {
    expect(src('lib/script-design.ts')).toContain('爆款元素：哪个，设计在哪一段');
    expect(src('lib/boards/script-query.ts')).toContain('爆款元素：哪个，设计在哪一段');
  });
});

describe('5. 旧的错误说法已经清掉（扫描确认非空，不是空转）', () => {
  const libFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = `${dir}/${e.name}`;
      return e.isDirectory() ? libFiles(p) : p.endsWith('.ts') ? [p] : [];
    });
  const files = libFiles('lib');

  it('扫描确实读到了提示词文件', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('没有「三条都要」「三有各落在哪」「参考系列不是规定动作」这类旧说法', () => {
    // 「归位到系列」「只能从系列里选」是 2026-10-29 产品方明确否掉的说法：系列是参考，不是限制
    const BAD = /三条都要有|有用、有趣、有共鸣各落在哪|这是内容定位的参考系列，不是规定动作|内容定位的系列清单：选题只能从这里的系列里选|先看档案：行业是什么|归位到系列|只能从这里的系列里选/;
    const offenders = files.filter((f) => BAD.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
