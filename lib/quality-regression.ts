/**
 * 每晚回归（2026-10-03）：拿一份固定的测试档案，真跑几个关键板块，再用 lib/quality-checks 体检。
 * 提示词一改坏（禁忌没带上、配比不按条数、排除的信息又被用、年限又写错），第二天后台看板就能看到，
 * 不用等编导在使用中撞上。只在服务端跑（定时任务调 /api/admin/quality/regression）。
 *
 * 测试档案把这周线上出过的坑都埋进去了：事实卡写「来南乐半年」、排除清单里有「公益」「直播」、
 * 审稿的原稿故意写「全城最正宗」「在南乐干了 18 年」。
 */
import { buildDirectionPrompt } from './direction';
import { buildProfileSummary } from './profile-summary';
import { buildContextBlock, type CreatorContext, type CreatorProfile } from './creator-context';
import { resolveMix, mixPromptBlock } from './content-mix';
import { buildReviewPrompt } from './review-standards';
import { buildRewritePrompt, cleanRewriteOutput } from './canvas';
import { runQualityChecks, reviewedQualityOutput, isBlockingIssue, QUALITY_LABELS, unsupportedFacts, type QualityResult } from './quality-checks';
import { FACT_AUTO_FIX_TASKS, buildFactFixPrompt, fixTooBig } from './fact-fix';
import { holdUnsupported } from './evidence-guard';
import { seasonMisstatements } from './time-anchor';
import { buildTopicBoardQuery } from './boards/topic-query';
import { buildAdaptiveScriptPrompt } from './script-design';
import { buildContentPlanPrompt } from './content-plan';
import { needsSentenceRepair, repairReality } from './reality-repair';
import { repairYears } from './years-repair';
import { sanitizeOutput, stripInternalLeaks } from './output-guard';

/**
 * 小节标题：「## 开篇」「## 开篇（0-5秒）」「## 开篇：0-5秒」都算。
 * 2026-10-16 摸底：原来标题名后面只认「：:、空白」，「## 开篇（0-5秒）」被判成缺失。
 */
export function sectionHeading(section: string): RegExp {
  // 标题前可以有 emoji（「## 📌 这个月的思路」「## 📊 配比一览」是线上提示词规定的字段名原样）
  return new RegExp(`^\\s*#{1,4}\\s+(?:[^\\p{L}\\p{N}\\s]+\\s*)?${section}(?:[：:、\\s（(【\\[\\-—·]|$)`, 'u');
}

export const REGRESSION_PROFILE: CreatorProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  profile_name: '回归测试·川味地摊',
  account_platform: ['抖音'],
  account_track: ['美食烹饪', '本地服务'],
  account_stage: '刚起号，定位未确定',
  target_age: ['18-24岁', '25-30岁'],
  target_occupation: ['学生', '白领'],
  content_tone: '亲切朋友式',
  unique_selling_point: '实在不坑、性价比高',
  competitive_advantage: '主厨做川菜 9 年；愿意真做公益；本地村书记人脉可对接贫困户',
  conversion_path: '看视频 → 评论区问 → 到店；中长期：进直播间 → 挂小房子小风车',
  product_category: ['川味串串火锅', '川味烧烤'],
  persona_facts: { host: '主厨老王', origin: '成都人', yearsInTrade: '做川菜 9 年', yearsLocal: '来南乐半年', mainProducts: '川味串串火锅、川味烧烤' },
  taboo_settings: { excluded: ['公益营销：给贫困户送米面油，联系村书记对接', '直播规划：蓝 V 后挂小房子小风车'] },
} as CreatorProfile;

export interface RegressionCase {
  task: string;
  /** 交给模型的提示词 */
  query: string;
  /** 从模型回答里取出要体检的那部分（审稿只查优化后的稿子，问题清单里引用原稿的话不算） */
  pick?: (answer: string) => string;
  mixCount?: number;
  profile?: CreatorProfile;
  requiredSections?: string[];
  /** 按哪个板块做事实核对（lib/quality-checks 的 FACT_CHECK_TASKS）；不传就不查事实（2026-10-05 前一直没传，夜间回归从没查过编造） */
  checkAs?: string;
  /** 这些原文必须一字不差地留在结果里（「只换开头」这类局部改写） */
  mustKeep?: string[];
  /** 这次给的素材（原稿）：结果里照用素材里的价格、说法不算编（和页面上传 originContent 一样） */
  source?: string;
}

