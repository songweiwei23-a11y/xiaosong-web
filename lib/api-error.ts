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

/** 读取响应体里的错误文案；读不出来就按状态码给一句能指导行动的话 */
export async function readApiError(response: Response, fallback = "生成失败"): Promise<string> {
  let serverMessage = "";

  try {
    // 出错时后端返回的是 JSON（正常时才是 SSE 流），克隆一份读，
    // 避免万一调用方还想读原始 body
    const data = await response.clone().json();
    serverMessage = data?.error || data?.message || "";
  } catch {
    // 不是 JSON 或已被读过，走下面的状态码兜底
  }

  if (serverMessage) return serverMessage;

  switch (response.status) {
    case 401:
      return "登录已过期，请重新登录";
    case 402:
      return "额度已用完，请升级会员或等待下月重置";
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
