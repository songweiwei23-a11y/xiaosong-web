/**
 * 「开物验证过的写法」（二期 B 阶段）：用作品录下的完播数据，验证哪种写法在这个号上真的更好。
 *
 * 规则（产品方 2026-10-17 确认）：
 *   - 某种写法至少 5 条已录数据的作品，且和其他作品对比完播中位数相差 5 个百分点以上，才形成一条
 *   - 至少 10 条才「生效」（会进生成的提示词）；5～9 条放「观察中」，只在首页显示，不影响生成
 *   - 写进偏好卡的句子不带数字（数字只在「依据」里看）：数字会随数据变，写死在提示词里就是假事实
 *   - 这是相关，不是因果：依据里要写清楚「相关，不代表一定是写法的功劳」
 *   - 每次学习整体重算：数据变了，条目跟着变；用户删掉的不再出现
 */
import type { PreferenceItem } from './preferences';
import { emptyEvidence, sameMeaning } from './preferences';
import { type LengthKind, type OpeningKind } from './work-features';

export const VERIFY_MIN_WATCH = 5;
export const VERIFY_MIN_ACTIVE = 10;
export const VERIFY_GAP = 5;

/** 一条已录数据的作品：完播（%）＋ 写法特征 */
export interface WorkSample { id: string; completion: number; opening: OpeningKind; length: LengthKind; at: string }

const TEXT: Record<string, { good: string; bad: string }> = {
  question: { good: '开头用一个具体的问题切入，让人想知道答案', bad: '少用反问开场，直接说事情' },
  number: { good: '开头带一个具体的数字或价格', bad: '开头先别堆感受，先给一个具体信息' },
  conclusion: { good: '开头直接给结论，少铺垫', bad: '开头别急着下结论，先讲一个具体经过' },
  scene: { good: '开头从一个具体的现场或真实经过切入', bad: '开头少用场景铺垫，直接进冲突' },
  short: { good: '口播尽量紧凑，一分钟以内讲完', bad: '口播别压得太短，把细节讲透' },
  long: { good: '内容可以讲透一些，口播不必刻意压短', bad: '口播控制在一分钟以内，别拖长' },
};

const OPENING_VALUES: OpeningKind[] = ['question', 'number', 'conclusion', 'scene'];
const LENGTH_VALUES: LengthKind[] = ['short', 'long'];

export const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** 按写法分组，和其余作品比完播中位数，形成「验证过」的条目 */
export function buildVerifiedItems(samples: WorkSample[], now: number): PreferenceItem[] {
  if (samples.length < VERIFY_MIN_WATCH) return [];
  const iso = new Date(now).toISOString();
  const out: PreferenceItem[] = [];
  const dims: { dim: 'opening' | 'length'; values: string[] }[] = [
    { dim: 'opening', values: OPENING_VALUES },
    { dim: 'length', values: LENGTH_VALUES },
  ];
  for (const { dim, values } of dims) {
    for (const value of values) {
      const group = samples.filter((s) => s[dim] === value);
      const rest = samples.filter((s) => s[dim] !== value);
      if (group.length < VERIFY_MIN_WATCH || rest.length < VERIFY_MIN_WATCH) continue;
      const gm = median(group.map((s) => s.completion));
      const rm = median(rest.map((s) => s.completion));
      const gap = Math.round(gm - rm);
      if (Math.abs(gap) < VERIFY_GAP) continue;
      const good = gap > 0;
      const text = good ? TEXT[value].good : TEXT[value].bad;
      const n = group.length;
      const status = n >= VERIFY_MIN_ACTIVE ? 'active' : 'watching';
      out.push({
        id: `data-${dim}-${value}-${good ? 'up' : 'down'}`,
        category: dim === 'opening' ? 'opening' : 'structure',
        text,
        count: n,
        from: { ...emptyEvidence(), published: n },
        status,
        origin: 'data',
        basis: `${n} 条已录数据的作品：完播中位数 ${Math.round(gm)}%，其他 ${rest.length} 条是 ${Math.round(rm)}%，${good ? '高' : '低'}约 ${Math.abs(gap)} 个百分点。相关，不代表一定是这个写法的功劳`,
        firstSeen: iso,
        lastSeen: iso,
        ...(status === 'active' ? { activeAt: iso } : {}),
      });
    }
  }
  return out;
}

/**
 * 把数据条目换进偏好卡：旧的数据条目全部替换；用户删过的（rejected）不再放回。
 * 手写的、学出来的条目原样保留。
 */
export function withDataItems(items: PreferenceItem[], dataItems: PreferenceItem[], rejected: string[]): PreferenceItem[] {
  const kept = items.filter((i) => i.origin !== 'data');
  const fresh = dataItems.filter((d) => !rejected.some((r) => sameMeaning(r, d.text)));
  return [...kept, ...fresh];
}

export const samplesSignature = (samples: WorkSample[]): string =>
  samples.map((s) => `${s.id}:${s.completion}:${s.opening}:${s.length}`).join('|');

/**
 * 「学习进度」这一句话（整改 B2）。usable 必须来自 collectVerifiedSamples——
 * 首页、作品页和后台统计用同一个数，不另起口径。
 */
export function learningProgressLine(usable: number, active: number = VERIFY_MIN_ACTIVE): string {
  if (usable <= 0) return '还没有录过数据。发完视频录 3 个数，攒到 ' + active + ' 条，开物才会开始验证你的写法';
  if (usable < active) return `已录 ${usable} 条数据，再录 ${active - usable} 条，开物才会开始验证你的写法`;
  return `已录 ${usable} 条数据，写法之间还没有明显差别，继续录会更准`;
}
