import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { WEB_SEARCH_LIMITS } from '@/lib/config/plans';
import { isWebSearchNode } from '@/lib/dify-web-status';
import { buildWebQuery } from '@/lib/web-query';

export interface WebQuotaState {
  plan: string; limit: number; used: number; pending: number; remaining: number;
  periodEnd?: string | null; allowed: boolean; reason?: string; requestId?: string | null;
}
export type WebSearchMode = 'auto' | 'on' | 'off';
export function wantsWebSearch(question: string, mode: unknown = 'auto'): boolean {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  if (/(?:不要|不用|无需|不需要|禁止)(?:使用|进行)?(?:联网|上网|搜索)/.test(question)) return false;
  return /联网|上网|搜索|查一下|核实|最新|实时|热点|新闻|平台规则|政策变化|行情|今日|今天|本周|本月|今年/.test(question);
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
