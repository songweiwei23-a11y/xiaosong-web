import { AMBIENT_SOUNDS, type AmbientId } from '@/lib/ambient/synth';

/**
 * 助理能在页面上替用户做的事（需要在浏览器里执行的那一类，比如播放声音）。
 * 服务端只负责告诉界面「做什么」，真正执行在 components/assistant/clientActions.ts。
 * 这里只放纯逻辑：动作白名单、参数校验，服务端和测试都能用。
 */

export const CLIENT_ACTION_NAMES = ['ambient.play', 'ambient.stop', 'page.open'] as const;
export type ClientActionName = (typeof CLIENT_ACTION_NAMES)[number];

/**
 * 助理能打开的页面（白名单）：只认这里的编号，路径由界面写死，模型不能指定任意地址。
 * 助理不替用户在页面里填内容，只帮他走到那个页面。
 */
export const OPEN_PAGES: Record<string, { path: string; label: string }> = {
  home: { path: '/dashboard', label: '工作台' },
  topic: { path: '/dashboard/topic', label: '选题策划' },
  script: { path: '/dashboard/script', label: '脚本生成' },
  review: { path: '/dashboard/review', label: '审稿优化' },
  profiles: { path: '/dashboard/profiles', label: '账号档案' },
  works: { path: '/dashboard/works', label: '作品' },
  knowledge: { path: '/dashboard/knowledge', label: '编导知识库' },
};

export interface ClientAction {
  name: ClientActionName;
  args: Record<string, unknown>;
}

/** 用户口语里的说法 → 开物里的声音。白噪音在开物里就是「专注」（棕噪音） */
const SOUND_ALIASES: Record<string, AmbientId> = {
  白噪音: 'brown',
  白噪声: 'brown',
  棕噪音: 'brown',
  专注: 'brown',
  雨声: 'rain',
  下雨: 'rain',
  咖啡馆: 'cafe',
  咖啡厅: 'cafe',
  篝火: 'fire',
  翻书: 'pages',
  海浪: 'waves',
};

/** 声音名字 / 编号 / 口语说法都认；认不出来返回 null */
export function resolveSound(input: unknown): AmbientId | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  const byId = AMBIENT_SOUNDS.find((x) => x.id === s);
  if (byId) return byId.id;
  const byName = AMBIENT_SOUNDS.find((x) => x.name === s);
  if (byName) return byName.id;
  return SOUND_ALIASES[s] ?? null;
}

export function soundChoices(): string {
  return AMBIENT_SOUNDS.map((x) => x.name).join('、');
}

/** 定时分钟数：1 到 240 分钟之间，没说或不合法就不定时 */
export function clampMinutes(input: unknown): number | null {
  const n = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(240, Math.max(1, Math.round(n)));
}

/** 界面收到的动作：名字必须在白名单里，参数要通过校验，否则丢弃 */
export function parseClientAction(raw: unknown): ClientAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { name?: unknown; args?: unknown };
  if (typeof r.name !== 'string' || !(CLIENT_ACTION_NAMES as readonly string[]).includes(r.name)) return null;
  const args = r.args && typeof r.args === 'object' ? (r.args as Record<string, unknown>) : {};
  if (r.name === 'ambient.play') {
    const sound = resolveSound(args.sound);
    if (!sound) return null;
    return { name: 'ambient.play', args: { sound, minutes: clampMinutes(args.minutes) } };
  }
  if (r.name === 'page.open') {
    const page = typeof args.page === 'string' && Object.prototype.hasOwnProperty.call(OPEN_PAGES, args.page) ? args.page : null;
    if (!page) return null;
    return { name: 'page.open', args: { page } };
  }
  return { name: 'ambient.stop', args: {} };
}
