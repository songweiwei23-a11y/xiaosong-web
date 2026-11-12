// 企业商用新生成验收（真实路由 + 真实 Dify + 档案只读；不部署，不写用户数据）。
//   npx vitest run -c .tmp/quality-eval/vitest.config.ts enterprise-fresh --silent
// 覆盖：同一用户名下全部 5 个档案 × 18 个走 /api/dify/stream 的板块，每个各生成 1 份。
//   自由对话走 /api/dify/chat，本次未覆盖（见报告）。
// 环境变量：FRESH_CONCURRENCY（默认 4）、FRESH_PROFILES（档案 id 前缀，逗号分隔，默认全部）、FRESH_BOARDS（板块名，逗号分隔，默认全部）
//
// 判定依据：docs/企业商用验收标准_20261011/验收标准.md。
//   E1 广告合规、E2 平台合规、E3 出处、E4 与档案/时令一致（部分自动）、E5 交付完整、E6 设定遵循（字数、条数）、E7 无内部泄漏。
//   自动判定只给线索；命中项需要人工读上下文确认（报告里会列出）。
// 与线上的差别：额度、共用会话、历史存档全部替换成空操作；每次都是新会话；只带档案和定位，不带创作简报、成交理由、作品数据。
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, vi } from 'vitest';
import { buildContextBlock } from '@/lib/creator-context';
import { buildProfileSummary, businessLines } from '@/lib/profile-summary';
import { creationSettingsBlock, type CreationSettings } from '@/lib/creation-settings';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildRemixPrompt } from '@/lib/remix';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildOpeningPrompt, buildGrowthPlanPrompt } from '@/lib/growth-standards';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildDealReasonPrompt } from '@/lib/deal-reasons';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildBriefPrompt } from '@/lib/creative-brief';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { buildIndustryAdvicePrompt } from '@/lib/industry-advice';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';
import { resolveMix, mixPromptBlock } from '@/lib/content-mix';
import { taboosPromptBlock } from '@/lib/taboos';
import { unsupportedFacts, yearConflicts } from '@/lib/quality-checks';
import { seasonMisstatements } from '@/lib/time-anchor';
import { hasObviousCutoff } from '@/lib/result-reconciliation';

// 诊断：每次生成的 usage（看触发了哪几步修复）、服务端 console.error（看 500 的原因）
const state = vi.hoisted(() => ({ owner: '' }));
const diag = vi.hoisted(() => ({ usage: new Map<string, Record<string, unknown>>(), seq: 0, errors: [] as string[] }));

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: state.owner }),
  requireUserWithQuota: async () => ({ ok: true, userId: state.owner }),
  incrementUsageServer: async () => {},
}));
vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: async () => ({ ok: true, reservation: { userId: state.owner, feature: 'script', requestId: `enterprise-fresh-${++diag.seq}` } }),
  releaseCreation: async () => {},
  recordCreationCompletion: async (reservation: any, completion: any) => { diag.usage.set(reservation.requestId, completion?.usage ?? {}); },
  completionUsage: () => ({}),
}));
// 测试专用：生成后事实修正的「每人每天 20 次」限额在测试里关掉（90 份都是同一个账号，额度会被耗尽，结果就分不清是模型编造还是额度用完）。线上限额不变。
vi.mock('@/lib/fact-fix', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, autoFactFixLimited: () => false };
});
// 测试专用：脚本口播修复的每日限额同样关掉（同上）
vi.mock('@/lib/script-repair', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, scriptRepairLimited: () => false };
});
vi.mock('@/lib/dify-conversation', () => ({
  getDifyConversationId: async () => null,
  saveDifyConversationId: async () => {},
  clearDifyConversationId: async () => {},
  isInvalidConversationError: () => false,
}));

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join('.tmp', 'quality-eval', 'fresh', STAMP);
fs.mkdirSync(OUT, { recursive: true });
const CONCURRENCY = Number(process.env.FRESH_CONCURRENCY || 4);
const ONLY_PROFILES = (process.env.FRESH_PROFILES || '').split(',').map((s) => s.trim()).filter(Boolean);
const ONLY_BOARDS = (process.env.FRESH_BOARDS || '').split(',').map((s) => s.trim()).filter(Boolean);

/** 页面看到的正文：answer 追加，message_replace 整篇替换（与 lib/sse-stream.ts 一致） */
function shownAfterStream(events: any[]): string {
  let shown = '';
  for (const e of events) {
    if (e.event === 'message_replace') shown = e.answer;
    else if (e.event === undefined && typeof e.answer === 'string') shown += e.answer;
  }
  return shown;
}

interface Obs { status: number; firstAnswerMs: number | null; totalMs: number; shown: string; errors: string[]; events: any[]; genId: string }

