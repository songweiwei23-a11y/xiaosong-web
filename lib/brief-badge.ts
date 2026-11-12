/**
 * 板块顶部徽章里，关于创作简报的那一句。
 *
 * 三件事不能混成一句「还没生成」：
 *   1. 库里有没有这份档案的简报（接口成功且正文为空，才是没有）
 *   2. 本板块按清单读不读简报（2026-10-19 方案 D：选题、脚本、分镜、方向的 brief 是空数组，有简报也不注入）
 *   3. 这次接口有没有读成（失败不是「没有」）
 *
 * 清单本身不在这里改。改文案，不改「谁读简报」。
 */

import { BRIEF_FIELDS, parseBrief } from './creative-brief';
import { manifestOf, type Board } from './context-manifest';

/** ok 读到正文；missing 接口成功但没有；error 没读成，不能当成没有 */
export type BriefLoad = 'ok' | 'missing' | 'error';

const BRIEF_PAGE = '/dashboard/creative-brief';

export interface BriefBadgeCopy {
  tone: 'muted' | 'emerald' | 'amber';
  text: string;
  /**
   * 只有「还没生成」用「去生成」。
   * 简报在、标题对不上时用「打开简报」，不把人送去做一次没用的生成。
   */
  link: { href: string; label: string } | null;
  /** 本板块确实带上了简报字段，才接着提醒「档案比简报新」 */
  attached: boolean;
}

/**
 * 把一次简报请求分成三种结果。
 * fetched：请求回来了且是 2xx。parsed：正文是数组（空数组也算读成，那是「没有记录」）。
 */
export function briefLoadOf(input: {
  fetched: boolean;
  parsed: boolean;
  brief: string | null | undefined;
}): BriefLoad {
  if (!input.fetched || !input.parsed) return 'error';
  return input.brief?.trim() ? 'ok' : 'missing';
}

export function briefBadgeCopy(input: {
  board: Board;
  brief?: string | null;
  /** 不传且没有正文：当成没读成，不说「还没生成」 */
  load?: BriefLoad;
}): BriefBadgeCopy {
  const text = input.brief?.trim() ?? '';
  if (!text) {
    if (input.load === 'missing' || input.load === 'ok') {
      return {
        tone: 'muted',
        text: '还没生成创作简报，这次只能用档案里的字段。',
        link: { href: BRIEF_PAGE, label: '去生成' },
        attached: false,
      };
    }
    return {
      tone: 'amber',
      text: '创作简报这次没有读成功，不能判断有没有。',
      link: null,
      attached: false,
    };
  }

  const manifest = manifestOf(input.board);
  // 有正文：记录是存在的。清单没点名任何简报字段，就是方案 D「这次不读」
  if (!manifest || manifest.brief.length === 0) {
    return {
      tone: 'muted',
      text: '本板块这次不读简报，只用档案。',
      link: null,
      attached: false,
    };
  }

  const values = parseBrief(text);
  const used = manifest.brief
    .map((k) => (values[k]?.trim() ? BRIEF_FIELDS.find((f) => f.key === k)?.label ?? null : null))
    .filter((x): x is string => Boolean(x));

  if (used.length > 0) {
    return {
      tone: 'emerald',
      text: `创作简报已带上：${used.join('、')} ✓`,
      link: null,
      attached: true,
    };
  }

  return {
    tone: 'amber',
    text: '创作简报已有，但本板块要的那几段没对上，这次带不上。',
    link: { href: BRIEF_PAGE, label: '打开简报' },
    attached: false,
  };
}
