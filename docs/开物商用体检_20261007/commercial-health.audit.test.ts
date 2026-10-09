import { describe, it, expect, vi, beforeEach } from 'vitest';

// Read-only diagnostic probes. Database writes are simulated in memory.
// Tests document current weaknesses; passing does not mean the weaknesses are fixed.
const fixture = vi.hoisted(() => ({
  order: {} as Record<string, unknown>,
  subscriptionError: null as null | { message: string },
  quotaError: null as null | { message: string },
  quotasReset: false,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        single: async () => ({ data: { ...fixture.order }, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        update(values: Record<string, unknown>) {
          Object.assign(fixture.order, values);
          return { eq: async () => ({ error: null }) };
        },
        upsert: async () => {
          if (table === 'subscriptions') return { error: fixture.subscriptionError };
          if (table === 'user_quotas') {
            fixture.quotasReset = !fixture.quotaError;
            return { error: fixture.quotaError };
          }
          return { error: null };
        },
      };
      return chain;
    },
  }),
}));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: async () => ({ userId: 'audit-admin' }) }));
vi.mock('@/lib/admin-logger', () => ({
  logAdminAction: async () => {},
  AdminActions: { APPROVE_ORDER: 'approve', REJECT_ORDER: 'reject' },
}));

import { POST } from '@/app/api/admin/orders/review/route';
import { unsupportedFacts } from '@/lib/quality-checks';
import { estimateSpeechStats, extractTitle } from '@/lib/script-result-utils';
import { checkCitations } from '@/lib/research';
import { buildReviewPrompt } from '@/lib/review-standards';

const request = () => new Request('http://localhost/api/admin/orders/review', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId: 'audit-order', approved: true }),
});

describe('commercial audit: payment failure injection', () => {
  beforeEach(() => {
    fixture.order = { id: 'audit-order', status: 'reviewing', user_id: 'audit-user', plan_id: 'basic', plan_name: '基础会员', billing_cycle: 'monthly', amount: 49 };
    fixture.subscriptionError = null;
    fixture.quotaError = null;
    fixture.quotasReset = false;
  });
  it('subscription failure leaves order approved and normal retry is rejected', async () => {
    fixture.subscriptionError = { message: 'simulated database failure' };
    expect((await POST(request())).status).toBe(500);
    expect(fixture.order.status).toBe('approved');
    fixture.subscriptionError = null;
    expect((await POST(request())).status).toBe(400);
  });
  it('quota reset failure still reports successful membership activation', async () => {
    fixture.quotaError = { message: 'simulated quota failure' };
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(fixture.quotasReset).toBe(false);
  });
});

describe('commercial audit: content diagnostics', () => {
  it('a URL unrelated to a statistical claim suppresses the missing citation notice', () => {
    const claim = '据统计，这种方法提升了创作效率。';
    expect(unsupportedFacts(claim, '').some(x => x.includes('没给出处'))).toBe(true);
    expect(unsupportedFacts(claim + '\n产品主页：https://example.com', '').some(x => x.includes('没给出处'))).toBe(false);
  });
  it('unconfirmed personal narrative is outside the regex fact checker coverage', () => {
    expect(unsupportedFacts('我每天早上六点到店，晚上八点接孩子放学。', '')).toEqual([]);
  });
  it('whole-report statistics count production notes as spoken words', () => {
    const speech = '国庆过去以后，店里的人少了。';
    const report = '# 脚本策略卡\n' + '情绪推进、画面设计、拍摄动作。'.repeat(60) + '\n## 纯文字文案\n' + speech;
    expect(estimateSpeechStats(report).seconds).toBeGreaterThan(estimateSpeechStats(speech).seconds * 20);
    expect(extractTitle(report)).toBe('脚本策略卡');
  });
  it('review passes uncertainty words to the model as confirmed faults', () => {
    const prompt = buildReviewPrompt({ draftContent: '这个方法可能有效，但我没有统计数据，应该先小规模试验。', platform: '抖音', duration: 'AI推荐', scriptType: '聊观点', reviewDimensions: '真实性', optimizationGoals: '保持事实边界', benchmarkScript: '', compareMode: false, severityLabels: true });
    expect(prompt).toContain('机器已确认');
    expect(prompt).toContain('本篇已命中');
    expect(prompt).toContain('可能');
    expect(prompt).toContain('必须替换为具体的人、事、数字');
  });
  it('research citation check accepts an unsupported meaning when the source number exists', () => {
    const sources = new Map([[1, '不同会话不会共享聊天上下文。这里没有说明删除持久化记录。']]);
    const checked = checkCitations('会话结束会清空全部数据库记忆。[1]', sources);
    expect(checked.check.unverified).toBe(0);
    expect(checked.text).not.toContain('未核实');
  });
});
