// 额度账本体检（只读，统计近 7 天）：预留、结算、用量、订阅四方对不对得上。不输出任何用户标识。
import { describe, it } from 'vitest';
import fs from 'node:fs';
import { getServiceSupabase } from '@/lib/admin-auth';

const DAYS = 7;

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) || '(空)';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

describe('额度账本体检（只读）', () => {
  it('统计预留、结算、用量、订阅', async () => {
    const db = getServiceSupabase();
    const since = new Date(Date.now() - DAYS * 24 * 3600_000).toISOString();
    const now = Date.now();
    const result: Record<string, unknown> = { days: DAYS, at: new Date().toISOString() };

    // 1. 预留记录（creation_requests）
    const req = await db.from('creation_requests').select('status, feature, created_at, expires_at').gte('created_at', since).limit(20000);
    if (req.error) result.requestsError = req.error.message;
    const reqRows = (req.data ?? []) as { status: string; feature: string; created_at: string; expires_at: string }[];
    result.requestsTotal = reqRows.length;
    result.requestsByStatus = countBy(reqRows, (r) => r.status);
    result.requestsByFeatureStatus = countBy(reqRows, (r) => `${r.feature}|${r.status}`);
    const pending = reqRows.filter((r) => r.status === 'pending');
    result.pendingTotal = pending.length;
    result.pendingExpired = pending.filter((r) => r.expires_at && new Date(r.expires_at).getTime() < now).length;
    result.pendingOldestCreated = pending.length ? pending.map((r) => r.created_at).sort()[0] : null;

    // 2. 用量事件（usage_events）：和结算一一对应的「用掉了」记录
    const ue = await db.from('usage_events').select('feature, created_at').gte('created_at', since).limit(20000);
    if (ue.error) result.usageError = ue.error.message;
    const ueRows = (ue.data ?? []) as { feature: string; created_at: string }[];
    result.usageEventsByFeature = countBy(ueRows, (r) => r.feature);

    // 3. 完成证据（creation_completion_evidence）：生成真的完成了，才有证据
    const ev = await db.from('creation_completion_evidence').select('terminal, completed_at').gte('completed_at', since).limit(20000);
    if (ev.error) result.evidenceError = ev.error.message;
    const evRows = (ev.data ?? []) as { terminal: string | null }[];
    result.evidenceTotal = evRows.length;
    result.evidenceByTerminal = countBy(evRows, (r) => r.terminal ?? '');

    // 4. 订阅：付费套餐里有没有已经到期却还是 active 的
    const subs = await db.from('subscriptions').select('plan, status, end_date').limit(20000);
    if (subs.error) result.subscriptionsError = subs.error.message;
    const subRows = (subs.data ?? []) as { plan: string; status: string; end_date: string | null }[];
    result.subscriptionsByPlanStatus = countBy(subRows, (r) => `${r.plan}|${r.status}`);
    result.activeButExpired = subRows.filter((r) => r.status === 'active' && r.end_date && new Date(r.end_date).getTime() < now && r.plan !== '免费版').length;

    // 4b. 付费套餐没有到期日期（会永远有效）
    const noEnd = subRows.filter((r) => r.status === 'active' && !r.end_date && r.plan !== '免费版' && r.plan !== 'free');
    result.paidWithoutEndDate = noEnd.length;
    result.paidWithoutEndDateByPlan = countBy(noEnd, (r) => r.plan);

    // 4c. 完成证据能不能对应到计费记录：有证据、没有已结算的预留 = 完成了却没扣（白嫖）
    const evFull = await db.from('creation_completion_evidence').select('request_id, user_id, completed_at').gte('completed_at', since).limit(20000);
    if (evFull.error) result.evidenceJoinError = evFull.error.message;
    const evIds = new Set(((evFull.data ?? []) as { request_id: string }[]).map((r) => r.request_id));
    const reqFull = await db.from('creation_requests').select('request_id, status').gte('created_at', since).limit(20000);
    if (reqFull.error) result.requestJoinError = reqFull.error.message;
    const reqById = new Map(((reqFull.data ?? []) as { request_id: string; status: string }[]).map((r) => [r.request_id, r.status]));
    result.evidenceWithoutRequestInWindow = [...evIds].filter((id) => !reqById.has(id)).length;
    result.evidenceForCommitted = [...evIds].filter((id) => reqById.get(id) === 'committed').length;
    result.evidenceForReleased = [...evIds].filter((id) => reqById.get(id) === 'released').length;
    result.evidenceForPending = [...evIds].filter((id) => reqById.get(id) === 'pending').length;

    // 5. 对照：已结算的预留 vs 用量事件（按功能）
    const settledByFeature: Record<string, number> = {};
    for (const r of reqRows) if (r.status !== 'pending') settledByFeature[r.feature] = (settledByFeature[r.feature] ?? 0) + 1;
    result.settledNonPendingByFeature = settledByFeature;

    fs.writeFileSync('.tmp/knowledge-probe/audit-result.json', JSON.stringify(result, null, 2), 'utf8');
    console.log(`AUDIT_DONE ${JSON.stringify(result)}`);
  }, 300_000);
});
