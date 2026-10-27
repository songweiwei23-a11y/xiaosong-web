/**
 * 选题的槽位分配（2026-10-26）：一批 N 条选题，代码先给每条分配不同的人群、爆款元素、拍法，
 * 模型只负责把分配写成具体、有创意的选题。多样性由代码保证，不靠模型自觉。
 * 人群来自档案的目标年龄、职业；元素是这个行业适用的八大爆款元素，每条用几个由创意难度定（2026-10-27）；
 * 拍法从可用的 36 计里挑。
 */

export interface TopicSlot {
  no: number;
  /** 这条的目的（流量型 / 人设型 / 变现型）。按配比时由代码按条数排好，没给就是空 */
  role: string;
  audience: string;
  /** 这条用的爆款元素（流量型 1 到 3 个，由创意难度定；人设、变现不套） */
  elements: string[];
  /** 这条押的成交理由（只给变现型，按选中的成交理由轮流分；没选就是空，由选题层从档案找） */
  reason: string;
  /** 这条用的切入角度（从创作方向的角度里轮流分；没有方向就是空）。2026-10-27：原来 6 条都挤在「坐下」上 */
  angle: string;
  tactic: string;
  /** 从方向的题眼池里分到的题眼（没有方向种子时为空） */
  hook: string;
}

export interface TopicProfileFields {
  target_gender?: string | null;
  target_age?: string | string[] | null;
  target_occupation?: string | string[] | null;
  target_interests?: string | string[] | null;
}

/** 档案的目标性别 → 人群标签前面的一个词（女性为主、男性为主才写；不限不写），避免模型自己写出档案没有的性别（2026-10-27） */
function genderWord(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (/女/.test(s)) return '女性';
  if (/男/.test(s)) return '男性';
  return '';
}

const SPLIT = /[、，,；;\s]+/;

/** 档案字段有的是字符串、有的是数组（多选），两种都要认 */
const parts = (v: unknown): string[] => {
  const raw = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(SPLIT) : [];
  return raw.map((s) => s.trim()).filter(Boolean);
};

/**
 * 档案里的人群候选：职业 × 年龄段两两组合，去重。档案没写职业或年龄时用兴趣补。
 */