async function runRoute(body: Record<string, unknown>): Promise<Obs> {
  const { POST } = await import('@/app/api/dify/stream/route');
  const t0 = Date.now();
  const res = await POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify(body) }) as any);
  if (!res.ok || !res.body) {
    return { status: res.status, firstAnswerMs: null, totalMs: Date.now() - t0, shown: '', errors: [await res.text()], events: [], genId: res.headers.get('X-Generation-Id') ?? '' };
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
    events,
    genId: res.headers.get('X-Generation-Id') ?? '',
  };
}

// ---- 判定 -----------------------------------------------------------------

// 警告语境（「违规、绝对化用语、是坑」）也是反例，不算宣传（第三轮口径，与 lib/output-guard 的 NEGATED 一致）
const NEG = /不能|不要|不许|禁止|别说|别写|避免|不承诺|不说|❌|✗|×|反例|错误|误区|不可用|不写|不得|不用|不做|不在|违规|绝对化用语|是坑|踩坑|陷阱|警惕/;
// E1：与 scripts 的 E1 保持一致（窄口径，避免「最怕、最容易」这类描述语误报）
const E1 = /最正宗|最好吃|全城|全网|第一家|最(?:好|高|低|便宜|划算|值|强|专业|正宗|新鲜|暖和|实惠|省)(?!拍|看|的时候|的人)|100%|保证(?!画面|稳定|推进|焦点|拍摄|音)|绝对|稳赚|零添加|纯天然|必吃|必去|顶级|极致/g;
// E2：站外引流作为行动指令；平台敏感词；操纵数据
// 「扫码点单」是正常经营动作，只判「扫码关注 / 扫码领 / 扫码加」这种站外引流（第三轮口径，与 lib/output-guard 一致）
const E2 = /加微信|加V|加v|扫码(?=关注|加|领|进群)|留电话|揭秘|内幕|刷评论|刷量|小号|买赞|买粉/g;
// E7：内部痕迹（所有板块都不能出现）
const E7_LEAK = /【本轮|【本条|【高阶自由对话】|提示词|系统指令|本轮校对|校对编辑|交稿前|自检|核对清单|数字来源核查|禁忌核查|三有自检|为什么这样写|数据说明|校对报告|内部术语/g;
// E7：内部编号（面向观众的板块不能出现；创作者板块允许）
const E7_NUM = /第\d+计|\d+计|起号\d*计|36计/g;
const REFUSAL = /未提供档案|无法核对|缺少档案|需要用户提供档案|待用户提供档案|请先提供/;

const FACING = new Set(['标题封面', '脚本生成', '选题策划', '开篇钩子', '分镜脚本', '跨行业二创', '审稿优化']);

function uniq<T>(a: T[]): T[] { return [...new Set(a)]; }

interface Judged {
  gates: Record<'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7', string[]>;
  warn: string[];
  metrics: Record<string, unknown>;
  pass: boolean;
}

