// 质检看板改进（2026-10-23）：规则误报、汇总口径、按运行分组、新增失败、重跑、节流、告警、误报统计。
import { describe, expect, it, vi } from 'vitest';
import { diffRuns, dailyTrend, groupRuns, summarizeQuality, tabooOnlyQuoted, yearConflicts, type QualityRow } from '@/lib/quality-checks';
import { runCase, runRegression } from '@/lib/quality-regression';
import { manualRunBlock, MANUAL_COOLDOWN_MS, MANUAL_DAILY_CAP } from '@/lib/quality-run-guard';
import { newFailureText } from '@/lib/quality-alert';
import { ruleKeyOf, ruleStats } from '@/lib/quality-feedback';

const PERSONA = { yearsInTrade: '美甲从业5年', yearsLocal: '在杭州定居2年', others: '店开了1年；基础单色价格88元' };

describe('年限检查：主语要分清', () => {
  it('「在杭州开美甲店 1 年」说的是店龄，事实卡里店开了 1 年，不算打架', () => {
    expect(yearConflicts('在杭州开美甲店1年，我发现很多人第一次来都会问价。', PERSONA)).toEqual([]);
  });

  it('店龄写成 2 年（事实卡是 1 年）仍然会被抓出来', () => {
    expect(yearConflicts('在杭州开美甲店2年，我发现很多人第一次来都会问价。', PERSONA).length).toBe(1);
  });

  it('「碰到一个做了 9 年的姐姐」是别人的经历，不拿来比', () => {
    expect(yearConflicts('转机是碰到一个做了9年的姐姐，她教我换思路。', PERSONA)).toEqual([]);
  });
});

describe('禁忌词：引用原稿不算踩禁忌', () => {
  it('引号里的禁忌词，是引用', () => {
    expect(tabooOnlyQuoted('原稿写的「全城最正宗」要改掉', '最正宗')).toBe(true);
    expect(tabooOnlyQuoted('把「最大」改成「很大」', '最大')).toBe(true);
  });

  it('直接在正文里用的，不是引用', () => {
    expect(tabooOnlyQuoted('我们是全城最正宗的川味串串', '最正宗')).toBe(false);
  });

  it('同一个词既引用又直接用：只要有一处直接用，就不算', () => {
    expect(tabooOnlyQuoted('原稿的「最大」我们不用。我们店最大的优势是现炒', '最大')).toBe(false);
  });
});

describe('汇总口径', () => {
  const base = { task_type: '选题策划', source: 'live', passed: true, issues: [] as QualityRow['issues'] };

  it('没跑成的不计入通过率，单独计数', () => {
    const rows: QualityRow[] = [
      { ...base, passed: true, created_at: '2026-10-23T01:00:00Z' },
      { ...base, passed: false, created_at: '2026-10-23T02:00:00Z', issues: [{ kind: 'taboo', detail: 'x' }] },
      { ...base, passed: false, created_at: '2026-10-23T03:00:00Z', issues: [{ kind: 'error', detail: 'Dify 超时' }] },
    ];
    const s = summarizeQuality(rows);
    expect(s.total).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.passRate).toBe(50);
    expect(s.errors).toBe(1);
  });

  it('只提醒的问题不算失败，单独列在非阻断里', () => {
    const rows: QualityRow[] = [
      { ...base, passed: true, created_at: '2026-10-23T01:00:00Z', issues: [{ kind: 'facts', detail: '模型自称「未编造」', blocking: false }] },
    ];
    const s = summarizeQuality(rows);
    expect(s.failed).toBe(0);
    expect(s.byKind).toEqual([]);
    expect(s.advisory).toEqual([{ kind: 'facts', label: expect.any(String), count: 1 }]);
  });

  it('默认只看实时体检；夜间和手动各自独立分组', () => {
    const rows: QualityRow[] = [
      { ...base, passed: true, created_at: '2026-10-23T01:00:00Z' },
      { ...base, task_type: '回归:创作方向', source: 'nightly', passed: true, created_at: '2026-10-23T19:03:00Z' },
      { ...base, task_type: '回归:创作方向', source: 'manual', passed: false, created_at: '2026-10-23T20:00:00Z' },
    ];
    expect(summarizeQuality(rows).total).toBe(1);
    expect(summarizeQuality(rows, { source: 'manual' }).failed).toBe(1);
    expect(groupRuns(rows, 'nightly')).toHaveLength(1);
    expect(groupRuns(rows, 'manual')).toHaveLength(1);
  });

  it('同一次运行的记录 created_at 相同，按它分成一次运行', () => {
    const at = '2026-10-23T19:03:00.123Z';
    const rows: QualityRow[] = [
      { ...base, task_type: '回归:A', source: 'nightly', passed: true, created_at: at },
      { ...base, task_type: '回归:B', source: 'nightly', passed: false, created_at: at, issues: [{ kind: 'years', detail: 'x' }] },
    ];
    const runs = groupRuns(rows, 'nightly');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ total: 2, passed: 1 });
  });

  it('每天的通过率按北京日期算：UTC 17:00 是北京次日 01:00', () => {
    const rows: QualityRow[] = [{ ...base, passed: true, created_at: '2026-10-22T17:00:00Z' }];
    expect(dailyTrend(rows)[0].day).toBe('2026-10-23');
  });
});

