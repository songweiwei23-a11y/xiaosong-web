/**
 * 前采建档时，编导"刻意没选"的信息——排除清单。
 *
 * 【2026-10-02 产品方】"前采是录音转文字，有些信息没用，建档时我刻意没选。可做账号定位、商业定位、
 * 内容定位、创作简报时还是会引用这些我不想要的信息，打乱方向，让 AI 有了错误的判断。"
 *
 * 【查实的原因】（线上「万客隆家具城·李国才」）
 * 1. 同一件事被提取进了好几栏：编导把「公益营销」那条要点勾掉了，可"公益"还留在选题方向、竞争优势、
 *    独特资源、爆款基因四栏里；「直播规划」勾掉了，成交路径里还写着"进直播间→挂小房子小风车"。
 * 2. "刻意没选"这个意思没被记下来：档案里只剩残留的字，AI 看见就当真。补充说明写了"不要做公益"，
 *    账号定位照样拿"公益类 10-20 万播放"当依据推主力形式。
 *
 * 所以：确认页把残留找出来让编导一键去掉；没选的东西记成排除清单存进档案（taboo_settings.excluded），
 * 所有板块当硬约束——"当它不存在"（见 lib/taboos 的 taboosPromptBlock）。
 */
import { PROFILE_FIELDS, splitToArray } from './profile-fields';
import type { Extraction } from './interview-import';

/** 确认页每一项的状态（和 components/interview/ReviewPanel 的 FieldDraft 同形，这里只要这几样） */
export interface DraftLike {
  include: boolean;
  mode: string;
  text: string;
}

const LABEL = new Map(PROFILE_FIELDS.map((f) => [f.key, f.label]));
const LABELS = new Set(PROFILE_FIELDS.map((f) => f.label));
const KIND = new Map(PROFILE_FIELDS.map((f) => [f.key, f.kind]));
const show = (v: unknown) => (Array.isArray(v) ? v.join('、') : typeof v === 'string' ? v : '');

