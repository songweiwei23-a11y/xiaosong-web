// 开物多轮质量评测（真实路由 + 真实 Dify + 真实档案只读）。
//   npx vitest run -c .tmp/quality-eval/vitest.config.ts
// 环境变量：EVAL_ROUNDS（默认 3）、EVAL_CASES（逗号分隔的用例 id，默认全部）
//
// 与线上的差别（会写进报告）：
//   - 额度扣减、共用会话、历史存档全部替换成空操作，不改用户的任何数据；每次都是新会话
//   - 页面端的部分上下文（成交理由、创作简报、作品数据）没有带入，只带档案和定位
//   - 脚本、选题的提示词按页面结构复刻，不是逐字复制页面代码
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { buildContextBlock } from '@/lib/creator-context';
import { buildProfileSummary, businessLines } from '@/lib/profile-summary';
import { creationSettingsBlock } from '@/lib/creation-settings';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildRemixPrompt } from '@/lib/remix';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildOpeningPrompt } from '@/lib/growth-standards';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildDealReasonPrompt } from '@/lib/deal-reasons';
import { continuationRules } from '@/lib/creation-continuation';

const state = vi.hoisted(() => ({ owner: '' }));

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: state.owner }),
  requireUserWithQuota: async () => ({ ok: true, userId: state.owner }),
  incrementUsageServer: async () => {},
}));
vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: async () => ({ ok: true, reservation: { userId: state.owner, feature: 'script', requestId: 'quality-eval' } }),
  releaseCreation: async () => {},
  recordCreationCompletion: async () => {},
  completionUsage: () => ({}),
}));
vi.mock('@/lib/dify-conversation', () => ({
  getDifyConversationId: async () => null,
  saveDifyConversationId: async () => {},
  clearDifyConversationId: async () => {},
  isInvalidConversationError: () => false,
}));

const OUT = path.join('.tmp', 'quality-eval', 'out');
fs.mkdirSync(OUT, { recursive: true });
const ROUNDS = Number(process.env.EVAL_ROUNDS || 3);
const ONLY = (process.env.EVAL_CASES || '').split(',').map((s) => s.trim()).filter(Boolean);

/** 页面看到的正文：answer 追加，message_replace 整篇替换（与 lib/sse-stream.ts 一致） */
function shownAfterStream(events: any[]): string {
  let shown = '';
  for (const e of events) {
    if (e.event === 'message_replace') shown = e.answer;
    else if (e.event === undefined && typeof e.answer === 'string') shown += e.answer;
  }
  return shown;
}

async function loadFixture() {
  const { getServiceSupabase } = await import('@/lib/admin-auth');
  const db = getServiceSupabase();
  const { data, error } = await db.from('user_profiles').select('*');
  if (error) throw error;
  const row = (data as any[]).find((r) => String(r.id).startsWith('74586841'));
  if (!row) throw new Error('找不到测试档案');
  const { data: pos } = await db.from('account_positioning').select('*').eq('profile_id', row.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1);
  const p = (pos as any[] | null)?.[0];
  const positioning = p ? { name: String(p.positioning_name ?? ''), summary: String(p.strategy_summary || p.positioning_description || ''), full: String(p.full_content || '') } : null;
  const ctx: any = { profile: row, positioning, dealReasons: [] };
  // 最近一条线上「创作方向」的输入（同一份想法、补充要求、目的），用来复现用户遇到的问题
  const { data: dir } = await db.from('script_history').select('input_data,created_at').eq('user_id', row.user_id).eq('task_type', '创作方向').order('created_at', { ascending: false }).limit(1);
  const dirInput = (dir as any[] | null)?.[0]?.input_data ?? null;
  // 最近一条线上「开篇钩子」的输入（选题的主题、设置、参考正文），用来复现「局外人口吻」的问题
  const { data: op } = await db.from('script_history').select('input_data,created_at').eq('user_id', row.user_id).eq('task_type', '开篇钩子').order('created_at', { ascending: false }).limit(1);
  const openingInput = (op as any[] | null)?.[0]?.input_data ?? null;
  return { row, ctx, positioning, owner: String(row.user_id), dirInput, openingInput };
}

