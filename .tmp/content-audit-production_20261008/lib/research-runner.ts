/**
 * 深度研究的后台执行（服务端）。纯逻辑在 lib/research。
 *
 * 【关掉页面也能跑完】任务状态全在 research_jobs 表里，执行时每 30 秒写一次心跳。
 * 页面每几秒来问一次进度（GET /api/research?id=），发现任务还在「研究中」但心跳停了 3 分钟以上
 * （比如服务器重启、部署），就从没做完的那一步接着跑——做完的子问题不重做、读过的网页不重读。
 * 抢任务用一条带条件的 update（心跳为空或过期才抢得到），多进程也不会两边同时跑一个任务。
 *
 * 【次数】确认计划、开始研究时预占一次（kaiwu_research_quota），真正发出第一次搜索时记为用掉；
 * 一次都没搜就失败或被停止，预占退回。失败的步骤重试不再扣次数。
 */
import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import type { ChatAttachment } from '@/lib/chat-attachments';
import { askDify } from '@/lib/dify-task';
import { aliSearch, SEARCH_FAILURE_TEXT, type SearchHit } from '@/lib/ali-search';
import { getSearchConfig, type SearchConfig } from '@/lib/search-config';
import { fetchPage } from '@/lib/page-fetch';
import { extractMainText } from '@/lib/html-text';
import { freeChatWebQuery, pickFreeChatSources, readOfficialDocumentation } from '@/lib/web-source-quality';
import { DEEP_RESEARCH_LIMITS } from '@/lib/config/plans';
import {
  DEPTHS, assembleReport, buildNotePrompt, buildSummaryPrompt, buildPlanPrompt, parsePlan, pickCandidates, siteOf,
  type ResearchDepth, type ResearchPlan, type ResearchStatus, type ResearchStep, type SourceRow,
} from '@/lib/research';

export const STALE_MS = 3 * 60_000;
const BEAT_MS = 30_000;
/** 一个账号同时最多跑几个研究 */
export const MAX_RUNNING = 2;

export interface ResearchQuota { plan: string; limit: number; used: number; pending: number; remaining: number; allowed: boolean; reason?: string; requestId?: string | null; periodEnd?: string | null }

export async function readResearchQuota(userId: string): Promise<ResearchQuota> {
  const { data, error } = await getServiceSupabase().rpc('kaiwu_research_quota', { p_user_id: userId, p_limits: DEEP_RESEARCH_LIMITS, p_request_id: null });
  if (error || !data) throw new Error('深度研究次数暂时查不到');
  return data as ResearchQuota;
}

export async function reserveResearch(userId: string): Promise<ResearchQuota> {
  const id = randomUUID();
  const { data, error } = await getServiceSupabase().rpc('kaiwu_research_quota', { p_user_id: userId, p_limits: DEEP_RESEARCH_LIMITS, p_request_id: id });
  if (error || !data) throw new Error('深度研究次数暂时查不到');
  return data as ResearchQuota;
}

export async function settleResearch(requestId: string | null | undefined, state: 'started' | 'released') {
  if (!requestId) return;
  const { error } = await getServiceSupabase().rpc('kaiwu_settle_research', { p_request_id: requestId, p_state: state });
  if (error) throw new Error('研究次数记账暂时失败，请稍后重试');
}

/** 用户看得懂的「为什么不能用」 */
export function quotaMessage(q: Pick<ResearchQuota, 'reason' | 'limit' | 'plan'>): string {
  switch (q.reason) {
    case 'plan_not_included': return '深度研究报告是专业会员（¥99/月）和高频会员（¥199/月）的功能，升级后即可使用';
    case 'membership_expired': return '会员已到期，续费后可以继续使用深度研究';
    case 'account_inactive': return '账号已停用，请联系客服';
    case 'period_unavailable': return '本期会员额度还没开始，请刷新页面后再试';
    case 'too_many_jobs': return '最多同时保留两个待确认或进行中的研究，请先完成或停止一个';
    case 'planning_limit': return '今天拟定研究计划已达30份，请明天继续';
    case 'duplicate_request': return '这个请求已经提交，请在研究历史中查看';
    case 'not_found': return '没有找到当前账号的研究';
    default: return `本期深度研究次数已用完（每月 ${q.limit} 次），下一期开始会恢复`;
  }
}

type JobRow = {
  id: string; user_id: string; topic: string; depth: ResearchDepth; status: ResearchStatus; plan: ResearchPlan | null;
  context: string; steps: ResearchStep[]; quota_request_id: string | null;
};

