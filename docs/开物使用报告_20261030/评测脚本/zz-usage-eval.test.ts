// 开物全站体验测评（2026-10-30）：三个行业 × 19 个生成节点，按链路串联，每一步真实调用模型。
// 产物写到 docs/开物使用报告_20261030/runs/：每个节点一份提示词（.prompt.txt）、一份输出（.out.md），
// 以及 meta.jsonl（节点、行业、提示词 sha256、耗时、是否成功）。CHAIN_REAL=1 才会真正调用。
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { it } from 'vitest';
import { askDify } from '@/lib/dify-task';
import { buildProfileSummary } from '@/lib/profile-summary';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildBriefPrompt } from '@/lib/creative-brief';
import { buildIndustryAdvicePrompt } from '@/lib/industry-advice';
import { buildGrowthPlanPrompt, buildOpeningPrompt } from '@/lib/growth-standards';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { resolveMix } from '@/lib/content-mix';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildTopicBoardQuery } from '@/lib/boards/topic-query';
import { buildScriptBoardQuery } from '@/lib/boards/script-query';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildReviewBoardQuery } from '@/lib/boards/review-query';
import { buildRemixPrompt, DEFAULT_LAYERS, DEFAULT_OUTPUTS } from '@/lib/remix';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';
import { buildDealReasonPrompt } from '@/lib/deal-reasons';
import { buildBenchmarkQuery } from '@/lib/benchmark-analysis';
import { buildExtractionPrompt } from '@/lib/interview-import';

const RUN = !!process.env.CHAIN_REAL;
// 干跑：只构造每个节点的提示词、不调模型，用来验证构造函数都能跑通
const DRY = !!process.env.EVAL_DRY;
const ROOT = 'E:/小宋/腾讯云生产版同步_20260918';
const OUT = `${ROOT}/docs/开物使用报告_20261030/runs`;
const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

/* ---------- 三个行业的固定材料（虚构，不是真实客户） ---------- */
type Industry = { code: string; name: string; profile: Record<string, unknown>; store: { name: string; type: string; features: string; customer: string }; viralSample: string; benchmarkSample: string; interviewNotes: string; storyboardType: string; topicPreset: string };