const BREAKDOWN_SOURCE = `原片：健身教练「练了一年还是这个体型」纠错视频（拆解）
结构：开场反问「你是不是练了一年还是这个体型？」→ 指出最常见的一个错误动作 → 现场示范错误与正确的对比 → 给一个可以马上做的改法 → 结尾引导评论区留言领取计划
开篇句式：反问 + 否定旧认知，第一句就点出观众自己的处境
节奏：每 3-4 秒切一次景别；正反对比用左右分屏
出镜：教练本人口播，站在器械前，背景是灯光下的健身房
原片公开数据：播放约 120 万，评论里有大量「我也是这样」`;

interface CaseDef {
  id: string;
  label: string;
  build: (f: Awaited<ReturnType<typeof loadFixture>>) => { query: string; body: Record<string, unknown>; extraSource: string };
}

const SCRIPT_REQ = (topic: string, extra = '') =>
  `\n\n## 本条任务\n- 平台：抖音\n- 时长：30 秒\n- 主题：${topic}\n- 目的：到店引流，同时让人记住这家店\n\n请写一条可以直接拍摄、照着念的口播脚本。分为 ## 开头、## 正文、## 结尾 三节；只写台词和必要的画面提示；开头 3 秒要让人停下来。${extra}`;

const CASES: CaseDef[] = [
  {
    id: 'title', label: '标题封面（5 个）',
    build: ({ ctx }) => {
      const settings = { titleCount: 5 };
      const query = buildTitlePrompt({
        topic: '一元串串火锅：第一次来怎么点不踩坑',
        titleTypeLabel: '痛点式', titleFormulaValue: 'pain-solution', titleFormulaLabel: '痛点+解决方案',
        keywordStrategyLabel: '搜索词', keywordStrategyDesc: '高搜索量',
        platform: '抖音', targetAudience: '附近的学生和上班族，想吃得便宜又好吃',
        count: 5, contextBlock: buildContextBlock(ctx, 'title') + creationSettingsBlock(settings),
        openingCards: [], sourceContent: '',
      });
      return { query, body: { taskType: '标题封面', creationSettings: settings, platform: '抖音', titleType: '痛点式' }, extraSource: '' };
    },
  },
  {
    id: 'script', label: '脚本生成（30 秒）',
    build: ({ ctx }) => ({
      query: `${buildContextBlock(ctx, 'script')}${SCRIPT_REQ('一元串串火锅：老板现场教你挑签子、看锅底')}`,
      body: { taskType: '脚本生成', creationSettings: { audience: '附近的上班族和学生', duration: '30秒', purpose: '到店引流' } },
      extraSource: '',
    }),
  },
  {
    id: 'topic', label: '选题策划（10 条）',
    build: ({ ctx }) => ({
      query: `【工作任务】生成10条选题\n\n${buildContextBlock(ctx, 'topic')}\n\n平台：抖音。每条给出：选题标题、拍摄角度（一句话）、为什么会有人看（一句话）。10 条的角度要分开，不要重复，不要只换说法。只用档案里有的事实，不编顾客故事、价格、销量。`,
      body: { taskType: '选题策划', creationSettings: {} },
      extraSource: '',
    }),
  },
  {
    id: 'review', label: '审稿优化（原稿带未核实说法）',
    build: ({ ctx }) => {
      const draft = `【开场】0-3秒 老板：我们是全城最正宗的川味串串，一元一串！
【中段】3-15秒 台词：我在这条街干了18年，每天卖3000串，老顾客都说比别家强。
【结尾】15-30秒 台词：想吃的评论区留言，加微信领优惠。`;
      const query = buildReviewPrompt({
        draftContent: draft, platform: '抖音', duration: '30秒', scriptType: '晒过程型',
        reviewDimensions: '【开头吸引力】3秒钩子是否有力\n【事实依据】每个数字、经历、顾客反馈是否有档案依据',
        optimizationGoals: '去掉没有依据的说法，保留真实经营信息，提升开头吸引力',
        benchmarkScript: '', compareMode: true, severityLabels: true,
        contextBlock: buildContextBlock(ctx, 'review'),
        personalRequirements: '按档案核对原稿里的年限、销量和顾客反馈',
      } as Parameters<typeof buildReviewPrompt>[0]);
      return {
        query,
        body: { taskType: '审稿优化', creationSettings: {}, draftContent: draft, personalRequirements: '按档案核对原稿里的年限、销量和顾客反馈' },
        extraSource: '',
      };
    },
  },
  {
    id: 'remix', label: '跨行业二创（2 个方案）',
    build: ({ row, ctx }) => {
      const source = { kind: 'paste' as const, text: BREAKDOWN_SOURCE, title: '健身教练纠错视频', industry: '健身' };
      const query = buildRemixPrompt(source, {
        layers: ['opening', 'structure', 'presentation'], count: 2, differentiate: 'layer', depth: 'full',
        role: '流量型', duration: '30 秒', outputs: ['script', 'shots', 'shootPlan'],
        profileSummary: buildProfileSummary(row),
        store: { name: String(row.profile_name ?? ''), lines: businessLines(row), track: Array.isArray(row.account_track) ? row.account_track.join('、') : String(row.account_track ?? '') },
        contextBlock: buildContextBlock(ctx, 'remix') + creationSettingsBlock({}),
      } as Parameters<typeof buildRemixPrompt>[1]);
      return { query, body: { taskType: '跨行业二创', creationSettings: {}, historyInput: { count: 2 } }, extraSource: BREAKDOWN_SOURCE };
    },
  },
  {
    id: 'trap', label: '陷阱：没价格没故事却要求突出性价比和口碑',
    build: ({ ctx }) => ({
      query: `${buildContextBlock(ctx, 'script')}${SCRIPT_REQ('到店引流：突出性价比和顾客口碑', '档案里没有价格，也没有具体顾客的故事；不要编价格和顾客原话。')}`,
      body: { taskType: '脚本生成', creationSettings: { audience: '附近的上班族和学生', duration: '30秒', purpose: '到店引流' } },
      extraSource: '',
    }),
  },
  {
    id: 'direction', label: '创作方向（复现：想法写了秋天）',
    build: ({ row, ctx, dirInput }) => {
      const d = (dirInput ?? {}) as Record<string, any>;
      const cs = (d.creationSettings ?? {}) as Record<string, unknown>;
      const query = buildDirectionPrompt({
        purposes: Array.isArray(d.purposes) ? d.purposes : [],
        customGoal: typeof d.customGoal === 'string' ? d.customGoal : '',
        ideas: typeof d.ideas === 'string' ? d.ideas : '',
        formats: Array.isArray(d.formats) ? d.formats : [],
        onCamera: d.onCamera, capacity: d.capacity, horizon: d.horizon,
        count: Number(d.count) || 5, depth: d.depth === 'quick' ? 'quick' : 'full',
        profileSummary: buildProfileSummary(row),
        contextBlock: buildContextBlock(ctx, 'direction'),
      } as Parameters<typeof buildDirectionPrompt>[0]);
      return { query, body: { taskType: '创作方向', creationSettings: cs }, extraSource: JSON.stringify(d) };
    },
  },
  ...(['30秒', 'AI推荐'] as const).map((dur): CaseDef => ({
    id: dur === 'AI推荐' ? 'scriptPlanAI' : 'scriptPlan30',
    label: dur === 'AI推荐' ? '脚本（AI 推荐，未设时长）' : '脚本（编导设了 30 秒）',
    build: ({ ctx }) => {
      const settings = dur === 'AI推荐' ? {} : { duration: dur };
      const query = buildAdaptiveScriptPrompt({
        topic: '一元串串火锅：老板现场教你挑签子、看锅底',
        platform: '抖音', duration: dur, context: buildContextBlock(ctx, 'script'), source: '一元串串火锅：老板现场教你挑签子、看锅底',
        requirements: '', settings,
      });
      return { query, body: { taskType: '脚本生成', creationSettings: settings }, extraSource: '' };
    },
  })),
  {
    id: 'storyboard', label: '分镜（输入：30 秒脚本）',
    build: ({ ctx }) => {
      // 分镜的输入是上一步脚本的正文：用这次评测里编导设了 30 秒的脚本第 2 步之前的全文
      const scriptContent = fs.readFileSync(path.join(OUT, 'r1-scriptPlan30.md'), 'utf8').replace(/^# .*\n/, '');
      const query = buildStoryboardPrompt({
        scriptContent, platform: '抖音', duration: '30秒', contentType: 'food', visualStyle: 'cinematic', visualStyleLabel: '电影感',
        additionalInfo: '', contextBlock: buildContextBlock(ctx, 'storyboard'),
      });
      return { query, body: { taskType: '分镜脚本', creationSettings: { duration: '30秒' } }, extraSource: scriptContent };
    },
  },
  {
    id: 'dealReason', label: '成交理由（17 条判断）',
    build: ({ row, ctx }) => {
      const query = buildDealReasonPrompt({
        accountContext: buildContextBlock(ctx, 'dealReason'),
        storeName: String(row.profile_name ?? ''),
        storeType: '地摊 · 川味串串火锅 / 川味烧烤 / 川菜',
        storeFeatures: [row.unique_selling_point, row.competitive_advantage].filter(Boolean).join('；'),
        targetCustomer: '附近上班族和学生，想吃得便宜又好吃',
      });
      return { query, body: { taskType: '成交理由', topic: query, creationSettings: {} }, extraSource: '' };
    },
  },
  {
    id: 'opening', label: '开篇钩子（复现：局外人口吻）',
    build: ({ ctx, openingInput }) => {
      const d = (openingInput ?? {}) as Record<string, any>;
      const cs = (d.creationSettings ?? {}) as Record<string, any>;
      // 与页面一致：contextBlock + 设置块；参考正文单独附在后面（growth 页 genOpening）
      const query = buildOpeningPrompt({
        contextBlock: buildContextBlock(ctx, 'script') + creationSettingsBlock(cs),
        topic: String(d.topic ?? ''),
        currentOpening: typeof d.currentOpening === 'string' ? d.currentOpening : undefined,
        picked: Array.isArray(d.picked) && d.picked.length ? d.picked : undefined,
        intent: { purpose: cs.purpose, purposeText: cs.purposeText, direction: cs.direction, userIntent: cs.userIntent },
      }) + (typeof d.referenceContent === 'string' && d.referenceContent.trim() ? `\n【已有创作参考】\n${d.referenceContent}${continuationRules('growth')}` : '');
      return { query, body: { taskType: '开篇钩子', creationSettings: cs }, extraSource: JSON.stringify(d) };
    },
  },
];

interface Obs {
  status: number;
  firstAnswerMs: number | null;
  totalMs: number;
  shown: string;
  errors: string[];
  answerEvents: number;
  replaceEvents: number;
  events: any[];
}

async function runRoute(body: Record<string, unknown>): Promise<Obs> {
  const { POST } = await import('@/app/api/dify/stream/route');
  const t0 = Date.now();
  const res = await POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify(body) }) as any);
  if (!res.ok || !res.body) {
    return { status: res.status, firstAnswerMs: null, totalMs: Date.now() - t0, shown: '', errors: [await res.text()], answerEvents: 0, replaceEvents: 0, events: [] };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const events: any[] = [];
  let firstAnswerMs: number | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (!block.startsWith('data:')) continue;
      const e = JSON.parse(block.slice(5));
      events.push({ ...e, _t: Date.now() - t0 });
      if (e.event === undefined && typeof e.answer === 'string' && e.answer && firstAnswerMs === null) firstAnswerMs = Date.now() - t0;
    }
  }
  return {
    status: res.status,
    firstAnswerMs,
    totalMs: Date.now() - t0,
    shown: shownAfterStream(events),
    errors: events.filter((e) => e.event === 'error').map((e) => String(e.message)),
    answerEvents: events.filter((e) => e.event === undefined && typeof e.answer === 'string').length,
    replaceEvents: events.filter((e) => e.event === 'message_replace').length,
    events,
  };
}

