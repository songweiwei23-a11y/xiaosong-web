/**
 * 规划、方向写成了观点（2026-10-29 产品方：「每一个方向更像是一个观点」，选题「差点意思」），以及当天之后九轮真实核验的整改。
 * 用例里的方向名、标题都来自 10-29 各轮真实链路的原稿。
 * 产品方定：方向只提供方向，不给标题胚子（不限制选题发挥）；选择题类方向一批最多 3 个；
 * 选题至少几种元素按创意等级分配，适合的不足时按适合的来；好主题可以借 36 计；流量型 = 爆款元素 + 人群感兴趣。
 * 2026-10-29 瘦身：规划和方向的规则收成一份「好方向的标准」（lib/direction-standard），这里逐条守住核心逻辑没丢。
 */
import { describe, expect, it } from 'vitest';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { buildDirectionPrompt } from '@/lib/direction';
import { resolveMix } from '@/lib/content-mix';
import { BIG_TRAFFIC_STANDARD } from '@/lib/content-roles';
import { directionStandard, elementSeesBlock, tacticNamesLine } from '@/lib/direction-standard';
import { elementTypesPerBatch, VIRAL_ELEMENTS } from '@/lib/viral-elements';
import { directionShapeIssues, identityTermsOf, MAX_CHOICE_DIRECTIONS } from '@/lib/direction-shape-check';
import { elementPrefixTitles, categoryCrowdTitles } from '@/lib/topic-element-check';
import { buildTopicBoardQuery, type TopicBoardInput } from '@/lib/boards/topic-query';
import { runQualityChecks } from '@/lib/quality-checks';
import type { CreatorContext } from '@/lib/creator-context';

const plan = buildContentPlanPrompt({ lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '', resolved: resolveMix(null), industry: '大码女装' });
const direction = buildDirectionPrompt({ purposes: ['fans'], formats: ['any'], count: 10, depth: 'quick', industry: '大码女装' });
const expanded = buildDirectionPrompt({ purposes: [], formats: ['any'], count: 10, depth: 'full', industry: '大码女装', expand: { from: '内容规划', content: '### 方向1：有限预算先买哪类衣服\n- **内容方向**：围绕大码女装、裤子、外套' } });
const standard = directionStandard();

describe('瘦身：规划和方向共用一份好方向标准，旧的分散规则不再重复出现', () => {
  it('三个提示词都带同一份标准（计名那行按禁忌筛，前面一字不差）', () => {
    const body = standard.split('起号 36 计（计名）')[0];
    for (const p of [plan, direction, expanded]) expect(p).toContain(body);
  });

  it('旧块不再出现：出发点方法块、36 计全量公式、九类长说明、主题三问长版', () => {
    for (const p of [plan, direction, expanded]) {
      expect(p).not.toContain('## 三种目的怎么找出发点');
      expect(p).not.toContain('#### 起号 36 计清单');
      expect(p).not.toContain('大流量的做法（先定出发点');
      expect(p).not.toContain('## 🔎 主题从哪来、怎么检验');
    }
  });

  it('标准的结构：正面标准在前，红线少量，搭配放最后当对照，先保证每个方向够好', () => {
    const order = ['### 一、出发点', '### 二、好方向长什么样', '### 三、主题从哪来', '### 四、八大爆款元素', '### 五、红线', '### 六、交稿前对照'];
    const idx = order.map((h) => standard.indexOf(h));
    expect(idx.every((n, i) => n >= 0 && (i === 0 || n > idx[i - 1]))).toBe(true);
    expect(standard).toContain('先保证每个方向够好，再看整批搭配；明显不满足时，换掉最弱的那个，不为凑数加弱题');
    const red = standard.split('### 五、红线')[1].split('### 六')[0].trim().split('\n').filter((l) => l.startsWith('- '));
    expect(red.length).toBeLessThanOrEqual(6);
  });

  it('规划提示词的规则部分变短：标准不超过 3000 字', () => {
    expect(standard.length).toBeLessThan(3000);
  });
});