export function audiencePool(profile: TopicProfileFields | null | undefined): string[] {
  const occ = parts(profile?.target_occupation);
  const age = parts(profile?.target_age);
  const out: string[] = [];
  // 职业 × 年龄段 的全部组合（3 个年龄 × 2 个职业 = 6 个人群），不是按位置对齐
  const occList = occ.length ? occ : [''];
  const ageList = age.length ? age : [''];
  const gender = genderWord(profile?.target_gender);
  for (const o of occList) {
    for (const a of ageList) {
      // 只有性别一个词不算人群，要有年龄或职业才组得出标签
      if (!a && !o) continue;
      const label = [gender, a, o].filter(Boolean).join(' ');
      if (!out.includes(label)) out.push(label);
    }
  }
  if (!out.length) {
    for (const x of parts(profile?.target_interests)) {
      const label = [gender, x].filter(Boolean).join(' ');
      if (!out.includes(label)) out.push(label);
    }
  }
  return out;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** 与长度互质的步长，让 i*步长 取模后尽量不重复 */
function coprimeStride(len: number): number {
  for (let s = 3; s < len; s++) if (gcd(s, len) === 1) return s;
  return 1;
}

/**
 * 每条选题分到 k 个爆款元素（k = 创意难度决定的个数）。
 * 目标两条：每个元素用的次数尽量平均；各条的元素组合互不相同（组合够分的时候）。
 * 轮换的起点按条号错开，k=1 时就是一条一个地轮流，和原来一致。
 */
function pickElementCombos(pool: string[], count: number, k: number): string[][] {
  const n = pool.length;
  if (!n) return Array.from({ length: count }, () => []);
  const usage = new Array<number>(n).fill(0);
  const used = new Set<string>();
  const out: string[][] = [];
  for (let i = 0; i < count; i++) {
    const options: number[][] = [];
    for (let shift = 0; shift < n; shift++) {
      const start = (i * k + shift) % n;
      const ranked = pool
        .map((_, idx) => idx)
        .sort((a, b) => usage[a] - usage[b] || ((a - start + n) % n) - ((b - start + n) % n));
      options.push(ranked.slice(0, k).sort((a, b) => a - b));
    }
    const chosen = options.find((o) => !used.has(o.join(','))) ?? options[0];
    used.add(chosen.join(','));
    chosen.forEach((x) => (usage[x] += 1));
    out.push(chosen.map((x) => pool[x]));
  }
  return out;
}

/**
 * 按配比的条数排成一个目的顺序（流量 / 人设 / 变现交错，尽量不连着出两条同一种）。
 * 条数由代码算好（mixToCounts），这里只负责排顺序，不让模型自己分。
 */
export function roleSequence(counts: Record<string, number>): string[] {
  const left: Record<string, number> = { ...counts };
  const out: string[] = [];
  let last = '';
  for (;;) {
    const keys = Object.keys(left).filter((k) => left[k] > 0);
    if (!keys.length) break;
    keys.sort((a, b) => ((a === last ? 1 : 0) - (b === last ? 1 : 0)) || left[b] - left[a]);
    const pick = keys[0];
    out.push(pick);
    left[pick] -= 1;
    last = pick;
  }
  return out;
}

/**
 * 给 count 条分配槽位：目的（有 roles 时）、人群、元素、拍法各自尽量不重复。
 * 只有流量型的条才分爆款元素：人设、变现讲的是人和成交，硬套「荷尔蒙」「奇葩」只会变味（2026-10-27）。
 * firstTactic 只给第 1 条（比如方向里明确提过采访，只第 1 条用街头采访，别的不强求）。
 */
export function assignTopicSlots(p: {
  count: number;
  audiences: string[];
  elements: string[];
  tactics: string[];
  firstTactic?: string;
  /** 方向种子里的题眼池：每条选题取一个，题眼不同，选题才不同 */
  hooks?: string[];
  /** 每条用几个爆款元素（创意难度决定：容易执行 1、中等创意 2、高创意 3）。默认 1，超过元素数时按元素数 */
  perTopic?: number;
  /** 每条的目的，长度和 count 一致。不给就是没分目的，每条都按流量型的元素来分 */
  roles?: string[];
  /** 用户选中的成交理由。只分给变现型的条，轮流用，每个理由都能轮到（2026-10-27：原来 5 条都写「现场试穿」） */
  reasons?: string[];
  /** 方向里的切入角度（每行一个）。按条轮流分，每条切进一个不同的角度 */
  angles?: string[];
}): TopicSlot[] {
  const audiences = p.audiences.length ? p.audiences : [];
  const tactics = p.tactics;
  const hooks = p.hooks ?? [];
  const stride = coprimeStride(tactics.length || 1);
  const perTopic = Math.max(1, Math.min(p.perTopic ?? 1, p.elements.length));
  const takesElements = (i: number) => !p.roles || p.roles[i] === '流量型';
  const flowIdx = Array.from({ length: p.count }, (_, i) => i).filter(takesElements);
  const combos = pickElementCombos(p.elements, flowIdx.length, perTopic);
  const comboAt = new Map(flowIdx.map((i, j) => [i, combos[j]]));
  const reasons = p.reasons ?? [];
  const takesReason = (i: number) => !p.roles || p.roles[i] === '变现型';
  const reasonAt = new Map<number, string>();
  let ordinal = 0;
  for (let i = 0; i < p.count && reasons.length; i++) {
    if (!takesReason(i)) continue;
    reasonAt.set(i, reasons[ordinal % reasons.length]);
    ordinal++;
  }
  const slots: TopicSlot[] = [];
  for (let i = 0; i < p.count; i++) {
    slots.push({
      no: i + 1,
      role: p.roles?.[i] ?? '',
      audience: audiences.length ? audiences[i % audiences.length] : '',
      elements: comboAt.get(i) ?? [],
      reason: reasonAt.get(i) ?? '',
      angle: p.angles?.length ? p.angles[i % p.angles.length] : '',
      tactic: i === 0 && p.firstTactic ? p.firstTactic : tactics.length ? tactics[(i * stride) % tactics.length] : '',
      hook: hooks.length ? hooks[i % hooks.length] : '',
    });
  }
  return slots;
}

/** 写进选题提示词的分配表。空的一项写成「由选题层定，但与其他条不同」 */
export function topicSlotsBlock(slots: TopicSlot[]): string {
  if (!slots.length) return '';
  const rows = slots.map((s) => {
    const who = s.audience || '由选题层从档案里选一类，和其他条不同';
    const notFlow = !!s.role && s.role !== '流量型';
    const el = notFlow
      ? `无（${s.role}不套爆款元素）`
      : s.elements.length
        ? s.elements.length > 1
          ? `${s.elements.join(' + ')}（这几个同时用，都要设计进这一条）`
          : s.elements[0]
        : '由选题层挑一个，和其他条不同';
    const how = s.tactic || '由选题层挑一计，和其他条不同';
    const hook = s.hook ? `；题眼=${s.hook}` : '';
    const role = s.role ? `目的=${s.role}；` : '';
    const reason = s.reason ? `成交理由=${s.reason}；` : '';
    const angle = s.angle ? `切入角度=${s.angle}；` : '';
    return `第${s.no}条：${role}人群=${who}；${angle}爆款元素=${el}；${reason}拍法=${how}${hook}`;
  });
  const hookNote = slots.some((s) => s.hook) ? '题眼是这条选题的出发线索，要从它展开成一个具体的人和事，不照抄题眼原文。' : '';
  const multiNote = slots.some((s) => s.elements.length > 1) ? '带「+」的那条要把几个爆款元素一起设计进同一个选题，不是各写一句。' : '';
  const roleNote = slots.some((s) => s.role) ? '每条的目的按分配表写，不要自己换；目的决定这条怎么拍，不决定要不要有爆款元素。' : '';
  const reasonNote = slots.some((s) => s.reason) ? '带「成交理由=」的那条只押这一个理由，要在画面或过程里看得见，不能又套别的理由。' : '';
  const elementNote = slots.some((s) => s.elements.length) ? '带爆款元素的那条，标题要光看就认得出用的是哪个元素（用它的句式），不能只在正文里；同一批里同一个句式关键词（如「当年最火」「最没面子」）只用一次。' : '';
  const angleNote = slots.some((s) => s.angle) ? '带「切入角度=」的那条，就从这个角度切进去（核心问题照它写），标题和内容都不要换到别的角度上。' : '';
  return `【本批每条的分配（代码定，每条必须照这几项写）】\n${rows.join('\n')}\n各项是每条选题的骨架：目的决定这条要达到什么，人群决定谁在看，元素决定看点，拍法决定事件怎么走，题眼决定从哪个角度切进去。各条互不相同；核心问题也不能只是换件衣服、换个年代或换句话（比如两条都讲旧穿法），标题和内容都围绕本条自己的分配写，不复用其他条的句子和写法。${roleNote}${reasonNote}${angleNote}${elementNote}${multiNote}${hookNote}`;
}