export function regressionCases(profile: CreatorProfile = REGRESSION_PROFILE): RegressionCase[] {
  const ctx = { profile, positioning: null, dealReasons: [] };
  const mix = resolveMix(profile);
  return [
    {
      task: '回归:创作方向',
      // 2026-10-28：加结构检查，要求方向段落齐（原来只看有没有字，截断的半截也能过）
      requiredSections: ['方向1', '方向2', '方向3'],
      query: buildDirectionPrompt({
        purposes: ['fans', 'store'], formats: ['any'], count: 20, depth: 'quick',
        profileSummary: buildProfileSummary(profile as unknown as Record<string, unknown>), contextBlock: buildContextBlock(ctx, 'direction'),
        mixBlock: mixPromptBlock(mix, { count: 20, unit: '个' }),
      }),
    },
    {
      task: '回归:审稿优化',
      query: buildReviewPrompt({
        draftContent: '【开场】0-3秒 老板：我们是全城最正宗的川味串串！\n【中段】3-15秒 台词：我在南乐干了 18 年，零添加，吃了养胃。\n【结尾】15-20秒 台词：加微信领优惠。',
        platform: '抖音', duration: '30秒', scriptType: '晒过程型',
        contextBlock: buildContextBlock(ctx, 'review'),
        personalRequirements: '原稿年限写错了，按事实卡改',
      } as Parameters<typeof buildReviewPrompt>[0]),
      pick: reviewedQualityOutput,
      checkAs: '审稿优化',
    },
    {
      task: '回归:画布改写',
      query: buildRewritePrompt({
        doc: '# 一元火锅\n**开头**：你知道一元火锅能吃到什么吗？\n**中段**：本店食材均为当日采购，锅底由主厨精心熬制。\n**结尾**：想吃的评论区说说。',
        selection: '**中段**：本店食材均为当日采购，锅底由主厨精心熬制。',
        instruction: '口语一点，像老板跟熟客聊天',
        context: buildContextBlock(ctx, 'freeChat'),
      }),
      pick: cleanRewriteOutput,
    },
    ...([
      { name: '美甲', platform: '小红书', task: '选题', facts: { yearsInTrade: '美甲从业5年', yearsLocal: '在杭州定居2年', others: '店开了1年；基础单色价格88元' } },
      { name: '家具', platform: '视频号', task: '开篇', facts: { yearsInTrade: '家具从业12年', yearsLocal: '来苏州3年', others: '门店开了2年；只卖家具，不承接装修' } },
    ]).map(({ name, platform, task, facts }): RegressionCase => {
      const fixture = { ...profile, profile_name: `回归测试·${name}`, account_platform: [platform], account_track: [name], persona_facts: facts, taboo_settings: {} } as CreatorProfile;
      return {
        task: `回归:${name}${task}`, profile: fixture,
        requiredSections: task === '选题' ? ['选题1', '选题2', '选题3'] : ['开篇', '衔接正文'],
        checkAs: task === '选题' ? '选题策划' : '开篇钩子',
        query: `${buildContextBlock({ profile: fixture, positioning: null, dealReasons: [] }, 'freeChat')}\n请为${platform}创作${task === '选题' ? '3个带拍摄角度的选题，严格分为 ## 选题1、## 选题2、## 选题3，每节包含标题和拍摄角度' : '一个20秒开篇和衔接正文，严格分为 ## 开篇 和 ## 衔接正文，每节包含可直接拍的台词'}。严守事实卡：从业年限、本地居住年限、店龄是不同事实，不能互换；只写可直接用的内容，不联网。`,
      };
    }),
    /*
     * 2026-10-05 质量整改加的两个（docs/开物质量深度研究_20261005）：
     *   没给价格、没给顾客故事，却要写「突出性价比和口碑」的引流脚本——最容易编出人均多少钱、有位顾客说；
     *   「只换开头」——短要求不能被模板压过，正文必须一字不动。
     */
    {
      task: '回归:无价格引流脚本',
      query: `${buildContextBlock(ctx, 'script')}\n请写一条 30 秒抖音到店引流口播脚本，突出性价比和顾客口碑。档案里没有价格，也没有具体顾客的故事。分为 ## 开头、## 正文、## 结尾 三节，只写可直接念的台词。`,
      requiredSections: ['开头', '正文', '结尾'],
      checkAs: '脚本生成',
    },
    {
      task: '回归:只换开头',
      query: `${buildContextBlock(ctx, 'script')}\n下面是一条已经定稿的口播，**别改正文，只换开头**，换成更抓人的一句。输出完整稿子。\n\n开头：大家好，今天给大家介绍一下我们店。\n正文：锅底每天早上现炒，一元一串，自己拿签子。\n结尾：想吃的评论区说说你在哪个区。`,
      checkAs: '脚本生成',
      mustKeep: ['锅底每天早上现炒，一元一串，自己拿签子', '想吃的评论区说说你在哪个区'],
      source: '开头：大家好，今天给大家介绍一下我们店。正文：锅底每天早上现炒，一元一串，自己拿签子。结尾：想吃的评论区说说你在哪个区。',
    },
    // 2026-10-23 加的三个：通用脚本、跨行业二创、自由对话，覆盖线上实时体检里失败最多的板块
    {
      task: '回归:通用口播脚本',
      query: `${buildContextBlock(ctx, 'script')}\n请写一条 30 秒抖音口播脚本，主题是老板凌晨三点起来亲手腌肉、一元一串。分为 ## 开头、## 正文、## 结尾 三节，只写可直接念的台词，不编顾客的话。`,
      requiredSections: ['开头', '正文', '结尾'],
      checkAs: '脚本生成',
    },
    {
      task: '回归:跨行业二创',
      query: `${buildContextBlock(ctx, 'script')}\n下面是一段别的行业的拆解文案，把它换成川味烧烤的说法，保留它的结构和节奏，分为 ## 开头、## 正文 两节，只写可直接念的台词。\n原文：一家开了十年的面馆，每天凌晨五点起来熬汤，老板说汤没有捷径，只能一锅一锅守。`,
      requiredSections: ['开头', '正文'],
      checkAs: '跨行业二创',
      source: '一家开了十年的面馆，每天凌晨五点起来熬汤，老板说汤没有捷径，只能一锅一锅守。',
    },
    {
      task: '回归:自由对话',
      query: `${buildContextBlock(ctx, 'freeChat')}\n我想知道我们店开了几年、主厨做了几年川菜，你直接告诉我，再给我一个做短视频的小建议。`,
      checkAs: '自由对话',
    },
    // 2026-10-28：选题、脚本的主路径（和页面、助理用的提示词一样，不是手写的简化版）。不分行业守同一套现实逻辑：
    //   服装、家具、餐饮各一份档案；脚本用「小变量要推出大反转」的要求去试，看会不会把一个细节放大成结论
    topicCase('大码女装', industryProfile('大码女装', '抖音', '时尚穿搭', ['大码外套', '大码裤子'], { yearsInTrade: '做大码女装 6 年', yearsLocal: '在南乐开店 3 年', mainProducts: '大码外套、大码裤子' }, { age: ['25-30岁'], occupation: ['学生', '白领'] }), '抖音'),
    topicCase('家具', industryProfile('家具', '视频号', '家居装修', ['沙发', '床'], { yearsInTrade: '家具从业 12 年', yearsLocal: '来苏州 3 年', mainProducts: '沙发、床，不承接装修' }, { age: ['25-30岁'], occupation: ['白领'] }), '视频号'),
    contentPlanCase(industryProfile('大码女装', '抖音', '时尚穿搭', ['大码外套', '大码裤子'], { yearsInTrade: '做大码女装 6 年', yearsLocal: '在南乐开店 3 年', mainProducts: '大码外套、大码裤子' }, { age: ['25-30岁'], occupation: ['学生', '白领'] })),
    scriptCase('大码穿法反转', industryProfile('大码女装', '抖音', '时尚穿搭', ['大码外套', '大码裤子'], { yearsInTrade: '做大码女装 6 年', yearsLocal: '在南乐开店 3 年', mainProducts: '大码外套、大码裤子' }, { age: ['25-30岁'], occupation: ['学生', '白领'] }),
      '同一件大码外套，只改扣子和袖口，穿出来的人气质完全不同',
      '学生穿大码外套来店里试。店主只把外套的扣子解开一颗、袖子卷到手肘。学生照镜子说：「原来差这一点。」',
      '要有戏剧冲突和反转，结尾要让人眼前一亮，看完想转发。'),
    scriptCase('家具反转', industryProfile('家具', '视频号', '家居装修', ['沙发', '床'], { yearsInTrade: '家具从业 12 年', yearsLocal: '来苏州 3 年', mainProducts: '沙发、床，不承接装修' }, { age: ['25-30岁'], occupation: ['白领'] }),
      '沙发怎么挑才不踩坑：换一个靠垫，客厅就像换了一套',
      '客户来店选沙发，店主把靠垫换成另一款。客户坐下说：「比刚才舒服多了。」',
      '要有戏剧冲突和反转，结尾要让人眼前一亮，看完想转发。'),
  ];
}

