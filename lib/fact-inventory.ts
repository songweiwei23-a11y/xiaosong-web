/**
 * 「本次能用的具体数字」清单（整改 A3，2026-10-17）。
 *
 * 写作底线（lib/output-rules）只说了「资料里没有的价格、年限不写」，模型仍会凭感觉写出 88 元、188 元。
 * 这里把档案里真有的数字一条条列出来，写明出处，再规定「清单之外一律不写」——
 * 模型不用猜哪些数字是真的，也不用在一堆文字里找依据。
 *
 * 只从档案的文字字段和事实卡里抽取，不调模型。抽不到就明说「没有任何具体数字」。
 */

/** 档案里可能写着数字的文字字段，以及给界面和提示词看的名字 */
const SOURCES: { key: string; label: string }[] = [
  { key: 'price_range', label: '价格区间' },
  { key: 'interview_highlights', label: '真实情况' },
  { key: 'unique_selling_point', label: '核心卖点' },
  { key: 'content_value', label: '内容价值' },
  { key: 'conversion_path', label: '成交路径' },
  { key: 'conversion_barriers', label: '成交障碍' },
  { key: 'content_themes', label: '内容方向' },
  { key: 'competitive_advantage', label: '差异化优势' },
  { key: 'viral_content_pattern', label: '爆款基因' },
  { key: 'monetization_model', label: '变现方式' },
  { key: 'persona_facts', label: '人设事实卡' },
];

/** 清单最多列这么多条，超过的不列（背景块有长度上限，见 tests/creator-context 的规模测试） */
export const INVENTORY_MAX = 8;

/** 数字 + 可选单位。单位只在这几个里认，避免把「第3步」之类的序号当成事实 */
const NUMBER_RE = /(\d+(?:\.\d+)?)\s*(%|元|块|折|年|个月|天|个|家|店|人|条|粉|万|千|岁|次|分钟|秒)?/g;

function textOf(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textOf).join('；');
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(textOf).join('；');
  return String(value);
}

export interface InventoryItem {
  /** 原文里的数字写法，比如「88元」「9年」 */
  value: string;
  /** 来自档案的哪一项 */
  from: string;
}

/** 从档案里抽出具体数字，同一个写法只列一次 */
export function inventoryOf(profile: Record<string, unknown> | null | undefined): InventoryItem[] {
  if (!profile) return [];
  const seen = new Set<string>();
  const out: InventoryItem[] = [];
  for (const { key, label } of SOURCES) {
    const text = textOf(profile[key]).trim();
    if (!text) continue;
    for (const m of text.matchAll(NUMBER_RE)) {
      const [raw, num, unit] = m;
      // 2026年、2020年这类年份不是「年限」，是日期，不列
      if (unit === '年' && /^(19|20)\d{2}$/.test(num)) continue;
      const value = raw.trim();
      // 同一个写法在几处都出现，只列第一次，清单短一点、模型不会因为重复而觉得它更「确定」
      if (seen.has(value)) continue;
      seen.add(value);
      out.push({ value, from: label });
      if (out.length >= INVENTORY_MAX) return out;
    }
  }
  return out;
}

/**
 * 提示词里的这一段。清单为空时明说「没有任何具体数字」，
 * 不让模型以为是清单漏了、于是自己补。
 */
export function factInventoryBlock(profile: Record<string, unknown> | null | undefined): string {
  if (!profile) return '';
  const items = inventoryOf(profile);
  const head = '## 🔢 本次能用的具体数字（只能用这些）';
  const rule = '清单之外的数字一律不写；要写就用【待确认：xx】占位。';
  // 压成一行：背景块有长度上限（lib/creator-context 的规模测试），清单越短越好
  // 没有数字时只说一句，不另起标题（背景块有长度上限，见 tests/creator-context 的规模测试）
  if (!items.length) {
    return '本次资料里没有具体数字：价格、年限、数量一律不写，要写就用【待确认：xx】占位。';
  }
  return [head, items.map((i) => `「${i.value}」（${i.from}）`).join('、'), rule].join('\n');
}
