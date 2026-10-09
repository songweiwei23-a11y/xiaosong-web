/**
 * 素材库（2026-10-02）。
 *
 * 产品方："每个板块都会生成内容，好的内容要能收藏保留起来，用户再用时不会浪费之前的资源。"
 * 收藏入口在「继续创作」那一栏（components/workspace/CreationLinks），所有板块都有；
 * 勾选了几条就存几条，没勾就存整份。
 */
import type { CreationItem, CreationItemKind } from './creation-items';
import type { CreationTarget, CreationContext } from './creation-flow';
import { mergeCreationSettings } from './creation-settings';
import { postSafely } from './safe-post';

export const LIBRARY_CATEGORIES = [
  { id: 'topic', label: '选题' },
  { id: 'script', label: '脚本' },
  { id: 'storyboard', label: '分镜' },
  { id: 'review', label: '审稿稿' },
  { id: 'title', label: '标题封面' },
  { id: 'opening', label: '开篇钩子' },
  // 方向、思路、灵感、角度、人设——账号运营板块里的也算，那是创作的灵感来源
  { id: 'direction', label: '方向思路' },
  // 方案、执行建议、做法、打法、拍法
  { id: 'plan', label: '方案建议' },
  { id: 'remix', label: '二创' },
  { id: 'breakdown', label: '拆解' },
  { id: 'positioning', label: '定位' },
  { id: 'deal', label: '成交理由' },
  // 用户自己记录的真实素材（客户问题、原话、真实结果……），不是 AI 写的
  { id: 'material', label: '真实素材' },
  { id: 'other', label: '其他' },
] as const;
export type LibraryCategory = typeof LIBRARY_CATEGORIES[number]['id'];
export const CATEGORY_IDS = new Set<string>(LIBRARY_CATEGORIES.map((c) => c.id));
export const categoryLabel = (id: string) => LIBRARY_CATEGORIES.find((c) => c.id === id)?.label ?? '其他';

/** 从哪个板块收藏的，默认归哪一类 */
const BOARD_CATEGORY: Record<string, LibraryCategory> = {
  topic: 'topic', script: 'script', storyboard: 'storyboard', review: 'review', title: 'title',
  growth: 'opening', remix: 'remix', breakdown: 'breakdown',
  positioning: 'positioning', 'content-positioning': 'positioning', 'business-positioning': 'positioning', 'creative-brief': 'positioning',
  'deal-reason': 'deal',
  direction: 'direction',
};

/** 勾选列表认出来的类型（lib/creation-items）对应哪一类 */
const KIND_CATEGORY: Partial<Record<CreationItemKind, LibraryCategory>> = {
  topic: 'topic', script: 'script', direction: 'direction', plan: 'plan', title: 'title',
};

/** 专门的创作板块：出的东西就是这一类，一律按板块归 */
const CREATION_BOARDS = new Set(['topic', 'script', 'storyboard', 'review', 'title', 'growth', 'remix', 'breakdown']);

/**
 * 分类：
 * - 专门的创作板块按板块归（选题页出的就是选题，哪怕某条正文里带口播）
 * - 其余（自由对话、知识库、账号定位、简报、成交理由）按勾选认出来的内容类型归：
 *   账号定位里勾的几条方向 → 方向思路（产品方：那是灵感，要能当素材用）；
 *   认不出、或者整份收藏的，按板块归，再不行算「其他」
 */
export function libraryCategory(source: string, kind?: CreationItemKind): LibraryCategory {
  const board = BOARD_CATEGORY[source];
  if (board && CREATION_BOARDS.has(source)) return board;
  return (kind && KIND_CATEGORY[kind]) || board || 'other';
}

/** 素材拿去继续创作时，按分类推荐下一步 */
export const CATEGORY_NEXT: Record<LibraryCategory, CreationTarget[]> = {
  topic: ['script', 'growth', 'title'],
  script: ['review', 'storyboard', 'title'],
  storyboard: ['review', 'title'],
  review: ['storyboard', 'title'],
  title: ['script', 'review'],
  opening: ['script', 'title'],
  direction: ['topic', 'script'],
  plan: ['script', 'storyboard', 'topic'],
  remix: ['review', 'storyboard', 'script'],
  breakdown: ['remix', 'topic'],
  positioning: ['topic', 'growth'],
  deal: ['topic', 'script'],
  material: ['script', 'topic', 'storyboard'],
  other: ['topic', 'script'],
};

export interface LibraryDraft {
  title: string;
  content: string;
  category: LibraryCategory;
  source: string;
  creationContext?: CreationContext;
}

