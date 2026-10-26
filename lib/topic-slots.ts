/**
 * 选题的槽位分配（2026-10-26）：一批 N 条选题，代码先给每条分配不同的人群、爆款元素、拍法，
 * 模型只负责把分配写成具体、有创意的选题。多样性由代码保证，不靠模型自觉。
 * 人群来自档案的目标年龄、职业；元素是八大爆款元素；拍法从可用的 36 计里挑。
 */

export interface TopicSlot {
  no: number;
  audience: string;
  element: string;
  tactic: string;
}

export interface TopicProfileFields {
  target_age?: string | string[] | null;
  target_occupation?: string | string[] | null;
  target_interests?: string | string[] | null;
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
  for (const o of occList) {
    for (const a of ageList) {
      const label = [a, o].filter(Boolean).join(' ');
      if (label && !out.includes(label)) out.push(label);
    }
  }
  if (!out.length) for (const x of parts(profile?.target_interests)) if (!out.includes(x)) out.push(x);
  return out;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** 与长度互质的步长，让 i*步长 取模后尽量不重复 */
function coprimeStride(len: number): number {
  for (let s = 3; s < len; s++) if (gcd(s, len) === 1) return s;
  return 1;
}

/**
 * 给 count 条分配槽位：人群、元素、拍法各自尽量不重复。
 * firstTactic 只给第 1 条（比如方向里明确提过采访，只第 1 条用街头采访，别的不强求）。
 */
export function assignTopicSlots(p: {
  count: number;
  audiences: string[];
  elements: string[];
  tactics: string[];
  firstTactic?: string;
}): TopicSlot[] {
  const audiences = p.audiences.length ? p.audiences : [];
  const elements = p.elements;
  const tactics = p.tactics;
  const stride = coprimeStride(tactics.length || 1);
  const slots: TopicSlot[] = [];
  for (let i = 0; i < p.count; i++) {
    slots.push({
      no: i + 1,
      audience: audiences.length ? audiences[i % audiences.length] : '',
      element: elements.length ? elements[i % elements.length] : '',
      tactic: i === 0 && p.firstTactic ? p.firstTactic : tactics.length ? tactics[(i * stride) % tactics.length] : '',
    });
  }
  return slots;
}

/** 写进选题提示词的分配表。空的一项写成「由选题层定，但与其他条不同」 */
export function topicSlotsBlock(slots: TopicSlot[]): string {
  if (!slots.length) return '';
  const rows = slots.map((s) => {
    const who = s.audience || '由选题层从档案里选一类，和其他条不同';
    const el = s.element || '由选题层挑一个，和其他条不同';
    const how = s.tactic || '由选题层挑一计，和其他条不同';
    return `第${s.no}条：人群=${who}；爆款元素=${el}；拍法=${how}`;
  });
  return `【本批每条的分配（代码定，每条必须照这三项写）】\n${rows.join('\n')}\n三项是每条选题的骨架：人群决定谁在看，元素决定看点，拍法决定事件怎么走。各条三项互不相同；标题和内容都围绕本条自己的三项写，不复用其他条的句子和写法。`;
}
