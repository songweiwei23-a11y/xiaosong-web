import { prepareWebSearch } from '@/lib/web-search-quota';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import { freeChatAnswerRules } from '@/lib/free-chat-answer';
import { releaseCreation, reserveCreation, settleCreation } from '@/lib/creation-quota';
import { knowledgeConfigured, knowledgeResultText, searchKnowledge } from '@/lib/assistant/knowledge';
import { AMBIENT_SOUNDS } from '@/lib/ambient/synth';
import { addMemory, listMemories, updateMemory } from '@/lib/assistant/memory-store';
import { MEMORY_MAX_COUNT } from '@/lib/assistant/memory';
import { clampMinutes, OPEN_PAGES, resolveSound, soundChoices } from '@/lib/assistant/client-action-spec';
import type { ActionReceipt } from '@/lib/assistant/receipts';
import { internalBase, readInternal, type BoardHistoryRow } from './boards';
import { BOARD_LABEL, BOARD_TASK_TYPE, missingFields, revisionCapOf, summaryOf, type BoardAny, type PlanSpec } from '@/lib/assistant/board-dispatch';
import { foundationGate, foundationNeedOf } from '@/lib/foundation-gate';
import { isDepth } from '@/lib/research';
import { createPendingRun } from './pending-runs';
import { listRecentResults, loadCarry } from '@/lib/assistant/carry';
import { applyCarry } from '@/lib/assistant/carry-shape';
import { adviseRoute } from '@/lib/assistant/route-advice';
import { MAX_REVISIONS } from './manager';
import type { AssistantTool, WebFeedback } from './agent';

/**
 * 助理能用的工具。助理是管理员：它理解需求、派活给板块、验收结果；内容本身由板块用 Dify 生成。
 *   read_account  读档案、定位、进行中的作品（走现有接口，权限和隔离沿用原来的）
 *   read_quota    读额度（走现有接口）
 *   search_web    联网查热点、新闻（走现有的联网搜索，扣联网额度）
 *   search_knowledge  查编导知识库里的方法论（走知识库检索，扣知识库查询额度）
 *
 *   propose_topic / propose_script / propose_review  派活给选题、脚本、审稿板块。只是列出来，
 *       用户点「确定开跑」后才真的跑（板块每跑一次都扣额度），跑完由管理员验收（见 lib/assistant/board-job.ts）
 *
 * 注意：这里刻意不调用自由对话接口 /api/dify/chat。它扣的是「自由对话」额度，而助理对话本身已经扣过一次，
 * 再经它调用就会重复扣。板块接口 /api/dify/stream 扣的是板块自己的额度，这是正常的。
 */

export interface AssistantToolContext {
  userId: string;
  /** 用户自己的 Cookie，内部读取接口靠它认人 */
  cookie: string;
  /** 用户当前选中的账号档案（浏览器里的选择，由界面带过来）；没有就用第一个 */
  profileId?: string | null;
  /** 用户有没有开「记忆预填」（页面上默认开着；关了就不按上次的习惯填）。不传按开着处理 */
  memoryOn?: boolean;
  /** 板块跑完存历史用。不传就走页面用的那些保存接口（用户的 Cookie 认人）；测试时可以替换 */
  saveHistory?: (row: BoardHistoryRow) => Promise<void>;
  /** 联网这一轮的质量反馈（状态、来源）推给界面，用户能看到每条结论依据哪些来源 */
  onWeb?: (feedback: WebFeedback) => void;
  /** 要在页面上替用户做的事（播放声音、派活确认等），由界面执行；见 lib/assistant/client-action-spec */
  onAction?: (action: { name: string; args: Record<string, unknown> }) => void;
  /** 写类工具执行的结果（回执）：界面显示成卡片；回答核对也用它（见 lib/assistant/receipts.ts） */
  onReceipt?: (receipt: ActionReceipt) => void;
  /** 默认 http://127.0.0.1:端口，测试时可以替换 */
  internalBase?: string;
  fetchImpl?: typeof fetch;
}

const TRUNC = 1500;

const KNOWLEDGE_DOWN =
  '编导知识库这次没有查到结果。请如实告诉用户这次没有查知识库，可以按一般经验回答，但要说明不是来自知识库，不编造资料来源。';
const KNOWLEDGE_EXHAUSTED =
  '本期「知识库查询」次数已用完。请如实告诉用户这次没有查知识库，可以按一般经验回答，但要说明不是来自知识库，不编造资料来源。';
const KNOWLEDGE_NONE =
  '编导知识库里没有和这个问题相关的资料。请如实告诉用户，可以按一般经验回答，但不能说成来自知识库。';

const clip = (s: unknown) => (typeof s === 'string' ? s.slice(0, TRUNC) : '');

/** 派活参数的小工具：字符串去空白、字符串数组、条数夹在范围里 */
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const clampCount = (n: unknown, fallback: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(typeof n === 'number' && Number.isFinite(n) ? n : fallback)));

