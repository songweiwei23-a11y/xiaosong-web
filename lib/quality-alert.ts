/**
 * 夜间回归的告警（2026-10-23）：这次新增的失败才提醒，持续失败不反复吵人。
 *
 * 发到 QUALITY_ALERT_WEBHOOK；没配的话退回 HEALTH_ALERT_WEBHOOK（和健康检查共用一个群机器人）。
 * HEALTH_ALERT_KIND=wecom（或 QUALITY_ALERT_KIND=wecom）时按企业微信机器人的格式发，否则发 {text}。
 * 发送失败只记日志，不影响回归结果本身。
 */
import type { RunDiff } from './quality-checks';

/** 新增失败的提醒文字（纯函数） */
export function newFailureText(diff: RunDiff, runAt: string): string {
  const lines = [`【开物质检】夜间回归有 ${diff.newFailures.length} 个用例新增失败（${runAt.slice(0, 16).replace('T', ' ')}，UTC）`];
  for (const task of diff.newFailures) lines.push(`· ${task.replace(/^回归:/, '')}`);
  if (diff.stillFailing.length) lines.push(`另有 ${diff.stillFailing.length} 个用例仍在失败，已经持续多次，看板上可以查看`);
  lines.push('请到后台「质检看板」查看失败的具体内容');
  return lines.join('\n');
}

/** 发出告警。没配置地址就什么都不做，返回 false */
export async function sendQualityAlert(text: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const url = process.env.QUALITY_ALERT_WEBHOOK || process.env.HEALTH_ALERT_WEBHOOK;
  if (!url) return false;
  const wecom = process.env.QUALITY_ALERT_KIND === 'wecom' || process.env.HEALTH_ALERT_KIND === 'wecom';
  const body = wecom ? { msgtype: 'text', text: { content: text } } : { text };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (e) {
    console.warn('[quality] 告警发送失败:', (e as Error).message);
    return false;
  }
}