function judge(board: string, text: string, known: string, profileRow: Record<string, unknown>, obs: Obs): Judged {
  const facing = FACING.has(board);
  const gates: Judged['gates'] = { E1: [], E2: [], E3: [], E4: [], E5: [], E6: [], E7: [] };
  const warn: string[] = [];
  const metrics: Record<string, unknown> = { chars: text.length };

  // E5 交付完整
  if (obs.status !== 200) gates.E5.push(`请求失败 ${obs.status}`);
  if (obs.errors.length) gates.E5.push(`生成报错：${obs.errors[0].slice(0, 80)}`);
  if (!text.trim()) gates.E5.push('正文为空');
  else {
    if (REFUSAL.test(text)) gates.E5.push(`拒答：${text.match(REFUSAL)![0]}`);
    if (hasObviousCutoff(text) || /[、，：【（(]$/.test(text.trim())) gates.E5.push('结尾疑似截断');
    const ph = (text.match(/【待确认|【换成/g) ?? []).length;
    if (ph > 5) warn.push(`占位 ${ph} 处`);
  }

  // E1 / E2：逐行看，否定语境的行不算
  for (const line of text.split('\n')) {
    if (NEG.test(line)) continue;
    for (const m of line.matchAll(E1)) {
      // 「最好在傍晚拍」「最好是先…」是拍摄或操作建议，不是绝对化承诺（与 2026-10-11 上一份报告的口径一致）
      if (m[0] === '最好' && /^(?:在|是|拍|看|用|去|来|选|先|别|不要|提前|控制|保持|留|把|配|搭|拿|做|说|放|找|记|能|要|从|给|谈|讲)/.test(line.slice((line.indexOf(m[0]) + m[0].length)))) continue;
      gates.E1.push(m[0]);
    }
    for (const m of line.matchAll(E2)) gates.E2.push(m[0]);
  }

  // E3 出处（与 quality-checks 的 unsupportedFacts 同一套规则）
  gates.E3.push(...unsupportedFacts(text, known).slice(0, 8));

  // E4 与档案一致：年限、时令；开篇的出镜人身份
  for (const y of yearConflicts(text, profileRow.persona_facts)) gates.E4.push(`年限与事实卡不符「${y}」`);
  for (const s of seasonMisstatements(text, Date.now(), known)) gates.E4.push(s);
  if (board === '开篇钩子') {
    const outsider = [...text.matchAll(/这家老板|这个老板|这个师傅|老板干了|老板早就|老板说|他们店|这家地摊老板/g)].map((m) => m[0]);
    if (outsider.length) gates.E4.push(`旁观者口吻（出镜人应讲「我」）：「${outsider[0]}」`);
  }

  // E6 设定遵循：字数、条数
  const body = text.trim();
  if (board === '脚本生成') {
    // 脚本是四步结构（第1步策略卡、第2步纯文字文案、第3步分镜、第4步执行）；口播 = 第 2 步的汉字（与 scripts 的约定一致）
    // 口播必须在「第2步…纯文字文案」标题下；标题是别的（如「候选方向」）说明口播没有交出来
    const step2 = body.match(/第2步[^\n]*纯文字文案[\s\S]*?(?=第3步|$)/)?.[0] ?? '';
    const spoken = (step2.match(/[一-鿿]/g) ?? []).length;
    metrics.spokenCjk = spoken;
    if (!step2) gates.E6.push('没有第 2 步纯文字文案');
    else if (spoken < 60) gates.E6.push(`第 2 步口播 ${spoken} 字，编导设了 30 秒，偏少`);
    else if (spoken > 170) gates.E6.push(`第 2 步口播 ${spoken} 字，编导设了 30 秒，超出约 150 字`);
  }
  if (board === '标题封面') {
    const heads = body.split('\n').filter((l) => /^\s*(?:#{1,4}\s*)?(?:标题\s*)?\d{1,2}[.、．:：)）]/.test(l));
    metrics.titleCount = heads.length;
    if (heads.length !== 5) gates.E6.push(`标题 ${heads.length} 个，要求 5 个`);
  }
  if (board === '选题策划') {
    // 「1.」「选题1」「## ✅ 选题1【…】」都算一条
    const items = body.split('\n').filter((l) => /^\s*(?:#{1,4}\s*)?(?:选题\s*)?\d{1,2}[.、．:：)）]|^\s*#{2,4}\s*[^\n]*?选题\s*\d/.test(l));
    metrics.topicCount = items.length;
    if (items.length !== 10) gates.E6.push(`选题 ${items.length} 条，要求 10 条`);
  }
  if (board === '跨行业二创') {
    const plans = body.split('\n').filter((l) => /^\s*#{2,4}\s*方案\s*\d/.test(l));
    metrics.planCount = plans.length;
    if (plans.length !== 2) gates.E6.push(`方案 ${plans.length} 个，要求 2 个`);
  }

  // E7 内部泄漏
  for (const m of text.matchAll(E7_LEAK)) gates.E7.push(m[0]);
  if (facing) for (const m of text.matchAll(E7_NUM)) gates.E7.push(m[0]);

  for (const k of Object.keys(gates) as (keyof Judged['gates'])[]) gates[k] = uniq(gates[k]);
  const pass = (Object.keys(gates) as (keyof Judged['gates'])[]).every((k) => gates[k].length === 0);
  return { gates, warn, metrics, pass };
}

// ---- 档案与任务 -------------------------------------------------------------

const BREAKDOWN_SOURCE = `原片：健身教练「练了一年还是这个体型」纠错视频（拆解）
结构：开场反问「你是不是练了一年还是这个体型？」→ 指出最常见的一个错误动作 → 现场示范错误与正确的对比 → 给一个可以马上做的改法 → 结尾引导评论区留言领取计划
开篇句式：反问 + 否定旧认知，第一句就点出观众自己的处境
节奏：每 3-4 秒切一次景别；正反对比用左右分屏
出镜：教练本人口播，站在器械前，背景是灯光下的健身房
原片公开数据：播放约 120 万，评论里有大量「我也是这样」`;

const SCRIPT_TOPIC = (name: string) => `${name}：出镜人讲讲店里（或服务中）一件最值得注意的日常`;
const FOOD = /火锅|串|烧烤|餐|菜|食|吃|饭|面|粉|小吃/;

interface Profile { row: Record<string, any>; ctx: any; name: string; idx: number; owner: string; positioning: { name: string; summary: string; full: string } | null; brief: string; interview: string }

async function loadProfiles(): Promise<Profile[]> {
  const { getServiceSupabase } = await import('@/lib/admin-auth');
  const db = getServiceSupabase();
  const { data, error } = await db.from('user_profiles').select('*');
  if (error) throw error;
  const seed = (data as any[]).find((r) => String(r.id).startsWith('74586841'));
  if (!seed) throw new Error('找不到档案');
  const owner = String(seed.user_id);
  const mine = (data as any[]).filter((r) => r.user_id === owner && (!ONLY_PROFILES.length || ONLY_PROFILES.some((p) => String(r.id).startsWith(p))));
  const { data: pos } = await db.from('account_positioning').select('profile_id,positioning_type,is_active,positioning_name,strategy_summary,positioning_description,full_content,updated_at').eq('user_id', owner);
  const out: Profile[] = [];
  mine.forEach((row, idx) => {
    const pp = ((pos as any[]) ?? []).filter((x) => x.profile_id === row.id);
    const act = pp.filter((x) => x.is_active && x.positioning_type === '账号定位').sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    const positioning = act ? { name: String(act.positioning_name ?? ''), summary: String(act.strategy_summary || act.positioning_description || ''), full: String(act.full_content || '') } : null;
    const brief = String(pp.find((x) => x.positioning_type === '创作简报')?.full_content ?? '');
    const interview = [row.interview_notes, row.interview_highlights].filter(Boolean).join('\n');
    const ctx: any = { profile: row, positioning, dealReasons: [] };
    out.push({ row, ctx, name: String(row.profile_name ?? `档案${idx + 1}`), idx: idx + 1, owner, positioning, brief, interview });
  });
  return out;
}

/** 与页面一致的「已知素材」：档案 JSON + 这个号的定位、简报、访谈，外加本条直接依赖的上游内容 */
function knownFor(p: Profile, upstream: string): string {
  return [JSON.stringify(p.row), p.positioning?.full ?? '', p.brief, p.interview, upstream].join('\n');
}

interface Task {
  key: string;
  board: string;
  build: (deps: Record<string, Obs>) => { taskType: string; query: string; body: Record<string, unknown>; upstream: string } | { skip: string };
}

function taskList(p: Profile): Task[] {
  const row = p.row;
  const ctx = p.ctx;
  const summary = buildProfileSummary(row);
  const mix = () => mixPromptBlock(resolveMix(row));
  const taboos = taboosPromptBlock(row);
  const restrictions = typeof row.content_restrictions === 'string' ? row.content_restrictions : undefined;
  const platform = Array.isArray(row.account_platform) ? String(row.account_platform[0] ?? '') || undefined : (row.account_platform ? String(row.account_platform) : undefined);
  const topic = SCRIPT_TOPIC(p.name);
  const food = FOOD.test(`${p.name}${JSON.stringify(row.account_track ?? '')}`);
  const ready = (key: string, deps: Record<string, Obs>, need: string[]) => {
    const miss = need.filter((k) => !deps[k] || !deps[k].shown.trim());
    return miss.length ? `上游「${miss.join('、')}」没有产出，本条无法生成` : '';
  };
  const posBody = (focus: 'full' | 'business' | 'content', baseline?: string) => buildPositioningPrompt({
    profileSummary: summary,
    additionalNotes: '无补充说明',
    platform,
    restrictions,
    focus,
    baseline,
    mixBlock: mix(),
    taboos,
  });

  return [
    {
      key: 'account', board: '账号定位',
      build: () => ({ taskType: '账号定位', query: posBody('full'), body: { taskType: '账号定位', creationSettings: {}, profileInfo: summary, additionalNotes: '无补充说明' }, upstream: '' }),
    },
    {
      key: 'business', board: '商业定位',
      build: (d) => {
        const miss = ready('business', d, ['account']); if (miss) return { skip: miss };
        return { taskType: '账号定位', query: posBody('business', d.account.shown), body: { taskType: '账号定位', creationSettings: {}, profileInfo: summary, additionalNotes: '无补充说明' }, upstream: d.account.shown };
      },
    },
    {
      key: 'content', board: '内容定位',
      build: (d) => {
        const miss = ready('content', d, ['account']); if (miss) return { skip: miss };
        return { taskType: '账号定位', query: posBody('content', d.account.shown), body: { taskType: '账号定位', creationSettings: {}, profileInfo: summary, additionalNotes: '无补充说明' }, upstream: d.account.shown };
      },
    },
    {
      key: 'brief', board: '创作简报',
      build: (d) => {
        const miss = ready('brief', d, ['account', 'business', 'content']); if (miss) return { skip: miss };
        const query = buildBriefPrompt({
          positioningFull: d.account.shown, profileSummary: summary, notes: '无补充说明',
          businessPositioning: d.business.shown, contentPositioning: d.content.shown, mixBlock: mix(), taboos,
        });
        return { taskType: '创作简报', query, body: { taskType: '创作简报', creationSettings: {} }, upstream: [d.account.shown, d.business.shown, d.content.shown].join('\n') };
      },
    },
    {
      key: 'growth', board: '起号方案',
      build: (d) => {
        const miss = ready('growth', d, ['content']); if (miss) return { skip: miss };
        const query = buildGrowthPlanPrompt({
          contextBlock: buildContextBlock(ctx, 'growth'), contentPlan: d.content.shown, restrictions, notes: '', mixBlock: mix(),
        });
        return { taskType: '起号方案', query, body: { taskType: '起号方案', creationSettings: {} }, upstream: d.content.shown };
      },
    },
    {
      key: 'advice', board: '行业建议',
      build: (d) => {
        const miss = ready('advice', d, ['account', 'business', 'content']); if (miss) return { skip: miss };
        const query = buildIndustryAdvicePrompt({
          profileSummary: summary, baseline: d.account.shown, businessBaseline: d.business.shown, contentBaseline: d.content.shown,
          input: { purpose: 'staged', stage: 'start', situation: '已经发了几条，还没看出哪类内容最有效，想知道下一阶段怎么推。', goal: '找到能稳定带来咨询的内容类型' },
          taboos,
        });
        return { taskType: '行业建议', query, body: { taskType: '行业建议', creationSettings: {} }, upstream: [d.account.shown, d.business.shown, d.content.shown].join('\n') };
      },
    },
    {
      key: 'contentPlan', board: '内容规划',
      build: () => {
        const query = buildContentPlanPrompt({
          lastMonth: '', recordedLastMonth: null, count: 12, focus: ['fans', 'store'], events: '', notes: '',
          resolved: resolveMix(row), profileSummary: summary, contextBlock: buildContextBlock(ctx, 'topic'), industry: '',
        });
        return { taskType: '内容规划', query, body: { taskType: '内容规划', creationSettings: {}, historyInput: { count: 12 } }, upstream: '' };
      },
    },
    {
      key: 'script', board: '脚本生成',
      build: () => {
        const settings = { duration: '30秒', purpose: '变现型' } as unknown as CreationSettings;
        const query = buildAdaptiveScriptPrompt({
          topic, platform: '抖音', duration: '30秒', context: buildContextBlock(ctx, 'script'), source: topic, requirements: '', settings: settings as any,
        });
        return { taskType: '脚本生成', query, body: { taskType: '脚本生成', creationSettings: settings }, upstream: topic };
      },
    },
    {
      key: 'title', board: '标题封面',
      build: () => {
        const settings = { titleCount: 5 } as unknown as CreationSettings;
        const query = buildTitlePrompt({
          topic, titleTypeLabel: '痛点式', titleFormulaValue: 'pain-solution', titleFormulaLabel: '痛点+解决方案',
          keywordStrategyLabel: '搜索词', keywordStrategyDesc: '高搜索量',
          platform: '抖音', targetAudience: '附近的人，想了解这家店或这项服务',
          count: 5, contextBlock: buildContextBlock(ctx, 'title') + creationSettingsBlock(settings), openingCards: [], sourceContent: '',
        });
        return { taskType: '标题封面', query, body: { taskType: '标题封面', creationSettings: settings, platform: '抖音', titleType: '痛点式' }, upstream: topic };
      },
    },
    {
      key: 'topic', board: '选题策划',
      build: () => ({
        taskType: '选题策划',
        query: `【工作任务】生成10条选题\n\n${buildContextBlock(ctx, 'topic')}\n\n平台：抖音。每条给出：选题标题、拍摄角度（一句话）、为什么会有人看（一句话）。10 条的角度要分开，不要重复，不要只换说法。只用档案里有的事实，不编顾客故事、价格、销量。`,
        body: { taskType: '选题策划', creationSettings: {} }, upstream: '',
      }),
    },
    {
      key: 'opening', board: '开篇钩子',
      build: () => {
        const cs = { purpose: '变现型' } as Record<string, any>;
        const query = buildOpeningPrompt({
          contextBlock: buildContextBlock(ctx, 'script') + creationSettingsBlock(cs as any),
          topic,
          intent: { purpose: cs.purpose, purposeText: undefined, direction: undefined, userIntent: undefined },
        } as any);
        return { taskType: '开篇钩子', query, body: { taskType: '开篇钩子', creationSettings: cs }, upstream: topic };
      },
    },
    {
      key: 'direction', board: '创作方向',
      build: () => {
        const ideas = '秋天到了，想拍一期门店这个季节的日常';
        const query = buildDirectionPrompt({
          purposes: ['store', 'deal'], customGoal: '', ideas, formats: [], onCamera: '出镜人本人', capacity: '每周 3 条',
          count: 5, depth: 'full', profileSummary: summary, contextBlock: buildContextBlock(ctx, 'direction'),
        } as any);
        return { taskType: '创作方向', query, body: { taskType: '创作方向', creationSettings: {} }, upstream: ideas };
      },
    },
    {
      key: 'dealReason', board: '成交理由',
      build: () => {
        const query = buildDealReasonPrompt({
          accountContext: buildContextBlock(ctx, 'dealReason'),
          storeName: p.name,
          storeType: String(row.product_category ?? row.account_track ?? ''),
          storeFeatures: [row.unique_selling_point, row.competitive_advantage].filter(Boolean).join('；'),
          targetCustomer: '附近的人，想找靠谱的本地服务或好店',
        } as any);
        return { taskType: '成交理由', query, body: { taskType: '成交理由', topic: query, creationSettings: {} }, upstream: '' };
      },
    },
    {
      key: 'knowledge', board: '知识库查询',
      build: () => {
        const q = `${p.name}这类门店的短视频开头，怎么在前 3 秒留住人？`;
        return { taskType: '知识库查询', query: q, body: { taskType: '知识库查询', topic: q }, upstream: '' };
      },
    },
    {
      key: 'breakdown', board: '拆解爆款',
      build: () => ({
        taskType: '拆解爆款',
        query: buildTextBreakdownPrompt(BREAKDOWN_SOURCE, buildContextBlock(ctx, 'breakdown'), {} as CreationSettings),
        body: { taskType: '拆解爆款', creationSettings: {} }, upstream: BREAKDOWN_SOURCE,
      }),
    },
    {
      key: 'remix', board: '跨行业二创',
      build: () => {
        const source = { kind: 'paste' as const, text: BREAKDOWN_SOURCE, title: '健身教练纠错视频', industry: '健身' };
        const query = buildRemixPrompt(source, {
          layers: ['opening', 'structure', 'presentation'], count: 2, differentiate: 'layer', depth: 'full',
          role: '流量型', duration: '30 秒', outputs: ['script', 'shots', 'shootPlan'],
          profileSummary: summary,
          store: { name: p.name, lines: businessLines(row), track: Array.isArray(row.account_track) ? row.account_track.join('、') : String(row.account_track ?? '') },
          contextBlock: buildContextBlock(ctx, 'remix') + creationSettingsBlock({}),
        } as any);
        return { taskType: '跨行业二创', query, body: { taskType: '跨行业二创', creationSettings: {}, historyInput: { count: 2 } }, upstream: BREAKDOWN_SOURCE };
      },
    },
    {
      key: 'review', board: '审稿优化',
      build: (d) => {
        const miss = ready('review', d, ['script']); if (miss) return { skip: miss };
        const draft = d.script.shown;
        const personalRequirements = '按档案核对原稿里的年限、销量和顾客反馈';
        const query = buildReviewPrompt({
          draftContent: draft, platform: '抖音', duration: '30秒', scriptType: '晒过程型',
          reviewDimensions: '【开头吸引力】3秒钩子是否有力\n【事实依据】每个数字、经历、顾客反馈是否有档案依据',
          optimizationGoals: '去掉没有依据的说法，保留真实经营信息，提升开头吸引力',
          benchmarkScript: '', compareMode: true, severityLabels: true,
          contextBlock: buildContextBlock(ctx, 'review'), personalRequirements,
        } as Parameters<typeof buildReviewPrompt>[0]);
        return { taskType: '审稿优化', query, body: { taskType: '审稿优化', creationSettings: {}, draftContent: draft, personalRequirements }, upstream: draft };
      },
    },
    {
      key: 'storyboard', board: '分镜脚本',
      build: (d) => {
        const miss = ready('storyboard', d, ['script']); if (miss) return { skip: miss };
        const scriptContent = d.script.shown;
        const query = buildStoryboardPrompt({
          scriptContent, platform: '抖音', duration: '30秒', contentType: food ? 'food' : 'auto', visualStyle: 'cinematic', visualStyleLabel: '电影感',
          additionalInfo: '', contextBlock: buildContextBlock(ctx, 'storyboard'),
        });
        return { taskType: '分镜脚本', query, body: { taskType: '分镜脚本', creationSettings: { duration: '30秒' } }, upstream: scriptContent };
      },
    },
  ];
}

// ---- 并发与执行 -------------------------------------------------------------

let active = 0;
const waiting: Array<() => void> = [];
async function gate<T>(fn: () => Promise<T>): Promise<T> {
  while (active >= CONCURRENCY) await new Promise<void>((r) => waiting.push(r));
  active++;
  try { return await fn(); }
  finally { active--; waiting.shift()?.(); }
}

interface Record_ {
  profile: string; profileId: string; board: string; key: string;
  status: 'done' | 'skipped' | 'failed'; skipReason?: string;
  firstAnswerMs: number | null; totalMs: number; chars: number;
  pass: boolean; gates: Judged['gates']; warn: string[]; metrics: Record<string, unknown>; file: string;
  /** 本条触发的修复步骤（usage 里的 *_steps）：fact_fix_steps / script_repair_steps / result_check_steps */
  steps?: string[];
}

const records: Record_[] = [];

async function runTask(p: Profile, t: Task, deps: Record<string, Obs>): Promise<void> {
  const profileId = String(p.row.id);
  const built = t.build(deps);
  const base = path.join(OUT, `p${p.idx}-${t.key}`);
  if ('skip' in built) {
    records.push({ profile: p.name, profileId, board: t.board, key: t.key, status: 'skipped', skipReason: built.skip, firstAnswerMs: null, totalMs: 0, chars: 0, pass: false, gates: { E1: [], E2: [], E3: [], E4: [], E5: ['依赖上游失败'], E6: [], E7: [] }, warn: [], metrics: {}, file: '' });
    return;
  }
  state.owner = p.owner;
  const obs = await gate(() => runRoute({ ...built.body, query: built.query, profileId, personalRequirements: (built.body as any).personalRequirements }));
  const shown = obs.shown;
  const known = knownFor(p, built.upstream);
  const j = judge(t.board, shown, known, p.row, obs);
  fs.writeFileSync(`${base}.md`, `# ${p.name} · ${t.board}\n\n${shown}\n`);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ profile: p.name, board: t.board, status: obs.status, firstAnswerMs: obs.firstAnswerMs, totalMs: obs.totalMs, errors: obs.errors, promptChars: built.query.length, judged: j, at: new Date().toISOString() }, null, 2));
  records.push({ profile: p.name, profileId, board: t.board, key: t.key, status: obs.status === 200 && shown.trim() ? 'done' : 'failed', firstAnswerMs: obs.firstAnswerMs, totalMs: obs.totalMs, chars: shown.length, pass: j.pass, gates: j.gates, warn: j.warn, metrics: j.metrics, file: path.basename(base) + '.md', steps: Object.keys(diag.usage.get(obs.genId) ?? {}).filter((k) => /_steps$/.test(k)) });
  deps[t.key] = obs;
  console.log(`[${p.name} · ${t.board}] ${j.pass ? 'PASS' : 'FAIL'} 首字 ${obs.firstAnswerMs}ms 总 ${obs.totalMs}ms 字数 ${shown.length}`);
}

async function runProfile(p: Profile): Promise<void> {
  const tasks = taskList(p).filter((t) => !ONLY_BOARDS.length || ONLY_BOARDS.includes(t.board));
  const deps: Record<string, Obs> = {};
  const run = async (key: string) => {
    const t = tasks.find((x) => x.key === key);
    if (t) await runTask(p, t, deps);
  };
  const chainAccount = (async () => {
    await run('account');
    await Promise.all([run('business'), run('content')]);
    await Promise.all([run('brief'), run('advice'), run('growth')]);
  })();
  const chainScript = (async () => {
    await run('script');
    await Promise.all([run('storyboard'), run('review')]);
  })();
  const independent = ['title', 'topic', 'opening', 'direction', 'dealReason', 'knowledge', 'breakdown', 'remix', 'contentPlan'].map((k) => run(k));
  await Promise.all([chainAccount, chainScript, ...independent]);
}

// ---- 汇总报告 ---------------------------------------------------------------

function writeReport(profiles: Profile[]) {
  fs.writeFileSync(path.join(OUT, 'records.json'), JSON.stringify(records, null, 2));
  const done = records.filter((r) => r.status !== 'skipped');
  const pass = done.filter((r) => r.pass).length;
  const byBoard = new Map<string, { n: number; pass: number; gates: Record<string, number> }>();
  for (const r of done) {
    const b = byBoard.get(r.board) ?? { n: 0, pass: 0, gates: { E1: 0, E2: 0, E3: 0, E4: 0, E5: 0, E6: 0, E7: 0 } };
    b.n++; if (r.pass) b.pass++;
    for (const k of Object.keys(r.gates) as (keyof Judged['gates'])[]) if (r.gates[k].length) b.gates[k]++;
    byBoard.set(r.board, b);
  }
  const lines: string[] = [];
  lines.push(`# 企业商用新生成验收（${STAMP}）`, '', `档案 ${profiles.length} 个 × 板块 ${new Set(records.map((r) => r.key)).size} 个；有效样本 ${done.length}，通过 ${pass}，通过率 ${done.length ? ((pass / done.length) * 100).toFixed(1) : '—'}%。`, '');
  lines.push(
    '## 本轮口径（相对第一轮的变化）', '',
    '- 测试专用：生成后事实修正的每日限额关掉（同一账号 90 份会耗尽额度）；线上限额不变。',
    '- 脚本 E6 只数第 2 步口播（第一轮误数整份输出）；选题计数识别「## ✅ 选题N」格式（第一轮漏计）。',
    '- E1 豁免「最好在 / 最好是 / 最好拍」这类拍摄建议（与上一份企业报告口径一致）。',
    '- 第三轮口径：脚本口播必须在「第2步…纯文字文案」标题下才算（标题是「候选方向」等即判未交出口播）；E2 的「扫码」只判「扫码关注 / 领 / 加 / 进群」，「扫码点单」不判。',
    '- 第三轮代码变化（被测版本）：脚本生成后按编导设的时长压缩一次口播（超过上限的 1.1 倍），或补上缺失的口播步骤；修复稿要过同样的检查才采用。',
    '- 自动判定，命中项仍需人工读上下文复核；本报告的数字是自动判定结果。', '',
  );
  lines.push('## 按板块（单条全部门槛通过才算通过）', '', '| 板块 | 通过 / 样本 | E1 | E2 | E3 | E4 | E5 | E6 | E7 |', '|---|---|---|---|---|---|---|---|---|');
  for (const [board, b] of byBoard) lines.push(`| ${board} | ${b.pass} / ${b.n} | ${b.gates.E1} | ${b.gates.E2} | ${b.gates.E3} | ${b.gates.E4} | ${b.gates.E5} | ${b.gates.E6} | ${b.gates.E7} |`);
  lines.push('', '## 按档案', '', '| 档案 | 通过 / 样本 |', '|---|---|');
  for (const p of profiles) {
    const rs = done.filter((r) => r.profile === p.name);
    lines.push(`| ${p.name} | ${rs.filter((r) => r.pass).length} / ${rs.length} |`);
  }
  const skipped = records.filter((r) => r.status === 'skipped');
  if (skipped.length) lines.push('', '## 未生成（上游失败）', '', ...skipped.map((r) => `- ${r.profile} · ${r.board}：${r.skipReason}`));
  const failing = done.filter((r) => !r.pass);
  lines.push('', '## 命中的门槛（待人工复核：每条都要读原文上下文）', '');
  for (const r of failing) {
    const hits = (Object.keys(r.gates) as (keyof Judged['gates'])[]).filter((k) => r.gates[k].length).map((k) => `${k}：${r.gates[k].slice(0, 4).join('、')}`);
    lines.push(`- ${r.profile} · ${r.board}（${r.file}）：${hits.join('；')}`);
  }
  const warns = done.filter((r) => r.warn.length);
  if (warns.length) lines.push('', '## 提示项（不计入通过率）', '', ...warns.map((r) => `- ${r.profile} · ${r.board}：${r.warn.join('；')}`));
  lines.push('', '## 修复触发次数（按板块：触发了几次事实修正 / 脚本修复 / 结果校对）', '', '| 板块 | 样本 | 事实修正 | 脚本修复 | 结果校对 |', '|---|---|---|---|---|');
  for (const board of new Set(done.map((r) => r.board))) {
    const rs = done.filter((r) => r.board === board);
    const c = (k: string) => rs.filter((r) => (r.steps ?? []).includes(k)).length;
    lines.push(`| ${board} | ${rs.length} | ${c('fact_fix_steps')} | ${c('script_repair_steps')} | ${c('result_check_steps')} |`);
  }
  lines.push('', '## 服务端报错（console.error，并发时可能混入其他样本）', '', ...(diag.errors.length ? diag.errors.map((e) => `- ${e}`) : ['- 无']));
  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');
}

describe('企业商用新生成验收', () => {
  it('5 档案 × 18 板块各生成 1 份并判定', async () => {
    const profiles = await loadProfiles();
    console.log('PROFILES', profiles.map((p) => `${p.idx}:${p.name}`).join(' | '));
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      const msg = a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}` : String(x))).join(' ');
      if (/API Error|Stream error|Dify|fetch|服务器/.test(msg)) diag.errors.push(msg.slice(0, 400));
    });
    try {
      await Promise.all(profiles.map((p) => runProfile(p)));
    } finally {
      errSpy.mockRestore();
    }
    writeReport(profiles);
    console.log('OUT', OUT, 'RECORDS', records.length);
  }, 3 * 60 * 60 * 1000);
});
