// 链路评测（2026-11-01，整改方案阶段 0.1、0.4）：按测评档案串联真实调用模型，每个节点出结果后马上量
// 「新出现的具体细节」（lib/noise-check）和「诱饵命中」（evals/fixtures/profiles），写进 metrics.jsonl。
//
// 环境变量：
//   CHAIN_REAL=1       真调用（不设就什么都不做）
//   EVAL_DRY=1         只构造提示词，不调模型
//   EVAL_OUT           输出目录（必填）
//   EVAL_PROFILES      档案编号，逗号分隔（如 A,B-s,C-a）；不设就是全部 36 个
//   EVAL_NODES         要真跑的节点，逗号分隔；不在名单里的节点读 EVAL_UPSTREAM 里上一轮的输出，没有就跳过
//   EVAL_UPSTREAM      上一轮输出目录（第二次采样时只重跑关键节点，上游沿用第一次）；可以写几个，逗号分隔，按顺序找
//                      （新旧对照时：前面放这一版自己的上游，后面放基线）
//   EVAL_CONCURRENCY   同时跑几条链路，默认 3
//   EVAL_SCRIPT_TYPE   脚本按「直接在脚本页输入主题、手选脚本类型」写（teach / show / discuss / story），
//                      不带选题正文和创作方向；不设就是从选题带过去（线上最常见的那条路）
// 用法：npx vitest run --config vitest.eval.config.ts evals/chain-eval.eval.ts
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
import { mixPromptBlock, resolveMix } from '@/lib/content-mix';
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
import { noiseReport } from '@/lib/noise-check';
import { buildSearchQuery } from '@/lib/search-query';
import { timeAnchor } from '@/lib/time-anchor';
import { profileFactsBlock, factGuardTail, userDonts } from '@/lib/fact-guard';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { mergeCreationSettings, scriptFormOfTopic } from '@/lib/creation-settings';
import { continuationRules } from '@/lib/creation-continuation';
import { tacticOfRoute, topicRouteOf } from '@/lib/script-route';
import { AUTO_TACTIC } from '@/lib/creative-routes';
import { defaultRoleOfScriptType } from '@/lib/content-roles';
import { decoyHits, pickIndustries, type EvalIndustry } from './fixtures/profiles';
import { nodeMaterials, topicSections, type MaterialContext } from './materials';

/** 节点对应线上的任务类型：检索词用线上同一个函数算（lib/search-query），知识库召回才和线上一致 */
const TASK_TYPE: Record<string, string> = {
  '01-账号定位': '账号定位', '02-商业定位': '商业定位', '03-内容定位': '内容定位', '04-创作简报': '创作简报', '05-行业建议': '行业建议',
  '06-起号方案': '起号方案', '07-内容规划': '内容规划', '08-创作方向': '创作方向', '09-选题': '选题策划', '10-脚本': '脚本生成',
  '11-分镜': '分镜脚本', '12-标题封面': '标题封面', '13-开篇钩子': '开篇钩子', '14-审稿': '审稿优化', '15-跨行业二创': '跨行业二创',
  '16-拆解爆款': '拆解爆款', '17-成交理由': '成交理由', '18-对标分析': '对标拆解', '19-前采提取': '前采建档',
};

/**
 * 线上服务端在页面拼好的提示词后面还会补几段（app/api/dify/stream/route.ts）：时间锚、档案关键事实、「别把设想写成真事」。
 * 评测直接调模型，不经过那条路由，所以这里照同样的顺序补上，提示词才和线上一致。前采建档不加护栏（同线上）。
 * 不包括生成后的后检（事实修正、细节核查等）：基线量的是生成本身。
 */
function withServerTail(ind: EvalIndustry, node: string, query: string): string {
  let q = query;
  if (!/今天是\s*\d{4}\s*年/.test(q)) q += '\n\n' + timeAnchor();
  if (node === '19-前采提取') return q;
  return q + profileFactsBlock(ind.profile as never) + factGuardTail(userDonts([]));
}