const INDUSTRIES: Industry[] = [
  {
    code: 'A', name: '川味餐饮（地摊串串）',
    profile: {
      profile_name: '锦园地摊串串一元火锅', account_platform: ['抖音'], account_track: ['美食烹饪', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['25-35岁'], target_occupation: ['白领', '宝妈'], target_region: ['南乐本地'],
      product_category: ['川味串串火锅', '川味烧烤', '川菜'],
      persona_facts: { host: '成都来的川菜厨师', role: '本人（掌勺）', origin: '成都人', yearsInTrade: '做川菜9年', yearsLocal: '来南乐半年', mainProducts: '川味串串火锅、川味烧烤、川菜', signature: '一元火锅', others: '每天下午4点出摊' },
      interview_highlights: '出镜人是成都来的川菜厨师，做川菜9年，来南乐半年；一元火锅是门店核心卖点，低门槛引流',
      content_themes: '以川味串串火锅、川味烧烤、川菜三个品类为核心，晒食材准备过程，教知识，厨师经验分享',
      unique_selling_point: '正宗川味配方，一元火锅低门槛',
    },
    store: { name: '锦园地摊串串一元火锅', type: '地摊火锅串串', features: '一元火锅、现做现售川味烧烤、下午到深夜出摊', customer: '本地白领、带孩子下班的家庭' },
    storyboardType: 'food', topicPreset: '川菜最不能省的是炒前准备',
    viralSample: '凌晨五点的菜市场，老板拎着两筐牛肉往回走。他说这一摊的料要自己挑，挑不好整锅汤都是白熬。今天我带你看他怎么选，选完你就知道为什么他的汤能喝出来。',
    benchmarkSample: '某同城美食账号（虚构样本）：标题「这家店为什么排队」，视频拍摄后厨出餐过程，开头三秒是一碗汤冒热气，结尾引导关注。',
    interviewNotes: '问：您做川菜多少年了？答：九年，在成都做了好几家店。问：怎么想到来南乐？答：朋友在这边合伙摆地摊，我就过来帮忙。问：一元火锅为什么敢这么卖？答：料要真，量要足，客人吃了还会回来。问：您最在意的是哪一步？答：炒之前的准备，调料怎么下、油温怎么控，省了后面怎么炒都补不回来。问：有没有客人特别记得的事？答：有个老顾客每周都来，说就喜欢我们的汤底不咸。',
  },
  {
    code: 'B', name: '大码女装（店主本人出镜）',
    profile: {
      profile_name: '阿梅大码女装店', account_platform: ['抖音'], account_track: ['时尚穿搭', '本地服务'], account_stage: '起号期', fans_level: '0-1000', target_gender: '女',
      target_age: ['25-40岁'], target_occupation: ['宝妈', '上班族'], target_region: ['县城本地'],
      product_category: ['大码女装'],
      persona_facts: { host: '店主阿梅', role: '老板本人出镜', yearsInTrade: '做大码女装6年', yearsLocal: '在本地开店3年', mainProducts: '大码连衣裙、大码外套、大码裤装', signature: '50码以上可试穿', others: '门店在县城商业街，有试衣间' },
      interview_highlights: '店主做大码女装6年，店开了3年；很多大码女生在别的店买不到合身的衣服',
      content_themes: '穿搭教学、试衣过程、大码女生的穿衣烦恼',
      unique_selling_point: '50码以上有可试穿款',
    },
    store: { name: '阿梅大码女装店', type: '女装店', features: '50码以上可试穿，门店在县城商业街', customer: '县城大码女生、宝妈' },
    storyboardType: 'product', topicPreset: '大码女生怎么挑外套不显胖',
    viralSample: '很多大码姐妹进店第一句话就是「我穿不了」。今天我不推荐衣服，我先让你站到镜子前，看看哪一个剪裁其实是在帮你。站不对，买再贵也白搭。',
    benchmarkSample: '某同城穿搭账号（虚构样本）：标题「大码女生的外套选对了三个地方」，视频在试衣间拍摄，前三秒是镜子前的转身，结尾引导到店试穿。',
    interviewNotes: '问：您做大码女装多少年了？答：六年。问：为什么做大码？答：身边的姐妹总说买不到合身的，我就自己去进货。问：客人最常问什么？答：外套显不显胖，裤子长短合不合适。问：有没有印象深的客人？答：有个宝妈试了五件，最后选的那件她说站起来很舒服。问：您觉得最难的是什么？答：每个人身材不一样，只能一个一个看。',
  },
  {
    code: 'C', name: '本地家具店（老板本人出镜）',
    profile: {
      profile_name: '县城木工家具店', account_platform: ['抖音'], account_track: ['家居家装', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['28-45岁'], target_occupation: ['新婚家庭', '换房的业主'], target_region: ['县城本地'],
      product_category: ['实木家具', '布艺沙发'],
      persona_facts: { host: '老板老周', role: '老板本人出镜', yearsInTrade: '做家具12年', yearsLocal: '本地人', mainProducts: '实木餐桌椅、布艺沙发', signature: '现场看木料', others: '门店在县城，自家有木工工坊' },
      interview_highlights: '老板做家具12年，自家有木工工坊；客人常问沙发怎么挑不踩坑',
      content_themes: '选家具的常识、木料辨认、工坊过程',
      unique_selling_point: '自家工坊，木料可现场看',
    },
    store: { name: '县城木工家具店', type: '家具店', features: '实木家具，自家工坊，木料现场看', customer: '新婚家庭、换房的业主' },
    storyboardType: 'product', topicPreset: '沙发怎么挑才不踩坑',
    viralSample: '买沙发最怕的不是贵，是买回家坐三个月就塌。我今天不卖沙发，我把一块木头拿到镜头前，你看纹路，我告诉你为什么这块木料撑得住。',
    benchmarkSample: '某同城家居账号（虚构样本）：标题「别再被沙发坑了」，视频在门店拍摄，前三秒是手掰沙发扶手，结尾引导到店。',
    interviewNotes: '问：您做家具多少年了？答：十二年，木工出身。问：客人最常问什么？答：沙发到底怎么挑，布艺还是皮的，坐久了会不会塌。问：您怎么回答？答：先看木架，木架不稳什么料子都白搭；坐垫的回弹要现场试。问：有没有印象深的事？答：有对年轻夫妻来看了三次，最后说就是因为能看到木料才放心买。问：您觉得做家具最讲究什么？答：料要干透，榫头要严，别偷工减料。',
  },
];

/* ---------- 执行器：每个节点落盘 + 记 meta ---------- */
type Meta = { industry: string; node: string; ok: boolean; promptSha256: string; promptChars: number; outChars: number; ms: number; error?: string; undefinedHits: string[] };
const metas: Meta[] = [];

async function runNode(ind: Industry, node: string, query: string, searchQuery: string): Promise<string | null> {
  const dir = `${OUT}/${ind.code}`;
  fs.mkdirSync(dir, { recursive: true });
  const started = Date.now();
  const sha = createHash('sha256').update(query).digest('hex');
  const undefinedHits = ['undefined', 'null', '[object Object]'].filter((w) => query.includes(w));
  fs.writeFileSync(`${dir}/${node}.prompt.txt`, query, 'utf8');
  if (DRY) {
    metas.push({ industry: ind.code, node, ok: true, promptSha256: sha, promptChars: query.length, outChars: 0, ms: 0, undefinedHits });
    return 'DRY';
  }
  // 网络断开（ECONNRESET）或模型返回失败时最多重试三次；仍失败就记下原因，由调用方跳过依赖它的节点
  let text: string | null = null;
  let error = '';
  for (let attempt = 1; attempt <= 3 && text === null; attempt++) {
    try {
      const res = await askDify(query, `usage-eval-${ind.code}`, searchQuery);
      if (res.ok) text = res.text;
      else error = res.message;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    if (text === null) await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  const ms = Date.now() - started;
  if (text === null) {
    metas.push({ industry: ind.code, node, ok: false, promptSha256: sha, promptChars: query.length, outChars: 0, ms, error, undefinedHits });
    fs.appendFileSync(`${OUT}/meta.jsonl`, JSON.stringify(metas[metas.length - 1]) + '\n', 'utf8');
    return null;
  }
  fs.writeFileSync(`${dir}/${node}.out.md`, text, 'utf8');
  metas.push({ industry: ind.code, node, ok: true, promptSha256: sha, promptChars: query.length, outChars: text.length, ms, undefinedHits });
  fs.appendFileSync(`${OUT}/meta.jsonl`, JSON.stringify(metas[metas.length - 1]) + '\n', 'utf8');
  return text;
}

/* ---------- 一个行业的整条链路 ---------- */
async function chain(ind: Industry) {
  const summary = buildProfileSummary(ind.profile as never);
  const profile = ind.profile as never;
  const mix = resolveMix(ind.profile, null, '');
  const creatorContext = { profile, positioning: null, dealReasons: [] } as never;

  // 1 账号定位（完整）
  const P = await runNode(ind, '01-账号定位', buildPositioningPrompt({ profileSummary: summary, platform: '抖音' }), '账号定位');
  // 2 商业定位 / 3 内容定位（以账号定位为底）
  const B = P && await runNode(ind, '02-商业定位', buildPositioningPrompt({ profileSummary: summary, platform: '抖音', focus: 'business', baseline: P }), '商业定位');
  const C = P && await runNode(ind, '03-内容定位', buildPositioningPrompt({ profileSummary: summary, platform: '抖音', focus: 'content', baseline: P }), '内容定位');
  // 4 创作简报
  const BR = P && await runNode(ind, '04-创作简报', buildBriefPrompt({ positioningFull: P, profileSummary: summary, notes: '', businessPositioning: B ?? undefined, contentPositioning: C ?? undefined } as never), '创作简报');
  // 5 行业建议
  await runNode(ind, '05-行业建议', buildIndustryAdvicePrompt({ profileSummary: summary, baseline: P ?? undefined, businessBaseline: B ?? undefined, contentBaseline: C ?? undefined, input: { purpose: 'traffic', stage: 'start', situation: '刚开始发，还没有数据', goal: '先让同城的人看到' } as never }), '行业建议');
  // 6 起号方案
  await runNode(ind, '06-起号方案', buildGrowthPlanPrompt({ contextBlock: summary, contentPlan: C ?? undefined, notes: '' } as never), '起号方案');
  // 7 内容规划
  const CP = await runNode(ind, '07-内容规划', buildContentPlanPrompt({ lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '', resolved: mix, profileSummary: summary, industry: ind.name } as never), '内容规划');
  // 8 创作方向（以内容定位和规划为底）
  const DR = await runNode(ind, '08-创作方向', buildDirectionPrompt({ purposes: ['流量型', '人设型'], formats: ['晒过程', '教知识'], count: 6, depth: 'quick', profileSummary: summary, contextBlock: [C, CP].filter(Boolean).join('\n\n'), industry: ind.name } as never), '创作方向');
  // 9 选题（以创作方向为来源）
  const topicQ = DR && buildTopicBoardQuery({
    creatorContext, selectedProfile: profile, positioningForCtx: null, topicCount: 6, topicType: '流量型', topicRole: '按配比', mode: 'quick',
    sourceReference: DR.slice(0, 4000), sourceFrom: '创作方向', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '', personalRequirement: '',
    currentSettings: {}, accountStage: '起号期', fansLevel: '0-1000', avgViewsInput: '', selectedPlatforms: ['抖音'], selectedTracks: [], selectedContentTypes: [],
    selectedStyles: [], positioningExtra: '', selectedElements: [], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意',
    withHook: true, tactic: '', route: '两种都出', routeExplicit: false, resolvedMix: mix, quickTopics: true,
  } as never);
  const T = topicQ && await runNode(ind, '09-选题', topicQ.query, '选题');
  // 10 脚本（以选题里的第一个选题为主题）
  const topicLine = (T?.match(/《([^》]{4,60})》/)?.[1]) ?? ind.topicPreset;
  const scriptQ = buildScriptBoardQuery({
    topic: topicLine, platform: '抖音', scriptType: 'show', autoScriptType: false, effectiveRole: '流量型', isAd: false, industry: ind.name, customIndustry: '', targetGroup: '', customTargetGroup: '',
    style: '专业', customStyle: '', durationMode: 'preset', duration: '60秒', customDuration: '', profile, positioningContent: C ?? P ?? null, scriptStructure: 'auto', hookType: 'auto',
    boomElements: [], directorThoughts: ['emotion', 'picture'], tactic: 'auto', openingLine: '', openingCard: '', productInfo: '', priceInfo: '', scene: '室内', device: '手机',
    budget: '低成本(0-500)', personnel: '一人', accountPositioning: P ?? '', additionalInfo: '', dealReasons: [], originContent: T ?? '', focusContent: '', currentSettings: {},
  } as never);
  const S = await runNode(ind, '10-脚本', String(scriptQ), '脚本');
  // 11 分镜（以脚本为底）
  S && await runNode(ind, '11-分镜', buildStoryboardPrompt({ scriptContent: S, platform: '抖音', duration: '60秒', contentType: ind.storyboardType, visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '', contextBlock: summary }), '分镜');
  // 12 标题封面（以选题为主题）
  await runNode(ind, '12-标题封面', buildTitlePrompt({ topic: topicLine, titleTypeLabel: '痛点式', titleFormulaValue: 'number-action', titleFormulaLabel: '数字+动作', keywordStrategyLabel: '综合', keywordStrategyDesc: '标题和正文都自然带关键词', platform: '抖音', targetAudience: ind.name, count: 6, contextBlock: summary, sourceContent: S ?? topicLine } as never), '标题');
  // 13 开篇钩子
  await runNode(ind, '13-开篇钩子', buildOpeningPrompt({ contextBlock: summary, topic: topicLine, count: 3, intent: { purpose: '流量型', direction: '本地同城', userIntent: '' } } as never), '开篇');
  // 14 审稿（以脚本为待审稿件）
  S && await runNode(ind, '14-审稿', buildReviewBoardQuery({ creatorContext, currentSettings: {}, sourceReference: '', draftContent: S, platform: '抖音', effectiveDuration: '60秒', scriptType: 'show', personalRequirements: '', reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: true } as never).query, '审稿');
  // 15 跨行业二创（借一条外行的爆款文案）
  await runNode(ind, '15-跨行业二创', buildRemixPrompt({ kind: 'paste', text: ind.viralSample, title: '外行的一条爆款（虚构）', industry: '其他行业' }, { layers: DEFAULT_LAYERS, count: 3, differentiate: 'auto', depth: 'quick', role: 'same', duration: '跟原片', outputs: DEFAULT_OUTPUTS, profileSummary: summary, store: { name: ind.store.name, lines: [ind.store.features], track: ind.profile.account_track ? String((ind.profile.account_track as string[])[0]) : undefined }, contextBlock: summary } as never), '二创');
  // 16 拆解爆款（文案）
  await runNode(ind, '16-拆解爆款', buildTextBreakdownPrompt(ind.viralSample, summary, {} as never), '拆解');
  // 17 成交理由
  await runNode(ind, '17-成交理由', buildDealReasonPrompt({ accountContext: summary, storeName: ind.store.name, storeType: ind.store.type, storeFeatures: ind.store.features, targetCustomer: ind.store.customer }), '成交理由');
  // 18 对标分析
  await runNode(ind, '18-对标分析', buildBenchmarkQuery({ accountName: '同城同类账号（虚构样本）', platform: '抖音', materialLines: [ind.benchmarkSample], materialText: ind.benchmarkSample, contextBlock: summary }), '对标');
  // 19 前采提取
  await runNode(ind, '19-前采提取', buildExtractionPrompt(ind.interviewNotes), '前采');
}

it('全站体验测评：三行业 × 19 节点', { timeout: 14_400_000 }, async () => {
  if (!RUN && !DRY) return;
  fs.mkdirSync(OUT, { recursive: true });
  // 三个行业并行，行业内部按链路顺序
  await Promise.all(INDUSTRIES.map((ind) => chain(ind)));
  const failed = metas.filter((m) => !m.ok);
  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ total: metas.length, ok: metas.length - failed.length, failed }, null, 2), 'utf8');
  console.log(`done total=${metas.length} failed=${failed.length}`);
});
