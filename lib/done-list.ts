/**
 * 「已经做过」避重清单（2026-11-08 产品方定，全链路闭环第二步）。
 *
 * 10-31 把历史产出整个关掉了（lib/creative-history 的 HISTORY_IN_GENERATION）：旧结果的正文、方向名把别的季节、场地带进新结果，
 * 模型照抄。但关掉以后系统不知道这个号已经拍过什么，会出重复的题。
 * 这里只给「已拍、已发」作品的标题和打法，不给正文；标题里带场地、设备字样的不给（和 directionNamesOf 同一条规矩）；
 * 提示词写明只用来避开重复，季节、时令、地点、细节都不带进新内容。
 * 只给出选题、出方向的板块：选题、创作方向 / 内容规划、自由对话。
 */
import { hasConcreteScene } from './scene-words';

export interface DoneItem {
  title: string;
  status: '已发布' | '已拍摄';
  tactic?: string | null;
  purpose?: string | null;
}

export const DONE_MAX = 40;
const TITLE_MAX = 60;

export interface DoneWork {
  id: string;
  title: string;
  shoot_status?: string | null;
  published_at?: string | null;
  shot_at?: string | null;
  updated_at?: string | null;
}

const norm = (s: string) => s.replace(/[\s「」『』“”"'《》【】！!？?，,。.、：:…]/g, '');

/** 已拍、已发的作品 → 清单：新的在前，同名去重，带场地设备字样的不要，最多 40 条 */
export function doneListOf(works: DoneWork[], settingsOf: Map<string, Record<string, unknown>>): DoneItem[] {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 30) : null);
  const at = (w: DoneWork) => Date.parse(w.published_at || w.shot_at || w.updated_at || '') || 0;
  const seen = new Set<string>();
  const out: DoneItem[] = [];
  for (const w of [...works].sort((a, b) => at(b) - at(a))) {
    const published = w.shoot_status === 'published' || !!w.published_at;
    if (!published && w.shoot_status !== 'shot') continue;
    const title = (w.title || '').trim().slice(0, TITLE_MAX);
    const key = norm(title);
    if (!key || seen.has(key) || hasConcreteScene(title)) continue;
    seen.add(key);
    const s = settingsOf.get(w.id) ?? {};
    out.push({ title, status: published ? '已发布' : '已拍摄', tactic: str(s.tactic), purpose: str(s.purpose) });
    if (out.length >= DONE_MAX) break;
  }
  return out;
}

/** 收到的清单（接口返回的）：只留认识的字段 */
export function readDoneList(v: unknown): DoneItem[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, TITLE_MAX) : '';
    if (!title) return [];
    return [{
      title,
      status: o.status === '已拍摄' ? '已拍摄' as const : '已发布' as const,
      tactic: typeof o.tactic === 'string' ? o.tactic.slice(0, 30) : null,
      purpose: typeof o.purpose === 'string' ? o.purpose.slice(0, 30) : null,
    }];
  }).slice(0, DONE_MAX);
}

export function doneListPromptBlock(items: DoneItem[] | null | undefined): string {
  if (!items?.length) return '';
  const rows = items.map((d) => `- 「${d.title}」（${d.status}${d.purpose ? `｜${d.purpose}` : ''}${d.tactic ? `｜打法：${d.tactic}` : ''}）`);
  return [
    `### 🗂 这个号已经拍过、发过的（${items.length} 条，只用来避开重复，不是参考素材）`,
    ...rows,
    '',
    '- 这一批不要再出和上面同一件事、同一个角度的题，换个说法也算重复；同一个母题换人、换货、换场景、换切入角度可以做。',
    '- 上面标题里的季节、时令、地点、具体细节一律不带进新内容；本轮的时间和季节以「当前时间」和本次输入为准。',
    '- 不要在结果里提到这份清单，也不要写「和以前不同」之类的话。',
  ].join('\n');
}