export interface LibraryItem extends LibraryDraft {
  id: string;
  profile_id: string | null;
  note: string;
  created_at: string;
  /** 素材来源；迁移 20261003_library_assets.sql 没跑时接口不返回，按 ai 算 */
  kind?: MaterialKind;
  /** 真实素材的各栏 */
  fields?: (RealMaterialFields & { creationContext?: CreationContext }) | null;
}

/** 收藏的正文和创作需求一起存，恢复时只认白名单，不接受任意导航或账号字段。 */
export function readLibraryCreationContext(raw: unknown): CreationContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  const out: CreationContext = { settings: mergeCreationSettings(v.settings) };
  if (v.branch === true) out.branch = true;
  if (v.partial === 'title' || v.partial === 'growth') out.partial = v.partial;
  if (typeof v.originContent === 'string') out.originContent = v.originContent;
  if (typeof v.workId === 'string' && /^[0-9a-f-]{36}$/i.test(v.workId)) out.workId = v.workId;
  return JSON.stringify(out).length <= 200_000 && (out.originContent || Object.keys(out.settings || {}).length) ? out : undefined;
}

/** 列表里的一条：只带预览，正文点开再取（GET /api/library?id=…） */
export interface LibraryListItem extends Omit<LibraryItem, 'content'> {
  preview: string;
  /** 正文字数，界面上提示「全文 xx 字」 */
  length: number;
}

// ---------------------------------------------------------------------------
// 素材来源：真实材料 / AI 建议 / 认可的好稿（2026-10-03）
//
// 产品要求："明确区分用户真实材料、AI 建议、用户认可的好稿；好稿能收藏并作为风格示例。"
// 风格预设（lib/creator-presets）只认 approved 这一类：只学用户主动认可的内容。
// ---------------------------------------------------------------------------

export const MATERIAL_KINDS = [
  { id: 'real', label: '真实素材', hint: '自己记下的真事：客户问题、原话、结果' },
  { id: 'approved', label: '认可的好稿', hint: '你点过「认可为好稿」的，能当风格示例' },
  { id: 'ai', label: 'AI 建议', hint: '各板块生成后收藏的' },
] as const;
export type MaterialKind = typeof MATERIAL_KINDS[number]['id'];
export const KIND_IDS = new Set<string>(MATERIAL_KINDS.map((k) => k.id));
export const kindLabel = (id?: string) => MATERIAL_KINDS.find((k) => k.id === id)?.label ?? 'AI 建议';
export const readKind = (v: unknown): MaterialKind => (typeof v === 'string' && KIND_IDS.has(v) ? (v as MaterialKind) : 'ai');

/** 真实素材的各栏，按讲故事的顺序 */
export const REAL_FIELDS = [
  { key: 'question', label: '客户问题', hint: '客户问了什么、担心什么', required: true },
  { key: 'quote', label: '原话', hint: '客户或你当时说的原话，照抄，不润色' },
  { key: 'action', label: '你做了什么', hint: '针对这个问题你采取的行动' },
  { key: 'process', label: '过程', hint: '中间怎么做的、发生了什么' },
  { key: 'result', label: '真实结果', hint: '最后怎么样了；有数字写数字，没有就写没有' },
  { key: 'shots', label: '可拍画面', hint: '现场能拍到什么：后厨、手部特写、客人背影……' },
] as const;
export type RealFieldKey = typeof REAL_FIELDS[number]['key'];

/** 用到客户、员工或别人家店里的画面和原话，要先问过 */
export const PERMISSIONS = [
  { id: 'pending', label: '待确认' },
  { id: 'granted', label: '已获同意' },
  { id: 'not_needed', label: '不涉及他人' },
] as const;
export type PermissionId = typeof PERMISSIONS[number]['id'];

export type RealMaterialFields = Partial<Record<RealFieldKey, string>> & { permission: PermissionId };

const FIELD_MAX = 2000;

/** 清洗用户填的真实素材：只留认识的栏，去首尾空白，每栏限长；一栏都没填返回 null */
export function readRealFields(raw: unknown): RealMaterialFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: RealMaterialFields = { permission: PERMISSIONS.some((p) => p.id === src.permission) ? (src.permission as PermissionId) : 'pending' };
  let filled = 0;
  for (const f of REAL_FIELDS) {
    const v = typeof src[f.key] === 'string' ? (src[f.key] as string).trim().slice(0, FIELD_MAX) : '';
    if (v) { out[f.key] = v; filled++; }
  }
  return filled ? out : null;
}

const permissionLabel = (id: PermissionId) => PERMISSIONS.find((p) => p.id === id)?.label ?? '待确认';

/**
 * 真实素材 → 正文。带「真实素材」字样和使用许可：拿去继续创作时，AI 读到的就是
 * "这是真事，原话别改，没写的结果别编"，许可待确认时不出现对方的脸和名字。
 */
