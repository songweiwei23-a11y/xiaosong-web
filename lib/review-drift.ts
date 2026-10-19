/**
 * 审稿改动越界检查：优化稿里有没有原稿没有的句子，而且问题清单、逐句对照里也找不到对应的说明。
 *
 * 【为什么要有这个】提示词要求「改动都要有说明」，但模型偶尔还是会顺手重写钩子、加新场景。
 * 提示词管不住的，用这里兜底：找出这些句子，在结果区标出来，由编导逐句确认，不自动再改。
 *
 * 只比句子，不做语义判断：句子在原稿里出现过就算没改；改过的句子，只要在说明部分（问题清单、逐句对照）
 * 里也出现了，就算有说明。
 */

import { creationScript } from './creation-flow';

/** 去掉标签、符号和空白，只留文字，方便按句子对比 */
function normalize(text: string): string {
  return text
    .replace(/(口播|台词|字幕|画面|旁白|镜头\s*\d*)\s*[：:]/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/[*#>\-|`~_\s]/g, '')
    .replace(/[，。！？、；：,.!?;:"'“”‘’（）()\[\]「」『』《》<>…—]/g, '');
}

interface Sentence {
  /** 去掉符号后的比对用文字 */
  key: string;
  /** 原文（显示给编导看的） */
  raw: string;
}

/** 按句号、问号、换行切句，太短的（标题、单字）不算 */
function sentencesOf(text: string): Sentence[] {
  return text
    .split(/[\n。！？!?]/)
    .map((raw) => ({ raw: raw.replace(/^[\s*#>\-|]+/, '').trim(), key: normalize(raw) }))
    .filter((s) => s.key.length >= 4);
}

export interface ReviewDrift {
  /** 优化稿里有、原稿里没有的句子（原文） */
  newSentences: string[];
  /** 其中在问题清单、逐句对照里也找不到说明的句子（原文）：要编导逐句确认 */
  unexplained: string[];
}

/** 纯文字文案是优化稿的复制品，不算说明：不然新句子只要在这里出现一次就被当成"有说明" */
const COPY_HEADING = /^#{1,4}\s*\d*\.?\s*纯文字文案/m;

function withoutCopySection(text: string): string {
  const m = COPY_HEADING.exec(text);
  return m ? text.slice(0, m.index) : text;
}

/** 片段至少这么长才算有意义：更短的容易在哪都出现，判不出是不是同一处改动 */
const SPAN_MIN = 4;

/**
 * 句子里和原稿对不上的片段。改一个字（"吃上一口"→"吃一口"）只会算出那一小段，
 * 不会因为整句不完全一样就算成整句新写的。
 */
function changedSpans(key: string, original: string): string[] {
  if (original.includes(key)) return [];
  if (key.length < SPAN_MIN) return [key];
  const marked = new Array<boolean>(key.length).fill(false);
  for (let j = 0; j + SPAN_MIN <= key.length; j++) {
    if (!original.includes(key.slice(j, j + SPAN_MIN))) {
      for (let t = j; t < j + SPAN_MIN; t++) marked[t] = true;
    }
  }
  const spans: string[] = [];
  let start = -1;
  for (let i = 0; i <= key.length; i++) {
    const on = i < key.length && marked[i];
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      spans.push(key.slice(start, i));
      start = -1;
    }
  }
  return spans.filter((s) => s.length >= SPAN_MIN);
}

/**
 * 没有「优化后的完整脚本」小节（格式不对、结果未完成）时返回空结果，不误报。
 */
export function reviewDrift(draft: string, output: string): ReviewDrift {
  const empty: ReviewDrift = { newSentences: [], unexplained: [] };
  const optimized = creationScript('review', output);
  if (!optimized || optimized === output || !draft.trim()) return empty;

  // 说明部分：整份输出去掉优化稿和纯文字文案之后剩下的内容（总评、问题清单、逐句对照）
  const explanation = normalize(withoutCopySection(output.replace(optimized, '')));
  const original = normalize(draft);

  const newSentences = sentencesOf(optimized).filter((s) => !original.includes(s.key));
  // 每一处改动的片段都要在说明里提到才算有说明。片段的边界可能多带一两个没改的字，
  // 所以说明里出现了片段里任意一段连续 SPAN_MIN 个字，就算提到了这一处改动
  const explained = (span: string) => {
    if (explanation.includes(span)) return true;
    for (let j = 0; j + SPAN_MIN <= span.length; j++) {
      if (explanation.includes(span.slice(j, j + SPAN_MIN))) return true;
    }
    return false;
  };
  const unexplained = newSentences.filter((s) => changedSpans(s.key, original).some((span) => !explained(span)));
  return {
    newSentences: newSentences.map((s) => s.raw),
    unexplained: unexplained.map((s) => s.raw),
  };
}
