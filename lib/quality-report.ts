/**
 * 浏览器端：生成完体检一遍、报给后台（lib/quality-checks 的规则，/api/quality-checks 记一笔）。
 * 同一份结果只报一次；报不上就算了，不打扰用户。
 */
import { runQualityChecks, outputKey, type QualityResult } from './quality-checks';
import type { ResolvedMix } from './content-mix';

const reported = new Set<string>();

export function reportQuality(p: {
  taskType: string;
  output: string;
  profile: { id?: string } & object | null | undefined;
  mix?: { resolved: ResolvedMix; count: number } | null;
  /** 这次带进来的素材：关键事实核对时，价格、地名在这里找得到就不算编的 */
  source?: string | null;
}): QualityResult | null {
  const output = p.output?.trim() ?? '';
  const key = `${p.profile?.id ?? ''}:${p.taskType}:${outputKey(output)}`;
  if (reported.has(key)) return null;
  reported.add(key);
  if (reported.size > 1000) reported.delete(reported.values().next().value!);
  const result = runQualityChecks({ output, profile: p.profile, mix: p.mix, taskType: p.taskType, source: p.source });
  void fetch('/api/quality-checks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskType: p.taskType, profileId: p.profile?.id ?? null, issues: result.issues, sample: output.slice(0, 300) }),
  }).catch(() => {});
  return result;
}
