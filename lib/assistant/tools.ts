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
import { BOARD_LABEL, internalBase, readInternal, type BoardHistoryRow, type BoardInput, type BoardKind } from './boards';
import { createPendingRun } from './pending-runs';
import { MAX_BOARD_RUNS } from './manager';
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
  const proposeBoard = (kind: BoardKind, board: BoardInput, summary: string): string => {
    const meta = BOARD_LABEL[kind];
    const run = createPendingRun({
      userId: ctx.userId,
      board,
      kind,
      label: meta.label,
      summary,
      maxRuns: MAX_BOARD_RUNS,
      profileId: ctx.profileId ?? null,
      memoryOn: ctx.memoryOn !== false,
    });
    ctx.onAction?.({ name: 'board.run', args: { runId: run.id, board: kind, label: meta.label, summary, maxRuns: MAX_BOARD_RUNS, feature: meta.feature } });
    return `已把「${meta.label}」的任务列给用户，等他点确认后才开跑（最多跑 ${MAX_BOARD_RUNS} 次，每次扣一次「${meta.feature}」额度；不达标我会让板块返工）。请告诉用户在面板上确认。在他确认之前，不要说已经做好了。`;
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
        const summary = [
          `选题 ${count} 条（${role}）`,
          `方向：${request}`,
          platform ? `平台：${platform}` : '',
          keywords.length ? `关键词：${keywords.join('、')}` : '',
          tracks.length ? `赛道：${tracks.join('、')}` : '',
          `难度：${difficulty}`,
        ].filter(Boolean).join('｜');
        return proposeBoard('topic', {
          kind: 'topic',
          input: {
            request,
            count,
            role,
            platform,
            keywords,
            tracks,
            styles,
            benchmarkAccounts: typeof input.benchmarkAccounts === 'string' ? input.benchmarkAccounts : '',
            viralCases: typeof input.viralCases === 'string' ? input.viralCases : '',
            difficulty,
          },
        }, summary);
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
        const summary = [`脚本：${request}`, role ? `目的：${role}` : '', platform ? `平台：${platform}` : '', scene ? `场景：${scene}` : '', style ? `风格：${style}` : '']
          .filter(Boolean).join('｜');
        return proposeBoard('script', {
          kind: 'script',
          input: { request, role, platform, scene, style },
        }, summary);
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
        const summary = `审稿：${draft.slice(0, 30)}${draft.length > 30 ? '…' : ''}｜${platform || '抖音'}`;
        return proposeBoard('review', {
          kind: 'review',
          input: { draft, platform, scriptType },
        }, summary);
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
        '把用户长期有用的事记进助理的记忆：偏好、账号情况、长期要遵守的要求。一句话写清楚。闲聊和一次性的事不记；密码、证件号、银行卡、手机号不记。「用户的记忆」里已经有的不要重复记；要修改其中一条，填 replaceId（用记忆里方括号中的编号）。',
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
