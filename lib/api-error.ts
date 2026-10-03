/**
 * 把失败的接口响应翻译成能给用户看的一句话。
 *
 * 此前各生成页一律写 `throw new Error("生成失败")`，服务端辛苦拼出来的
 * 「基础会员额度已用完（150次/月），请升级会员」就此丢掉，用户只看到
 * 「生成失败，请重试」——于是反复重试，每次都失败，最后以为系统坏了。
 *
 * 额度耗尽、被封禁、未登录这三种情况都不是「重试能解决的故障」，
 * 必须原样告诉用户。
 */

import { openUpgrade } from "@/lib/upgrade";
import { postSafely } from "@/lib/safe-post";

/**
 * 请求根本没到服务器（网络断了一下、代理掐了连接）。浏览器给的是一句英文
 * "Failed to fetch"（Safari 是 "Load failed"），直接显示出来用户看不懂，还以为是功能坏了。
 * 线上实测过：从编导的网络发几十 KB 的请求，会时不时被半路掐断，服务器那头一条记录都没有。
 */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && /fetch|network|load failed/i.test(e.message);
}

export const NETWORK_ERROR_HINT = "网络断了一下，请求没发出去，再试一次就好";

/**
 * 发生成请求（/api/dify/stream、/api/dify/chat）。
 *
 * 线上 2026-10-02：在「创作方向」勾了一阵选项再点生成，页面提示网络断了——服务器上**一条记录都没有**，
 * 同一个人几分钟前的请求都正常到达。原因是浏览器拿了一条已经被网络线路断掉的空闲连接去发 POST，
 * 立刻失败（Failed to fetch），请求根本没出去。表单填得越久越容易碰上。
 *
 * 这种"秒失败"自动换新连接重发一次。超过 3 秒才失败的不重发——那时请求可能已经到了服务器，
 * 重发会重复生成、重复扣次数。
 */
export async function fetchGeneration(url: string, init: RequestInit): Promise<Response> {
  /*
   * 后来查实（2026-10-02 同日）：「创作方向」每次都失败不是空闲连接，是请求带上简报后约 11KB，
   * 用户线路差的时候超过约 8KB 的 POST 一律被切断。所以发送统一走 postSafely：大了先压缩、再大就分块
   */
  const started = Date.now();
  try {
    return await postSafely(url, init);
  } catch (e) {
    if (!isNetworkError(e) || Date.now() - started > 3000 || init.signal?.aborted) throw e;
    await new Promise((r) => setTimeout(r, 300));
    return postSafely(url, init);
  }
}

/**
 * 额度用完时各板块提示的后半句。
 * 原来写的是「请升级会员或等待下月重置」——免费版现在是一次性体验、不会下月重置，
 * 会员也是按期清零，"等下月"对谁都不准。各板块生成前的预检查都用这一句。
 */
export const QUOTA_EXHAUSTED_HINT = "额度已用完，开通、续费或升级会员后继续使用";

/** 读取响应体里的错误文案；读不出来就按状态码给一句能指导行动的话 */
export async function readApiError(response: Response, fallback = "生成失败"): Promise<string> {
  let serverMessage = "";
  let feature: string | undefined;

  try {
    // 出错时后端返回的是 JSON（正常时才是 SSE 流），克隆一份读，
    // 避免万一调用方还想读原始 body
    const data = await response.clone().json();
    serverMessage = data?.error || data?.message || "";
    feature = typeof data?.feature === "string" ? data.feature : undefined;
  } catch {
    // 不是 JSON 或已被读过，走下面的状态码兜底
  }

  // 额度用完：全站统一弹付费引导。所有板块的生成出错都走这里，一处接住就全接住了
  if (isQuotaError(response.status)) openUpgrade(feature);

  if (serverMessage) return serverMessage;

  switch (response.status) {
    case 401:
      return "登录已过期，请重新登录";
    case 402:
      return QUOTA_EXHAUSTED_HINT;
    case 403:
      return "账户已被封禁，请联系管理员";
    case 429:
      return "请求太频繁，请稍后再试";
    case 504:
    case 408:
      return "生成超时了，内容可能太长，试试减少要求或稍后重试";
    default:
      return response.status >= 500 ? `${fallback}（服务端错误 ${response.status}）` : fallback;
  }
}

/**
 * 额度类错误不该提示「请重试」。调用方据此决定文案后缀，
 * 以及要不要把用户引到会员页。
 */
export function isQuotaError(status: number): boolean {
  return status === 402;
}

/**
 * 统一的抛错：把服务端文案带进 Error.message，
 * 各页面 catch 里直接 `notify(String(err.message))` 即可。
 */
export async function throwApiError(response: Response, fallback = "生成失败"): Promise<never> {
  const message = await readApiError(response, fallback);
  const err = new Error(message) as Error & { status?: number };
  err.status = response.status;
  throw err;
}
