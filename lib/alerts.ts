/**
 * 主动告警（2026-10-22，后台扩展方案 P1-4）。
 *
 * 规则是纯函数（输入事实，输出命中的告警），便于测试；推送到企业微信或飞书的机器人。
 * 没有配置 ALERT_WEBHOOK_URL 时，告警只记日志、不推送，并在状态里标明「未配置」。
 * 同一条规则 30 分钟内只推一次，避免刷屏；恢复时不另外推送（下一次检查不命中即可）。
 */

export interface AlertFacts {
  /** 数据库一次简单查询的耗时（毫秒） */
  dbLatencyMs: number;
  /** 待审核（已上传凭证）的订单数 */
  pendingReview: number;
  /** 最早那笔待审订单已经等了多少分钟；没有待审订单为 null */
  oldestPendingMinutes: number | null;
  /** 生成任务排队的人数（进程内，见 lib/generation-slots） */
  generationQueued: number;
}

export interface AlertHit {
  id: string;
  title: string;
  message: string;
}

/** 阈值（可以用环境变量改，见 thresholdsFromEnv） */
export interface AlertThresholds {
  dbLatencyMs: number;
  pendingMinutes: number;
  generationQueued: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  dbLatencyMs: 1000,
  pendingMinutes: 30,
  generationQueued: 50,
};

export function thresholdsFromEnv(env: Record<string, string | undefined> = process.env): AlertThresholds {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    dbLatencyMs: num(env.ALERT_DB_LATENCY_MS, DEFAULT_THRESHOLDS.dbLatencyMs),
    pendingMinutes: num(env.ALERT_PENDING_MINUTES, DEFAULT_THRESHOLDS.pendingMinutes),
    generationQueued: num(env.ALERT_GENERATION_QUEUED, DEFAULT_THRESHOLDS.generationQueued),
  };
}

/** 规则：输入事实，命中就返回告警内容，不命中返回 null */
export function evaluateAlerts(facts: AlertFacts, t: AlertThresholds = DEFAULT_THRESHOLDS): AlertHit[] {
  const hits: AlertHit[] = [];
  if (facts.dbLatencyMs >= t.dbLatencyMs) {
    hits.push({ id: 'db-latency', title: '数据库变慢', message: `数据库一次简单查询用了 ${facts.dbLatencyMs} ms（阈值 ${t.dbLatencyMs} ms）。` });
  }
  if (facts.oldestPendingMinutes !== null && facts.oldestPendingMinutes >= t.pendingMinutes) {
    hits.push({
      id: 'orders-unreviewed',
      title: '订单长时间未审核',
      message: `有 ${facts.pendingReview} 笔订单待审核，最早的已等了 ${Math.floor(facts.oldestPendingMinutes)} 分钟（阈值 ${t.pendingMinutes} 分钟）。请到后台「订单」处理。`,
    });
  }
  if (facts.generationQueued >= t.generationQueued) {
    hits.push({ id: 'generation-queue', title: '生成任务积压', message: `当前排队 ${facts.generationQueued} 个生成任务（阈值 ${t.generationQueued}）。` });
  }
  return hits;
}

/** 节流：同一条规则 THROTTLE_MS 内只返回一次。state 由调用方保存（进程内即可） */
export const THROTTLE_MS = 30 * 60_000;

export function dueAlerts(hits: AlertHit[], state: Map<string, number>, now = Date.now(), throttleMs = THROTTLE_MS): AlertHit[] {
  const due: AlertHit[] = [];
  for (const h of hits) {
    const last = state.get(h.id);
    if (last !== undefined && now - last < throttleMs) continue;
    state.set(h.id, now);
    due.push(h);
  }
  return due;
}

export type WebhookKind = 'wecom' | 'feishu';

/** 企业微信机器人和飞书机器人的消息格式不一样，这里分别组装 */
export function webhookBody(kind: WebhookKind, text: string): Record<string, unknown> {
  if (kind === 'feishu') return { msg_type: 'text', content: { text } };
  return { msgtype: 'text', text: { content: text } };
}

export function alertConfig(env: Record<string, string | undefined> = process.env): { url: string; kind: WebhookKind } | null {
  const url = (env.ALERT_WEBHOOK_URL || '').trim();
  if (!/^https:\/\//.test(url)) return null;
  const kind: WebhookKind = (env.ALERT_WEBHOOK_KIND || '').trim() === 'feishu' ? 'feishu' : 'wecom';
  return { url, kind };
}

/** 推送一条告警。没配置时返回 false（调用方据此标明「未配置」）。推送失败只记日志，不影响业务 */
export async function sendAlert(
  hit: AlertHit,
  env: Record<string, string | undefined> = process.env,
  doFetch: typeof fetch = fetch,
): Promise<boolean> {
  const cfg = alertConfig(env);
  if (!cfg) return false;
  const text = `【开物告警】${hit.title}\n${hit.message}\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
  try {
    const res = await doFetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookBody(cfg.kind, text)),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) console.error('[alerts] 推送失败，HTTP', res.status);
    return res.ok;
  } catch {
    console.error('[alerts] 推送出错');
    return false;
  }
}