/** 按一份行业档案造回归档案（沿用回归档案的其余字段，只换行业、事实和经营的东西） */
/**
 * 按一个行业的档案造回归档案。2026-10-28 修：原来整个继承川味地摊的基础档案，
 * 「实在不坑、性价比高」「川菜」「公益营销」「村书记」「18—24岁」等川味字段漏进了大码、家具的档案，
 * 之前那几组大码、家具的回归结果是拿错的档案测出来的。这里把所有带川味内容的字段都覆盖掉，人群只写这个行业自己的。
 */
function industryProfile(
  name: string, platform: string, track: string, products: string[], facts: Record<string, string>,
  audience: { age?: string[]; occupation?: string[] } = {},
): CreatorProfile {
  return {
    ...REGRESSION_PROFILE,
    profile_name: `回归测试·${name}`,
    account_platform: [platform],
    account_track: [track],
    account_stage: '刚起号，定位未确定',
    target_age: audience.age ?? [],
    target_occupation: audience.occupation ?? [],
    content_tone: '',
    unique_selling_point: '',
    competitive_advantage: '',
    conversion_path: '',
    product_category: products,
    persona_facts: facts,
    taboo_settings: {},
  } as CreatorProfile;
}

/** 选题主路径：和选题页用的 buildTopicBoardQuery 同一份提示词，按档案的配比出 6 条 */
function topicCase(name: string, profile: CreatorProfile, platform: string): RegressionCase {
  const ctx = { profile, positioning: null, dealReasons: [] } as unknown as CreatorContext;
  return {
    task: `回归:选题主路径·${name}`,
    profile,
    mixCount: 6,
    checkAs: '选题策划',
    requiredSections: ['选题1', '选题2', '选题3'],
    query: buildTopicBoardQuery({
      creatorContext: ctx, selectedProfile: profile, positioningForCtx: null,
      topicCount: 6, topicType: '选题（流量型、人设型、变现型按配比搭配）', topicRole: '按配比', mode: 'quick',
      sourceReference: '', sourceFrom: '', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '',
      personalRequirement: '', currentSettings: {}, accountStage: '', fansLevel: '', avgViewsInput: '',
      selectedPlatforms: [platform], selectedTracks: [], selectedContentTypes: [], selectedStyles: [],
      positioningExtra: '', selectedElements: ['nostalgia', 'worst', 'cost'], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '',
      difficulty: '中等创意', withHook: true, tactic: '', route: '两种都出', routeExplicit: false, resolvedMix: resolveMix(profile), quickTopics: false,
    }).query,
  };
}

