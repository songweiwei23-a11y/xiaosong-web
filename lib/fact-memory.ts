/**
 * 事实记忆（二期 C 阶段，见 docs/越用越懂你_二期方案_20261017.md 4.5）：
 * 生成时反复用到的「拍摄条件」，和档案里写的对不上，就提示一句「要不要更新档案」。
 *
 * 只看四个结构化字段（设备、人员、预算、拍摄场地）——它们的生成设置默认就是从档案来的，
 * 所以「反复改成另一个值」就是档案过时的最直接信号。自由文本（店名、价格的原话）不猜。
 *
 * 规则（产品方 2026-10-17：只提示，不自动写）：
 *   - 最近 10 次生成里，某个值出现至少 3 次、占一半以上（60%），且档案里还没有这个值，才提示
 *   - 用户点「忽略」的，同一个字段同一个值不再提示
 *   - 「AI 推荐」「自动」之类交给 AI 定的，不算
 */

export const FACT_WINDOW = 10;
export const FACT_MIN = 3;
export const FACT_SHARE = 0.6;

/** 设置字段 → 档案字段。kind：multi 是多选（追加），single 是单选（替换） */
export const FACT_FIELDS = [
  { setting: 'device', profile: 'equipment', kind: 'multi', label: '设备条件' },
  { setting: 'personnel', profile: 'team_structure', kind: 'single', label: '团队配置' },
  { setting: 'budget', profile: 'budget_per_video', kind: 'single', label: '单条预算' },
  { setting: 'scene', profile: 'shooting_location', kind: 'multi', label: '拍摄场地' },
] as const;

export type FactField = (typeof FACT_FIELDS)[number];

export interface FactSuggestion {
  /** 档案字段名（只会是 FACT_FIELDS 里的） */
  field: string;
  label: string;
  kind: 'multi' | 'single';
  value: string;
  /** 档案里现在写的（没有写就是「未写」） */
  current: string;
  n: number;
  of: number;
  /** 忽略记录用：字段 + 值 */
  key: string;
}

const isAuto = (v: string) => !v || /自动|AI|推荐/.test(v);

/** 档案里现在写的值，显示用 */
export function currentText(raw: unknown, kind: 'multi' | 'single'): string {
  if (kind === 'multi') return Array.isArray(raw) && raw.length ? raw.map(String).join('、') : '';
  return typeof raw === 'string' ? raw : '';
}

/** 这个值在档案里是不是已经有了 */
export function alreadyInProfile(raw: unknown, kind: 'multi' | 'single', value: string): boolean {
  if (kind === 'multi') return Array.isArray(raw) && raw.map(String).includes(value);
  return typeof raw === 'string' && raw.trim() === value;
}

export const factKey = (field: string, value: string) => `${field}|${value}`;

/**
 * records：最近的生成设置（新的在前），每条是 creationSettings；profile：档案行；dismissed：已经忽略过的 factKey。
 */
export function factSuggestions(records: (Record<string, unknown> | null | undefined)[], profile: Record<string, unknown> | null, dismissed: Set<string>): FactSuggestion[] {
  const recent = records.slice(0, FACT_WINDOW);
  const of = recent.length;
  if (of < FACT_MIN || !profile) return [];
  const out: FactSuggestion[] = [];
  for (const spec of FACT_FIELDS) {
    const counts = new Map<string, number>();
    for (const r of recent) {
      const raw = r?.[spec.setting];
      const v = typeof raw === 'string' ? raw.trim() : '';
      if (isAuto(v)) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const [value, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    if (!value || n < FACT_MIN || n / of < FACT_SHARE) continue;
    if (alreadyInProfile(profile[spec.profile], spec.kind, value)) continue;
    const key = factKey(spec.profile, value);
    if (dismissed.has(key)) continue;
    out.push({ field: spec.profile, label: spec.label, kind: spec.kind, value, current: currentText(profile[spec.profile], spec.kind), n, of, key });
  }
  return out;
}

/** 接受之后写进档案的新值：多选追加（不丢原来的），单选替换 */
export function nextProfileValue(raw: unknown, kind: 'multi' | 'single', value: string): string[] | string {
  if (kind === 'multi') {
    const prev = Array.isArray(raw) ? raw.map(String) : [];
    return prev.includes(value) ? prev : [...prev, value];
  }
  return value;
}

/** 只允许更新这几个档案字段，别的一律不碰 */
export const FACT_PROFILE_FIELDS = new Set<string>(FACT_FIELDS.map((f) => f.profile));
export const specOfProfileField = (field: string) => FACT_FIELDS.find((f) => f.profile === field) ?? null;