/** 一段话按顿号、逗号、分号切成一句一句（括号里的不切） */
export function segmentsOf(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if ('（(【「'.includes(ch)) depth++;
    if ('）)】」'.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && '、，,；;\n'.includes(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * 编导没要的东西：
 * - 前采要点里没勾的
 * - 整栏没写进去的（原来档案空着、AI 提取了、编导取消了勾）
 * - 多选里删掉了几项、但还留着别的项的（删掉的那几项）；整个换掉的不算——那是改对了，不是不要
 * - 文字栏里删掉了几句、但还留着别的句的（删掉的那几句）
 */
export function exclusionsOf(ex: Extraction, drafts: Record<string, DraftLike>, highlightOn: boolean[]): string[] {
  const out: string[] = [];
  ex.highlights.forEach((h, i) => {
    if (highlightOn[i] === false) out.push(h);
  });
  for (const f of ex.fields) {
    const d = drafts[f.key];
    if (!d || d.mode === 'keep') continue;
    const label = LABEL.get(f.key) ?? f.key;
    const original = KIND.get(f.key) === 'multi' ? (Array.isArray(f.value) ? f.value : splitToArray(show(f.value))) : segmentsOf(show(f.value));
    if (!d.include) {
      if (original.length) out.push(`${label}：${original.join('、')}`);
      continue;
    }
    const now = KIND.get(f.key) === 'multi' ? splitToArray(d.text) : segmentsOf(d.text);
    const kept = original.filter((x) => now.includes(x));
    const removed = original.filter((x) => !now.includes(x));
    if (kept.length > 0 && removed.length > 0) out.push(`${label}里的：${removed.join('、')}`);
  }
  return Array.from(new Set(out.map((x) => x.trim()).filter(Boolean)));
}

/**
 * 三个字以上的片段（只取中文、字母、数字连着的部分）。
 * 至少要有两个汉字：「17个」「0-20」这种数字片段太常见，拿来比会误伤
 */
function grams(text: string, n = 3): Set<string> {
  const s = new Set<string>();
  for (const run of text.match(/[\p{Script=Han}A-Za-z0-9]+/gu) ?? []) {
    for (let i = 0; i + n <= run.length; i++) {
      const g = run.slice(i, i + n);
      if ((g.match(/\p{Script=Han}/gu) ?? []).length >= 2) s.add(g);
    }
  }
  return s;
}

/** 单独出现不代表"提到了排除的事"的通用词：设备、身份、日常用语 */
const GENERIC_WORDS = new Set(['手机', '相机', '电脑', '三脚架', '视频', '客人', '顾客', '客户', '老板', '价格', '质量', '服务', '店里', '门店', '家具', '口播', '图文']);
/** 片段里带这些字多半是虚词组合（的问题、怎么挑、不着急），不是特征词 */
const FUNCTION_CHARS = /[的了是吗呢吧着过都也就还再很不没怎么什这那一个和与或在把被让给要会能可]/;
/** 带这些常用词的片段也不当特征（愿意投、效果好、万播放：哪篇稿子都可能有） */
const COMMON_IN_GRAM = /愿意|意投|投入|效果|播放|喜欢|时候|觉得|东西|事情|热点/;

/**
 * 排除内容的特征片段（去掉"××里的："这种前缀；店名人名里的字不算）。
 * 编导手动写的往往很短（"公益""不提直播"）：拆开后两到六个字的整词直接当关键词，长的再切三字片段
 */
function exclusionGrams(excluded: string[], stopText: string): string[][] {
  const stop = grams(stopText);
  return excluded.map((e) => {
    // 只去掉"变现方式里的：""单条预算："这种栏名前缀；"直播规划：……"这种要点自己的标题要留着，它就是关键词
    const m = e.match(/^([^：]{1,16})：/);
    const body = m && (m[1].endsWith('里的') || LABELS.has(m[1])) ? e.slice(m[0].length) : e;
    const needles = new Set<string>();
    /*
     * 2026-10-09 全板块实测：原来每段都切三字片段，「不用担心钱的问题」切出「的问题」、「不着急再看看」切出「不着急」，
     * 「设备条件：手机、相机」直接拿「手机」当关键词——质检满屏误报，更糟的是 stripExcluded 拿同一套关键词
     * 删档案句子，凡是提到手机、怎么挑的档案句子都被删掉，模型看到的档案变少了。
     * 现在：六个字以内的整段只按整段认（通用词不算）；长的切四字片段，带虚词的片段不要
     */
    for (const piece of segmentsOf(body)) {
      const core = piece.replace(/^(?:不要|不提|不做|不拍|不说|别提|别拍|别)/, '').replace(/(?:相关的事|相关的|相关|的事|内容|这类)$/, '').trim();
      const han = (core.match(/\p{Script=Han}/gu) ?? []).length;
      if (core.length <= 6 && han >= 2 && !GENERIC_WORDS.has(core)) needles.add(core);
      // 三字片段照样切（「通过村书记找贫困户」里的「村书记」「贫困户」），但带虚词的不要（的问题、不着急、怎么挑）
      for (const g of grams(core)) if (!FUNCTION_CHARS.test(g) && !COMMON_IN_GRAM.test(g) && !GENERIC_WORDS.has(g)) needles.add(g);
    }
    return [...needles].filter((x) => !stop.has(x));
  });
}

/** 这一句和排除内容撞上了没有（撞上的是哪几个字） */
function hitsExclusion(segment: string, ex: string[][]): string | undefined {
  for (const list of ex) {
    const hit = list.find((x) => segment.includes(x));
    if (hit) return hit;
  }
  return undefined;
}

/**
 * 生成结果里还提到了排除清单里的东西（质检用，见 lib/quality-checks）。
 * 行里本身在说"不做 / 不要 / 别"的跳过——"这次不做公益"不算漏出来
 */
export function findExcludedMentions(text: string, excluded: string[], profileName = ''): { needle: string; line: string }[] {
  if (!excluded.length || !text) return [];
  const ex = exclusionGrams(excluded, profileName);
  const out: { needle: string; line: string }[] = [];
  const seen = new Set<string>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || /不要|不做|不拍|不提|别|不用|避免|排除|去掉|没选|不再/.test(line)) continue;
    const hit = hitsExclusion(line, ex);
    if (hit && !seen.has(hit)) {
      seen.add(hit);
      out.push({ needle: hit, line: line.length > 60 ? `${line.slice(0, 60)}…` : line });
    }
  }
  return out;
}

/** 档案里这些栏不动：名称、设置、原文 */
const UNTOUCHED = new Set(['id', 'user_id', 'profile_name', 'taboo_settings', 'content_mix', 'persona_facts', 'interview_notes', 'created_at', 'updated_at', 'content_restrictions', 'avoid_content']);

/**
 * 把档案里和排除清单相关的句子剔掉，再交给 AI。
 *
 * 只在提示词里说"请忽略"压不干净：2026-10-02 实测，加了排除清单后方向对了（不再规划公益），
 * 但档案的爆款基因里还写着"公益类 10-20 万、抽奖近 30 万"，模型照样拿来推"之前靠公益抽奖拿过流量"。
 * 所以在拼提示词之前就从数据里拿掉——模型看不见，才谈得上"当它不存在"。
 * 只改交给 AI 的那份拷贝，库里的档案不动（编导在档案页还能看到、能自己删）。
 */
export function scrubProfile<T extends object>(profile: T | null | undefined, excluded: string[]): T | null | undefined {
  if (!profile || excluded.length === 0) return profile;
  const p = profile as Record<string, unknown>;
  const ex = exclusionGrams(excluded, String(p.profile_name ?? ''));
  const out: Record<string, unknown> = { ...p };
  for (const [k, v] of Object.entries(p)) {
    if (UNTOUCHED.has(k)) continue;
    if (Array.isArray(v)) out[k] = v.filter((x) => typeof x !== 'string' || !hitsExclusion(x, ex));
    else if (typeof v === 'string' && v.trim()) {
      // 前采要点一行一条，按行；其余按句
      const parts = k === 'interview_highlights' ? v.split('\n') : segmentsOf(v);
      const kept = parts.filter((s) => !hitsExclusion(s, ex));
      if (kept.length !== parts.length) out[k] = kept.join(k === 'interview_highlights' ? '\n' : '、');
    }
  }
  return out as T;
}

export interface Residual {
  key: string;
  label: string;
  /** 这一栏里提到了排除内容的那一句 */
  segment: string;
  /** 和哪条排除内容撞上的、撞上的是哪几个字 */
  because: string;
  shared: string;
}

/**
 * 编导去掉的东西，别的栏里还在说的：按"三个字以上相同的片段"找。
 * 店名、人名这种到处都有的字（来自档案名称）不算，不然每一栏都会被标出来。
 */
export function residualMentions(
  ex: Extraction,
  drafts: Record<string, DraftLike>,
  excluded: string[],
  profileName = ''
): Residual[] {
  if (excluded.length === 0) return [];
  const gramsOf = exclusionGrams(excluded, profileName || ex.profileName || '');
  const out: Residual[] = [];
  for (const f of ex.fields) {
    const d = drafts[f.key];
    if (!d?.include || d.mode === 'keep' || !d.text.trim()) continue;
    for (const seg of segmentsOf(d.text)) {
      for (let i = 0; i < gramsOf.length; i++) {
        const hit = gramsOf[i].find((x) => seg.includes(x));
        if (!hit) continue;
        out.push({ key: f.key, label: LABEL.get(f.key) ?? f.key, segment: seg, because: excluded[i], shared: hit });
        break;
      }
    }
  }
  return out;
}

/** 把一栏里的某一句去掉（保留其余，用原来的分隔习惯：多选用顿号，文字栏用顿号连） */
export function dropSegment(text: string, segment: string): string {
  return segmentsOf(text).filter((s) => s !== segment).join('、');
}
