// 整改阶段 6（2026-11-01）：每晚质检回归记下每条用例的字数、新冒出来的具体细节、占位、模型调用次数、耗时。
// 只记录，不判通过与否；看板单独一行，不混进「提醒」，也不进非阻断问题的计数。
import { describe, expect, it } from 'vitest';
import { caseMetrics, runCase, type RegressionCase } from '@/lib/quality-regression';
import { groupRuns, summarizeQuality, type QualityRow } from '@/lib/quality-checks';

const CASE = { task: '回归:测试', query: '写一条理发店的口播，店主剪发11年', checkAs: '自由对话' } as unknown as RegressionCase;

describe('回归用例的本次指标', () => {
  it('数出字数、新细节、占位，标成不阻断', () => {
    const m = caseMetrics('我剪发11年。上周三来了个客人，花了300元。【待确认：价格】', CASE, 3, 4200);
    expect(m.kind).toBe('metrics');
    expect(m.blocking).toBe(false);
    expect(m.metrics?.calls).toBe(3);
    expect(m.metrics?.placeholders).toBe(1);
    // 「11年」在提问里有，不算新细节；「300元」是新冒出来的
    expect(m.metrics?.novel).toBeGreaterThanOrEqual(1);
    expect(m.detail).toContain('300');
    expect(m.detail).not.toMatch(/新冒出来的具体细节 \d+（[^）]*11年/);
  });

  it('runCase 把生成和修复里的模型调用都算进去，指标不影响通过', async () => {
    let n = 0;
    const ask = async () => { n++; return '一段正常的口播，没有问题。'; };
    const repair = async (text: string, _c: RegressionCase, call?: (q: string) => Promise<string>) => { await call?.('修一下'); return text; };
    const out = await runCase(CASE, ask, repair);
    const m = out.result.issues.find((i) => i.kind === 'metrics');
    expect(m?.metrics?.calls).toBe(2);
    expect(n).toBe(2);
    expect(out.result.passed).toBe(true);
  });
});

describe('看板：指标单独一行，不算提醒', () => {
  const row = (issues: unknown[]): QualityRow => ({ id: '1', task_type: '回归:测试', source: 'nightly', passed: true, issues, sample: 's', created_at: '2026-11-01T19:00:00Z' } as unknown as QualityRow);
  const metrics = { kind: 'metrics', blocking: false, detail: '字数 100｜新冒出来的具体细节 0｜占位 0｜模型调用 1 次｜耗时 3 秒', metrics: { chars: 100 } };

  it('groupRuns 把指标放进 metrics，不放进 advisory', () => {
    const [run] = groupRuns([row([metrics])], 'nightly');
    expect(run.cases[0].metrics).toContain('字数 100');
    expect(run.cases[0].advisory).toEqual([]);
  });

  it('非阻断问题的计数里没有「本次指标」', () => {
    const s = summarizeQuality([row([metrics])], { source: 'nightly' });
    expect(s.advisory.find((a) => a.kind === 'metrics')).toBeUndefined();
  });
});
