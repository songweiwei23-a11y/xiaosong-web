import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { WEB_SEARCH_LIMITS } from '@/lib/config/plans';
import { isWebSearchNode } from '@/lib/dify-web-status';
import { buildWebQuery, isNewsQuestion } from '@/lib/web-query';

export interface WebQuotaState {
  plan: string; limit: number; used: number; pending: number; remaining: number;
  periodEnd?: string | null; allowed: boolean; reason?: string; requestId?: string | null;
}
export type WebSearchMode = 'auto' | 'on' | 'off';
/**
 * 「按需联网」只在明确要查、或问新闻类问题时自动搜。
 * 时间词（今天、今年、本周、最新）单独出现不算：「今天我该拍什么」这种创作问题也常带时间词，
 * 原来会白扣一次免费联网额度（2026-10-16 产品方反馈）。要查最新的，用户自己选「本轮联网」。
 */
/** 时间词：今天、最近、现在这些。单独出现不算要查（「今年做账号怎么安排」是咨询，不是查资料） */
const LIVE_TIME = /今天|今日|昨天|今晚|明天|今年|最近|最新|近期|目前|现在|当前|实时|刚刚|近几天|这几天|本周|本月|眼下/;
/** 明显要查实时事实的对象：天气、股价、票价、政策规则、热搜热榜、考试放假、发布会…… */
const LIVE_TOPIC = /天气|气温|股价|股票|汇率|油价|金价|票价|房价|热搜|热榜|头条|发布会|放假|高考|中考|开奖|赛程|比赛结果|政策|新规|规则|通知|公告|价格|多少钱|涨价|降价|时间表|几号|哪天|什么时候|截止|官网|更新了/;
/** 这一句是在要创作（拍什么、写什么），不是在查资料：时间词再多也不扣额度 */
const CREATIVE_ONLY = /该拍|拍什么|选题|脚本|标题|文案|怎么写|帮我写|创作|方向|拆解|分镜|审稿/;
/** 时间词加上提问的样子（「是多少」「吗」「哪些」）：要查的事实，不是咨询 */
const FACT_QUESTION = /什么时候|多少|几号|哪天|哪些|是否|有没有|是什么|吗[？?]?$/;

/**
 * 按需联网：要不要自动搜（免费额度只有 3 次，所以不能太松）。2026-10-17 实测：原来只认「搜索、查一下、新闻」，
 * 「特斯拉最近股价」「最新 iPhone 发布会」「郑州地铁现在票价」都不会自动搜，结果等于没联网。
 * 现在：明确要查、新闻类、或「实时事实对象」（股价、票价、天气、规则……）自动搜；
 * 只有时间词、又是创作问题的，不搜。
 */
export function wantsWebSearch(question: string, mode: unknown = 'auto'): boolean {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  if (/(?:不要|不用|无需|不需要|禁止)(?:使用|进行)?(?:联网|上网|搜索)/.test(question)) return false;
  if (/联网|上网|搜索|查一下|查查|查资料|核实|政策变化/.test(question) || isNewsQuestion(question)) return true;
  if (CREATIVE_ONLY.test(question)) return false;
  if (LIVE_TOPIC.test(question)) return true;
  return LIVE_TIME.test(question) && FACT_QUESTION.test(question);
}
export async function readWebSearchQuota(userId: string): Promise<WebQuotaState> {
  const { data, error } = await getServiceSupabase().rpc('kaiwu_web_search', { p_user_id: userId, p_limits: WEB_SEARCH_LIMITS, p_request_id: null });
  if (error || !data) {
    console.warn('[web-search] 余额查询失败', { code: error?.code, message: error?.message });
    throw new Error('联网额度暂时无法查询');
  }
  return data as WebQuotaState;
}

/** Dify 开始节点的三个联网输入：搜索词、今天、时效窗口（天，0 不限） */
export function webQueryInputs(question: string, now?: number) {
  const w = buildWebQuery(question, now);
  return { web_search_query: w.query, web_search_today: w.today, web_search_recency: String(w.recencyDays) };
}

/** 每次工作流调用单独预占一席，实际搜索开始时提交；未知结果保留预占，避免重复付费。 */
export async function prepareWebSearch(userId: string, question: string, mode?: unknown) {
  let quota: WebQuotaState | undefined;
  let requestId: string | undefined;
  let started = false;
  let settled = false;
  let terminal = false;
  let failedBeforeSearch = false;
  const requested = wantsWebSearch(question, mode);
  let reason = requested ? 'unavailable' : 'not_requested';
  if (requested) {
    try {
      const id = randomUUID();
      const { data, error } = await getServiceSupabase().rpc('kaiwu_web_search', { p_user_id: userId, p_limits: WEB_SEARCH_LIMITS, p_request_id: id });
      if (error || !data) throw new Error('web quota unavailable');
      quota = data as WebQuotaState;
      if (quota.allowed && quota.requestId === id) { requestId = id; reason = 'reserved'; }
      else reason = quota.reason || 'quota_exhausted';
    } catch { console.warn('[web-search] 额度服务不可用，本轮禁止搜索'); }
  }
  const note = requestId ? '本轮可执行一次联网搜索；仅依据本轮真实返回的来源核实信息。'
    : reason === 'quota_exhausted' || reason === 'membership_expired' ? '本期联网额度已用完，本轮未执行联网搜索。可以基于已有资料继续回答；涉及最新信息须明确未核实。'
    : requested ? '本轮联网额度服务暂不可用，未执行联网搜索。不要编造实时信息或来源。'
    : '本轮未执行联网搜索；基于已有资料创作，涉及最新事实须说明未核实。';
  const settle = async (state: 'started' | 'released') => {
    if (!requestId || settled) return;
    try {
      const { error } = await getServiceSupabase().rpc('kaiwu_settle_web_search', { p_request_id: requestId, p_state: state });
      if (error) throw error;
      settled = true;
    } catch { console.warn('[web-search] 联网记账未完成，预占继续保留'); }
  };
  return {
    enabled: !!requestId,
    inputs: {
      web_search_enabled: requestId ? '1' : '0',
      web_search_note: note,
      // 联网专用搜索词（lib/web-query）。原来联网搜的是给知识库准备的 search_query，见那个文件的说明
      ...(requestId ? webQueryInputs(question) : {}),
    },
    initialEvent: requested && !requestId ? { event: 'web_search', status: reason === 'quota_exhausted' || reason === 'membership_expired' ? 'quota_exhausted' : 'unavailable', sources: [], message: note, quota } : null,
    quota,
    /** 自由对话的服务端搜索也沿用同一预占；在实际发起付费请求前确认开始。 */
    async markStarted() {
      if (!requestId) throw new Error('本轮没有联网授权');
      started = true;
      await settle('started');
    },
    async observe(event: any) {
      if (isWebSearchNode(event?.data) && ['node_started','node_finished'].includes(event.event)) {
        started = true;
        await settle('started');
      }
      if (event.event === 'error' || (event.event === 'workflow_finished' && event.data?.status === 'failed')) failedBeforeSearch = !started;
      if (['message_end','workflow_finished','error'].includes(event.event)) terminal = true;
    },
    async rejected(status: number) {
      if ([400,401,403,404,422,429].includes(status) && !started) await settle('released');
    },
    async finish() {
      if (terminal && failedBeforeSearch && !started) await settle('released');
      else if (terminal && !settled) await settle('started');
      // 未确认上游结束时不能返还：客户端断线不代表付费搜索没发生。
    },
  };
}