export function realMaterialContent(f: RealMaterialFields): string {
  const lines = ['【真实素材｜以下是真实发生的事，原话照用，没写的细节和结果不要编】'];
  for (const def of REAL_FIELDS) if (f[def.key]) lines.push(`- ${def.label}：${f[def.key]}`);
  lines.push(`- 使用许可：${permissionLabel(f.permission)}${f.permission === 'pending' ? '（拍摄和发布前先问对方，不确定就别露脸、别带名字）' : ''}`);
  return lines.join('\n');
}

/** 没填标题时：取客户问题，其次原话 */
export function realMaterialTitle(f: RealMaterialFields, title?: string): string {
  const t = (title || '').trim() || f.question || f.quote || f.result || '真实素材';
  return t.replace(/\s+/g, ' ').slice(0, 120);
}

// ---------------------------------------------------------------------------
// 列表查询（接口和测试共用）
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** 列表里的预览：去掉 Markdown 符号，压成一行 */
export const libraryPreview = (s: string, max = 140) => String(s || '').replace(/[#*>|`-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * 搜索词：去掉在 PostgREST 过滤语法里有含义的字符（, ( ) 分隔条件；% _ * 是通配符；引号、反斜杠），
 * 免得搜一个逗号就把查询拼坏、搜一个 % 就匹配全部。
 */
export const cleanKeyword = (kw: string | null | undefined) => String(kw || '').replace(/[%_*,()"'\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** 按北京时间的日期筛：from 当天 0 点起，to 当天 24 点前。格式不对的忽略 */
export function dateRange(from?: string | null, to?: string | null): { gte?: string; lt?: string } {
  const r: { gte?: string; lt?: string } = {};
  if (from && DAY.test(from) && !isNaN(Date.parse(`${from}T00:00:00+08:00`))) r.gte = new Date(`${from}T00:00:00+08:00`).toISOString();
  if (to && DAY.test(to) && !isNaN(Date.parse(`${to}T00:00:00+08:00`))) r.lt = new Date(Date.parse(`${to}T00:00:00+08:00`) + 86_400_000).toISOString();
  return r;
}

/** offset / limit：非数字、负数按默认；一页最多 MAX_PAGE_SIZE */
export function pageOf(sp: URLSearchParams): { offset: number; limit: number } {
  const o = Number(sp.get('offset'));
  const l = Number(sp.get('limit'));
  return {
    offset: Number.isInteger(o) && o > 0 ? o : 0,
    limit: Number.isInteger(l) && l > 0 ? Math.min(l, MAX_PAGE_SIZE) : PAGE_SIZE,
  };
}

/** 导出：Markdown，一条一段，带分类、来源、时间、备注；真实素材的许可也在正文里 */
export function libraryExportMarkdown(items: Pick<LibraryItem, 'title' | 'content' | 'category' | 'source' | 'note' | 'created_at' | 'kind'>[], exportedAt = new Date()): string {
  const head = `# 开物素材库导出\n\n导出时间：${exportedAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}　共 ${items.length} 条\n`;
  const body = items.map((it, i) => [
    `## ${i + 1}. ${it.title}`,
    `> ${kindLabel(it.kind)} · ${categoryLabel(it.category)}${it.source ? ` · 来自${it.source}` : ''} · ${new Date(it.created_at).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
    it.note ? `> 备注：${it.note}` : '',
    '',
    it.content,
  ].filter((l, j) => l !== '' || j === 3).join('\n'));
  return [head, ...body].join('\n\n') + '\n';
}

/** 一条勾选项 → 一条素材 */
export function draftFromItem(item: CreationItem, source: string, sourceLabel: string): LibraryDraft {
  return { title: (item.topic || item.label).slice(0, 120), content: item.body, category: libraryCategory(source, item.kind), source: sourceLabel };
}

/** 整份 → 一条素材。标题取第一个标题行，没有就取第一行 */
export function draftFromBody(body: string, source: string, sourceLabel: string, title?: string): LibraryDraft {
  const heading = body.split('\n').find((l) => /^#{1,4}\s+/.test(l)) || body.split('\n').find((l) => l.trim()) || '';
  const t = (title || heading.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim() || `${sourceLabel}的内容`).slice(0, 120);
  return { title: t, content: body.trim(), category: libraryCategory(source), source: sourceLabel };
}

/** 存进素材库。返回新存了几条、几条之前就收藏过；失败抛出带中文的错误 */
export async function saveToLibrary(items: LibraryDraft[], profileId: string | null): Promise<{ saved: number; duplicated: number }> {
  // 一次收藏好几条长内容会超过 8KB：大了自动压缩 / 分块（lib/safe-post）
  const res = await postSafely('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, profileId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '收藏失败，请稍后重试');
  return { saved: data.saved ?? 0, duplicated: data.duplicated ?? 0 };
}