/**
 * 内容规划（2026-10-28 补进回归）：和内容规划页用的 buildContentPlanPrompt 同一份提示词。
 * 只出条数、目的、方向和节奏，不出选题和脚本；4 个必有的段落要在。
 */
function contentPlanCase(profile: CreatorProfile): RegressionCase {
  return {
    task: `回归:内容规划·${profile.account_track?.[0] ?? '档案'}`,
    profile,
    checkAs: '内容规划',
    requiredSections: ['这个月的思路', '配比一览', '内容方向', '四周节奏'],
    query: buildContentPlanPrompt({
      lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '',
      resolved: resolveMix(profile), profileSummary: buildProfileSummary(profile as unknown as Parameters<typeof buildProfileSummary>[0]),
    }),
  };
}

/** 脚本主路径：和脚本页用的 buildAdaptiveScriptPrompt 同一份提示词 */
function scriptCase(name: string, profile: CreatorProfile, topic: string, source: string, requirements: string): RegressionCase {
  const ctx = { profile, positioning: null, dealReasons: [] };
  return {
    task: `回归:脚本主路径·${name}`,
    profile,
    checkAs: '脚本生成',
    // 2026-10-28：原来没有完整性检查，一段 132 字的内部提示词被截断后也判「通过」。四步结构必须齐
    requiredSections: ['第1步', '第2步', '第3步', '第4步'],
    source,
    query: buildAdaptiveScriptPrompt({
      topic, platform: profile.account_platform?.[0] ?? '抖音', duration: '30秒',
      context: buildContextBlock(ctx, 'script'), source, requirements, settings: {},
    }),
  };
}

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