describe('核心逻辑一条没丢', () => {
  it('出发点用产品方定义的原文（全站唯一出处）；任何脚本结构 + 爆款元素都是大流量', () => {
    expect(standard).toContain(BIG_TRAFFIC_STANDARD);
    expect(BIG_TRAFFIC_STANDARD).toContain('任何脚本结构配上爆款元素都是大流量');
    expect(BIG_TRAFFIC_STANDARD).toContain('围绕人、货、场其中一个');
    expect(BIG_TRAFFIC_STANDARD).toContain('符合三有（有用、有趣、有共鸣）之一');
  });

  it('三种目的各一句：流量 = 爆款元素 + 人群感兴趣（身份处境，不必挂系列）、变现 = 成交理由 + 卖的东西、人设 = 一件真事', () => {
    expect(standard).toContain('**流量型 = 爆款元素 + 这群人感兴趣的话题**');
    expect(standard).toContain('最好的话题是这群人的身份处境');
    expect(standard).toContain('不必挂在系列上');
    expect(standard).toContain('**变现型 = 一个成交理由 + 卖的那样东西**');
    expect(standard).toContain('**人设型 = 让人记住这个人的一点**');
  });

  // 第十一轮真实核验（瘦身后）：方向名又回到「换季试衣间顾虑」「学生换季预算取舍」——瘦身时把收尾词禁用表删了，补回
  it('好方向：一类看得见的内容、至少 5 期，不是观点、问题、部位、动作；方向名不用议题词收尾；写得出拍什么、看点、得到什么、凭什么拍得出', () => {
    expect(standard).toContain('能出至少 5 期不同的选题；不是一个观点、一个问题，也不是一个部位、一个动作');
    expect(standard).toContain('方向名不用「顾虑」「困惑」「态度」「取舍」「两难」「观察」「需求」「介绍」「日常」这类词收尾');
    for (const k of ['**拍什么**', '**看点**', '**观众看完得到什么**', '**这个号凭什么拍得出**']) expect(standard).toContain(k);
    expect(standard).toContain('例子只示范写法');
  });

  it('主题来源：系列好的优先接（只是参考）、借 36 计（方向不定拍法）、人设和系列找独有、九类切口参考、过两问', () => {
    expect(standard).toContain('好的**优先接过来**；有更好的可以换，系列只是参考');
    expect(standard).toContain('借起号 36 计');
    expect(standard).toContain('方向里不写定用哪一计拍，拍法留给选题层');
    expect(standard).toContain('先从这个号独有的事实里找');
    for (const t of ['反认知', '冷知识', '怀旧与共鸣']) expect(standard).toContain(`**${t}**`);
    expect(standard).toContain('答案是不是人人都知道？陌生人刷到凭什么停下？');
  });

  it('八大元素：每个一行，写让观众看到什么 + 一条句式；反差不算视角、动作和处境落差；有条件的元素写明', () => {
    const block = elementSeesBlock();
    for (const e of VIRAL_ELEMENTS) expect(block).toContain(`**${e.name}**`);
    expect(block.split('\n')).toHaveLength(VIRAL_ELEMENTS.length);
    expect(block).toContain('同一件东西换视角、换动作、挂着和穿上，处境上的落差，都不算');
    expect(block).toContain('不是在内容里提到预算');
    expect(block).toContain('平价店不硬写最贵');
    expect(block).toContain('只适合时尚穿搭');
  });

  // 第十二轮真实核验：对照项执行得松（大码号 5/7 讲换季、反差还是变动作变情绪），这两条挪进红线
  it('红线：不编、流量不推卖点不证明成交理由、反差两边是两样货两类人两个时代、品类不同框、选择题最多 3 个、同话题最多 2 个（系列大主题也算）、禁忌', () => {
    expect(standard).toContain('不编人、事、数字和别人的反应');
    expect(standard).toContain('流量型不推卖点、不讲价格，不证明成交理由');
    expect(standard).toContain('选反差：两边必须是两样货、两类人或两个时代；同一件东西换视角、换动作、挂着和穿上，想象和实际、情绪前后的落差，都不算，换别的元素');
    expect(standard).toContain('做反差或对比时，变的是卖的东西，人、场、动作不变');
    expect(standard).toContain('单条不用同框，不做「X、Y、Z 先买哪个」');
    expect(standard).toContain(`一批最多 ${MAX_CHOICE_DIRECTIONS} 个`);
    expect(standard).toContain('换个道具问同一道题也算');
    expect(standard).toContain('同一个话题（系列的大主题也算，比如换季）在流量方向里最多 2 个');
    expect(standard).toContain('系列的大主题（比如「换季」）也是一个话题，照样最多接 2 个');
  });

  it('对照：人货场、三有搭配、同看点元素各 2、同货 3、一半带人群身份、不和变现撞拍法', () => {
    expect(standard).toContain('流量方向里人、货、场都有（6 个以上时各至少 2 个）；三有至少用到两种，「有用」不超过一半');
    expect(standard).toContain('同一种看点、同一个元素，各最多 2 个；同一件货最多 3 个');
    expect(standard).toContain('至少一半流量方向带这群人的身份');
    expect(standard).toContain('流量方向不和变现方向用同一种拍法');
  });

  it('核心卖点点名留给变现型', () => {
    const s = directionStandard({ profileSummary: '- 核心卖点：价格比同款市场价低30%-50%、现场试穿' });
    expect(s).toContain('（这个号的成交理由是「价格比同款市场价低30%-50%」「现场试穿」，留给变现型）');
  });

  it('36 计只列计名，和禁忌冲突的计拿掉', () => {
    expect(tacticNamesLine()).toContain('第18计 求助网友');
    expect(tacticNamesLine().length).toBeLessThan(700);
  });

  it('方向层：不用议题式定义、大众切口可选、展开靠拍的东西拉开；不给标题胚子', () => {
    for (const p of [direction, expanded]) {
      expect(p).not.toContain('核心问题要是大众问题');
      expect(p).not.toContain('切入维度只从这些里选');
      expect(p).toContain('大众大事参考池（可选，想不到切口时参考）');
    }
    expect(expanded).toContain('不能把原方向的那个问题放进不同生活处境（时间紧、家人、朋友、第一次）再问一遍');
    expect(expanded).toContain('每个都能出多期选题的方向');
    expect(plan).toContain('也不能把同一个问题换个生活处境（时间紧、家人、朋友、第一次）再问一遍');
    for (const p of [plan, direction, expanded]) expect(p).not.toMatch(/标题胚子|可以拍成的标题/);
  });

  it('三有只写三个词之一；选反差写清两边；流量反差口径统一', () => {
    for (const p of [plan, direction]) {
      expect(p).toContain('三有：有用、有趣、有共鸣写一个词');
      expect(p).toContain('（选反差就写清两边是哪两样货、哪两类人或哪两个时代）');
      expect(p).not.toContain('不写成换衣、换款对比');
    }
  });
});

