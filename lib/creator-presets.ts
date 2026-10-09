/**
 * 个人风格预设（2026-10-03）。
 *
 * 产品要求："可复用的风格与创作预设：名称、表达风格、结构、认可的示例、适用档案。
 * 按登录账号和档案持久保存，支持新增、采用、修改、删除、导出。只学习用户主动认可的内容，不把所有生成稿都当成偏好。"
 *
 * - 示例只能是：素材库里点过「认可为好稿」的（kind = approved，接口会核对），或用户自己贴进来的稿子。
 * - 「采用」= 这个档案生成时套用它。每个档案最多一份在用；适用「全部档案」的那份是兜底。
 * - 生成时怎么用：lib/creator-context 的 buildContextBlock 在写稿类板块拼上 presetPromptBlock——
 *   只学表达和结构，不照搬示例里的店名、价格、数字和经历（事实以账号档案为准）。
 * 表见 supabase/migrations/20261003_creator_presets.sql；接口 app/api/creator-presets/route.ts。
 */
import type { Board } from './context-manifest';

export interface PresetExample {
  title: string;
  content: string;
  /** 来自素材库哪一条（认可的好稿）；自己贴的没有 */
  libraryId?: string;
}

export interface CreatorPreset {
  id: string;
  /** 适用档案；null = 全部档案 */
  profile_id: string | null;
  name: string;
  /** 表达风格：语气、用词、节奏 */
  style: string;
  /** 结构：开头怎么起、中间怎么展开、结尾怎么收 */
  structure: string;
  examples: PresetExample[];
  /** 正在采用 */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const PRESET_LIMITS = { name: 30, style: 800, structure: 800, examples: 3, exampleChars: 3000, perUser: 50 } as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface PresetInput {
  name: string;
  style: string;
  structure: string;
  examples: PresetExample[];
  profileId: string | null;
}

/** 清洗用户提交的预设。名字为空、风格结构示例全空时返回错误说明 */
export function readPresetInput(raw: unknown): PresetInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: '请求格式不正确' };
  const o = raw as Record<string, unknown>;
  const name = str(o.name, PRESET_LIMITS.name);
  if (!name) return { error: '给预设起个名字' };
  const examples = (Array.isArray(o.examples) ? o.examples : [])
    .map((e) => {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      const content = str(x.content, PRESET_LIMITS.exampleChars);
      const libraryId = typeof x.libraryId === 'string' && UUID_RE.test(x.libraryId) ? x.libraryId : undefined;
      return { title: str(x.title, 80) || content.slice(0, 20) || '示例', content, ...(libraryId ? { libraryId } : {}) };
    })
    // 素材库来的正文由服务端按 libraryId 重新取（verifiedExamples），这里不看长度
    .filter((e) => e.libraryId || e.content.length >= 10)
    .slice(0, PRESET_LIMITS.examples);
  const style = str(o.style, PRESET_LIMITS.style);
  const structure = str(o.structure, PRESET_LIMITS.structure);
  if (!style && !structure && !examples.length) return { error: '表达风格、结构、示例至少填一项' };
  const profileId = typeof o.profileId === 'string' && UUID_RE.test(o.profileId) ? o.profileId : null;
  return { name, style, structure, examples, profileId };
}

/** 数据库行 → 前端结构 */
export function toPreset(row: Record<string, unknown>): CreatorPreset {
  return {
    id: String(row.id),
    profile_id: typeof row.profile_id === 'string' ? row.profile_id : null,
    name: String(row.name || '未命名预设'),
    style: String(row.style || ''),
    structure: String(row.structure || ''),
    examples: Array.isArray(row.examples) ? (row.examples as PresetExample[]).filter((e) => e && typeof e.content === 'string') : [],
    is_active: row.is_active === true,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || row.created_at || ''),
  };
}

/**
 * 这个档案生成时用哪一份：先找专门给这个档案的在用预设，没有再用「全部档案」的在用预设。
 * 别的档案的预设绝不拿来用（不同店的写法不能混）。
 */
export function pickActivePreset(presets: CreatorPreset[], profileId: string | null): CreatorPreset | null {
  const own = profileId ? presets.find((p) => p.is_active && p.profile_id === profileId) : undefined;
  return own ?? presets.find((p) => p.is_active && p.profile_id === null) ?? null;
}

/** 写稿类板块才带风格预设：选题、定位、拆解这些是规划和分析，不该被写法带偏 */
export const PRESET_BOARDS = new Set<Board>(['script', 'review', 'title', 'growth', 'remix', 'storyboard', 'freeChat']);

const EXAMPLE_IN_PROMPT = 600;

/** 拼进提示词的一段。示例截短：只为让 AI 感受语气和节奏，不是让它抄 */
export function presetPromptBlock(p: CreatorPreset | null | undefined): string {
  if (!p) return '';
  const lines = [`## ✍️ 这个账号认可的写法（风格预设：${p.name}）`, ''];
  if (p.style) lines.push(`- **表达风格**：${p.style}`);
  if (p.structure) lines.push(`- **结构**：${p.structure}`);
  if (p.examples.length) {
    lines.push('', '下面是用户认可的好稿，**只学语气、节奏和结构**：');
    p.examples.forEach((e, i) => {
      const body = e.content.length > EXAMPLE_IN_PROMPT ? `${e.content.slice(0, EXAMPLE_IN_PROMPT)}…` : e.content;
      lines.push('', `### 示例${i + 1}：${e.title}`, body);
    });
  }
  lines.push('', '⚠️ 示例里的店名、价格、数字、经历、地点**不能搬进新稿**；事实以上面的账号背景和这次的素材为准。风格预设和本次要求冲突时，以本次要求为准。');
  return lines.join('\n');
}

/** 导出：给用户留底 / 换设备时用 */
export function presetsExportJson(presets: CreatorPreset[], exportedAt = new Date()): string {
  return JSON.stringify({ exportedAt: exportedAt.toISOString(), count: presets.length, presets }, null, 2);
}

/* ---------- 浏览器端 ---------- */

/** 当前档案在用的预设（各生成板块读这个）；没有或接口没启用返回 null，不挡生成 */
export async function fetchActivePreset(profileId: string | null): Promise<CreatorPreset | null> {
  try {
    const res = await fetch(`/api/creator-presets?active=1${profileId ? `&profileId=${encodeURIComponent(profileId)}` : ''}`);
    if (!res.ok) return null;
    const d = await res.json().catch(() => null);
    return d?.preset ? toPreset(d.preset) : null;
  } catch {
    return null;
  }
}