/** 调一次「开物」，收齐回答（不进任何人的会话，用户标成 quality-nightly） */
async function askDify(query: string): Promise<string> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'quality-nightly', response_mode: 'streaming', query,
      inputs: { query, search_query: '短视频 创作 质检', conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮为夜间质检回归，不联网。' },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  return readDifyAnswer(res);
}

/** 必须收到正常结束事件；错误事件即使不是 Dify 开头，也不能被 JSON 容错吞掉。 */
export async function readDifyAnswer(res: Response): Promise<string> {
  if (!res.ok || !res.body) throw new Error(`Dify ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let answer = '';
  let completed = false;
  const consume = (line: string) => {
    if (!line.startsWith('data:')) return;
    let e: Record<string, unknown>;
    try { e = JSON.parse(line.slice(5).trim()); } catch { throw new Error('Dify 返回了无法解析的事件'); }
    if (e.event === 'error') throw new Error(String(e.message || 'Dify 出错'));
    if (e.event === 'message' || e.event === 'agent_message') answer += typeof e.answer === 'string' ? e.answer : '';
    if (e.event === 'message_replace') answer = typeof e.answer === 'string' ? e.answer : '';
    if (e.event === 'message_end') completed = true;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); if (buf.trim()) consume(buf); break; }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) consume(line);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!completed) throw new Error('Dify 连接中断，未收到完成事件');
  if (!answer.trim()) throw new Error('Dify 未返回正文');
  return answer;
}

export interface RegressionOutcome { task: string; result: QualityResult; sample: string; error?: string }

/** 回归样例保存的字数：比原来的 300 字多，管理员能看到大部分内容再判断 */
const SAMPLE_CHARS = 1200;

/** 跑一个用例：问一次模型，再体检。没跑成（Dify 出错、超时）记成 error，不当成质量问题 */
export async function runCase(c: RegressionCase, ask: (q: string) => Promise<string>, repair?: RegressionRepair): Promise<RegressionOutcome> {
  try {
    const raw = await ask(c.query);
    // 有修复步骤时，体检的是修复后的稿子（和线上交付给编导的一样）
    const answer = repair ? await repair(raw, c) : raw;
    const checked = c.pick ? c.pick(answer) : answer;
    const profile = c.profile ?? REGRESSION_PROFILE;
    const mix = c.mixCount ? { resolved: resolveMix(profile), count: c.mixCount } : null;
    // 审稿的事实核对自己会取「优化后的完整脚本」那一节（lib/quality-checks），交给它整段回答，别取两次
    const result = runQualityChecks({ output: c.checkAs === '审稿优化' ? answer : checked, profile, mix, taskType: c.checkAs, source: c.source });
    for (const keep of c.mustKeep ?? []) {
      if (!checked.replace(/\s+/g, '').includes(keep.replace(/\s+/g, ''))) result.issues.push({ kind: 'generation', detail: `没守住用户的明确要求：「${keep.slice(0, 20)}」被改了`.slice(0, 200) });
    }
    for (const section of c.requiredSections ?? []) {
      const lines = checked.split('\n');
      const start = lines.findIndex(line => sectionHeading(section).test(line));
      // 段落到同级或更高级的标题为止（2026-10-28 修：原来碰到下一个三级标题就截止，「## 内容方向」下面的「### 方向1」会把正文判成空）
      const level = start < 0 ? 0 : (lines[start].match(/^\s*(#+)/)?.[1].length ?? 0);
      const next = start < 0 ? -1 : lines.findIndex((line, i) => {
        if (i <= start) return false;
        const h = line.match(/^\s*(#{1,6})\s+/);
        return !!h && h[1].length <= level;
      });
      const body = start < 0 ? '' : lines.slice(start + 1, next < 0 ? lines.length : next).join('\n');
      if (!/[\p{L}\p{N}]/u.test(body)) result.issues.push({ kind: 'generation', detail: `必要交付部分「${section}」缺失或为空` });
    }
    result.passed = !result.issues.some(isBlockingIssue);
    return { task: c.task, result, sample: checked.slice(0, SAMPLE_CHARS) };
  } catch (e) {
    const error = (e as Error).message;
    return { task: c.task, result: { passed: false, issues: [{ kind: 'error', detail: error.slice(0, 200) }] }, sample: '', error };
  }
}

/**
 * 依次跑完所有用例（串行：别同时压 Dify），每个都体检。
 * 第一次没过的，重跑一次：模型输出有波动，单次失败不足为凭。重跑过了记 flaky（只提醒，不算失败），重跑还不过才算失败。
 */
/** 生成后的修复（和线上一样）：拿到模型的原稿，返回交付的稿子 */
export type RegressionRepair = (text: string, c: RegressionCase) => Promise<string>;

/**
 * 线上同一套修复（app/api/dify/stream 里交付前的步骤，顺序也一样）：
 * 1. 整理：去内部痕迹、广告法用语、数字规则（审稿只去痕迹，原稿用语不动）
 * 2. 事实：没有出处的价格、顾客见证等，按资料修正一次；修不掉的换成【待确认】（lib/fact-fix、lib/evidence-guard）
 * 3. 年限：结果里的从业、本地、店龄年数对不上事实卡，只改那一句（lib/years-repair）
 * 4. 现实：一个小变量推大结论这类说法，只改那一句（lib/reality-repair）
 */
export function productionRepair(): RegressionRepair {
  return async (text, c) => {
    const task = c.checkAs ?? c.task.replace(/^回归:/, '');
    const tidy = (t: string) => (task === '审稿优化' ? stripInternalLeaks(t, task) : sanitizeOutput(t, task));
    let out = tidy(text);

    if (FACT_AUTO_FIX_TASKS.has(task)) {
      const known = `${JSON.stringify(c.profile ?? REGRESSION_PROFILE)}\n${c.source ?? ''}\n${c.query}`;
      const factIssues = (t: string) => [...unsupportedFacts(t, known), ...seasonMisstatements(t, Date.now(), known)];
      const found = factIssues(out);
      if (found.length) {
        const fixed = await askDify(buildFactFixPrompt({ text: out, issues: found, context: c.query })).catch(() => null);
        const fixedText = fixed ? tidy(cleanRewriteOutput(fixed)) : '';
        // 只采用真的少了问题、又没有借机重写全文的版本
        if (fixedText && !fixTooBig(out, fixedText, found) && factIssues(fixedText).length < found.length) out = fixedText;
      }
      out = holdUnsupported(out, factIssues).text;
    }

    if (!needsSentenceRepair(task)) return out;
    const ask = (prompt: string) => askDify(prompt).catch(() => null);
    out = (await repairYears(out, ask, (c.profile ?? REGRESSION_PROFILE).persona_facts, task)).text;
    return (await repairReality(out, ask, task)).text;
  };
}

export async function runRegression(ask: (q: string) => Promise<string> = askDify, cases: RegressionCase[] = regressionCases(), repair?: RegressionRepair): Promise<RegressionOutcome[]> {
  const out: RegressionOutcome[] = [];
  for (const c of cases) {
    const first = await runCase(c, ask, repair);
    if (first.error || first.result.passed) {
      out.push(first);
      continue;
    }
    const second = await runCase(c, ask, repair);
    if (!second.error && second.result.passed) {
      const why = first.result.issues.filter(isBlockingIssue).map((i) => QUALITY_LABELS[i.kind]).slice(0, 3).join('、');
      second.result.issues.push({ kind: 'flaky', detail: `第一次没过（${why}），重跑后通过`, blocking: false });
    }
    out.push(second);
  }
  return out;
}
