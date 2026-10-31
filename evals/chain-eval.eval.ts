// 链路评测（2026-11-01，整改方案阶段 0.1、0.4）：按测评档案串联真实调用模型，每个节点出结果后马上量
// 「新出现的具体细节」（lib/noise-check）和「诱饵命中」（evals/fixtures/profiles），写进 metrics.jsonl。
//
// 环境变量：
//   CHAIN_REAL=1       真调用（不设就什么都不做）
//   EVAL_DRY=1         只构造提示词，不调模型
//   EVAL_OUT           输出目录（必填）
//   EVAL_PROFILES      档案编号，逗号分隔（如 A,B-s,C-a）；不设就是全部 36 个
//   EVAL_NODES         要真跑的节点，逗号分隔；不在名单里的节点读 EVAL_UPSTREAM 里上一轮的输出，没有就跳过
//   EVAL_UPSTREAM      上一轮输出目录（第二次采样时只重跑关键节点，上游沿用第一次）
//   EVAL_CONCURRENCY   同时跑几条链路，默认 3
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
import { decoyHits, pickIndustries, type EvalIndustry } from './fixtures/profiles';

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
const UPSTREAM = process.env.EVAL_UPSTREAM ?? '';
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? 3));

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
  if (DRY) {
    metas.push({ industry: ind.code, shape: ind.shape, node, ok: true, promptSha256: sha, promptChars: query.length, outChars: 0, ms: 0 });
    return 'DRY';
  }
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
    return null;
  }
  fs.writeFileSync(`${dir}/${node}.out.md`, text, 'utf8');
  metas.push({ industry: ind.code, shape: ind.shape, node, ok: true, promptSha256: sha, promptChars: query.length, outChars: text.length, ms });
  fs.appendFileSync(`${OUT}/meta.jsonl`, JSON.stringify(metas[metas.length - 1]) + '\n', 'utf8');
  writeMetrics(ind, node, text, materials, ms);
  return text;
}