const local = new Set<string>();

/** 抢这个任务的执行权：只有「研究中/写报告中」且心跳为空或过期的才抢得到 */
async function claim(id: string, token: string): Promise<boolean> {
  const now = new Date();
  const stale = new Date(now.getTime() - STALE_MS).toISOString();
  const { data, error } = await getServiceSupabase().from('research_jobs')
    .update({ heartbeat_at: now.toISOString(), run_token: token })
    .eq('id', id).in('status', ['running', 'writing'])
    .or(`heartbeat_at.is.null,heartbeat_at.lt.${stale}`)
    .select('id');
  return !error && !!data?.length;
}

export function isStale(job: { status: string; heartbeat_at?: string | null }, now = Date.now()): boolean {
  if (job.status !== 'running' && job.status !== 'writing') return false;
  if (!job.heartbeat_at) return true;
  return now - new Date(job.heartbeat_at).getTime() > STALE_MS;
}

/** 后台开跑（不等它结束）。已经在本进程里跑着、或者别的进程抢到了，就什么都不做 */
export function kickResearch(id: string) {
  if (local.has(id)) return;
  void runResearch(id).catch((e) => console.error('[research] 任务异常', id, e));
}

/** 计划也在后台保存，断开浏览器连接不会丢掉任务编号。 */
export async function runResearchPlan(id: string) {
  if (local.has(id)) return;
  local.add(id);
  const db = getServiceSupabase(), token = randomUUID();
  let ownsLease = false;
  let beat: ReturnType<typeof setInterval> | undefined;
  let requestId: string | null = null;
  try {
    const stale = new Date(Date.now() - STALE_MS).toISOString();
    const claimed = await db.from('research_jobs').update({ run_token: token, heartbeat_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'planning').or(`heartbeat_at.is.null,heartbeat_at.lt.${stale}`).select('id');
    if (claimed.error || !claimed.data?.length) return;
    ownsLease = true;
    const { data: job } = await db.from('research_jobs').select('user_id,topic,depth,context,attachments,quota_request_id').eq('id', id).maybeSingle();
    if (!job) return;
    requestId = job.quota_request_id;
    beat = setInterval(() => { void db.from('research_jobs').update({ heartbeat_at: new Date().toISOString() }).eq('id', id).eq('run_token', token).eq('status', 'planning').then(() => {}); }, BEAT_MS);
    let plan: ResearchPlan | null = null;
    for (let i = 0; i < 2 && !plan; i++) {
      const { data: activePlan } = await db.from('research_jobs').select('id').eq('id', id).eq('run_token', token).eq('status', 'planning').maybeSingle();
      if (!activePlan) return;
      const result = await askResearch(buildPlanPrompt(job.topic, job.depth, job.context) + '\n若有附件，请逐份读取。可在 JSON 增加 materialSummary 字段，概括附件中的真实信息、数字与未能读取的文件；不能编造附件内容。', job.user_id, job.attachments ?? []);
      if (result.ok) {
        plan = parsePlan(result.text, job.depth);
        try {
          const raw = result.text.replace(/```(?:json)?/gi, '');
          const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
          if (typeof parsed.materialSummary === 'string') job.context += `\n【附件模型读取摘要，未经独立核实】\n${parsed.materialSummary.slice(0, 8000)}`;
        } catch { /* 计划解析负责格式校验 */ }
      }
    }
    const updated = await db.from('research_jobs').update({ plan, context: job.context, status: plan ? 'plan_ready' : 'failed', error: plan ? null : '研究计划未生成，请重新开始', updated_at: new Date().toISOString(), run_token: null })
      .eq('id', id).eq('run_token', token).eq('status', 'planning').select('id');
    if (!plan && updated.data?.length) await settleResearch(requestId, 'released');
  } catch {
    const updated = await db.from('research_jobs').update({ status: 'failed', error: '研究计划暂时未完成，请重试', run_token: null }).eq('id', id).eq('run_token', token).eq('status', 'planning').select('id');
    if (updated.data?.length) await settleResearch(requestId, 'released').catch(() => {});
  } finally {
    if (beat) clearInterval(beat);
    if (ownsLease) await db.from('research_jobs').update({ run_token: null }).eq('id', id).eq('run_token', token);
    local.delete(id);
  }
}

/** 自托管服务器启动和定期扫描：接续停在半途的任务，不依赖用户一直开着页面。 */
export async function recoverResearchJobs() {
  const db = getServiceSupabase();
  const { data, error } = await db.from('research_jobs').select('id,status,heartbeat_at,quota_request_id,updated_at').in('status', ['planning', 'running', 'writing', 'plan_ready', 'canceled']).or('status.neq.canceled,run_token.not.is.null').order('updated_at').limit(50);
  if (error) return; // 未迁移时不影响旧功能启动。
  for (const job of data ?? []) {
    if (job.status === 'plan_ready') {
      if (Date.now() - new Date(job.updated_at).getTime() > 6 * 60 * 60_000) {
        await db.rpc('kaiwu_expire_research', { p_job_id: job.id });
      }
    } else if (job.status === 'canceled') {
      if (Date.now() - new Date(job.heartbeat_at || job.updated_at).getTime() > STALE_MS) await db.rpc('kaiwu_expire_research', { p_job_id: job.id });
    } else if (!job.heartbeat_at || Date.now() - new Date(job.heartbeat_at).getTime() > STALE_MS) {
      if (job.status === 'planning') void runResearchPlan(job.id);
      else kickResearch(job.id);
    }
  }
}

let recoveryTimer: ReturnType<typeof setInterval> | undefined;
export function startResearchRecovery() {
  if (recoveryTimer) return;
  const tick = () => { void recoverResearchJobs().catch(() => console.warn('[research] 任务恢复暂时不可用')); };
  recoveryTimer = setInterval(tick, 60_000);
  recoveryTimer.unref();
  tick();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0, failed = false; let failure: unknown;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); }
      catch (e) { failed = true; failure = e; }
    }
  }));
  if (failed) throw failure;
  return out;
}

class Fatal extends Error {}
class LostLease extends Error {}

export async function askResearch(query: string, userId: string, files: ChatAttachment[] = []) {
  try { return await askDify(query, userId, '', { signal: AbortSignal.timeout(180_000), files }); }
  catch { return { ok: false as const, message: '研究模型暂时连接不稳定，请重试' }; }
}

export async function runResearch(id: string, deps: { search?: typeof aliSearch; fetch?: typeof fetchPage; ask?: typeof askDify; config?: SearchConfig | null } = {}) {
  if (local.has(id)) return;
  local.add(id);
  const db = getServiceSupabase();
  let claimed = false;
  let searchedOnce = false;
  let requestId: string | null = null;
  const token = randomUUID();
  let beat: ReturnType<typeof setInterval> | undefined;
  try {
    if (!(await claim(id, token))) return;
    claimed = true;
    beat = setInterval(() => { void db.from('research_jobs').update({ heartbeat_at: new Date().toISOString() }).eq('id', id).eq('run_token', token).in('status', ['running', 'writing']).then(() => {}); }, BEAT_MS);
    const { data: job } = await db.from('research_jobs').select('id, user_id, topic, depth, status, plan, context, steps, quota_request_id').eq('id', id).maybeSingle() as { data: JobRow | null };
    if (!job?.plan) return;
    requestId = job.quota_request_id;
    const { data: reserved } = await db.from('research_requests').select('status').eq('id', requestId).maybeSingle();
    searchedOnce = reserved?.status === 'started';
    const plan = job.plan;
    const depth = DEPTHS[job.depth] ? job.depth : 'standard';
    const search = deps.search ?? aliSearch;
    const open = deps.fetch ?? fetchPage;
    const ask = deps.ask ?? ((query: string, userId: string) => askResearch(query, userId));

    let status: ResearchStatus = job.status;
    const steps: ResearchStep[] = plan.questions.map((_, i) => {
      const s = job.steps?.[i];
      return s?.status === 'done' && s.note ? s : { status: 'pending' };
    });

    // 写库排队：每次写当前最新的整份状态，后发的一定后到
    let chain: Promise<unknown> = Promise.resolve();
    const save = (extra: Record<string, unknown> = {}) => {
      const snapshot = { steps: JSON.parse(JSON.stringify(steps)), status, updated_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), ...extra };
      chain = chain.then(async () => {
        const { data, error } = await db.from('research_jobs').update(snapshot).eq('id', id).eq('run_token', token).in('status', ['running', 'writing']).select('id');
        if (error) throw new Fatal('研究进度未保存，请稍后重试');
        if (!data?.length) throw new LostLease('任务已停止或由其他进程接续');
      });
      return chain;
    };
    const canceled = async () => {
      const { data } = await db.from('research_jobs').select('status').eq('id', id).maybeSingle();
      return data?.status === 'canceled';
    };

    // 来源是整份报告共用的证据；补跑时保留，避免删掉其他已完成章节的引用。
    const unfinished = steps.map((s, i) => (s.status === 'done' ? -1 : i)).filter((i) => i >= 0);
    const { data: kept } = await db.from('research_sources').select('n, step, url, title, site, published, fetched, content,collected_at').eq('job_id', id);
    const sources: SourceRow[] = (kept as SourceRow[] | null) ?? [];
    let nextN = sources.reduce((m, s) => Math.max(m, s.n), 0) + 1;
    type ReadSource = { h: SearchHit; title: string; content: string; fetched: 'full' | 'snippet'; published: string; collected_at?: string };
    const readCache = new Map<string, Promise<ReadSource | null>>();
    for (const source of sources) readCache.set(source.url, Promise.resolve({ h: { url: source.url, title: source.title, content: source.content, published: source.published }, ...source }));
    let sourceWrites: Promise<unknown> = Promise.resolve();

    const config = deps.config !== undefined ? deps.config : await getSearchConfig();
    if (!config && status !== 'writing' && unfinished.length) throw new Fatal('联网搜索还没配置好（需要管理员在后台填写搜索密钥）');

    const markSearched = async () => {
      if (searchedOnce) return;
      searchedOnce = true;
      try { await settleResearch(job.quota_request_id, 'started'); }
      catch { throw new Fatal('搜索已返回，但记账暂时失败；保留占位，请补跑后恢复'); }
    };

    const runStep = async (i: number) => {
      const step = steps[i];
      const q = plan.questions[i];
      try {
        step.status = 'searching'; step.error = undefined; await save();
        const hits: SearchHit[] = [];
        let lastFailure: string | undefined;
        for (const query of q.queries.slice(0, DEPTHS[depth].queries)) {
          if (await canceled()) throw new LostLease('任务已停止');
          const w = freeChatWebQuery(query);
          const r = await search(w.query, config!, { topK: 8, way: 'pro-fetch', rewrite: !/site:/i.test(w.query), today: w.today });
          if (r.ok) { await markSearched(); hits.push(...r.hits); }
          else {
            lastFailure = SEARCH_FAILURE_TEXT[r.reason];
            if (r.reason === 'auth') throw new Fatal(lastFailure);
          }
        }
        if (await canceled()) throw new LostLease('任务已停止');
        step.searched = hits.length;
        if (!hits.length) throw new Error(lastFailure || '没搜到相关网页，可以改一下这个子问题的搜索词再试');

        step.status = 'reading'; await save();
        const want = DEPTHS[depth].sources;
        const sourceQuestion = `${job.topic} ${q.q}`;
        const official = await readOfficialDocumentation(sourceQuestion, open);
        const officialUrls = new Set(official.map(h => h.url));
        const w = freeChatWebQuery(sourceQuestion);
        const ranked = pickFreeChatSources([...official, ...hits], sourceQuestion, w.recencyDays, Date.now(), want + 3);
        const candidates = pickCandidates(ranked, new Set(), want + 3);
        const read = await mapLimit(candidates, 4, async (h) => {
          if (await canceled()) throw new LostLease('任务已停止');
          const cached = readCache.get(h.url);
          if (cached) return cached;
          const loading = (async (): Promise<ReadSource | null> => {
            // 已读到的官方正文不再重复请求；其余正文失败才保留搜索摘录。
            if (officialUrls.has(h.url)) return { h, title: h.title, content: h.content.slice(0, 15_000), fetched: 'full', published: h.published, collected_at: new Date().toISOString() };
            const page = await open(h.url).catch(() => ({ ok: false as const }));
            const text = page.ok ? (/text\/(?:plain|markdown)/i.test(page.contentType) ? { text: page.html.trim(), title: '', published: '' } : extractMainText(page.html)) : null;
            const collected_at = new Date().toISOString();
            if (text && text.text.length >= 300 && text.text.length >= h.content.length * 0.6) return { h, title: h.title || text.title, content: text.text.slice(0, 15_000), fetched: 'full', published: h.published || text.published, collected_at };
            if (h.content.length >= 150) return { h, title: h.title, content: h.content.slice(0, 15_000), fetched: 'snippet', published: h.published, collected_at };
            return null;
          })();
          readCache.set(h.url, loading);
          const result = await loading;
          if (!result) readCache.delete(h.url);
          return result;
        });
        const rows: SourceRow[] = [];
        const write = sourceWrites.then(async () => {
          if (await canceled()) throw new LostLease('任务已停止');
          const added: SourceRow[] = [];
          for (const r of read) {
            if (!r || rows.length >= want) continue;
            const existing = sources.find(s => s.url === r.h.url);
            if (existing) { rows.push(existing); continue; }
            const row = { n: nextN++, step: i, url: r.h.url, title: (r.title || siteOf(r.h.url)).slice(0, 200), site: siteOf(r.h.url), published: r.published.slice(0, 40), fetched: r.fetched, content: r.content, collected_at: r.collected_at };
            added.push(row); rows.push(row);
          }
          if (added.length) {
            const { error } = await db.from('research_sources').insert(added.map(row => ({ ...row, job_id: id })));
            if (error) throw new Error('来源没存上，请重试这一步');
            sources.push(...added);
          }
        });
        sourceWrites = write.catch(() => {});
        await write;
        step.read = rows.length;
        if (!rows.length) throw new Error('搜到的网页都打不开或没有正文，可以换个搜索词再试');
        step.sources = rows.map((r) => r.n);

        step.status = 'writing'; await save();
        const prompt = buildNotePrompt({ topic: job.topic, title: plan.title, question: q.q, index: i, total: plan.questions.length, depth, rows, context: job.context });
        let ans = await ask(prompt, job.user_id, '');
        if (!ans.ok && !(await canceled())) ans = await ask(prompt, job.user_id, '');
        if (!ans.ok) throw new Error(ans.message);
        step.note = ans.text.trim();
        step.status = 'done';
        await save();
      } catch (e) {
        if (e instanceof Fatal || e instanceof LostLease) throw e;
        step.status = 'failed';
        step.error = ((e as Error).message || '这一步失败了').slice(0, 200);
        await save();
      }
    };

    if (status !== 'writing') {
      status = 'running';
      await save({ error: null });
      // 两个子问题一起跑；每跑完一个看一眼是不是被停了
      let stop = false;
      await mapLimit(unfinished, 2, async (i) => {
        if (stop) return;
        if (await canceled()) { stop = true; return; }
        await runStep(i);
      });
      if (stop || (await canceled())) {
        if (!searchedOnce) await settleResearch(job.quota_request_id, 'released');
        return;
      }
    }

    const doneCount = steps.filter((s) => s.status === 'done').length;
    if (!doneCount) {
      if (!searchedOnce) await settleResearch(job.quota_request_id, 'released');
      status = 'failed';
      await save({ error: steps.find((s) => s.error)?.error || '没有一个子问题研究成功' });
      return;
    }

    status = 'writing';
    await save();
    const questions = plan.questions.map((x) => x.q);
    const notes = steps.map((s) => (s.status === 'done' ? s.note || '' : ''));
    const hasContext = !!job.context.trim();
    const sumPrompt = buildSummaryPrompt({ topic: job.topic, title: plan.title, questions, notes, context: job.context, hasContext });
    let summary = await ask(sumPrompt, job.user_id, '');
    if (!summary.ok && !(await canceled())) summary = await ask(sumPrompt, job.user_id, '');
    const report = assembleReport({
      title: plan.title, topic: job.topic, depth, questions, steps,
      summary: summary.ok ? summary.text : '## 核心结论\n\n> 结论部分没有写成，下面各节是完整的研究内容。可以点「重试」重新生成结论。',
      sources: sources.sort((a, b) => a.n - b.n),
    });
    if (await canceled()) return;
    status = 'done';
    await save({ report: report.markdown, checks: report.check, summary_failed: !summary.ok, error: null });
  } catch (e) {
    if (!(e instanceof LostLease)) console.error('[research] 失败', id, (e as Error).message);
    if (claimed && e instanceof LostLease && !searchedOnce) {
      const { data } = await db.from('research_jobs').select('id').eq('id', id).eq('run_token', token).eq('status', 'canceled').maybeSingle();
      if (data) await settleResearch(requestId, 'released').catch(() => {});
    }
    if (claimed && !(e instanceof LostLease)) {
      if (!searchedOnce) await settleResearch(requestId, 'released').catch(() => {});
      await db.from('research_jobs').update({ status: 'failed', error: ((e as Error).message || '研究没有完成').slice(0, 300), updated_at: new Date().toISOString() }).eq('id', id).eq('run_token', token).in('status', ['running', 'writing']);
    }
  } finally {
    if (beat) clearInterval(beat);
    if (claimed) await db.from('research_jobs').update({ run_token: null }).eq('id', id).eq('run_token', token);
    local.delete(id);
  }
}