/** 多步计划的一步（模型给的参数）转成派活格式；认不出的板块返回 null */
function stepToBoard(s: { board?: unknown; text?: unknown; count?: unknown; platform?: unknown }): BoardAny | null {
  const text = str(s.text);
  const platform = str(s.platform);
  switch (s.board) {
    case 'topic':
      return { kind: 'topic', input: { request: text, count: clampCount(s.count, 10, 3, 10), role: '按配比', platform, keywords: [], tracks: [], styles: [], elements: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意' } };
    case 'script':
      return { kind: 'script', input: { request: text, platform } };
    case 'review':
      return { kind: 'review', input: { draft: text, platform } };
    case 'title':
      return { kind: 'title', input: { topic: text, count: clampCount(s.count, 5, 3, 10), platform } };
    case 'storyboard':
      return { kind: 'storyboard', input: { script: text, platform } };
    case 'direction':
      return { kind: 'direction', input: { goal: text, count: clampCount(s.count, 5, 3, 8) } };
    case 'content-plan':
      return { kind: 'content-plan', input: { goal: text, count: clampCount(s.count, 12, 4, 30) } };
    case 'deal-reason':
      // 计划里的成交理由只给了「特色」，店铺名称缺了就会被必填项挡住，让老板补齐
      return { kind: 'deal-reason', input: { storeName: '', storeFeatures: text } };
    case 'positioning':
      return { kind: 'positioning', input: { platform, notes: text } };
    case 'brief':
      return { kind: 'brief', input: { notes: text } };
    case 'advice':
      // 计划里的行业建议只给了现状，目的和阶段缺了就会被必填项挡住，让老板补齐
      return { kind: 'advice', input: { purpose: '', stage: '', situation: text } };
    case 'growth':
      return { kind: 'growth', input: { notes: text } };
    case 'opening':
      return { kind: 'opening', input: { topic: text, count: clampCount(s.count, 3, 1, 6) } };
    case 'remix':
      return { kind: 'remix', input: { text, count: clampCount(s.count, 1, 1, 15) } };
    case 'breakdown':
      return { kind: 'breakdown', input: { script: text } };
    case 'research':
      // 计划里的深度研究只给了主题，深度按标准，资料由上一步的产出带过去
      return { kind: 'research', input: { topic: text } };
    default:
      return null;
  }
}

/**
 * 接着上一步的结果做：只填老板这次说的那一点（想要的主题、目的、这次的要求），其余的正文和原方向由带过来的结果补。
 * 认不出的板块返回 null。
 */
function continueBoard(to: string, request: string, count: number | undefined, platform: string): BoardAny | null {
  switch (to) {
    case 'topic':
      return { kind: 'topic', input: { request, count: clampCount(count, 10, 3, 10), role: '按配比', platform, keywords: [], tracks: [], styles: [], elements: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意' } };
    case 'script':
      return { kind: 'script', input: { request, platform } };
    case 'review':
      return { kind: 'review', input: { draft: '', platform } };
    case 'storyboard':
      return { kind: 'storyboard', input: { script: '', platform } };
    case 'title':
      return { kind: 'title', input: { topic: request, count: clampCount(count, 5, 3, 10), platform } };
    case 'opening':
      return { kind: 'opening', input: { topic: request, count: clampCount(count, 3, 1, 6) } };
    case 'direction':
      return { kind: 'direction', input: { goal: request, count: clampCount(count, 5, 3, 8) } };
    case 'positioning':
      return { kind: 'positioning', input: { platform, notes: request } };
    case 'brief':
      return { kind: 'brief', input: { notes: request } };
    case 'remix':
      return { kind: 'remix', input: { text: '', notes: request, count: 1 } };
    case 'breakdown':
      return { kind: 'breakdown', input: { script: '' } };
    default:
      return null;
  }
}

/** 待办的一条（接口返回的形状） */
interface TodoItem {
  id: string;
  content: string;
  due_at: string | null;
  done: boolean;
}

const isDateText = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
/** YYYY-MM-DD → 「10 月 28 日」（给回执和用户看） */
const dateLabel = (day: string) => {
  const [, m, d] = day.split('-');
  return `${Number(m)} 月 ${Number(d)} 日`;
};
/** 北京时间的日期（YYYY-MM-DD） */
const shanghaiDay = (when: string | Date) => new Date(when).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
/** 日期换成到期时间：北京时间早上 9 点 */
const dueAtOf = (day: string) => `${day}T09:00:00+08:00`;
const WORK_STATUS_LABEL: Record<string, string> = { none: '未拍', shot: '已拍摄', published: '已发布' };

export function createAssistantTools(ctx: AssistantToolContext): AssistantTool[] {
  /** 这一轮（一条消息）的联网资料：只查一次、只扣一次联网额度，之后的 search_web 调用都用同一份（和自由对话一致） */
  let webRound: Promise<string> | null = null;
  /** 这一轮（一条消息）的知识库检索：只查一次、只扣一次额度，之后的 search_knowledge 调用都用同一份（和联网一致） */
  let knowledgeRound: Promise<string> | null = null;

  const emit = (receipt: ActionReceipt) => ctx.onReceipt?.(receipt);
  const doFetch = ctx.fetchImpl ?? fetch;
  const base = internalBase(ctx);
  /** 这一轮里已经记过的待办、笔记（同样的内容不重复新增：模型重复调用或网络重试时） */
  const addedTodos = new Map<string, string>();
  const addedNotes = new Map<string, string>();
  const todosRead = async (): Promise<TodoItem[]> => {
    const res = await doFetch(`${base}/api/todos`, { headers: { cookie: ctx.cookie }, cache: 'no-store' });
    if (!res.ok) throw new Error('待办读取失败');
    return ((await res.json().catch(() => [])) as TodoItem[]) ?? [];
  };
  const todoPatch = (id: string, body: Record<string, unknown>) =>
    doFetch(`${base}/api/todos?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

  const runKnowledgeSearch = async (question: string): Promise<string> => {
    if (!knowledgeConfigured()) return KNOWLEDGE_DOWN;
    // 和知识库板块一样扣「知识库查询」额度：先预留，查到了才结算，没查到就释放
    const reserved = await reserveCreation(ctx.userId, 'knowledge', new Request('http://localhost/api/assistant'), { assistant: true, question });
    if (!reserved.ok) return reserved.response.status === 402 ? KNOWLEDGE_EXHAUSTED : KNOWLEDGE_DOWN;
    const hits = await searchKnowledge(question).catch(() => null);
    if (!hits) {
      await releaseCreation(reserved.reservation);
      return KNOWLEDGE_DOWN;
    }
    await settleCreation(reserved.reservation, true, '知识库查询').catch((error) => {
      console.error('[assistant] 知识库额度结算没有完成，预占保留到过期', error instanceof Error ? error.message : error);
    });
    // 查到的资料名交给回答核对（用了却没写出资料名，要在末尾注明）
    if (hits.length) emit({ kind: 'knowledge.hits', ok: true, text: `查到 ${hits.length} 段资料`, docs: [...new Set(hits.map((h) => h.doc))] });
    return hits.length ? knowledgeResultText(hits) : KNOWLEDGE_NONE;
  };

  const runWebSearch = async (question: string): Promise<string> => {
    try {
      const web = await prepareWebSearch(ctx.userId, question, 'on');
      if (!web.enabled) {
        const exhausted = web.quota?.reason === 'quota_exhausted' || web.quota?.reason === 'membership_expired';
        const note = String(web.inputs.web_search_note);
        ctx.onWeb?.({ status: exhausted ? 'quota_exhausted' : 'unavailable', message: note, sources: [] });
        return `${note}${freeChatAnswerRules(false, { evidenceOnly: true })}`;
      }
      // 真正发起付费搜索前才确认扣费（没有可用的搜索服务时不会调用，也就不扣）
      const result = await searchFreeChatWeb(question, { onStarted: () => web.markStarted() });
      if (!result) {
        ctx.onWeb?.({ status: 'unavailable', message: '联网搜索暂时不可用', sources: [] });
        return '联网搜索暂时不可用，请如实告诉用户没有查到最新信息，不要编造来源。';
      }
      const done = result.status.status === 'done';
      ctx.onWeb?.({ status: done ? 'done' : 'unavailable', message: result.status.message, sources: result.status.sources });
      // 资料全文交给模型（和自由对话一样），连同同样的引用要求
      return `${result.context || '没有查到可靠的来源，请如实告诉用户未核实。'}${freeChatAnswerRules(true, { evidenceOnly: true })}`;
    } catch {
      ctx.onWeb?.({ status: 'unavailable', message: '联网搜索出错，这次没有核实', sources: [] });
      return '联网搜索出错，请如实告诉用户这次没有核实，不要编造来源。';
    }
  };

  /**
   * 派活：把板块任务列出来，等用户确认才真的跑。板块每跑一次都扣额度，所以这里绝不直接执行。
   * 管理员的验收和返工在确认之后、板块跑的过程中进行（见 lib/assistant/board-job.ts）。
   */
  const proposeBoard = async (board: BoardAny | PlanSpec): Promise<string> => {
    // 必填项缺了就先问老板，不列任务、不派活
    const missing = board.kind === 'plan'
      ? board.steps.flatMap((step, i) => missingFields(step).map((m) => `第 ${i + 1} 步缺${m}`))
      : missingFields(board);
    if (missing.length) return `还缺：${missing.join('、')}。请先问老板补齐，补齐后再派活，不要自己编。`;
    const steps = board.kind === 'plan' ? board.steps : [board];
    // 地基没打好（建档、账号定位、创作简报）的板块不列任务：和生成接口同一套规则，这里提前拦，不让老板确认一个跑不了的任务
    for (const need of new Set(steps.map((s) => foundationNeedOf(BOARD_TASK_TYPE[s.kind])))) {
      let blocked: string | null;
      try {
        blocked = await foundationGate(ctx.userId, need, ctx.profileId ?? null);
      } catch {
        return '暂时没有读到老板的地基进度，这次先不派活。请稍后再试。';
      }
      if (blocked) return `这次不派活：${blocked}这些板块要先打好地基才能生成，所以不列任务、不扣额度。请先告诉老板先去做上面这一步，做好以后再派。`;
    }
    const summary = board.kind === 'plan'
      ? board.steps.map((s, i) => `${i + 1}. ${summaryOf(s)}`).join('\n')
      : summaryOf(board);
    const features = [...new Set(steps.map((s) => BOARD_LABEL[s.kind].feature))].join('、');
    const isPlan = board.kind === 'plan';
    const label = isPlan ? `执行计划（${steps.length} 步）` : BOARD_LABEL[board.kind].label;
    // 板块只跑一次；不达标的地方由管理员直接修改（深度研究不改）
    const runs = revisionCapOf(board, MAX_REVISIONS);
    const run = createPendingRun({
      userId: ctx.userId,
      board,
      kind: isPlan ? 'plan' : board.kind,
      label,
      summary,
      maxRuns: runs,
      profileId: ctx.profileId ?? null,
      memoryOn: ctx.memoryOn !== false,
    });
    ctx.onAction?.({ name: 'board.run', args: { runId: run.id, board: run.kind, label, summary, maxRuns: runs, feature: features } });
    const rework = isPlan
      ? `每一步只跑一次，不达标的地方我直接修改，最多改 ${MAX_REVISIONS} 次${steps.some((s) => s.kind === 'research') ? '；深度研究那一步不改，不达标直接交给老板判断' : ''}`
      : runs === 0
        ? '只跑一次，不达标的地方直接交给老板判断'
        : `只跑一次，不达标的地方我直接修改，最多改 ${MAX_REVISIONS} 次`;
    return `已把${isPlan ? `这 ${steps.length} 步计划` : `「${label}」的任务`}列给老板，等他点确认后才开跑（${rework}，每次扣「${features}」额度）。请告诉老板在面板上确认。在他确认之前，不要说已经做好了。`;
  };

  /** 当前档案的名字（没有就空）：成交理由的店铺名称、档案里已经有的，不用老板再说一遍 */
  const currentProfileName = async (): Promise<string> => {
    const profiles = await readInternal(ctx, '/api/profiles').catch(() => []);
    const list = Array.isArray(profiles) ? (profiles as { id?: string; profile_name?: string | null }[]) : [];
    const own = list.find((p) => p.id === ctx.profileId) ?? list[0];
    return own?.profile_name?.trim() ?? '';
  };

  /** 定位、起号这类板块都要先有账号档案；没有就先请老板建档 */
  const NO_PROFILE = '还没有账号档案。请先请老板建一个档案，再派这个板块。';
  const hasProfile = async (): Promise<boolean> => {
    const profiles = await readInternal(ctx, '/api/profiles').catch(() => []);
    return Array.isArray(profiles) && profiles.length > 0;
  };

  return [
    {
      name: 'read_account',
      label: '正在查你的档案和作品',
      description:
        '读取用户的账号档案列表、每个档案已经有的定位类型，以及最近的作品和它们的进度。回答与用户账号、进度、该做什么有关的问题前先用它。结果里方括号中的编号，是修改档案、作品时要用的。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const profiles = await readInternal(ctx, '/api/profiles');
        const list = Array.isArray(profiles) ? profiles : [];
        const lines: string[] = [];
        lines.push(`账号档案 ${list.length} 个`);
        for (const p of list.slice(0, 5) as { id: string; profile_name?: string; industry?: string }[]) {
          const positions = await readInternal(ctx, `/api/positioning?profileId=${encodeURIComponent(p.id)}`).catch(() => []);
          const types = Array.isArray(positions)
            ? [...new Set((positions as { positioning_type?: string }[]).map((r) => r.positioning_type).filter(Boolean))]
            : [];
          lines.push(`- [${p.id}] ${p.profile_name || '未命名档案'}${p.industry ? `（${p.industry}）` : ''}：已有定位 ${types.length ? types.join('、') : '无'}`);
        }
        const works = await readInternal(ctx, '/api/works?limit=10').catch(() => []);
        const items = Array.isArray(works) ? (works as { id?: string; title?: string; is_done?: boolean; shoot_status?: string; updated_at?: string; stages?: { name: string; done: boolean }[] }[]) : [];
        lines.push(`最近作品 ${items.length} 条`);
        for (const w of items.slice(0, 8)) {
          const done = (w.stages ?? []).filter((s) => s.done).map((s) => s.name);
          const status = w.shoot_status === 'published' ? '已发布' : w.shoot_status === 'shot' ? '已拍摄' : w.is_done ? '内容做完、未拍' : '进行中';
          lines.push(`- [${w.id ?? ''}] 「${w.title ?? '未命名'}」${status}，已完成环节：${done.length ? done.join('、') : '无'}，最近更新 ${w.updated_at ? w.updated_at.slice(0, 10) : '未知'}`);
        }
        return clip(lines.join('\n'));
      },
    },
    {
      name: 'read_quota',
      label: '正在查你的额度',
      description: '读取用户当前套餐、各功能剩余额度、次数包余额。用户问额度够不够、能不能再生成时用它。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const q = (await readInternal(ctx, '/api/quota/check')) as {
          planName?: string;
          tightest?: { featureName: string; remaining: number } | null;
          packCredits?: number | null;
        };
        const parts = [`套餐：${q.planName ?? '免费版'}`];
        if (q.tightest) parts.push(`最紧张的功能「${q.tightest.featureName}」剩余 ${q.tightest.remaining} 次`);
        if (typeof q.packCredits === 'number') parts.push(`次数包余额 ${q.packCredits} 次`);
        return clip(parts.join('；'));
      },
    },
    {
      name: 'search_web',
      label: '正在联网查资料',
      description:
        '联网搜索最新的热点、新闻、行业动态。只在用户问最新、热点、今天发生的事、或者需要查证实时信息时使用。回答时要说明信息来源，查不到就如实说明。',
      input_schema: {
        type: 'object',
        properties: { question: { type: 'string', description: '要搜索的问题，用中文写清楚' } },
        required: ['question'],
      },
      // 资料全文要交给模型，不能像读取类工具那样只给 1500 字
      maxResultChars: 16000,
      async run(input) {
        const question = typeof input.question === 'string' ? input.question.trim() : '';
        if (!question) return '缺少要搜索的问题';
        if (!webRound) webRound = runWebSearch(question);
        return webRound;
      },
    },
    // 没接通知识库时不给这个工具：模型不会去查一个不存在的东西，回答里也不会出现「查过知识库」之类的话
    ...(knowledgeConfigured() ? [{
      name: 'search_knowledge',
      label: '正在查编导知识库',
      description:
        '查开物的编导知识库，找选题方法、脚本结构、开篇钩子、拍摄执行、账号定位这类方法论资料。用户问「怎么做」「为什么」「有什么方法」「该怎么选」时使用。账号情况、待办、额度不用它；最新热点用 search_web。回答时写出依据的是哪篇资料。',
      input_schema: {
        type: 'object',
        properties: { question: { type: 'string', description: '要查的问题，用中文写清楚' } },
        required: ['question'],
      },
      // 资料要交给模型看全，但每段已在检索结果里截到 900 字，整体上限放在 8000
      maxResultChars: 8000,
      async run(input: Record<string, unknown>) {
        const question = typeof input.question === 'string' ? input.question.trim() : '';
        if (!question) return '缺少要查的问题';
        if (!knowledgeRound) knowledgeRound = runKnowledgeSearch(question);
        return knowledgeRound;
      },
    }] : []),
    {
      name: 'propose_topic',
      label: '正在派选题板块',
      description:
        '把选题任务派给「选题策划」板块（板块用 Dify 真正产出选题，你不自己写选题）。派之前先把需求补全：要拍的方向或主题、条数、目的（流量/人设/变现，不确定就按配比）、关键词、赛道、风格、对标账号、爆款案例、创意难度。缺关键信息先问用户，不要自己编。这一步只是列给用户看，用户点确认后才开跑，每次扣选题额度。',
      input_schema: {
        type: 'object',
        properties: {
          request: { type: 'string', description: '要拍的方向或主题，用中文写清楚' },
          count: { type: 'number', description: '条数，3 到 10，默认 10' },
          role: { type: 'string', enum: ['按配比', '流量型', '人设型', '变现型'], description: '视频目的，默认按配比' },
          platform: { type: 'string', description: '发布平台，不确定就不填' },
          keywords: { type: 'array', items: { type: 'string' }, description: '关键词，最多 3 个' },
          tracks: { type: 'array', items: { type: 'string' }, description: '赛道' },
          styles: { type: 'array', items: { type: 'string' }, description: '风格' },
          benchmarkAccounts: { type: 'string', description: '对标账号（用户说了才填）' },
          viralCases: { type: 'string', description: '爆款案例（用户说了才填）' },
          difficulty: { type: 'string', enum: ['简单易上手', '中等创意', '高难度'], description: '创意难度，默认中等创意' },
          elements: { type: 'array', items: { type: 'string' }, description: '页面上选的爆款元素（名字），老板说了才填' },
        },
        required: ['request'],
      },
      async run(input) {
        const request = typeof input.request === 'string' ? input.request.trim() : '';
        if (!request) return '还不知道用户想拍什么。请先问清楚想要的方向或需求';
        const count = Math.min(10, Math.max(3, Math.round(typeof input.count === 'number' ? input.count : 10)));
        const roles = ['按配比', '流量型', '人设型', '变现型'] as const;
        const role = (roles as readonly string[]).includes(String(input.role)) ? (input.role as (typeof roles)[number]) : '按配比';
        const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);
        const keywords = strings(input.keywords).slice(0, 3);
        const tracks = strings(input.tracks);
        const styles = strings(input.styles);
        const difficulty = typeof input.difficulty === 'string' && input.difficulty.trim() ? input.difficulty.trim() : '中等创意';
        const platform = typeof input.platform === 'string' ? input.platform.trim() : '';
        return proposeBoard({
          kind: 'topic',
          input: {
            request,
            count,
            role,
            platform,
            keywords,
            tracks,
            styles,
            elements: strings(input.elements),
            benchmarkAccounts: typeof input.benchmarkAccounts === 'string' ? input.benchmarkAccounts : '',
            viralCases: typeof input.viralCases === 'string' ? input.viralCases : '',
            difficulty,
          },
        });
      },
    },
    {
      name: 'propose_script',
      label: '正在派脚本板块',
      description:
        '把拍摄需求派给「脚本生成」板块（板块用 Dify 真正写脚本，你不自己写脚本正文）。要拍的主题或内容必须说清楚；目的、平台、场景、风格不确定就不填，由板块按档案和页面默认设置处理。这一步只是列给用户看，用户点确认后才开跑，每次扣脚本额度。',
      input_schema: {
        type: 'object',
        properties: {
          request: { type: 'string', description: '要拍的主题或内容，用中文写清楚' },
          role: { type: 'string', enum: ['流量型', '人设型', '变现型'], description: '视频目的，不确定就不填' },
          platform: { type: 'string', description: '发布平台，不确定就不填，默认抖音' },
          scene: { type: 'string', description: '拍摄场景，用户说了才填' },
          style: { type: 'string', description: '风格，用户说了才填' },
        },
        required: ['request'],
      },
      async run(input) {
        const request = typeof input.request === 'string' ? input.request.trim() : '';
        if (!request) return '还不知道用户想拍什么。请先问清楚要拍的主题或内容';
        const role = (['流量型', '人设型', '变现型'] as const).find((r) => r === input.role);
        const platform = typeof input.platform === 'string' ? input.platform.trim() : '';
        const scene = typeof input.scene === 'string' ? input.scene.trim() : '';
        const style = typeof input.style === 'string' ? input.style.trim() : '';
        return proposeBoard({
          kind: 'script',
          input: { request, role, platform, scene, style },
        });
      },
    },
    {
      name: 'propose_review',
      label: '正在派审稿板块',
      description:
        '把一份口播稿派给「审稿优化」板块（板块用 Dify 逐条核对，你不自己改稿）。需要用户提供稿子的完整原文；稿子太短时先请用户补全。这一步只是列给用户看，用户点确认后才开跑，每次扣审稿额度。',
      input_schema: {
        type: 'object',
        properties: {
          draft: { type: 'string', description: '待审的口播稿原文，完整保留用户给的内容' },
          platform: { type: 'string', description: '发布平台，例如抖音、快手、视频号、小红书、B站，不确定就不填' },
          scriptType: { type: 'string', description: '脚本类型，例如教知识型、讲故事型，不确定就不填' },
        },
        required: ['draft'],
      },
      async run(input) {
        const draft = typeof input.draft === 'string' ? input.draft.trim() : '';
        if (draft.length < 30) return '稿子太短或者没有给出原文。请先请用户把要审的稿子完整发过来';
        const platform = typeof input.platform === 'string' ? input.platform.trim() : '';
        const scriptType = typeof input.scriptType === 'string' ? input.scriptType.trim() : '';
        return proposeBoard({
          kind: 'review',
          input: { draft, platform, scriptType },
        });
      },
    },
    {
      name: 'propose_title',
      label: '正在派标题板块',
      description:
        '把标题封面任务派给「标题封面」板块（板块用 Dify 写标题，你不自己写）。要有主题（一句话说清楚这条内容讲什么）；条数默认 5 个，目标人群老板说了才填。这一步只是列给老板看，确认后才开跑，每次扣标题额度。',
      input_schema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: '要起标题的主题，一句话' },
          count: { type: 'number', description: '标题个数，3 到 10，默认 5' },
          platform: { type: 'string', description: '发布平台，不确定就不填，默认抖音' },
          audience: { type: 'string', description: '目标人群，老板说了才填' },
        },
        required: ['topic'],
      },
      async run(input) {
        return proposeBoard({
          kind: 'title',
          input: { topic: str(input.topic), count: clampCount(input.count, 5, 3, 10), platform: str(input.platform), audience: str(input.audience) },
        });
      },
    },
    {
      name: 'propose_storyboard',
      label: '正在派分镜板块',
      description:
        '把分镜任务派给「分镜脚本」板块（板块用 Dify 拆镜头，你不自己拆）。要有完整的脚本原文（至少 30 字）；时长、平台不确定就不填。这一步只是列给老板看，确认后才开跑，每次扣分镜额度。',
      input_schema: {
        type: 'object',
        properties: {
          script: { type: 'string', description: '要拆分镜的脚本原文，完整保留' },
          platform: { type: 'string', description: '发布平台，不确定就不填' },
          duration: { type: 'string', description: '时长，例如 60秒，不确定就不填' },
        },
        required: ['script'],
      },
      async run(input) {
        return proposeBoard({
          kind: 'storyboard',
          input: { script: str(input.script), platform: str(input.platform), duration: str(input.duration) },
        });
      },
    },
    {
      name: 'propose_direction',
      label: '正在派方向板块',
      description:
        '把创作方向任务派给「创作方向」板块（板块用 Dify 铺开几个方向，你不自己想方向）。要有这次想达到的目的（一两句话）；个数默认 5 个。这一步只是列给老板看，确认后才开跑，每次扣方向额度。',
      input_schema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: '这次想达到的目的，一两句话' },
          count: { type: 'number', description: '方向个数，3 到 8，默认 5' },
          industry: { type: 'string', description: '行业，档案里没有时才填' },
          ideas: { type: 'string', description: '老板已有的想法，可以不填' },
        },
        required: ['goal'],
      },
      async run(input) {
        return proposeBoard({
          kind: 'direction',
          input: { goal: str(input.goal), count: clampCount(input.count, 5, 3, 8), industry: str(input.industry), ideas: str(input.ideas) },
        });
      },
    },
    {
      name: 'propose_content_plan',
      label: '正在派内容规划板块',
      description:
        '把内容规划任务派给「内容规划」板块（板块用 Dify 排一个月的内容，你不自己排）。要有这个月想主攻什么（一句话）；条数默认 12 条，这个月的大事可以不填。这一步只是列给老板看，确认后才开跑，每次扣方向额度。',
      input_schema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: '这个月想主攻什么，一句话' },
          count: { type: 'number', description: '这个月发几条，4 到 30，默认 12' },
          events: { type: 'string', description: '这个月的大事、节点，可以不填' },
        },
        required: ['goal'],
      },
      async run(input) {
        return proposeBoard({
          kind: 'content-plan',
          input: { goal: str(input.goal), count: clampCount(input.count, 12, 4, 30), events: str(input.events) },
        });
      },
    },
    {
      name: 'propose_deal_reason',
      label: '正在派成交理由板块',
      description:
        '把成交理由任务派给「成交理由」板块（板块用 Dify 逐条判断十七条成交理由是否成立，并给出怎么拍，你不自己判断）。要有店铺名称和店铺特色（具体的服务、产品、优势，没有依据的不要编）；店铺类型、目标客户老板说了才填。这一步只是列给老板看，确认后才开跑，每次扣成交理由额度。',
      input_schema: {
        type: 'object',
        properties: {
          storeName: { type: 'string', description: '店铺名称' },
          storeType: { type: 'string', description: '店铺类型，例如火锅店、美容院，老板说了才填' },
          storeFeatures: { type: 'string', description: '店铺特色：具体的服务、产品、优势' },
          targetCustomer: { type: 'string', description: '目标客户，老板说了才填' },
        },
        required: ['storeFeatures'],
      },
      async run(input) {
        // 店铺名称老板没说，就用档案里的店名（成交理由说的就是这家店）
        const storeName = str(input.storeName) || (await currentProfileName());
        return proposeBoard({
          kind: 'deal-reason',
          input: { storeName, storeType: str(input.storeType), storeFeatures: str(input.storeFeatures), targetCustomer: str(input.targetCustomer) },
        });
      },
    },
    {
      name: 'propose_work_progress',
      label: '正在准备作品进度',
      description:
        '老板说某个作品的内容做完了、或要改回没做完时使用（只改「内容做完」这一项）。作品编号从 read_account 里来（方括号中的那串）；没有编号就用作品名。这个工具不会直接改：页面上会列出要改的内容，老板点确认才生效。',
      input_schema: {
        type: 'object',
        properties: {
          workId: { type: 'string', description: '作品编号（read_account 里方括号中的那串）' },
          title: { type: 'string', description: '作品名（没有编号时用）' },
          done: { type: 'boolean', description: 'true=内容做完，false=改回没做完' },
        },
        required: ['done'],
      },
      async run(input) {
        if (typeof input.done !== 'boolean') return '要改成做完还是没做完，请先问清楚老板';
        const done = input.done;
        const works = (await readInternal(ctx, '/api/works?limit=50').catch(() => [])) as { id?: string; title?: string }[];
        const wanted = str(input.workId);
        const title = str(input.title);
        const target = works.find((w) => (wanted && w.id === wanted) || (!wanted && title && w.title === title));
        if (!target?.id) return '没有找到要改的作品。请先用 read_account 查出作品，再说清楚是哪一个。';
        const label = done ? '内容已做完' : '改回没做完';
        ctx.onAction?.({ name: 'work.progress', args: { id: target.id, title: target.title || '未命名', done, label } });
        return `已在页面上列出要修改的内容（「${target.title || '未命名'}」改为${label}），等老板点确认后才会生效。请告诉老板在页面上确认。`;
      },
    },
    {
      name: 'suggest_path',
      label: '正在看怎么做最合适',
      description:
        '老板的需求说得模糊时用（「最近没灵感」「想更新几期」「不知道拍什么」）：先判断他要做什么（need），再看账号现在有什么（档案、定位、简报、最近的结果），推荐该走哪几个板块、每一步为什么。只读，不派活。拿到推荐后，用一两句话告诉老板为什么这么做，再用 propose_plan 把这几步列给他确认。',
      input_schema: {
        type: 'object',
        properties: {
          need: {
            type: 'string',
            enum: ['inspiration', 'batch', 'script', 'title', 'storyboard', 'review', 'positioning', 'other'],
            description: '老板要做什么：inspiration 没灵感想找方向，batch 想更新几期，script 写脚本，title 起标题，storyboard 拆分镜，review 审稿，positioning 定位，other 说不清',
          },
        },
        required: ['need'],
      },
      async run(input) {
        const need = (['inspiration', 'batch', 'script', 'title', 'storyboard', 'review', 'positioning'] as const).find((n) => n === input.need) ?? 'other';
        const profiles = await readInternal(ctx, '/api/profiles').catch(() => []);
        const hasProfile = Array.isArray(profiles) && profiles.length > 0;
        const positioning = await readInternal(ctx, `/api/positioning?type=${encodeURIComponent('账号定位')}`).catch(() => []);
        const brief = await readInternal(ctx, `/api/positioning?type=${encodeURIComponent('创作简报')}`).catch(() => []);
        const results = await listRecentResults(ctx, 10);
        const recentDirectionId = results.find((r) => r.from === '创作方向')?.id;
        const advice = adviseRoute(need, {
          hasProfile,
          hasPositioning: Array.isArray(positioning) && positioning.length > 0,
          hasBrief: Array.isArray(brief) && brief.length > 0,
          recentResults: results.length,
          recentDirectionId,
        });
        if (!hasProfile) return '还没有账号档案。先请老板建一个档案，再推荐怎么做。';
        if (!advice.steps.length) return `还不能推荐路线。还缺：${advice.missing.join('、')}。先问清楚老板要做什么。`;
        const lines = advice.steps.map((s, i) => `${i + 1}. ${s.label}（${s.board}）：${s.why}${s.fromResultId ? `（接着编号 ${s.fromResultId} 的创作做）` : ''}`);
        const tail = advice.missing.length ? `\n还缺：${advice.missing.join('、')}（问老板，不要自己编）。` : '';
        // 只有一步、且是接着已有结果做的：直接用 propose_continue；多步才列计划
        const onlyContinue = advice.steps.length === 1 && advice.steps[0].fromResultId;
        const next = onlyContinue
          ? `接下来用 propose_continue（fromResultId=${advice.steps[0].fromResultId}，to=${advice.steps[0].board}）把它接着做，列给老板确认。`
          : '接下来用 propose_plan 把这几步列给老板确认；确认后按顺序跑，前一步的创作会直接接给下一步。';
        return `推荐路线（按账号现在的状态）：\n${lines.join('\n')}${tail}\n${next}`;
      },
    },
    {
      name: 'list_results',
      label: '正在查最近的创作',
      description:
        '列出这个账号最近的创作结果（板块跑出来的、页面带去下一步的），每条有编号。老板说「用刚才的」「接着写」「用那个方向」「把那条脚本拿去做选题」时，先用它找到要接着做的那一份，再用 propose_continue 带过去。只读，不改任何内容。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const list = await listRecentResults(ctx, 10);
        if (!list.length) return '这个账号还没有可以接着做的创作结果。请先让板块生成一份。';
        const lines = list.map((r) => {
          const when = new Date(r.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
          return `- 编号 ${r.id}｜${r.from || '创作'}｜${when}｜${r.title || r.preview}`;
        });
        return `最近的创作（从新到旧）：\n${lines.join('\n')}`.slice(0, 4000);
      },
    },
    {
      name: 'list_materials',
      label: '正在查素材库',
      description:
        '查看老板这个账号的素材库里有哪些文件（名称、状态）。老板问「我有哪些素材」「素材库里有什么」时用。档案不填就用当前选中的档案。',
      input_schema: {
        type: 'object',
        properties: { profileId: { type: 'string', description: '档案编号（read_account 里方括号中的那串），不填就用当前档案' } },
        required: [],
      },
      async run(input) {
        const profileId = str(input.profileId) || ctx.profileId || '';
        if (!profileId) return '还没有选账号档案，素材库需要先选一个档案。请先问老板要用哪个档案。';
        const data = (await readInternal(ctx, `/api/work-materials?profileId=${encodeURIComponent(profileId)}`).catch(() => null)) as {
          materials?: { filename?: string; status?: string }[];
        } | null;
        const list = data?.materials ?? [];
        if (!list.length) return '这个档案的素材库里还没有文件。';
        return clip(`素材库 ${list.length} 个文件：\n${list.slice(0, 30).map((m) => `- ${m.filename ?? '未命名'}（${m.status ?? '未知'}）`).join('\n')}`);
      },
    },
    {
      name: 'propose_delete_material',
      label: '正在找要删的素材',
      description:
        '老板要删掉素材库里的某个文件时使用，填文件名（list_materials 查得到）。这个工具不会直接删：页面上会列出来，老板点「确定删除」才真的删。所以回答时告诉老板「请在页面上点确定删除」。',
      input_schema: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '要删的文件名，和 list_materials 里的一致' },
          profileId: { type: 'string', description: '档案编号，不填就用当前档案' },
        },
        required: ['filename'],
      },
      async run(input) {
        const filename = str(input.filename);
        if (!filename) return '还不知道要删哪个文件。请先用 list_materials 查出文件名';
        const profileId = str(input.profileId) || ctx.profileId || '';
        if (!profileId) return '还没有选账号档案。请先问老板要用哪个档案。';
        const data = (await readInternal(ctx, `/api/work-materials?profileId=${encodeURIComponent(profileId)}`).catch(() => null)) as {
          materials?: { id?: string; filename?: string }[];
        } | null;
        const found = (data?.materials ?? []).find((m) => m.filename === filename && m.id);
        if (!found?.id) return `素材库里没有「${filename}」这个文件。请先用 list_materials 查出正确的文件名。`;
        ctx.onAction?.({ name: 'material.delete', args: { id: found.id, profileId, filename } });
        return `已在页面上列出要删除的文件「${filename}」，等老板点「确定删除」后才会删。请告诉老板在页面上确认。`;
      },
    },
    {
      name: 'propose_positioning',
      label: '正在派账号定位板块',
      description:
        '把账号定位派给「账号定位」板块（板块用 Dify 按档案写六维地基，你不自己写）。要先有账号档案，没有就请老板先建档。平台、补充要求老板说了才填。这一步只是列给老板看，确认后才开跑，每次扣定位额度。',
      input_schema: {
        type: 'object',
        properties: {
          platform: { type: 'string', description: '主平台，档案里有就不填，例如抖音、快手、视频号' },
          notes: { type: 'string', description: '老板的补充要求，没有就不填' },
        },
        required: [],
      },
      async run(input) {
        if (!(await hasProfile())) return NO_PROFILE;
        return proposeBoard({ kind: 'positioning', input: { platform: str(input.platform), notes: str(input.notes) } });
      },
    },
    {
      name: 'propose_brief',
      label: '正在派创作简报板块',
      description:
        '把创作简报派给「创作简报」板块（板块用 Dify 把账号定位转译成给选题、脚本用的简报，你不自己转译）。前提是账号定位已经做好；没有就先派账号定位。补充要求老板说了才填。这一步只是列给老板看，确认后才开跑，每次扣定位额度。',
      input_schema: {
        type: 'object',
        properties: { notes: { type: 'string', description: '老板的补充要求，没有就不填' } },
        required: [],
      },
      async run(input) {
        const rows = await readInternal(ctx, `/api/positioning?type=${encodeURIComponent('账号定位')}`).catch(() => []);
        if (!Array.isArray(rows) || rows.length === 0) return '还没有账号定位。请先派账号定位，定好以后再做创作简报。';
        return proposeBoard({ kind: 'brief', input: { notes: str(input.notes) } });
      },
    },
    {
      name: 'propose_industry_advice',
      label: '正在派行业建议板块',
      description:
        '把行业建议（给这个号开的药方）派给「行业建议」板块：按账号目的和当前阶段，写清楚每一步针对哪类人、怎么拍、什么时候换阶段（板块用 Dify 写，你不自己开）。目的和阶段必须问清楚：目的取 traffic=大流量、persona=人设型、monetize=变现型、staged=分阶段推进；阶段取 start=起号期、accumulate=积累期、scale=放量期、monetize=变现期。现状、想达到的结果老板说了才填。这一步只是列给老板看，确认后才开跑，每次扣定位额度。',
      input_schema: {
        type: 'object',
        properties: {
          purpose: { type: 'string', enum: ['traffic', 'persona', 'monetize', 'staged'], description: '账号目的，老板没说就先问' },
          stage: { type: 'string', enum: ['start', 'accumulate', 'scale', 'monetize'], description: '当前阶段，老板没说就先问' },
          situation: { type: 'string', description: '现状：发了多少条、哪类数据好、卡在哪，老板说了才填' },
          goal: { type: 'string', description: '这一阶段想达到的具体结果，老板说了才填' },
        },
        required: ['purpose', 'stage'],
      },
      async run(input) {
        if (!(await hasProfile())) return NO_PROFILE;
        return proposeBoard({
          kind: 'advice',
          input: { purpose: str(input.purpose), stage: str(input.stage), situation: str(input.situation), goal: str(input.goal) },
        });
      },
    },
    {
      name: 'propose_growth_plan',
      label: '正在派起号方案板块',
      description:
        '把起号方案派给「起号方案」板块（板块用 Dify 推起号打法、每一计说清楚第一条拍什么，你不自己推）。要先有账号档案。补充要求老板说了才填。这一步只是列给老板看，确认后才开跑，每次扣脚本额度。',
      input_schema: {
        type: 'object',
        properties: { notes: { type: 'string', description: '老板的补充要求，没有就不填' } },
        required: [],
      },
      async run(input) {
        if (!(await hasProfile())) return NO_PROFILE;
        return proposeBoard({ kind: 'growth', input: { notes: str(input.notes) } });
      },
    },
    {
      name: 'propose_opening',
      label: '正在派开篇钩子板块',
      description:
        '把开篇钩子派给「开篇钩子」板块（板块用 Dify 写开头，你不自己写）。要有这条内容讲什么（一句话）；要几条默认 3 条；老板已有的开头、想优化时才填。这一步只是列给老板看，确认后才开跑，每次扣脚本额度。',
      input_schema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: '这条内容讲什么，一句话' },
          count: { type: 'number', description: '要几条，1 到 6，默认 3' },
          currentOpening: { type: 'string', description: '老板已有的开头，想优化时才填' },
        },
        required: ['topic'],
      },
      async run(input) {
        return proposeBoard({
          kind: 'opening',
          input: { topic: str(input.topic), count: clampCount(input.count, 3, 1, 6), currentOpening: str(input.currentOpening) },
        });
      },
    },
    {
      name: 'propose_remix',
      label: '正在派跨行业二创板块',
      description:
        '把跨行业二创派给「跨行业二创」板块：拿别的行业的爆款文案，或上一步拆解的结果，借它的开篇、结构、拍法，换成老板自己的店来拍（板块用 Dify 写，你不自己写）。要有原文（至少 30 字）；方案个数默认 1 个，只认 1、2、3、5、10、15；时长、原片名、行业老板说了才填。每次扣二创额度。这一步只是列给老板看，确认后才开跑。',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要借鉴的原文，完整保留' },
          title: { type: 'string', description: '原片叫什么，老板说了才填' },
          industry: { type: 'string', description: '原片是什么行业，老板说了才填' },
          count: { type: 'number', description: '方案个数，1、2、3、5、10、15 之一，默认 1' },
          duration: { type: 'string', description: '时长，例如 60秒，不填跟原片' },
          notes: { type: 'string', description: '老板的补充要求，没有就不填' },
        },
        required: ['text'],
      },
      async run(input) {
        return proposeBoard({
          kind: 'remix',
          input: {
            text: str(input.text),
            title: str(input.title),
            industry: str(input.industry),
            count: clampCount(input.count, 1, 1, 15),
            duration: str(input.duration),
            notes: str(input.notes),
          },
        });
      },
    },
    {
      name: 'propose_breakdown',
      label: '正在派文案拆解板块',
      description:
        '把文案拆解派给「拆解爆款」板块的文字版：老板贴的文案原文，板块拆结构和表达机制，找出可以保留和改进的地方（板块用 Dify 拆，你不自己拆）。要有完整原文（至少 30 字）。视频截图的拆解要老板去拆解页面上传视频，这里不做。这一步只是列给老板看，确认后才开跑，每次扣拆解额度。',
      input_schema: {
        type: 'object',
        properties: { script: { type: 'string', description: '要拆解的文案原文，完整保留' } },
        required: ['script'],
      },
      async run(input) {
        return proposeBoard({ kind: 'breakdown', input: { script: str(input.script) } });
      },
    },
    {
      name: 'propose_research',
      label: '正在派深度研究板块',
      description:
        '把深度研究派给「深度研究」板块：围绕主题联网搜集网页、逐个子问题读正文，写成带来源编号的研究报告（报告由板块的研究接口生成，你不自己写）。主题要说清楚，4 到 500 字。深度：quick 快速（约 3～5 分钟）、standard 标准（默认，约 6～10 分钟）、deep 深入（约 12～20 分钟）。老板给的背景资料、上一步的产出可以填进 material。每次扣研究额度，耗时长。这一步只是列给老板看，他在面板上确认后才开跑。',
      input_schema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: '研究主题，用中文写清楚，4 到 500 字' },
          depth: { type: 'string', enum: ['quick', 'standard', 'deep'], description: '深度，不确定就按 standard' },
          material: { type: 'string', description: '老板给的背景资料，没有就不填' },
        },
        required: ['topic'],
      },
      async run(input) {
        const topic = str(input.topic);
        if (!topic) return '还不知道要研究什么。请先问清楚研究主题';
        return proposeBoard({
          kind: 'research',
          input: { topic, depth: isDepth(input.depth) ? input.depth : 'standard', material: str(input.material) },
        });
      },
    },
    {
      name: 'propose_continue',
      label: '正在接着上一步的结果派活',
      description:
        '把一份已经做好的创作结果（编号从 list_results 查得到）带去另一个板块接着做，走页面「带去下一步」同样的路子：原方向、目的、创作设置、当前脚本、开头都跟着过去，不会丢。to 填要去的板块：topic 选题、script 脚本、review 审稿、storyboard 分镜、title 标题、opening 开篇、direction 创作方向、positioning 账号定位、brief 创作简报、remix 跨行业二创、breakdown 文案拆解。request 填老板这次的具体要求（例如「写 3 个选题」「改成口播」），没有就不填，由带过来的内容决定。这一步只是列给老板看，确认后才开跑。',
      input_schema: {
        type: 'object',
        properties: {
          fromResultId: { type: 'string', description: '要接着做的那份结果的编号（list_results 里的）' },
          to: { type: 'string', enum: ['topic', 'script', 'review', 'storyboard', 'title', 'opening', 'direction', 'positioning', 'brief', 'remix', 'breakdown'], description: '要去的板块' },
          request: { type: 'string', description: '老板这次的具体要求，没有就不填' },
          count: { type: 'number', description: '条数或方案个数，老板说了才填' },
          platform: { type: 'string', description: '发布平台，不确定就不填' },
        },
        required: ['fromResultId', 'to'],
      },
      async run(input) {
        const id = str(input.fromResultId);
        if (!id) return '还不知道要接着哪份结果做。请先用 list_results 查最近的创作，选出要接着做的那一份';
        const to = str(input.to);
        const board = continueBoard(to, str(input.request), typeof input.count === 'number' ? input.count : undefined, str(input.platform));
        if (!board) return `「${to || '这个'}」板块不能接着做。可以接着做的有：选题、脚本、审稿、分镜、标题、开篇、创作方向、账号定位、创作简报、跨行业二创、文案拆解`;
        const carry = await loadCarry(ctx, id);
        if (!carry) return `没有找到结果编号「${id}」。请先用 list_results 查最近的创作，再用正确的编号。`;
        return proposeBoard(applyCarry(board, carry));
      },
    },
    {
      name: 'propose_plan',
      label: '正在整理执行计划',
      description:
        '老板的需求要几步才能做完时，先把计划列出来（最多 5 步，按顺序执行，前一步的产出交给后一步）。每一步 board 填板块：topic 选题、script 脚本、review 审稿、title 标题、storyboard 分镜、direction 方向、content-plan 内容规划、deal-reason 成交理由、positioning 账号定位、brief 创作简报、advice 行业建议、growth 起号方案、opening 开篇钩子、remix 跨行业二创、breakdown 文案拆解、research 深度研究（主题 4 字以上，耗时长）；text 填这一步的主要输入（主题、要拍的内容、稿子原文、脚本原文、定位的补充要求或目的）。行业建议的目的和阶段计划里给不了，会被挡住让老板补。计划只是列给老板看，他确认后才开跑。',
      input_schema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: {
              type: 'object',
              properties: {
                board: {
                  type: 'string',
                  enum: ['topic', 'script', 'review', 'title', 'storyboard', 'direction', 'content-plan', 'deal-reason', 'positioning', 'brief', 'advice', 'growth', 'opening', 'remix', 'breakdown', 'research'],
                },
                text: { type: 'string', description: '这一步的主要输入' },
                count: { type: 'number', description: '条数，不确定就不填' },
                platform: { type: 'string', description: '平台，不确定就不填' },
              },
              required: ['board', 'text'],
            },
          },
        },
        required: ['steps'],
      },
      async run(input) {
        const raw = Array.isArray(input.steps) ? (input.steps as Record<string, unknown>[]) : [];
        if (raw.length < 1 || raw.length > 5) return '计划要 1 到 5 步。请先把计划拆成这个范围内的几步';
        const steps: BoardAny[] = [];
        for (let i = 0; i < raw.length; i++) {
          const b = stepToBoard(raw[i]);
          if (!b) return `第 ${i + 1} 步的板块不认识。板块只能是选题、脚本、审稿、标题、分镜、方向、内容规划、成交理由、账号定位、创作简报、行业建议、起号方案、开篇钩子、跨行业二创、文案拆解、深度研究`;
          steps.push(b);
        }
        return proposeBoard({ kind: 'plan', steps });
      },
    },
    {
      name: 'add_todo',
      label: '正在记下这条待办',
      description:
        '把用户说的待办、计划记进开物的待办（工作台的待办里能看到；打开工作台时会提示到期的事）。用户说了日期，就换算成 YYYY-MM-DD 填进 dueDate；没说日期就不填。',
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '要做的事，用一句话写清楚' },
          dueDate: { type: 'string', description: '到期日期，YYYY-MM-DD（北京时间）；没有日期就不填' },
        },
        required: ['content'],
      },
      async run(input) {
        const content = typeof input.content === 'string' ? input.content.trim() : '';
        if (!content) return '还不知道要记什么。请先问清楚用户要记的事';
        const dueDate = typeof input.dueDate === 'string' && isDateText(input.dueDate.trim()) ? input.dueDate.trim() : null;
        const key = `${content}|${dueDate ?? ''}`;
        const again = addedTodos.get(key);
        if (again) return `这条待办刚才已经记过了（编号 ${again}），不用重复记。`;
        const res = await doFetch(`${internalBase(ctx)}/api/todos`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: ctx.cookie },
          body: JSON.stringify({ content, dueAt: dueDate ? dueAtOf(dueDate) : null }),
          cache: 'no-store',
        });
        if (!res.ok) {
          emit({ kind: 'todo.add', ok: false, text: `待办「${content}」没有记下来` });
          return '待办没有记下来，请如实告诉用户，并请用户稍后再试';
        }
        const row = (await res.json().catch(() => null)) as { id?: string } | null;
        const id = row?.id ?? '';
        if (id) addedTodos.set(key, id);
        emit({
          kind: 'todo.add',
          ok: true,
          text: `已新增待办：「${content}」${dueDate ? `，${dateLabel(dueDate)}到期` : ''}`,
          undo: id ? { type: 'todo_delete', id } : undefined,
        });
        return `已记下待办：「${content}」${dueDate ? `，到期 ${dueDate}` : ''}。它会出现在工作台的待办里；打开工作台时会提示你到期的事。`;
      },
    },
    {
      name: 'list_todos',
      label: '正在查你的待办',
      description:
        '查看用户记下的待办和计划，以及哪些已经到期。用户问「我有什么要做的」「提醒我」这类问题时使用。结果里每条前面方括号中的编号，是修改、完成、删除时要用的。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const list = await todosRead().catch(() => null);
        if (!list) return '待办暂时没有读出来，请如实告诉用户';
        const open = list.filter((t) => !t.done);
        if (!open.length) return '用户现在没有未完成的待办。';
        const now = Date.now();
        const lines = open.map((t) => {
          const due = t.due_at ? new Date(t.due_at) : null;
          const day = due ? shanghaiDay(due) : null;
          const overdue = !!due && due.getTime() < now;
          return `- [${t.id}] ${t.content}${day ? `｜到期 ${day}` : ''}${overdue ? '（已到期）' : ''}`;
        });
        return `未完成的待办 ${open.length} 条：\n${lines.join('\n')}`;
      },
    },
    {
      name: 'update_todo',
      label: '正在修改待办',
      description:
        '修改用户已经记下的一条待办：改内容，或改到期日期。先用 list_todos 找到它的编号（方括号里的那串）。要改的日期换算成 YYYY-MM-DD；要去掉到期日期就把 clearDue 填 true。',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '待办的编号（list_todos 里方括号中的那串）' },
          content: { type: 'string', description: '新的内容；不改就不填' },
          dueDate: { type: 'string', description: '新的到期日期 YYYY-MM-DD；不改就不填' },
          clearDue: { type: 'boolean', description: '去掉到期日期时填 true' },
        },
        required: ['id'],
      },
      async run(input) {
        const id = typeof input.id === 'string' ? input.id.trim() : '';
        if (!id) return '缺少待办的编号。请先用 list_todos 查出编号';
        const content = typeof input.content === 'string' ? input.content.trim() : '';
        const dueDate = typeof input.dueDate === 'string' && isDateText(input.dueDate.trim()) ? input.dueDate.trim() : null;
        const clearDue = input.clearDue === true;
        if (!content && !dueDate && !clearDue) return '没有说要改什么。请先问清楚用户想改内容还是日期';
        const found = (await todosRead().catch(() => [] as TodoItem[])).find((t) => t.id === id);
        if (!found) {
          emit({ kind: 'todo.update', ok: false, text: '没有找到要修改的待办' });
          return '没有找到这条待办（编号不对或已经删除）。请如实告诉用户，并先用 list_todos 找到正确的那条。';
        }
        const body: Record<string, unknown> = {};
        const undoBody: { content?: string; dueAt?: string | null } = {};
        if (content) {
          body.content = content;
          undoBody.content = found.content;
        }
        if (dueDate || clearDue) {
          body.dueAt = dueDate ? dueAtOf(dueDate) : null;
          undoBody.dueAt = found.due_at;
        }
        const res = await todoPatch(id, body);
        if (!res.ok) {
          emit({ kind: 'todo.update', ok: false, text: `待办「${found.content}」没有改成功` });
          return '待办没有改成功，请如实告诉用户，并请用户稍后再试';
        }
        const newContent = content || found.content;
        const dueText = dueDate ? `，到期改为 ${dateLabel(dueDate)}` : clearDue ? '，已去掉到期日期' : '';
        emit({
          kind: 'todo.update',
          ok: true,
          text: `已修改待办：「${found.content}」→「${newContent}」${dueText}`,
          undo: { type: 'todo_patch', id, body: undoBody },
        });
        return `已修改待办：「${newContent}」${dueDate ? `，到期 ${dueDate}` : clearDue ? '，已去掉到期日期' : ''}。`;
      },
    },
    {
      name: 'complete_todo',
      label: '正在标记完成',
      description: '把用户的一条待办标记为完成。先用 list_todos 找到它的编号。',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string', description: '待办的编号（list_todos 里方括号中的那串）' } },
        required: ['id'],
      },
      async run(input) {
        const id = typeof input.id === 'string' ? input.id.trim() : '';
        if (!id) return '缺少待办的编号。请先用 list_todos 查出编号';
        const found = (await todosRead().catch(() => [] as TodoItem[])).find((t) => t.id === id);
        if (!found) {
          emit({ kind: 'todo.complete', ok: false, text: '没有找到要完成的待办' });
          return '没有找到这条待办（编号不对或已经删除）。请如实告诉用户，并先用 list_todos 找到正确的那条。';
        }
        if (found.done) return `「${found.content}」已经是完成的了，不用再标记。`;
        const res = await todoPatch(id, { done: true });
        if (!res.ok) {
          emit({ kind: 'todo.complete', ok: false, text: `待办「${found.content}」没有标记成功` });
          return '待办没有标记成功，请如实告诉用户，并请用户稍后再试';
        }
        emit({ kind: 'todo.complete', ok: true, text: `已标记完成：「${found.content}」`, undo: { type: 'todo_patch', id, body: { done: false } } });
        return `已把「${found.content}」标记为完成。`;
      },
    },
    {
      name: 'propose_delete_todo',
      label: '正在找要删的待办',
      description:
        '用户要删掉某一条待办时使用，填它的编号（list_todos 里方括号中的那串）。这个工具不会直接删：页面上会列出这条待办，用户点「确定删除」才真的删。所以回答时告诉用户「请在页面上点确定删除」。',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string', description: '待办的编号' } },
        required: ['id'],
      },
      async run(input) {
        const id = typeof input.id === 'string' ? input.id.trim() : '';
        if (!id) return '缺少待办的编号。请先用 list_todos 查出编号';
        const found = (await todosRead().catch(() => [] as TodoItem[])).find((t) => t.id === id);
        if (!found) return '没有找到这条待办（编号不对或已经删除）。请如实告诉用户，并先用 list_todos 找到正确的那条。';
        ctx.onAction?.({ name: 'todo.delete', args: { id, content: found.content } });
        return `已在页面上列出「${found.content}」，等用户点「确定删除」后才会删。请告诉用户在页面上点确定删除。`;
      },
    },
    {
      name: 'play_ambient',
      label: '正在打开白噪音',
      description:
        '在页面上播放开物里的环境声。白噪音就是「专注」。用户说要播放白噪音、雨声、咖啡馆这类声音，或想专注时使用；说了时长就设定时间到了自动停。',
      input_schema: {
        type: 'object',
        properties: {
          sound: { type: 'string', description: '声音：白噪音（专注）、雨声、咖啡馆、篝火、翻书、海浪' },
          minutes: { type: 'number', description: '播放多少分钟后自动停；没说就不定时' },
        },
        required: ['sound'],
      },
      async run(input) {
        const sound = resolveSound(input.sound);
        if (!sound) return `没有这种声音。开物里有：${soundChoices()}（白噪音就是「专注」）`;
        const minutes = clampMinutes(input.minutes);
        const name = AMBIENT_SOUNDS.find((x) => x.id === sound)?.name ?? sound;
        ctx.onAction?.({ name: 'ambient.play', args: { sound, minutes } });
        emit({ kind: 'ambient.play', ok: true, text: `已安排播放「${name}」${minutes ? `，${minutes} 分钟后自动停` : ''}` });
        return `已安排在页面上播放「${name}」${minutes ? `，${minutes} 分钟后自动停` : ''}。`;
      },
    },
    {
      name: 'stop_ambient',
      label: '正在停止声音',
      description: '停止页面上正在播放的环境声。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        ctx.onAction?.({ name: 'ambient.stop', args: {} });
        emit({ kind: 'ambient.stop', ok: true, text: '已安排停止播放' });
        return '已安排停止播放。';
      },
    },
    {
      name: 'remember',
      label: '正在记下来',
      description:
        '把用户长期有用的事记进助理的记忆：偏好、账号情况、长期要遵守的要求。一句话写清楚。闲聊和一次性的事不记；密码、证件号、银行卡、手机号不记。「用户的记忆」里已经有的，也调用一次 remember：它会识别出重复、不再重复存，并告诉你已经记着了；不要自己直接说「已经记住」。要修改其中一条，填 replaceId（用记忆里方括号中的编号）。',
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '要记住的事，一句话，写清楚是谁、什么事' },
          replaceId: { type: 'string', description: '要改写的那条记忆的编号；新增时不填' },
        },
        required: ['content'],
      },
      async run(input) {
        const content = typeof input.content === 'string' ? input.content : '';
        const replaceId = typeof input.replaceId === 'string' ? input.replaceId.trim() : '';
        try {
          if (replaceId) {
            const r = await updateMemory(ctx.userId, replaceId, content);
            if (!r.ok) {
              emit({ kind: 'memory.update', ok: false, text: '这条记忆没有改成功' });
              return `没有改成功：${r.reason}`;
            }
            emit({ kind: 'memory.update', ok: true, text: `已把这条记忆改成「${r.memory.content}」` });
            return `已把这条记忆改成「${r.memory.content}」。`;
          }
          const r = await addMemory(ctx.userId, content);
          if (!r.ok) {
            emit({ kind: 'memory.add', ok: false, text: '这件事没有记进记忆' });
            return `没有记下来：${r.reason}`;
          }
          // 已经记着的同一件事，也算「记着了」，回执照给，免得回答说「已记下」却没有回执
          emit({ kind: 'memory.add', ok: true, text: r.duplicate ? `这件事已经记着了：「${r.memory.content}」` : `已记住：「${r.memory.content}」` });
          if (r.duplicate) return `这件事已经记着了：「${r.memory.content}」，不用重复记。`;
          return `已记下：「${r.memory.content}」。之后的对话会记得这件事，用户可以在助理的「记忆」里查看和删除。`;
        } catch {
          emit({ kind: 'memory.add', ok: false, text: '记忆暂时没有存下来' });
          return '记忆暂时没有存下来，请如实告诉用户，并请用户稍后再试';
        }
      },
    },
    {
      name: 'propose_forget',
      label: '正在找要忘掉的这条',
      description:
        '用户要助理忘掉某一条记忆时使用，填「用户的记忆」里的编号。这个工具不会直接删除：页面上会弹出确认，用户点「确定忘掉」才真的删。所以回答时告诉用户「请在页面上点确认」。',
      input_schema: {
        type: 'object',
        properties: { memoryId: { type: 'string', description: '记忆的编号（方括号中的那串）' } },
        required: ['memoryId'],
      },
      async run(input) {
        const memoryId = typeof input.memoryId === 'string' ? input.memoryId.trim() : '';
        if (!memoryId) return '缺少记忆的编号';
        try {
          const found = (await listMemories(ctx.userId, MEMORY_MAX_COUNT)).find((m) => m.id === memoryId);
          if (!found) return '没有找到这条记忆。请如实告诉用户，并请用户说清楚是哪一条。';
          ctx.onAction?.({ name: 'memory.forget', args: { id: found.id, content: found.content } });
          return `已在页面上列出「${found.content}」，等用户点确认后才会忘掉。请告诉用户在页面上点「确定忘掉」。`;
        } catch {
          return '记忆暂时读不出来，请如实告诉用户，稍后再试';
        }
      },
    },
    {
      name: 'save_note',
      label: '正在存笔记',
      description:
        '把用户想记下来的想法、灵感、要点存成笔记（创意类内容比待办更合适）。一句或几句写清楚。有日期、要去做的事，用 add_todo 记待办，不用这个。',
      input_schema: {
        type: 'object',
        properties: { content: { type: 'string', description: '笔记内容' } },
        required: ['content'],
      },
      async run(input) {
        const content = typeof input.content === 'string' ? input.content.trim().slice(0, 1000) : '';
        if (!content) return '还不知道要存什么笔记。请先问清楚用户想记的内容';
        const again = addedNotes.get(content);
        if (again) return '这条笔记刚才已经存过了，不用重复存。';
        const res = await doFetch(`${base}/api/assistant/notes`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: ctx.cookie },
          body: JSON.stringify({ content }),
          cache: 'no-store',
        });
        if (!res.ok) {
          emit({ kind: 'note.add', ok: false, text: '笔记没有存下来' });
          return '笔记没有存下来，请如实告诉用户，并请用户稍后再试';
        }
        const data = (await res.json().catch(() => null)) as { note?: { id?: string } } | null;
        const id = data?.note?.id ?? '';
        if (id) addedNotes.set(content, id);
        const short = content.length > 40 ? `${content.slice(0, 40)}…` : content;
        emit({ kind: 'note.add', ok: true, text: `已存笔记：「${short}」`, undo: id ? { type: 'note_delete', id } : undefined });
        return `已存成笔记：「${content}」。在助理的笔记里能找到。`;
      },
    },
    {
      name: 'list_notes',
      label: '正在查笔记',
      description: '查看用户存过的笔记（最近的在前）。用户问「我之前记过什么想法」「我的笔记」时使用。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const res = await doFetch(`${base}/api/assistant/notes`, { headers: { cookie: ctx.cookie }, cache: 'no-store' });
        if (!res.ok) return '笔记暂时没有读出来，请如实告诉用户';
        const data = (await res.json().catch(() => null)) as { notes?: { content: string }[] } | null;
        const list = data?.notes ?? [];
        if (!list.length) return '用户还没有存过笔记。';
        return clip(`笔记 ${list.length} 条（最近的在前）：\n${list.slice(0, 20).map((n) => `- ${n.content}`).join('\n')}`);
      },
    },
    {
      name: 'open_page',
      label: '正在打开页面',
      description:
        `帮用户走到开物里的某个页面（回答结束后自动跳转，只能去下面这些页面，不能替用户在页面里填内容）。page 可选：${Object.entries(OPEN_PAGES).map(([k, v]) => `${k}（${v.label}）`).join('、')}。`,
      input_schema: {
        type: 'object',
        properties: { page: { type: 'string', enum: Object.keys(OPEN_PAGES), description: '页面编号' } },
        required: ['page'],
      },
      async run(input) {
        const page = typeof input.page === 'string' ? input.page : '';
        if (!Object.prototype.hasOwnProperty.call(OPEN_PAGES, page)) return '没有这个页面。请告诉用户能去的页面有哪些。';
        const target = OPEN_PAGES[page];
        ctx.onAction?.({ name: 'page.open', args: { page } });
        emit({ kind: 'page.open', ok: true, text: `已安排打开「${target.label}」页面` });
        return `已安排打开「${target.label}」页面（回答结束后自动跳转）。`;
      },
    },
    {
      name: 'propose_profile_update',
      label: '正在准备档案修改',
      description:
        '用户要改账号档案的名称或行业时使用（只支持这两项）。这个工具不会直接改：页面上会列出要改的内容，用户点「确定修改」才真的改。档案编号从 read_account 里来；只有一个档案或用户已选中的档案，可以不填。',
      input_schema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: '档案编号（read_account 里方括号中的那串）' },
          field: { type: 'string', enum: ['profile_name', 'industry'], description: 'profile_name=档案名称，industry=行业' },
          value: { type: 'string', description: '新的值' },
        },
        required: ['field', 'value'],
      },
      async run(input) {
        const field = input.field === 'profile_name' || input.field === 'industry' ? input.field : null;
        const value = typeof input.value === 'string' ? input.value.trim().slice(0, 60) : '';
        if (!field || !value) return '要改的项或新的值没有说清楚。请先问清楚用户要改哪一项、改成什么';
        const profiles = (await readInternal(ctx, '/api/profiles').catch(() => [])) as { id: string; profile_name?: string; industry?: string }[];
        const wanted = typeof input.profileId === 'string' ? input.profileId : '';
        const target = profiles.find((p) => p.id === wanted) ?? profiles.find((p) => p.id === ctx.profileId) ?? (profiles.length === 1 ? profiles[0] : undefined);
        if (!target) return '没有确定要改哪个档案。请如实告诉用户，请他在「账号档案」页面里选中要改的那个。';
        const label = field === 'profile_name' ? '档案名称' : '行业';
        const old = (field === 'profile_name' ? target.profile_name : target.industry) || '未填';
        ctx.onAction?.({ name: 'profile.update', args: { id: target.id, field, value, label, from: old, profileName: target.profile_name || '未命名档案' } });
        return `已在页面上列出要修改的内容（${target.profile_name || '未命名档案'}：${label}由「${old}」改为「${value}」），等用户点「确定修改」后才会生效。请告诉用户在页面上确认。`;
      },
    },
    {
      name: 'propose_create_profile',
      label: '正在准备新建档案',
      description:
        '用户要新建一个账号档案时使用。这个工具只填档案名称和行业；其它信息（定位、经营品类、人设等）请用户建好后到「账号档案」页面补。这个工具不会直接建：页面上会列出要建的档案，用户点「确定新建」才真的建。',
      input_schema: {
        type: 'object',
        properties: {
          profileName: { type: 'string', description: '档案名称' },
          industry: { type: 'string', description: '行业；不知道就不填' },
        },
        required: ['profileName'],
      },
      async run(input) {
        const profileName = typeof input.profileName === 'string' ? input.profileName.trim().slice(0, 60) : '';
        const industry = typeof input.industry === 'string' ? input.industry.trim().slice(0, 60) : '';
        if (!profileName) return '还不知道档案叫什么名字。请先问清楚用户想叫什么';
        ctx.onAction?.({ name: 'profile.create', args: { profileName, industry } });
        return `已在页面上列出要新建的档案「${profileName}」，等用户点「确定新建」后才会建。请告诉用户在页面上确认；定位、经营品类等建好后再到「账号档案」页面补。`;
      },
    },
    {
      name: 'propose_work_status',
      label: '正在准备作品状态',
      description:
        '用户说某个作品已经拍了、已经发布了、或改回还没拍时使用。这个工具不会直接改：页面上会列出要改的内容，用户点「确定修改」才生效。作品编号从 read_account 里来（方括号中的那串）；没有编号就用作品名。',
      input_schema: {
        type: 'object',
        properties: {
          workId: { type: 'string', description: '作品编号（read_account 里方括号中的那串）' },
          title: { type: 'string', description: '作品名（没有编号时用）' },
          status: { type: 'string', enum: ['none', 'shot', 'published'], description: 'none=未拍，shot=已拍摄，published=已发布' },
        },
        required: ['status'],
      },
      async run(input) {
        const status = typeof input.status === 'string' && Object.prototype.hasOwnProperty.call(WORK_STATUS_LABEL, input.status) ? input.status : null;
        if (!status) return '要改成什么状态没有说清楚。请先问清楚：未拍、已拍摄，还是已发布';
        const works = (await readInternal(ctx, '/api/works?limit=50').catch(() => [])) as { id?: string; title?: string }[];
        const wanted = typeof input.workId === 'string' ? input.workId : '';
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        const target = works.find((w) => (wanted && w.id === wanted) || (!wanted && title && w.title === title));
        if (!target?.id) return '没有找到要改的作品。请先用 read_account 查出作品，再说清楚是哪一个。';
        const label = WORK_STATUS_LABEL[status];
        ctx.onAction?.({ name: 'work.status', args: { id: target.id, status, title: target.title || '未命名', label } });
        return `已在页面上列出要修改的内容（「${target.title || '未命名'}」改为${label}），等用户点「确定修改」后才会生效。请告诉用户在页面上确认。`;
      },
    },
    {
      name: 'daily_brief',
      label: '正在整理今天的安排',
      description:
        '给用户一份今天的安排：今天到期和已经过期的待办、还没拍的作品、额度。用户问「今天要做什么」「今天的安排」时用。这是按需生成的，不会主动推送。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const [todos, quota, works] = await Promise.all([
          todosRead().catch(() => null),
          readInternal(ctx, '/api/quota/check').catch(() => null) as Promise<{ planName?: string } | null>,
          readInternal(ctx, '/api/works?limit=20').catch(() => null),
        ]);
        const lines: string[] = [];
        const today = shanghaiDay(new Date());
        if (todos) {
          const open = todos.filter((t) => !t.done);
          const overdue = open.filter((t) => t.due_at && shanghaiDay(t.due_at) < today);
          const dueToday = open.filter((t) => t.due_at && shanghaiDay(t.due_at) === today);
          lines.push(`待办：未完成 ${open.length} 条，今天到期 ${dueToday.length} 条，已过期 ${overdue.length} 条`);
          for (const t of overdue) lines.push(`- [${t.id}] ${t.content}（已过期）`);
          for (const t of dueToday) lines.push(`- [${t.id}] ${t.content}（今天到期）`);
        } else {
          lines.push('待办暂时读不出来');
        }
        if (Array.isArray(works)) {
          const unshot = (works as { shoot_status?: string }[]).filter((w) => w.shoot_status === 'none').length;
          lines.push(`作品：还没拍的 ${unshot} 条`);
        }
        if (quota?.planName) lines.push(`套餐：${quota.planName}`);
        return clip(lines.join('\n'));
      },
    },
  ];
}