/** 不在 EVAL_NODES 里的节点：读上一轮的输出；没有就跳过（返回 null） */
async function step(ind: EvalIndustry, node: string, query: () => string, _label: string, materials: string[]): Promise<string | null> {
  if (NODES && !NODES.has(node)) {
    const p = `${UPSTREAM}/${ind.code}/${node}.out.md`;
    return UPSTREAM && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  const taskType = TASK_TYPE[node];
  const built = query();
  const searchQuery = buildSearchQuery(taskType, { taskType }, built);
  return runNode(ind, node, withServerTail(ind, node, built), searchQuery, materials);
}

async function chain(ind: EvalIndustry) {
  const summary = buildProfileSummary(ind.profile as never);
  const profile = ind.profile as never;
  const mix = resolveMix(ind.profile, null, '');
  const mixBlock = mixPromptBlock(mix);
  const mixBlockCount = mixPromptBlock(mix, { count: 6 });
  const creatorContext = { profile, positioning: null, dealReasons: [] } as never;
  const storeText = `${ind.store.name} ${ind.store.type} ${ind.store.features} ${ind.store.customer}`;

  const P = await step(ind, '01-账号定位', () => buildPositioningPrompt({ profileSummary: summary, platform: '抖音', mixBlock }), '账号定位', [summary]);
  const B = P && await step(ind, '02-商业定位', () => buildPositioningPrompt({ profileSummary: summary, platform: '抖音', focus: 'business', baseline: P }), '商业定位', [summary, P]);
  const C = P && await step(ind, '03-内容定位', () => buildPositioningPrompt({ profileSummary: summary, platform: '抖音', focus: 'content', baseline: P, mixBlock }), '内容定位', [summary, P]);
  P && await step(ind, '04-创作简报', () => buildBriefPrompt({ positioningFull: P, profileSummary: summary, notes: '', businessPositioning: B ?? undefined, contentPositioning: C ?? undefined, mixBlock } as never), '创作简报', [summary, P, B ?? '', C ?? '']);
  await step(ind, '05-行业建议', () => buildIndustryAdvicePrompt({ profileSummary: summary, baseline: P ?? undefined, businessBaseline: B ?? undefined, contentBaseline: C ?? undefined, input: { purpose: 'traffic', stage: 'start', situation: '刚开始发，还没有数据', goal: '先让同城的人看到' } as never }), '行业建议', [summary, P ?? '', B ?? '', C ?? '', '刚开始发，还没有数据 先让同城的人看到']);
  await step(ind, '06-起号方案', () => buildGrowthPlanPrompt({ contextBlock: summary, contentPlan: C ?? undefined, notes: '', mixBlock } as never), '起号方案', [summary, C ?? '']);
  const CP = await step(ind, '07-内容规划', () => buildContentPlanPrompt({ lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '', resolved: mix, profileSummary: summary, industry: ind.name } as never), '内容规划', [summary]);
  const DR = await step(ind, '08-创作方向', () => buildDirectionPrompt({ purposes: DIRECTION_INPUT.purposes, formats: DIRECTION_INPUT.formats, mixBlock: mixBlockCount, count: 6, depth: 'quick', profileSummary: summary, contextBlock: [C, CP].filter(Boolean).join('\n\n'), industry: ind.name } as never), '创作方向', [summary, C ?? '', CP ?? '']);
  const T = DR && await step(ind, '09-选题', () => buildTopicBoardQuery({
    creatorContext, selectedProfile: profile, positioningForCtx: null, topicCount: 6, topicType: '流量型', topicRole: '按配比', mode: 'quick',
    sourceReference: DR.slice(0, 4000), sourceFrom: '创作方向', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '', personalRequirement: '',
    currentSettings: {}, accountStage: '起号期', fansLevel: '0-1000', avgViewsInput: '', selectedPlatforms: ['抖音'], selectedTracks: [], selectedContentTypes: [],
    selectedStyles: [], positioningExtra: '', selectedElements: [], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意',
    withHook: true, tactic: '', route: '两种都出', routeExplicit: false, resolvedMix: mix, quickTopics: true,
  } as never).query, '选题', [summary, DR]);
  const topicLine = (T?.match(/《([^》]{4,60})》/)?.[1]) ?? ind.topicPreset;
  const S = await step(ind, '10-脚本', () => String(buildScriptBoardQuery({
    topic: topicLine, platform: '抖音', scriptType: 'show', autoScriptType: false, effectiveRole: '流量型', isAd: false, industry: ind.name, customIndustry: '', targetGroup: '', customTargetGroup: '',
    style: '专业', customStyle: '', durationMode: 'preset', duration: '60秒', customDuration: '', profile, positioningContent: C ?? P ?? null, scriptStructure: 'auto', hookType: 'auto',
    boomElements: [], directorThoughts: ['emotion', 'picture'], tactic: 'auto', openingLine: '', openingCard: '', productInfo: '', priceInfo: '', scene: '室内', device: '手机',
    budget: '低成本(0-500)', personnel: '一人', accountPositioning: P ?? '', additionalInfo: '', dealReasons: [], originContent: T ?? '', focusContent: '', currentSettings: {},
  } as never)), '脚本', [summary, T ?? '', topicLine, C ?? P ?? '']);
  S && await step(ind, '11-分镜', () => buildStoryboardPrompt({ scriptContent: S, platform: '抖音', duration: '60秒', contentType: ind.storyboardType, visualStyle: 'bright', visualStyleLabel: '明亮', additionalInfo: '', contextBlock: summary }), '分镜', [summary, S]);
  await step(ind, '12-标题封面', () => buildTitlePrompt({ topic: topicLine, titleTypeLabel: '痛点式', titleFormulaValue: 'number-action', titleFormulaLabel: '数字+动作', keywordStrategyLabel: '综合', keywordStrategyDesc: '标题和正文都自然带关键词', platform: '抖音', targetAudience: ind.name, count: 6, contextBlock: summary, sourceContent: S ?? topicLine } as never), '标题', [summary, topicLine, S ?? '']);
  await step(ind, '13-开篇钩子', () => buildOpeningPrompt({ contextBlock: summary, topic: topicLine, count: 3, intent: { purpose: '流量型', direction: '本地同城', userIntent: '' } } as never), '开篇', [summary, topicLine]);
  S && await step(ind, '14-审稿', () => buildReviewBoardQuery({ creatorContext, currentSettings: {}, sourceReference: '', draftContent: S, platform: '抖音', effectiveDuration: '60秒', scriptType: 'show', personalRequirements: '', reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false, severityLabels: true } as never).query, '审稿', [summary, S]);
  await step(ind, '15-跨行业二创', () => buildRemixPrompt({ kind: 'paste', text: ind.viralSample, title: '外行的一条爆款（虚构）', industry: '其他行业' }, { layers: DEFAULT_LAYERS, count: 3, differentiate: 'auto', depth: 'quick', role: 'same', duration: '跟原片', outputs: DEFAULT_OUTPUTS, profileSummary: summary, store: { name: ind.store.name, lines: [ind.store.features], track: Array.isArray(ind.profile.account_track) ? String((ind.profile.account_track as string[])[0]) : undefined }, contextBlock: summary } as never), '二创', [summary, ind.viralSample, storeText]);
  await step(ind, '16-拆解爆款', () => buildTextBreakdownPrompt(ind.viralSample, summary, {} as never), '拆解', [summary, ind.viralSample]);
  await step(ind, '17-成交理由', () => buildDealReasonPrompt({ accountContext: summary, storeName: ind.store.name, storeType: ind.store.type, storeFeatures: ind.store.features, targetCustomer: ind.store.customer }), '成交理由', [summary, storeText]);
  await step(ind, '18-对标分析', () => buildBenchmarkQuery({ accountName: '同城同类账号（虚构样本）', platform: '抖音', materialLines: [ind.benchmarkSample], materialText: ind.benchmarkSample, contextBlock: summary }), '对标', [summary, ind.benchmarkSample]);
  if (ind.interviewNotes) await step(ind, '19-前采提取', () => buildExtractionPrompt(ind.interviewNotes), '前采', [ind.interviewNotes]);
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
  fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ total: metas.length, ok: metas.length - failed.length, failed }, null, 2), 'utf8');
  console.log(`done total=${metas.length} failed=${failed.length}`);
});
