/**
 * 档案保存时的一致性提示（整改 B3，2026-10-17）。
 *
 * 「川菜」那次的根因：对话改了档案，只改了一项，「两个核心」「双品类」之类的字样还留在别的栏里，
 * 定位就照着旧的写。这里只做能用规则判断清楚的两条，不调模型：
 *   1. 文字里写的「两个核心 / 三个品类」，和经营的具体品类数量对不上；
 *   2. 经历里「做了/干了/开了 …年」出现了好几个不同的年数，需要核对是不是同一件事。
 * 只提示、不阻止保存。规则抓不到的，仍交给前采时的模型逐项核对（lib/interview-import）。
 */
import { PROFILE_CHOICES } from './profile-fields';

/** 产品品类里的大类，不算一个具体品类（「餐饮」「本地服务」只说了行业，没说卖什么） */
const GENERIC_CATEGORIES = new Set(['餐饮', '本地服务']);

/** 会写「几个核心 / 几个品类」的字段，以及给界面看的名字 */
const COUNT_FIELDS: { key: string; label: string }[] = [
  { key: 'content_themes', label: '主要选题方向' },
  { key: 'unique_selling_point', label: '核心卖点' },
  { key: 'content_value', label: '内容价值' },
  { key: 'competitive_advantage', label: '差异化优势' },
];

const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 两: 2, 双: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const COUNT_RE = /(一|二|两|双|三|四|五|六)(?:个|大|种)?(?:核心|品类|类目)/g;
/** 只认「做了 / 干了 / 开了 …N 年」这类经历说法；「2026 年」这种日期不算 */
const YEARS_RE = /(?:从业|做了|干了|开了|经营|干过|开过|做过)[^，。,.；;\n]{0,6}?(\d{1,2})\s*年/g;

export interface ProfileConsistencyIssue {
  /** 出问题的字段，界面上可以用来定位 */
  key: string;
  message: string;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [];

function textOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(textOf).join('；');
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).map(textOf).join('；');
  return String(v);
}

/** 经营的具体品类：产品品类去掉大类，加上赛道里不在标准选项里的自定义值，去重 */
export function specificCategories(p: Record<string, unknown>): string[] {
  const product = strings(p.product_category).filter((v) => !GENERIC_CATEGORIES.has(v));
  const standard = PROFILE_CHOICES.account_track as readonly string[];
  const track = strings(p.account_track).filter((v) => !standard.includes(v));
  return [...new Set([...product, ...track])];
}

export function profileConsistencyIssues(p: Record<string, unknown> | null | undefined): ProfileConsistencyIssue[] {
  if (!p) return [];
  const out: ProfileConsistencyIssue[] = [];

  // 1. 数量：只有经营两个以上具体品类时才核对（只有一个品类，写「两个核心」才是明显的错，但那一条不属于「对不上」的范围）
  const cats = specificCategories(p);
  if (cats.length >= 2) {
    for (const f of COUNT_FIELDS) {
      const hit = [...textOf(p[f.key]).matchAll(COUNT_RE)][0];
      if (hit && CN_NUM[hit[1]] !== cats.length) {
        out.push({
          key: f.key,
          message: `「${f.label}」里写了「${hit[0]}」，但经营品类有 ${cats.length} 个（${cats.join('、')}），对不上。`,
        });
      }
    }
  }

  // 2. 经历年数：同一份档案里出现了好几个不同的年数，提醒核对
  const years = new Set<number>();
  for (const key of ['interview_highlights', 'persona_facts']) {
    for (const m of textOf(p[key]).matchAll(YEARS_RE)) years.add(Number(m[1]));
  }
  if (years.size > 1) {
    out.push({
      key: 'interview_highlights',
      message: `经历里「做了/干了/开了 …年」出现了 ${[...years].sort((a, b) => a - b).join('、')} 年，核对一下是不是同一件事；不是的话在经历里说清楚。`,
    });
  }

  return out;
}
