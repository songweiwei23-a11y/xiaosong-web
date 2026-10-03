import { BORROW_LAYERS, COUNT_OPTIONS, DEFAULT_LAYERS, DEFAULT_OUTPUTS, DEPTHS, DIFFERENTIATE, DURATIONS, OUTPUTS, ROLES, type RemixSource, type RemixDuration } from '@/lib/remix';

function choice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}
function choices<T extends string>(value: unknown, values: readonly T[], fallback: readonly T[]): T[] {
  return Array.isArray(value) ? value.filter((v): v is T => values.includes(v)) : [...fallback];
}

/** 老记录只恢复它真正存过的字段；新记录可以恢复原片与完整二创设置。 */
export function remixHistoryForm(input: Record<string, unknown> | null | undefined) {
  const data = input || {};
  const raw = data.sourceData as Partial<RemixSource> | undefined;
  const source = raw && typeof raw.text === 'string' && (raw.kind === 'paste' || raw.kind === 'breakdown')
    ? { kind: raw.kind, text: raw.text, title: typeof raw.title === 'string' ? raw.title : undefined, industry: typeof raw.industry === 'string' ? raw.industry : undefined } as RemixSource : null;
  return {
    source,
    layers: choices(data.layers, BORROW_LAYERS.map((v) => v.id), DEFAULT_LAYERS),
    count: COUNT_OPTIONS.includes(data.count as typeof COUNT_OPTIONS[number]) ? data.count as typeof COUNT_OPTIONS[number] : 3,
    differentiate: choice(data.differentiate, DIFFERENTIATE.map((v) => v.id), 'auto'),
    depth: choice(data.depth, DEPTHS.map((v) => v.id), 'full'),
    role: choice(data.role, ROLES.map((v) => v.id), 'same'),
    duration: typeof data.duration === 'string' && /^\d+(?:\.\d+)?(?:-\d+)?(?:秒|分钟)$/.test(data.duration) ? data.duration as RemixDuration : choice(data.duration, DURATIONS, '跟原片'),
    outputs: choices(data.outputs, OUTPUTS.map((v) => v.id), DEFAULT_OUTPUTS),
    targetIndustry: typeof data.targetIndustry === 'string' ? data.targetIndustry : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
  };
}
