/**
 * 新选题和「已经做过」的比一比（2026-11-08 产品方选：生成后比对、标出来，换不换编导定；用一次小的模型调用来判）。
 *
 * 为什么不放进生成的提示词：真实对照里清单会把模型往旧题上拽（见 lib/creator-context 的 DONE_LIST_IN_PROMPT）。
 * 为什么不按字面比：同一个号的选题本来就共用「一元火锅」「大码」「连衣裙」这些字，真重复和正常选题分数混在一起（.tmp/done-ab）。
 * 所以选题定稿以后，只把标题交给模型判「是不是同一件事、同一个角度」，不改选题、不扣次数。
 */
import type { DoneItem } from './done-list';

export interface DupHit {
  /** 新选题的标题（原样） */
  title: string;
  /** 像哪一条做过的 */
  like: string;
  status: DoneItem['status'];
  /** 一句话：哪里一样 */
  why: string;
}

export const DUP_TITLES_MAX = 30;

export function buildDupPrompt(titles: string[], done: DoneItem[]): { system: string; user: string } {
  const system = [
    '你帮短视频编导查重：判断新选题里，哪几条和这个号已经拍过、发过的是同一条内容。',
    '算重复：讲的是同一件事、同一个切入角度或同一个结论，换个说法、换个标题句式也算。',
    '不算重复：只是同一个品类、同一个大方向（比如都讲火锅、都讲连衣裙），但讲的是不同的事、不同的角度、不同的人或不同的货。',
    '拿不准的不算。宁可少标，不要多标。',
    '只输出一个 JSON 对象，不要任何其他文字：{"dups": [{"new": 新选题编号, "done": 做过的编号, "why": "哪里一样，不超过 20 字"}]}；没有重复就是 {"dups": []}。',
  ].join('\n');
  const user = [
    '## 新选题',
    ...titles.map((t, i) => `${i + 1}. ${t}`),
    '',
    '## 这个号已经拍过、发过的',
    ...done.map((d, i) => `${i + 1}. ${d.title}`),
  ].join('\n');
  return { system, user };
}

export function parseDupJson(raw: string, titles: string[], done: DoneItem[]): DupHit[] {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let d: { dups?: unknown };
  try { d = JSON.parse(raw.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(d?.dups)) return [];
  const seen = new Set<number>();
  const out: DupHit[] = [];
  for (const x of d.dups) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const n = Number(o.new), k = Number(o.done);
    if (!Number.isInteger(n) || !Number.isInteger(k) || n < 1 || n > titles.length || k < 1 || k > done.length || seen.has(n)) continue;
    seen.add(n);
    out.push({ title: titles[n - 1], like: done[k - 1].title, status: done[k - 1].status, why: typeof o.why === 'string' ? o.why.trim().slice(0, 40) : '' });
  }
  return out;
}