describe('内容定位、账号定位那边的规则（主题三问长版仍在定位里）', () => {
  it('选择题类系列最多一个；至少一个流量型系列；刚起号第一条用流量型', async () => {
    const fs = await import('node:fs');
    const { buildPositioningPrompt } = await import('@/lib/positioning-standards');
    expect(fs.readFileSync('lib/positioning-standards.ts', 'utf8')).toContain('选择题、投票类系列最多一个');
    expect(buildPositioningPrompt({ profileSummary: '- 档案名称：测试号', focus: 'content' })).toContain('2-4 个系列里至少一个是流量型');
    expect(buildPositioningPrompt({ profileSummary: '- 档案名称：测试号' })).toContain('**刚起号的号，第一条用流量型**');
  });

  it('账号定位、内容定位带主题三问；变现定位不带；核心卖点点名', async () => {
    const { buildPositioningPrompt } = await import('@/lib/positioning-standards');
    const { THEME_RULES, themeRulesFor } = await import('@/lib/content-roles');
    const summary = '- 档案名称：测试号\n- 核心卖点：价格比同款市场价低30%-50%、现场试穿';
    for (const focus of ['full', 'content'] as const) expect(buildPositioningPrompt({ profileSummary: summary, focus })).toContain(THEME_RULES);
    expect(buildPositioningPrompt({ profileSummary: summary, focus: 'business' })).not.toContain('主题三问');
    for (const k of ['**借起号 36 计**', '**流量型 = 爆款元素 + 这群人感兴趣的话题**', '这个号有、同行没有的那一样东西', '「门店试衣镜、本地现场感不同」这种谁都能说的不算', '**流量型的主题不建在成交理由上**', '不要为了凑齐品类做「X、Y、Z 先买哪个」', '至少一半的流量内容，换一个不服务这群人的号就拍不了', '单个流量内容过 ①② 就行']) {
      expect(THEME_RULES).toContain(k);
    }
    expect(themeRulesFor(summary)).toContain('这个号的核心卖点是：「价格比同款市场价低30%-50%」「现场试穿」');
    expect(themeRulesFor('- 档案名称：测试号')).toBe(THEME_RULES);
  });

  it('经营品类的硬约束只管账号整体，写明单条、王牌栏目、系列不用同框', async () => {
    const { buildPositioningPrompt } = await import('@/lib/positioning-standards');
    const p = buildPositioningPrompt({ profileSummary: '- 经营品类（每一个都在卖，定位里都要体现）：大码女装、裤子、外套' });
    expect(p).toContain('**单条视频、王牌栏目、单个系列不需要把它们同框**');
    expect(p).toContain('不是让某一条视频把它们放在一起');
  });
});