/** 确定性检查：只报事实线索，最终扣分以人工对照为准 */
function autoChecks(caseId: string, shown: string, allowed: string, userInput = '') {
  const issues: string[] = [];
  const metrics: Record<string, unknown> = {};
  const body = shown.trim();
  if (!body) issues.push('正文为空');
  if (/[【（(]$|\*\*$|[、，：]$/.test(body)) issues.push('结尾疑似截断');

  // 数字：带单位的数字必须在档案、定位或素材里出现过
  const normAllowed = allowed.replace(/\s+/g, '');
  const nums = [...body.matchAll(/[\d一二两三四五六七八九十百千万]+(?:\.\d+)?\s*(?:%|元|块|钱|年|个月|万|倍|串|斤|份|家|店|人|位|名|岁|折)/g)].map((m) => m[0].replace(/\s+/g, ''));
  const unsupportedNums = [...new Set(nums.filter((n) => !normAllowed.includes(n)))];
  if (unsupportedNums.length) issues.push(`数字无出处：${unsupportedNums.join('、')}`);

  // 顾客原话 / 采访式表述：素材里没有就是编的
  const quotes = [...body.matchAll(/(顾客|客人|老客|老顾客|食客|网友|粉丝|街坊)[^\n，。！？]{0,8}(说|问|留言|反馈|夸|评价|告诉)|我(问|采访|走访)了|老板[^\n，。]{0,4}(说|告诉我)/g)].map((m) => m[0]);
  const fakeQuotes = quotes.filter((q) => !allowed.includes(q.slice(0, 4)));
  if (fakeQuotes.length) issues.push(`疑似编造的顾客原话：${[...new Set(fakeQuotes)].join('、')}`);

  // 过度承诺的宣传词
  const promo = [...new Set([...body.matchAll(/最正宗|全城|全网|最好吃|第一家|绝对|100%|保证|稳赚|史上|零添加/g)].map((m) => m[0]))].filter((w) => !allowed.includes(w));
  if (promo.length) issues.push(`宣传词过度：${promo.join('、')}`);

  // 元信息 / 套话泄漏
  const meta = [...new Set([...body.matchAll(/交稿前|自查|校对报告|校对过程|以下是|好的[，,！]|希望对你有帮助|综上所述|（注|\(注|需要我/g)].map((m) => m[0]))];
  if (meta.length) issues.push(`元信息或套话：${meta.join('、')}`);

  if (caseId === 'title') {
    const heads = body.split('\n').filter((l) => /^\s*(?:#{1,4}\s*)?(?:标题\s*)?\d{1,2}[.、．:：)）]/.test(l));
    metrics.titleCount = heads.length;
    if (heads.length !== 5) issues.push(`标题数量 ${heads.length}，要求 5 个`);
    const titles = heads.map((l) => l.replace(/^\s*(?:#{1,4}\s*)?(?:标题\s*)?\d{1,2}[.、．:：)）]\s*/, '').replace(/\*\*/g, '').split(/——|—|\s{2,}/)[0].trim());
    metrics.titleLengths = titles.map((t) => t.length);
    const long = titles.filter((t) => t.length > 30);
    if (long.length) issues.push(`标题超过 30 字：${long.length} 个`);
  }
  if (caseId === 'script' || caseId === 'trap') {
    const spoken = body.split('\n').filter((l) => !/^\s*#/.test(l)).join('');
    const cjk = (spoken.match(/[一-鿿]/g) ?? []).length;
    metrics.spokenCjk = cjk;
    if (!/##\s*开头/.test(body) || !/##\s*正文/.test(body) || !/##\s*结尾/.test(body)) issues.push('缺少 开头/正文/结尾 三节');
    if (cjk < 60) issues.push(`台词偏少（${cjk} 字，30 秒约需 90 字以上）`);
    if (cjk > 220) issues.push(`台词偏多（${cjk} 字，30 秒最多约 150 字）`);
  }
  if (caseId === 'topic') {
    const items = body.split('\n').filter((l) => /^\s*(?:#{1,4}\s*)?(?:选题\s*)?\d{1,2}[.、．:：)）]|^\s*#{2,4}\s*选题\s*\d/.test(l));
    metrics.topicCount = items.length;
    if (items.length !== 10) issues.push(`选题数量 ${items.length}，要求 10 条`);
    const keys = items.map((l) => l.replace(/[\s#*（(]/g, '').slice(0, 14));
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dup.length) issues.push(`选题标题重复：${dup.length} 处`);
  }
  if (caseId === 'remix') {
    const plans = body.split('\n').filter((l) => /^\s*#{2,4}\s*方案\s*\d/.test(l));
    metrics.planCount = plans.length;
    if (plans.length !== 2) issues.push(`方案数量 ${plans.length}，要求 2 个`);
  }
  if (caseId === 'review') {
    metrics.hasScore = /\d(\.\d)?\s*分|得分|评分/.test(body);
    metrics.hasRewrite = /改写|优化后|完整脚本/.test(body);
    if (!metrics.hasScore) issues.push('没有给出评分');
    if (!metrics.hasRewrite) issues.push('没有给出改写或优化后的完整脚本');
  }
  if (caseId === 'scriptPlan30' || caseId === 'scriptPlanAI') {
    // 口播 = 第 2 步「纯文字文案」里的汉字（与提示词约定一致），不含镜头和标注
    const step2 = body.match(/第2步[\s\S]*?(?=第3步|$)/)?.[0] ?? '';
    const spoken = (step2.match(/[一-鿿]/g) ?? []).length;
    metrics.spokenCjk = spoken;
    metrics.step2Found = step2.length > 0;
    if (!step2) issues.push('没有第 2 步纯文字文案');
    if (caseId === 'scriptPlan30' && spoken > 170) issues.push(`编导设了 30 秒，口播 ${spoken} 字，超出约 150 字上限`);
    if (caseId === 'scriptPlanAI' && spoken < 60) issues.push(`口播只有 ${spoken} 字，偏少`);
  }
  if (caseId === 'opening') {
    // 旁观者口吻：用第三人称讲出镜人或这家店（应该是出镜人自己用「我」说）
    const outsider = [...body.matchAll(/这家老板|这个老板|这个师傅|老板干了|老板早就|老板说|他们店|这家地摊老板/g)].map((m) => m[0]);
    metrics.outsiderMarkers = outsider.length;
    metrics.firstPerson = (body.match(/我/g) ?? []).length;
    if (outsider.length) issues.push(`旁观者口吻 ${outsider.length} 处（如「${outsider[0]}」）`);
  }
  if (caseId === 'direction') {
    const plans = body.split('\n').filter((l) => /^\s*#{2,4}\s*方向\s*\d/.test(l));
    metrics.directionCount = plans.length;
    metrics.autumnMentions = (body.match(/秋/g) ?? []).length;
    metrics.winterMentions = (body.match(/冬/g) ?? []).length;
    // 只看用户这次输入里有没有「秋」：档案里本来就有季节字，不能拿来判断
    if (/秋/.test(userInput) && (metrics.winterMentions as number) > 0) issues.push(`用户写了秋天，输出里出现冬天 ${metrics.winterMentions} 处`);
  }
  metrics.chars = body.length;
  return { issues, metrics };
}

describe('开物多轮质量评测', () => {
  for (let round = 1; round <= ROUNDS; round++) {
    for (const c of CASES) {
      if (ONLY.length && !ONLY.includes(c.id)) continue;
      it(`第 ${round} 轮 · ${c.label}`, async () => {
        const fixture = await loadFixture();
        state.owner = fixture.owner;
        const built = c.build(fixture);
        const profileId = String(fixture.row.id);
        const obs = await runRoute({ ...built.body, query: built.query, profileId, personalRequirements: (built.body as any).personalRequirements });
        const allowed = JSON.stringify(fixture.row) + (fixture.positioning ? JSON.stringify(fixture.positioning) : '') + built.extraSource;
        const checks = autoChecks(c.id, obs.shown, allowed, built.extraSource);
        const base = path.join(OUT, `r${round}-${c.id}`);
        fs.writeFileSync(`${base}.md`, `# 第 ${round} 轮 · ${c.label}\n\n${obs.shown}\n`);
        fs.writeFileSync(`${base}.json`, JSON.stringify({
          round, case: c.id, label: c.label, status: obs.status, firstAnswerMs: obs.firstAnswerMs, totalMs: obs.totalMs,
          answerEvents: obs.answerEvents, replaceEvents: obs.replaceEvents, errors: obs.errors,
          promptChars: built.query.length, auto: checks, at: new Date().toISOString(),
        }, null, 2));
        fs.writeFileSync(`${base}.events.json`, JSON.stringify(obs.events, null, 2));
        console.log(`[r${round} ${c.id}] 首字 ${obs.firstAnswerMs}ms 总耗时 ${obs.totalMs}ms 正文 ${obs.shown.length} 字 错误 ${obs.errors.length} 自动检查问题 ${checks.issues.length}`);
        expect(obs.status).toBe(200);
      }, 900_000);
    }
  }
});