describe('新增失败：和上一次同一用例比', () => {
  const mk = (at: string, cases: [string, boolean][]) => groupRuns(cases.map(([task, passed]) => ({
    task_type: task, source: 'nightly', passed, issues: passed ? [] : [{ kind: 'years' as const, detail: 'x' }], created_at: at,
  })), 'nightly')[0];

  it('新增失败、持续失败、已修复分开', () => {
    const latest = mk('2026-10-23T19:03:00Z', [['回归:A', false], ['回归:B', false], ['回归:C', true]]);
    const previous = mk('2026-10-22T19:03:00Z', [['回归:A', true], ['回归:B', false], ['回归:C', false]]);
    const d = diffRuns(latest, previous);
    expect(d.newFailures).toEqual(['回归:A']);
    expect(d.stillFailing).toEqual(['回归:B']);
    expect(d.fixed).toEqual(['回归:C']);
  });

  it('没有上一次时，失败的都算新增', () => {
    const latest = mk('2026-10-23T19:03:00Z', [['回归:A', false]]);
    expect(diffRuns(latest, null).newFailures).toEqual(['回归:A']);
  });
});

describe('手动回归的节流', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');

  it('刚跑完不久，不让再跑，并说明还要等多久', () => {
    const msg = manualRunBlock([new Date(now - 5 * 60_000).toISOString()], now);
    expect(msg).toContain('还需等');
  });

  it('过了冷却时间，可以跑', () => {
    expect(manualRunBlock([new Date(now - MANUAL_COOLDOWN_MS - 1000).toISOString()], now)).toBeNull();
  });

  it('最近 24 小时达到上限，不让再跑', () => {
    const times = Array.from({ length: MANUAL_DAILY_CAP }, (_, i) => new Date(now - (i + 1) * 2 * 60 * 60_000).toISOString());
    expect(manualRunBlock(times, now)).toContain('达到上限');
  });
});

describe('回归：重跑与没跑成', () => {
  const ONE_CASE = [{ task: '回归:测试', query: '请写', requiredSections: ['开头'] }];

  it('第一次没过、重跑后通过：算通过，并记一条只提醒的 flaky', async () => {
    const ask = vi.fn<(q: string) => Promise<string>>()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('## 开头\n今天来点好吃的，老板亲手烤。');
    const [out] = await runRegression(ask, ONE_CASE);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(out.result.passed).toBe(true);
    expect(out.result.issues.some((i) => i.kind === 'flaky' && i.blocking === false)).toBe(true);
  });

  it('两次都不过：算失败，不再重跑第三次', async () => {
    const ask = vi.fn(async () => '');
    const [out] = await runRegression(ask, ONE_CASE);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(out.result.passed).toBe(false);
  });

  it('没跑成（模型调用出错）：不重跑，记成 error，不算质量问题', async () => {
    const ask = vi.fn(async () => { throw new Error('Dify 超时'); });
    const out = await runCase({ task: '回归:测试', query: '请写' }, ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(out.error).toBe('Dify 超时');
    expect(out.result.issues[0].kind).toBe('error');
  });
});

describe('告警文字', () => {
  it('写出新增失败的用例名（去掉回归前缀），并提示看哪里', () => {
    const text = newFailureText({ newFailures: ['回归:美甲选题'], stillFailing: ['回归:创作方向'], fixed: [] }, '2026-10-23T19:03:00Z');
    expect(text).toContain('1 个用例新增失败');
    expect(text).toContain('· 美甲选题');
    expect(text).toContain('质检看板');
  });
});

describe('误报统计', () => {
  it('规则标识把引号里的内容换成「…」，同一条规则换了案例也归到一起', () => {
    expect(ruleKeyOf({ kind: 'years', detail: '「在杭州开美甲店1年，我发」和事实卡对不上' })).toBe('years|「…」和事实卡对不上');
    expect(ruleKeyOf({ kind: 'years', detail: '「在杭州开美甲店2年，我发」和事实卡对不上' })).toBe(ruleKeyOf({ kind: 'years', detail: '「在杭州开美甲店1年，我发」和事实卡对不上' }));
  });

  it('按规则算出现次数和误报率', () => {
    const key = ruleKeyOf({ kind: 'taboo', detail: '「最大」— 广告法红线' });
    const rows: QualityRow[] = [
      { task_type: '选题策划', source: 'live', passed: false, issues: [{ kind: 'taboo', detail: '「最大」— 广告法红线' }], created_at: '2026-10-23T01:00:00Z' },
      { task_type: '选题策划', source: 'live', passed: false, issues: [{ kind: 'taboo', detail: '「最大」— 广告法红线' }], created_at: '2026-10-23T02:00:00Z' },
    ];
    const stats = ruleStats(rows, [{ rule_key: key, verdict: 'false_positive' }, { rule_key: key, verdict: 'true_positive' }, { rule_key: key, verdict: 'false_positive' }]);
    expect(stats[0]).toMatchObject({ key, occurrences: 2, falsePositive: 2, truePositive: 1, fpRate: 66.7 });
  });
});