const RUN = !!process.env.CHAIN_REAL;
const DRY = !!process.env.EVAL_DRY;
const ROOT = 'E:/小宋/腾讯云生产版同步_20260918';
const OUT = process.env.EVAL_OUT ?? '';
const NODES = process.env.EVAL_NODES ? new Set(process.env.EVAL_NODES.split(',').map((s) => s.trim())) : null;
const UPSTREAMS = (process.env.EVAL_UPSTREAM ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const UPSTREAM = UPSTREAMS.join(',');
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? 3));
/** 续跑：本次输出目录里已经成功的节点直接沿用，不再调用（补跑失败的那部分用） */
const RESUME = !!process.env.EVAL_RESUME;
const DIRECT_TYPE = process.env.EVAL_SCRIPT_TYPE ?? '';
/**
 * 熔断（2026-11-01）：连续失败这么多次就不再发新请求。
 * 评测和线上共用同一个模型账户，余额用完时每次都会失败；不停下来只会白跑，还看不出原因。
 */
const HALT_AFTER = 3;
let consecutiveFailures = 0;
let halted = false;

const env = fs.readFileSync(`${ROOT}/.env.local`, 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

/** 创作方向的目的和形式：必须用 lib/direction 的合法 ID；按行业大类给 */
const DIRECTION_INPUT = { purposes: ['store', 'trust'], formats: ['process', 'teach'] };

const now = new Date();
const TODAY = `今天是${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

type Meta = { industry: string; shape: string; node: string; ok: boolean; promptSha256: string; promptChars: number; outChars: number; ms: number; error?: string };
const metas: Meta[] = [];

/** 每个节点出结果后：新出现的具体细节、诱饵命中、占位数 */
function writeMetrics(ind: EvalIndustry, node: string, text: string, materials: string[], ms: number) {
  const r = noiseReport(text, [...materials, TODAY]);
  const decoys = decoyHits(text, ind.decoys);
  const row = {
    industry: ind.code, shape: ind.shape, node, chars: text.length, ms,
    novel: r.novel.length, novelByKind: r.byKind, novelSamples: r.novel.slice(0, 12).map((s) => s.text),
    decoys, placeholders: (text.match(/【待确认/g) || []).length,
  };
  fs.writeFileSync(`${OUT}/${ind.code}/${node}.metrics.json`, JSON.stringify(row, null, 2), 'utf8');
  fs.appendFileSync(`${OUT}/metrics.jsonl`, JSON.stringify(row) + '\n', 'utf8');
}

async function runNode(ind: EvalIndustry, node: string, query: string, searchQuery: string, materials: string[]): Promise<string | null> {
  const dir = `${OUT}/${ind.code}`;
  fs.mkdirSync(dir, { recursive: true });
  const started = Date.now();
  const sha = createHash('sha256').update(query).digest('hex');
  fs.writeFileSync(`${dir}/${node}.prompt.txt`, query, 'utf8');
  // 检索词也存下来：新旧对照重发时（evals/ab-replay.eval.ts）要和线上一样的知识库召回
  fs.writeFileSync(`${dir}/${node}.search.txt`, searchQuery, 'utf8');
  if (DRY) {
    metas.push({ industry: ind.code, shape: ind.shape, node, ok: true, promptSha256: sha, promptChars: query.length, outChars: 0, ms: 0 });
    return 'DRY';
  }
  if (halted) return null;
  let text: string | null = null;
  let error = '';
  for (let attempt = 1; attempt <= 3 && text === null; attempt++) {
    try {
      const res = await askDify(query, `chain-eval-${ind.code}`, searchQuery);
      if (res.ok) text = res.text;
      else error = res.message;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    if (text === null) await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  const ms = Date.now() - started;
  if (text === null) {
    metas.push({ industry: ind.code, shape: ind.shape, node, ok: false, promptSha256: sha, promptChars: query.length, outChars: 0, ms, error });
    fs.appendFileSync(`${OUT}/meta.jsonl`, JSON.stringify(metas[metas.length - 1]) + '\n', 'utf8');
    consecutiveFailures += 1;
    if (consecutiveFailures >= HALT_AFTER && !halted) {
      halted = true;
      console.log(`[熔断] 连续失败 ${consecutiveFailures} 次（最近一次：${error}），不再发新请求`);
    }
    return null;
  }
  consecutiveFailures = 0;
  fs.writeFileSync(`${dir}/${node}.out.md`, text, 'utf8');
  metas.push({ industry: ind.code, shape: ind.shape, node, ok: true, promptSha256: sha, promptChars: query.length, outChars: text.length, ms });
  fs.appendFileSync(`${OUT}/meta.jsonl`, JSON.stringify(metas[metas.length - 1]) + '\n', 'utf8');
  writeMetrics(ind, node, text, materials, ms);
  return text;
}

/** 不在 EVAL_NODES 里的节点：读上一轮的输出；没有就跳过（返回 null） */
async function step(ind: EvalIndustry, node: string, query: () => string, ctx: MaterialContext): Promise<string | null> {
  if (NODES && !NODES.has(node)) {
    const p = UPSTREAMS.map((d) => `${d}/${ind.code}/${node}.out.md`).find((f) => fs.existsSync(f));
    return p ? fs.readFileSync(p, 'utf8') : null;
  }
  if (RESUME) {
    const done = `${OUT}/${ind.code}/${node}.out.md`;
    if (fs.existsSync(done)) return fs.readFileSync(done, 'utf8');
  }
  const taskType = TASK_TYPE[node];
  const built = query();
  const searchQuery = buildSearchQuery(taskType, { taskType }, built);
  return runNode(ind, node, withServerTail(ind, node, built), searchQuery, nodeMaterials(node, ctx));
}

async function chain(ind: EvalIndustry) {
  const summary = buildProfileSummary(ind.profile as never);
  const profile = ind.profile as never;
  const mix = resolveMix(ind.profile, null, '');
  const mixBlock = mixPromptBlock(mix);
  const mixBlockCount = mixPromptBlock(mix, { count: 6 });
  const creatorContext = { profile, positioning: null, dealReasons: [] } as never;
  const storeText = `${ind.store.name} ${ind.store.type} ${ind.store.features} ${ind.store.customer}`;
  const base: MaterialContext = { summary, mixBlock, mixBlockCount, storeText, viralSample: ind.viralSample, benchmarkSample: ind.benchmarkSample, interviewNotes: ind.interviewNotes, adviceInput: '刚开始发，还没有数据 先让同城的人看到' };

  const P = await step(ind, '01-账号定位', () => buildPositioningPrompt({ profileSummary: summary, platform: '抖音', mixBlock }), base);
  const B = P && await step(ind, '02-商业定位', () => buildPositioningPrompt({ profileSummary: summary, platform: '抖音', focus: 'business', baseline: P }), { ...base, P });
  const C = P && await step(ind, '03-内容定位', () => buildPositioningPrompt({ profileSummary: summary, platform: '抖音', focus: 'content', baseline: P, mixBlock }), { ...base, P });
  P && await step(ind, '04-创作简报', () => buildBriefPrompt({ positioningFull: P, profileSummary: summary, notes: '', businessPositioning: B ?? undefined, contentPositioning: C ?? undefined, mixBlock } as never), { ...base, P, B, C });
  await step(ind, '05-行业建议', () => buildIndustryAdvicePrompt({ profileSummary: summary, baseline: P ?? undefined, businessBaseline: B ?? undefined, contentBaseline: C ?? undefined, input: { purpose: 'traffic', stage: 'start', situation: '刚开始发，还没有数据', goal: '先让同城的人看到' } as never }), { ...base, P, B, C });
  await step(ind, '06-起号方案', () => buildGrowthPlanPrompt({ contextBlock: summary, contentPlan: C ?? undefined, notes: '', mixBlock } as never), { ...base, C });
  const CP = await step(ind, '07-内容规划', () => buildContentPlanPrompt({ lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '', resolved: mix, profileSummary: summary, industry: ind.name } as never), base);
  const DR = await step(ind, '08-创作方向', () => buildDirectionPrompt({ purposes: DIRECTION_INPUT.purposes, formats: DIRECTION_INPUT.formats, mixBlock: mixBlockCount, count: 6, depth: 'quick', profileSummary: summary, contextBlock: [C, CP].filter(Boolean).join('\n\n'), industry: ind.name } as never), { ...base, C, CP });
  const T = DR && await step(ind, '09-选题', () => buildTopicBoardQuery({
    // topicType 和线上选题页一样按 topicRole 算（app/dashboard/topic/page.tsx）；2026-11-01 之前写死成「流量型」，
    // 提示词第一行变成「生成6条流量型」，和配比、创作方向互相打架，模型偶尔直接反问不出稿
    creatorContext, selectedProfile: profile, positioningForCtx: null, topicCount: 6, topicType: '选题（流量型、人设型、变现型按配比搭配）', topicRole: '按配比', mode: 'quick',
    sourceReference: DR.slice(0, 4000), sourceFrom: '创作方向', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '', personalRequirement: '',
    currentSettings: {}, accountStage: '起号期', fansLevel: '0-1000', avgViewsInput: '', selectedPlatforms: ['抖音'], selectedTracks: [], selectedContentTypes: [],
    selectedStyles: [], positioningExtra: '', selectedElements: [], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意',
    withHook: true, tactic: '', route: '两种都出', routeExplicit: false, resolvedMix: mix, quickTopics: true,
  } as never).query, { ...base, DR });
  /*
   * 选题 → 脚本按线上的交接来（app/dashboard/topic/page.tsx 的 sendTopic、app/dashboard/script/page.tsx 的生成）：
   * 只带第一条选题（标题、正文、它标的那一计），脚本类型、目的从这条选题读，没写就自动判断；时长 AI 推荐。
   * 2026-11-01 之前的评测主题落到了档案的预设题目、带的是整份选题、脚本类型写死成晒过程，三者互相冲突。
   */
  const pick = topicSections(T)[0];
  const topicLine = pick?.title || ind.topicPreset;
  const topicBody = pick?.body ?? '';
  const form = scriptFormOfTopic(topicBody);
  const tactic = tacticOfRoute(topicRouteOf(topicBody)) || AUTO_TACTIC;
  const autoScriptType = !form.scriptType || tactic !== AUTO_TACTIC;
  const handoff = buildCreationHandoff('topic', 'script', topicBody || topicLine, { topic: topicLine, settings: mergeCreationSettings({}, { topic: topicLine, ...form }), originContent: DR ?? '' });
  // 脚本页的默认值：表达重点默认勾着「emotion」「picture」（app/dashboard/script/page.tsx）；2026-11-01 之前评测传的是空
  const scriptBase = {
    topic: topicLine, platform: '抖音', isAd: false, industry: ind.name, customIndustry: '', targetGroup: '', customTargetGroup: '',
    style: '', customStyle: '', durationMode: 'ai', duration: '60秒', customDuration: '', profile, scriptStructure: 'auto', hookType: 'auto',
    boomElements: [], directorThoughts: ['emotion', 'picture'], openingLine: '', openingCard: '', productInfo: '', priceInfo: '', scene: '', device: '',
    budget: '', personnel: '', accountPositioning: P ?? '', dealReasons: [], focusContent: '', currentSettings: {},
  };
  const S = await step(ind, '10-脚本', () => DIRECT_TYPE
    // 直接在脚本页输入主题、手选类型：不带选题正文和创作方向，目的按类型的默认值（页面「自动」时），页面不补尾巴
    ? String(buildScriptBoardQuery({ ...scriptBase, scriptType: DIRECT_TYPE, autoScriptType: false, effectiveRole: defaultRoleOfScriptType(DIRECT_TYPE), tactic: AUTO_TACTIC, additionalInfo: '', originContent: '' } as never))
    : String(buildScriptBoardQuery({
      ...scriptBase, scriptType: form.scriptType ?? 'show', autoScriptType, effectiveRole: form.purpose ?? '流量型', tactic, additionalInfo: handoff.note ?? '', originContent: DR ?? '',
    } as never))
    // 页面在提示词后面再补的几段（同 app/dashboard/script/page.tsx 生成时的 query 拼接）
    + (DR ? continuationRules('script') : '')
    + (form.purpose ? '' : '\n【自动目的的执行原则】前文按脚本类型推荐的目的、结构、结尾只是候选，不能据此修改原始用户想法。先从完整原意确定本条目的与行动指令；混合目的完整保留，不强行归成单一类型。不因页面默认、商业档案或广告模板把大众流量/人设内容改成获客促销。')
    + (autoScriptType ? '\n【本轮脚本类型自动决策（覆盖前文候选模板）】用户没有选择脚本类型，页面教知识模板及其教学步骤、示例只供参考，不是用户指令。先判断这次带来的内容究竟是观点讨论、过程展示、真实故事还是知识教学，选最贴合原意的一种并标注实际类型。讨论类选聊话题，不能硬写成教知识教程、创业指南或广告。根据原意确定结构、结尾与开篇，不强行套前文的教知识公式。' : ''),
  DIRECT_TYPE ? { ...base, topicLine, C, P } : { ...base, T, DR, topicLine, topicBody, C, P });
  S && await step(ind, '11-分镜', () => buildStoryboardPrompt({ scriptContent: S, platform: '抖音', duration: '60秒', contentType: ind.storyboardType, visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '', contextBlock: summary }), { ...base, S });
  await step(ind, '12-标题封面', () => buildTitlePrompt({ topic: topicLine, titleTypeLabel: '痛点式', titleFormulaValue: 'number-action', titleFormulaLabel: '数字+动作', keywordStrategyLabel: '综合', keywordStrategyDesc: '标题和正文都自然带关键词', platform: '抖音', targetAudience: ind.name, count: 6, contextBlock: summary, sourceContent: S ?? topicLine } as never), { ...base, topicLine, S });
  await step(ind, '13-开篇钩子', () => buildOpeningPrompt({ contextBlock: summary, topic: topicLine, count: 3, intent: { purpose: '流量型', direction: '本地同城', userIntent: '' } } as never), { ...base, topicLine });
  S && await step(ind, '14-审稿', () => buildReviewBoardQuery({ creatorContext, currentSettings: {}, sourceReference: '', draftContent: S, platform: '抖音', effectiveDuration: '60秒', scriptType: 'show', personalRequirements: '', reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: true } as never).query, { ...base, S });
  await step(ind, '15-跨行业二创', () => buildRemixPrompt({ kind: 'paste', text: ind.viralSample, title: '外行的一条爆款（虚构）', industry: '其他行业' }, { layers: DEFAULT_LAYERS, count: 3, differentiate: 'auto', depth: 'quick', role: 'same', duration: '跟原片', outputs: DEFAULT_OUTPUTS, profileSummary: summary, store: { name: ind.store.name, lines: [ind.store.features], track: Array.isArray(ind.profile.account_track) ? String((ind.profile.account_track as string[])[0]) : undefined }, contextBlock: summary } as never), base);
  await step(ind, '16-拆解爆款', () => buildTextBreakdownPrompt(ind.viralSample, summary, {} as never), base);
  await step(ind, '17-成交理由', () => buildDealReasonPrompt({ accountContext: summary, storeName: ind.store.name, storeType: ind.store.type, storeFeatures: ind.store.features, targetCustomer: ind.store.customer }), base);
  await step(ind, '18-对标分析', () => buildBenchmarkQuery({ accountName: '同城同类账号（虚构样本）', platform: '抖音', materialLines: [ind.benchmarkSample], materialText: ind.benchmarkSample, contextBlock: summary }), base);
  if (ind.interviewNotes) await step(ind, '19-前采提取', () => buildExtractionPrompt(ind.interviewNotes), base);
}

/** 限制并发：同时跑 CONCURRENCY 条链路，行业内部按顺序 */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

it('链路评测：测评档案 × 节点', { timeout: 14_400_000 }, async () => {
  if (!RUN && !DRY) return;
  if (!OUT) throw new Error('请设置 EVAL_OUT');
  fs.mkdirSync(OUT, { recursive: true });
  const picked = pickIndustries(process.env.EVAL_PROFILES);
  fs.writeFileSync(`${OUT}/run.json`, JSON.stringify({ at: now.toISOString(), profiles: picked.map((p) => p.code), nodes: NODES ? [...NODES] : 'all', upstream: UPSTREAM || null, concurrency: CONCURRENCY }, null, 2), 'utf8');
  await pool(picked, CONCURRENCY, chain);
  const failed = metas.filter((m) => !m.ok);
  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ total: metas.length, ok: metas.length - failed.length, failed, halted }, null, 2), 'utf8');
  console.log(`done total=${metas.length} failed=${failed.length}${halted ? '（已熔断）' : ''}`);
});