describe('体检：方向像观点、选择题超量、搭配、成交理由、撞拍法、人群身份（10-29 各轮真实原稿）', () => {
  const planNames = ['有限预算先买哪类衣服', '换季添衣的预算取舍', '学生换季添衣的两难', '宝妈出门穿衣的顾虑', '衣架与上身的预期落差', '买裤子时的尺码困惑', '让顾客慢慢试的态度'];
  const planOut = planNames.map((n, i) => `### 方向${i + 1}：${n}\n- **视频目的**：流量型\n- **内容方向**：……`).join('\n\n');

  it('规划里议题、态度词收尾的方向名都被认出来（扫描非空转：7 个里认出 6 个）', () => {
    const issues = directionShapeIssues(planOut).filter((d) => d.includes('像一个议题或态度'));
    expect(issues).toHaveLength(6);
    expect(issues.join()).not.toContain('有限预算先买哪类衣服');
  });

  const dirs: [string, string][] = [
    ['一套预算先留给谁', '三类衣服同时摆在眼前，观众得判断有限预算该先留给谁'],
    ['时间紧时先顾哪类', '时间不宽裕、预算也有限，先选哪类衣服更让人纠结'],
    ['衣服买错，预算就更难安排', '先选哪类，才更贴合自己目前的实际需要？'],
    ['家里人要添衣，预算先顾谁', '家里添衣的计划和个人想买的衣服撞上有限预算'],
    ['朋友一起买，意见不同怎么选', '同样一份预算，两种优先顺序各有理由'],
    ['不想穿得不合场合，预算先放哪类', '不同出门需要都想顾到'],
  ];
  const dirOut = dirs.map(([n, h], i) => `### 方向${i + 1}：${n}\n- **内容方向**：……\n- **出发点**：围绕：人｜三有：有共鸣｜爆款元素：成本｜看点：${h}`).join('\n\n---\n\n');

  it('选择题类方向超过 3 个就提醒', () => {
    const issue = directionShapeIssues(dirOut).find((d) => d.includes('只是抛一道选择题'));
    expect(issue).toBeDefined();
    expect(issue).toContain('有 6 个方向');
  });

  it('换个道具问同一道「先补哪件」也认作选择题', () => {
    const props: [string, string, string][] = [
      ['换季门口那排衣架', '在门店衣架上固定摆出大码女装、裤子、外套', '一排衣架把「我到底缺哪件」摆成看得见的生活场景'],
      ['出门日历旁的三件衣服', '不同生活安排会优先补不同品类', '衣服被放进一张普通女生的日程表里'],
      ['帆布袋里的衣柜账', '哪些衣服更值得先占一个位置', '一只帆布袋把抽象的预算限制变成看得见的取舍'],
      ['衣柜门后的待穿纸条', '帮助观众看清有限预算更该补哪一类', '一张纸条把「衣服多却没得穿」具体化'],
      ['试衣间外的三格衣篮', '内容核心是「哪类货先进入试衣间」', '让每一次选择都像一次衣柜排序'],
    ];
    const out = props.map(([n, s, h], i) => `### 方向${i + 1}：${n}\n- **内容方向**：${s}\n- **出发点**：围绕：货｜看点：${h}`).join('\n\n');
    expect(directionShapeIssues(out).find((d) => d.includes('只是抛一道选择题'))).toContain('有 4 个方向');
  });

  const parts: [string, string, string][] = [
    ['抬手时外套肩背怎么动', '人群，呈现大码女性穿外套时关心的活动空间', '有用'],
    ['裤腰与腰头的上身落点', '人群，呈现大码女性试裤子时常关注的腰部位置', '有用'],
    ['裤腿从大腿到裤脚的轮廓', '反差，呈现裤子挂着的轮廓与上身后的实际裤腿线条之间可见的不同', '有用'],
    ['外套拉合后的衣身状态', '反差，呈现同一件外套从敞开到拉合的衣身变化', '有用'],
    ['坐下时裤子膝部和腰部怎么变化', '人群，呈现大码女性在日常坐着时对裤子活动状态的关注', '有用'],
    ['大码女装侧身时的衣身轮廓', '反差，呈现同一件衣服正面与侧面两个视角下可见细节的不同', '有用'],
  ];
  const partsOut = parts.map(([n, el, s], i) => `### 方向${i + 1}：${n}\n- **出发点**：围绕：货｜三有：${s}，观众能带走一个观察点｜爆款元素：${el}｜看点：……`).join('\n\n');

  it('人货场一边倒、三有只用一种、反差变的是视角或动作：都提醒', () => {
    const issues = directionShapeIssues(partsOut);
    expect(issues.some((d) => d.includes('人货场没搭开（人 0、货 6、场 0）'))).toBe(true);
    expect(issues.some((d) => d.includes('三有只用了「有用」一种'))).toBe(true);
    expect(issues.filter((d) => d.includes('反差变的是视角或动作'))).toHaveLength(3);
  });

  it('换了货的反差不误报；有用超过一半单独提醒', () => {
    const out = [
      ['同一人换上的两条裤子', '货', '有用', '反差，同一个人、同一试衣间、同样动作下更换不同裤子'],
      ['接孩子路上的外套', '人', '有共鸣', '人群'],
      ['衣柜里留下的旧外套', '货', '有用', '怀旧'],
      ['开门前的换季货架', '场', '有用', '成本'],
    ].map(([n, a, s, el], i) => `### 方向${i + 1}：${n}\n- **出发点**：围绕：${a}｜三有：${s}｜爆款元素：${el}｜看点：……`).join('\n\n');
    const issues = directionShapeIssues(out);
    expect(issues.some((d) => d.includes('反差变的是视角或动作'))).toBe(false);
    expect(issues.some((d) => d.includes('「有用」占了 3/4，超过一半'))).toBe(true);
    expect(issues.some((d) => d.includes('人货场没搭开'))).toBe(false);
  });

  it('处境落差标成反差、三有写成三个词以外的：都提醒', () => {
    const out = [
      '### 方向1：衣柜里缺的那一格\n- **出发点**：围绕：货｜三有：有共鸣｜爆款元素：反差，设计在开场的“衣架很多”和“缺一件”的落差里｜看点：……',
      '### 方向2：评论区的预算清单\n- **出发点**：围绕：人｜三有：有参与感，评论被带进下一期｜爆款元素：人群｜看点：……',
    ].join('\n\n');
    const issues = directionShapeIssues(out);
    expect(issues.some((d) => d.includes('「衣柜里缺的那一格」的反差变的是视角或动作'))).toBe(true);
    expect(issues.some((d) => d.includes('「评论区的预算清单」的三有写的不是有用、有趣、有共鸣其中一个'))).toBe(true);
  });

  it('流量方向的看点在证明成交理由就提醒（第七轮原稿）；人群处境「怕买错」不误报', () => {
    const out = [
      ['衣架与上身的大码女装', '货', '有用', '观众能带走“看衣服不能只看挂着效果”的判断', '拍店内大码女装从衣架取下、上身'],
      ['镜外走坐抬手测试', '场', '有用', '让人看到买错后闲置的成本，先在店里通过动作确认', '拍出镜者走路、坐下'],
      ['本地女生试衣背影', '人', '有共鸣', '让预算有限的女生看到“怕买回去闲置”的真实时刻', '拍经同意的顾客背影'],
      ['店员轮番试穿', '人', '有趣', '同一排衣服，被不同人拿起来试', '店内团队成员分别试穿，现场试穿也照常拍'],
    ].map(([n, a, s, h, sc], i) => `### 方向${i + 1}：${n}\n- **出发点**：围绕：${a}｜三有：${s}，${h}｜爆款元素：人群｜看点：……\n- **内容方向**：${sc}`).join('\n\n');
    const flagged = directionShapeIssues(out, ['现场试穿']).filter((d) => d.includes('成交理由'));
    expect(flagged.join()).toContain('衣架与上身的大码女装');
    expect(flagged.join()).toContain('镜外走坐抬手测试');
    expect(flagged.join()).toContain('店员轮番试穿」的看点在证明成交理由「现场试穿」');
    expect(flagged.join()).not.toContain('本地女生试衣背影');
  });

  // 第十轮真实核验：流量「同一个人穿不同版型外套」「大码裤子的不同轮廓」和变现「同一人、同一镜子更换不同商品」撞拍法；7 个流量只有 3 个带大码身份
  const run10 = [
    ['大码学生出门前的衣服', '围绕：人｜三有：有共鸣，观众看到想穿得自在又在意他人目光的瞬间｜爆款元素：人群，在情境中呈现大码学生的穿衣处境｜看点：……'],
    ['带娃出门时的妈妈外套', '围绕：人｜三有：有共鸣，观众看到照顾孩子时也想给自己留一点穿衣空间的处境｜爆款元素：人群，在整段情境里呈现大码宝妈的生活角色｜看点：……'],
    ['同一个人穿不同版型外套', '围绕：货｜三有：有兴趣，观众看到不同版型外套在同一人身上的视觉差别｜爆款元素：反差，呈现不同廓形外套的可见差异｜看点：同一个人、同一场景和动作下，换掉外套后轮廓有什么不同。'],
    ['大码裤子的不同轮廓', '围绕：货｜三有：有兴趣，观众看到不同裤型形成的轮廓差异｜爆款元素：反差，在同一人、同一场景和动作下更换裤子｜看点：裤型变了，裤腿呈现出的线条也不同。'],
    ['衣柜里舍不得收的旧衣', '围绕：场｜三有：有共鸣，观众认出换季整理时留下旧衣的瞬间｜爆款元素：怀旧，让真实保留的旧衣物出现在情境中｜看点：……'],
    ['衣架上留下的旧款式', '围绕：场｜三有：有兴趣，观众看到曾经熟悉的服装细节在当下再次出现｜爆款元素：怀旧，以真实存在的旧款衣物或留存实物承载记忆｜看点：……'],
    ['换季整理衣服的时间账', '围绕：场｜三有：有兴趣，观众看到整理一批衣物从开始到归位要经过哪些事｜爆款元素：成本，以实际记录呈现时间和体力消耗｜看点：……'],
    ['镜子里的大码女装试穿', '成交理由：现场试穿｜主角：大码女装；同一人、同一镜子和动作下更换不同商品，让观众看到版型和活动空间的实际差别。'],
  ].map(([n, o], i) => `### 方向${i + 1}：${n}\n- **出发点**：${o}\n- **内容方向**：围绕旧款大码女装……`).join('\n\n');
  const PROFILE = { profile_name: '素妮朵大码女装', product_category: ['大码女装', '裤子', '外套'], account_track: ['时尚穿搭'], target_occupation: ['宝妈', '学生'], target_interests: ['大码女装', '平价穿搭'] };

  it('流量方向和变现方向用同一种拍法（同一人换货）就提醒那两个流量方向', () => {
    const flagged = directionShapeIssues(run10).filter((d) => d.includes('同一种拍法'));
    expect(flagged.map((d) => d.match(/「(.+?)」/)?.[1])).toEqual(['同一个人穿不同版型外套', '大码裤子的不同轮廓']);
    expect(directionShapeIssues(run10.replace(/### 方向8[\s\S]*$/, '')).some((d) => d.includes('同一种拍法'))).toBe(false);
  });

  it('人群身份词从档案取；带身份的流量方向不到一半就提醒（只看方向名和出发点）', () => {
    expect(identityTermsOf(PROFILE)).toEqual(['宝妈', '学生', '大码']);
    expect(identityTermsOf(null)).toEqual([]);
    // 川味烧烤：档案里没有明确的身份词，只有职业，不查（第十一轮：拿职业当身份词会误报）
    expect(identityTermsOf({ profile_name: '锦园地摊串串一元火锅', product_category: ['川味串串火锅', '川味烧烤', '川菜'], target_occupation: ['学生', '白领'] })).toEqual([]);
    const issue = directionShapeIssues(run10, [], identityTermsOf(PROFILE)).find((d) => d.includes('带这群人的身份'));
    expect(issue).toContain('只有 3/7 个');
    expect(directionShapeIssues(run10, []).some((d) => d.includes('带这群人的身份'))).toBe(false);
  });

  // 第十二轮真实原稿：大码号 7 个流量方向名里 5 个带「换季」；川味号 5 个流量方向没有扎堆
  it('话题扎堆：同一个词出现在 3 个以上流量方向名里就提醒；「片段」「现场」和身份词不算', () => {
    const block = (n: string) => `### 方向：${n}\n- **出发点**：围绕：人｜三有：有共鸣｜爆款元素：人群｜看点：……`;
    const big = ['大码换季烦恼现场', '学生衣柜换季片段', '宝妈出门换季片段', '裤装日常行动片段', '镜前出门犹豫片段', '换季货架整理现场', '外套换季收纳画面'].map((n, i) => block(n).replace('方向：', `方向${i + 1}：`)).join('\n\n');
    expect(directionShapeIssues(big, [], ['宝妈', '学生', '大码']).find((d) => d.includes('同一个话题'))).toContain('有 5 个都在讲「换季」');
    const chuan = ['地摊饭桌真心话', '下班夜宵同伴默契', '地摊开摊收摊场景', '炭火锅气感官画面', '南乐夜宵旧时记忆'].map((n, i) => block(n).replace('方向：', `方向${i + 1}：`)).join('\n\n');
    expect(directionShapeIssues(chuan).some((d) => d.includes('同一个话题'))).toBe(false);
  });

  it('看得见的方向不误报', () => {
    const good = ['十年前的爆款外套今天穿', '店主不进货的那几种裤子', '一百块在店里能配齐什么'].map((n, i) => `### 方向${i + 1}：${n}\n- **出发点**：看点：一百块的东西摆出来`).join('\n\n');
    expect(directionShapeIssues(good)).toEqual([]);
  });

  it('接进创作方向和内容规划的体检，只提醒不挡交付；档案在就查人群身份', () => {
    for (const taskType of ['创作方向', '内容规划']) {
      const r = runQualityChecks({ output: dirOut, profile: null, taskType });
      expect(r.issues.find((i) => i.detail.includes('只是抛一道选择题'))?.blocking).toBe(false);
    }
    const r = runQualityChecks({ output: run10, profile: PROFILE, taskType: '内容规划' });
    expect(r.issues.find((i) => i.detail.includes('带这群人的身份'))?.blocking).toBe(false);
  });
});

describe('选题：句式不当前缀，内容要有结果，元素种数按创意等级，品类不挤一个标题', () => {
  it('「句式：问题」的冒号前缀被认出来，融进标题的不误报', () => {
    const out = [
      '## 选题1：花小钱办大事：大码女装裤外套先买谁\n**1️⃣ 爆款元素**\n成本；套用句式：花小钱办大事',
      '## 选题2：曾经vs现在：大码女装裤外套先补谁\n**1️⃣ 爆款元素**\n反差；套用句式：曾经 vs 现在',
      '## 选题3：第一次换季买衣服的学生，钱先留给谁\n**1️⃣ 爆款元素**\n人群',
    ].join('\n\n');
    const flagged = elementPrefixTitles(out);
    expect(flagged).toHaveLength(2);
    expect(flagged.join()).not.toContain('第一次换季');
  });

  it('「以前…现在」认作反差的句式，不再误报认不出元素', async () => {
    const { elementTitleIssues } = await import('@/lib/topic-element-check');
    expect(elementTitleIssues('## 选题2：《以前只背包，现在出门先找哪件衣服？》\n**1️⃣ 爆款元素**\n反差')).toEqual([]);
  });

  it('选题标题一半以上把几个品类挤在一起就提醒（第三轮 5 条全是「大码女装裤外套先买谁」）', () => {
    const titles = ['花小钱办大事：大码女装裤外套先买谁', '曾经vs现在：大码女装裤外套先补谁', '异性会多看你两眼的外套先买吗', '第一次换季买衣服的学生，钱先留给谁', '最贵的换季外套，到底该先买吗'];
    const out = titles.map((t, i) => `## 选题${i + 1}：${t}\n正文`).join('\n\n');
    expect(categoryCrowdTitles(out, ['大码女装', '裤子', '外套'])).toEqual([]);
    const crowded = ['大码女装裤外套先买谁', '大码女装、裤子、外套先补谁', '一套钱给大码女装裤子还是外套', '当年最火的外套'].map((t, i) => `## 选题${i + 1}：${t}\n正文`).join('\n\n');
    expect(categoryCrowdTitles(crowded, ['大码女装', '裤子', '外套'])[0]).toContain('有 3/4 条标题');
    expect(categoryCrowdTitles(crowded, ['大码女装'])).toEqual([]);
  });

  const EMPTY_CTX = { profile: null, positioning: null, dealReasons: [] } as unknown as CreatorContext;
  const input = (difficulty: string, over: Partial<TopicBoardInput> = {}): TopicBoardInput => ({
    creatorContext: EMPTY_CTX, selectedProfile: null, positioningForCtx: null, topicCount: 6, topicType: '流量型选题', topicRole: '流量型', mode: 'quick',
    sourceReference: '', sourceFrom: '', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '', personalRequirement: '', currentSettings: {},
    accountStage: '', fansLevel: '', avgViewsInput: '', selectedPlatforms: [], selectedTracks: [], selectedContentTypes: [], selectedStyles: [], positioningExtra: '',
    selectedElements: [], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '', difficulty, withHook: true, tactic: '', route: '两种都出', routeExplicit: false,
    resolvedMix: resolveMix(null, null, ''), quickTopics: false, ...over,
  });

  it('容易执行至少 2 种、中等 3 种、高创意 4 种', () => {
    expect(elementTypesPerBatch('容易执行')).toBe(2);
    expect(elementTypesPerBatch('中等创意')).toBe(3);
    expect(elementTypesPerBatch('高创意')).toBe(4);
    expect(buildTopicBoardQuery(input('容易执行')).query).toContain('这批流量选题至少用 2 种爆款元素');
    expect(buildTopicBoardQuery(input('高创意')).query).toContain('这批流量选题至少用 4 种爆款元素');
  });

  it('适合的元素不足时按适合的来：只选了 2 个元素，高创意也只要求 2 种', () => {
    const q = buildTopicBoardQuery(input('高创意', { selectedElements: ['cost', 'people'] })).query;
    expect(q).toContain('这批流量选题至少用 2 种爆款元素');
    expect(q).toContain('元素不够时，按适合的来，不硬套');
  });

  it('句式融进标题；内容推进要有结果，不能只摆选项', () => {
    const q = buildTopicBoardQuery(input('中等创意')).query;
    expect(q).toContain('不写成「句式：问题」这种冒号前缀');
    expect(q).toContain('内容推进要有结果');
    expect(q).toContain('不能整条只是摆出选项、什么都不给');
  });
});
