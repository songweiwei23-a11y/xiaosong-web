/**
 * 选题多样性的测量（2026-10-26）：一批选题里，拍法、爆款元素、标题各有几种、有没有重复。
 * 只测量，不改写。用来看 P1–P4 改动后，选题是不是真的不再一个模板。
 */
import { splitTopicSections } from './topic-library';
import { tacticInText } from './creative-routes';
import { VIRAL_ELEMENTS } from './viral-elements';

const ELEMENT_NAMES = VIRAL_ELEMENTS.map((e) => e.name.replace(/选题$/, ''));

export interface TopicDiversity {
  count: number;
  distinctTactics: number;
  distinctElements: number;
  duplicateTitles: number;
}

/** 每条选题里第一个出现的爆款元素名（按正文出现的位置，不按列表顺序） */
function elementOf(body: string): string | undefined {
  let best: { name: string; at: number } | undefined;
  for (const name of ELEMENT_NAMES) {
    const at = body.indexOf(name);
    if (at >= 0 && (!best || at < best.at)) best = { name, at };
  }
  return best?.name;
}

export function topicDiversityOf(markdown: string): TopicDiversity {
  const sections = splitTopicSections(markdown);
  const tactics = new Set<string>();
  const elements = new Set<string>();
  const titles = new Map<string, number>();
  for (const s of sections) {
    const t = tacticInText(s.body);
    if (t) tactics.add(t);
    const e = elementOf(s.body);
    if (e) elements.add(e);
    const key = s.title.replace(/\s+/g, '');
    titles.set(key, (titles.get(key) ?? 0) + 1);
  }
  const duplicateTitles = [...titles.values()].filter((n) => n > 1).reduce((a, n) => a + n - 1, 0);
  return { count: sections.length, distinctTactics: tactics.size, distinctElements: elements.size, duplicateTitles };
}
