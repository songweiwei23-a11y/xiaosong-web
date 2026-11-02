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
/** 时间词：今天、最近、现在这些 */
const LIVE_TIME = /今天|今日|昨天|今晚|明天|今年|最近|最新|近期|目前|现在|当前|实时|刚刚|近几天|这几天|本周|本月|眼下/;
/** 明显要查实时事实的对象：天气、股价、票价、政策规则、热搜热榜、考试放假、发布会…… */
const LIVE_TOPIC = /天气|气温|股价|股票|汇率|油价|金价|票价|房价|热搜|热榜|头条|发布会|放假|高考|中考|开奖|赛程|比赛结果|政策|新规|规则|通知|公告|价格|多少钱|涨价|降价|时间表|几号|哪天|什么时候|截止|官网|更新了/;
/** 时间词加上提问的样子（「是多少」「吗」「哪些」「啥」） */
const FACT_QUESTION = /什么时候|多少|几号|哪天|哪些|哪里|哪儿|是否|有没有|是什么|啥|吗[？?]?$/;

/**
 * 2026-11-02 产品方：「把需要联网搜索的权限放开，别太限制它；按用户需求给到用户想要的信息和满意答案」。
 * 按需联网从「只在几种情况下搜」改成「默认搜，只有明显不用查的才不搜」：
 *   不搜——改写、润色、翻译、拆分镜、审稿这类加工用户给的内容；打招呼、道谢；「继续」「再来一版」「换一批」这类接着上一轮的话；
 *   其余只要是在问（什么、怎么、为什么、哪、有没有、案例、数据、趋势、价格、规则、热点、推荐……）都搜。
 * 原来「今天我该拍什么」「今年做账号怎么安排」这类为省免费额度不搜（10-16），这个决定被替换。
 */
const SMALL_TALK = /^(?:你好|您好|hi|hello|嗨|在吗|在不在|谢谢|多谢|感谢|辛苦了|好的|好|ok|嗯+|行|可以|收到|明白了?|继续|接着写|再来一[版个条遍]|换一[版个批条]|重新生成)[!！。.~～\s]*$/i;
/** 加工用户给的内容：不用查资料 */
const TRANSFORM = /改写|润色|扩写|缩写|精简|翻译|校对|改一下|帮我改|优化(?:这|下面|上面|一下)|拆成分镜|拆分镜|审稿|续写|排版|改成|转成|整理成/;
/** 在问、在要信息 */
const ASKING = /[？?]|吗|呢$|什么|怎么|如何|为什么|为啥|哪|啥|多少|几[个号天点条]|有没有|能不能|是否|推荐|对比|区别|案例|数据|趋势|行情|攻略|教程|方法|技巧|规则|政策|价格|费用|热点|热门|爆款|排名|榜/;

export function wantsWebSearch(question: string, mode: unknown = 'auto'): boolean {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  const q = question.trim();
  if (/(?:不要|不用|无需|不需要|禁止)(?:使用|进行)?(?:联网|上网|搜索)/.test(q)) return false;
  if (/联网|上网|搜索|查一下|查查|查资料|核实|政策变化/.test(q) || isNewsQuestion(q)) return true;
  if (SMALL_TALK.test(q)) return false;
  // 加工用户给的内容：除非同时在问实时事实（价格、规则、热点……），不搜
  if (TRANSFORM.test(q) && !LIVE_TOPIC.test(q)) return false;
  return ASKING.test(q) || LIVE_TOPIC.test(q) || (LIVE_TIME.test(q) && FACT_QUESTION.test(q));
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
