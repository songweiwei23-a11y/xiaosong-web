/**
 * 误报标记（2026-10-23）：管理员在看板上把某条提醒标成「误报」或「确认有问题」，按规则统计误报率。
 *
 * 规则的标识 = 类别 + 说明的前 40 个字，引号里的内容换成「…」，同一条规则换了案例也归到一起。
 * 误报率高的规则要去改规则（比如年限检查把别人的经历算进来），而不是硬着头皮看它天天红。
 */
import type { QualityRow } from './quality-checks';
import { QUALITY_LABELS, isRunError, type QualityKind } from './quality-checks';

export type FeedbackVerdict = 'false_positive' | 'true_positive';

export function ruleKeyOf(issue: { kind: string; detail: string }): string {
  return `${issue.kind}|${issue.detail.replace(/「[^」]*」/g, '「…」').slice(0, 40)}`;
}

export interface RuleStat {
  key: string;
  kind: string;
  label: string;
  occurrences: number;
  falsePositive: number;
  truePositive: number;
  /** 误报占已标记的比例；还没人标过就是 null */
  fpRate: number | null;
}

/** 按规则统计出现次数和误报情况。feedback 是 quality_feedback 里的记录（已限定在统计窗口内） */
export function ruleStats(rows: QualityRow[], feedback: { rule_key: string; verdict: string }[]): RuleStat[] {
  const occ = new Map<string, { kind: string; count: number }>();
  for (const r of rows) {
    if (isRunError(r)) continue;
    for (const k of new Set(r.issues.map((i) => ruleKeyOf(i)))) {
      const kind = k.split('|')[0];
      const cur = occ.get(k) ?? { kind, count: 0 };
      cur.count++;
      occ.set(k, cur);
    }
  }
  const fb = new Map<string, { fp: number; tp: number }>();
  for (const f of feedback) {
    const cur = fb.get(f.rule_key) ?? { fp: 0, tp: 0 };
    if (f.verdict === 'false_positive') cur.fp++;
    else if (f.verdict === 'true_positive') cur.tp++;
    fb.set(f.rule_key, cur);
  }
  const keys = new Set([...occ.keys(), ...fb.keys()]);
  return [...keys]
    .map((key) => {
      const kind = key.split('|')[0];
      const f = fb.get(key) ?? { fp: 0, tp: 0 };
      const marked = f.fp + f.tp;
      return {
        key,
        kind,
        label: QUALITY_LABELS[kind as QualityKind] ?? kind,
        occurrences: occ.get(key)?.count ?? 0,
        falsePositive: f.fp,
        truePositive: f.tp,
        fpRate: marked ? Math.round((f.fp / marked) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);
}
