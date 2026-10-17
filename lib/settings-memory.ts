/**
 * 设置记忆（二期，见 docs/越用越懂你_二期方案_20261017.md 4.4）：从最近的历史记录里找出他常选的设置，
 * 下次打开表单时预填。纯逻辑，前后端共用。
 *
 * 规则（产品方 2026-10-17 定：默认开，可一键改回或关闭）：
 *   - 只看最近 20 次；每个字段至少 5 次有具体取值、且占一半以上，才预填
 *   - 「AI 推荐」本身就是默认值，不算一个要预填的常用值
 *   - 预填只是起点：用户当次改了，就以当次为准；不覆盖从别处带过来的设置
 */
import { settingsFromInput } from './creation-settings';

export const MEMORY_WINDOW = 20;
export const MEMORY_MIN = 5;
export const MEMORY_SHARE = 0.5;

export type MemoryField = 'duration' | 'purpose' | 'structure' | 'platform';
export const MEMORY_FIELDS: MemoryField[] = ['duration', 'purpose', 'structure', 'platform'];

export interface MemoryDefault { value: string; n: number; of: number }
export type MemoryDefaults = Partial<Record<MemoryField, MemoryDefault>>;

/** AI 推荐、AI 自行推断之类都算「交给 AI 定」，不是一个常用的具体值 */
const isAiChoice = (v: string) => /AI/.test(v);

/**
 * inputs：历史记录里的 input_data，按时间从新到旧。
 * 返回每个字段的常用值（没有达到门槛的字段不返回）。
 */
export function pickDefaults(inputs: (Record<string, unknown> | null | undefined)[]): MemoryDefaults {
  const recent = inputs.slice(0, MEMORY_WINDOW);
  const of = recent.length;
  const out: MemoryDefaults = {};
  if (of < MEMORY_MIN) return out;
  const settings = recent.map((input) => settingsFromInput(input ?? {}));
  for (const field of MEMORY_FIELDS) {
    const counts = new Map<string, number>();
    for (const s of settings) {
      const raw = s[field];
      const v = typeof raw === 'string' ? raw.trim() : '';
      if (!v || isAiChoice(v)) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const [value, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    if (value && n >= MEMORY_MIN && n / of >= MEMORY_SHARE) out[field] = { value, n, of };
  }
  return out;
}

/** 设置记忆的开关只在这台电脑上记（localStorage）：关了就不再预填，但历史记录照常存 */
export const MEMORY_KEY = 'kaiwu:settings-memory';
export function memoryEnabled(): boolean {
  try {
    return typeof window === 'undefined' || localStorage.getItem(MEMORY_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setMemoryEnabled(on: boolean): void {
  try {
    localStorage.setItem(MEMORY_KEY, on ? 'on' : 'off');
  } catch {
    // 存不下就只在本次打开期间生效
  }
}

/** 预填成一句话：「按你常用的设置预填了：60秒 · 引流优先 · 抖音」 */
export function memorySummary(d: MemoryDefaults): string {
  const parts = MEMORY_FIELDS.map((f) => d[f]?.value).filter((v): v is string => !!v);
  return parts.length ? `按你常用的设置预填了：${parts.join(' · ')}` : '';
}
