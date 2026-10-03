/**
 * 自由对话的结果画布（2026-10-03）：长回答在画布里打开，能直接改、选中一段让 AI 改、有版本可切换对比。
 *
 * 这里只放纯逻辑（提示词、局部替换、逐行对比、版本），画布界面在 components/chat/ResultCanvas.tsx。
 * 改写请求单独开会话（taskType 「画布改写」在 ISOLATED_TASKS 里）：不读也不写这个档案共用的记忆，
 * 否则"把第二段改口语点"这种来回会搅进选题、脚本那边。
 */

export const CANVAS_TASK_TYPE = '画布改写';

/** 多长的回答值得在画布里打开（短回答直接在气泡里看就行） */
export const CANVAS_MIN_CHARS = 300;

export interface CanvasVersion {
  content: string;
  at: number;
  /** 这一版是怎么来的：「AI 原稿」「手动修改」「改写：口语一点」 */
  note: string;
}

const MAX_VERSIONS = 20;
const MAX_VERSION_CHARS = 40_000;

/** 存储前清洗：最多 20 版、每版最长 4 万字 */
export function sanitizeCanvasVersions(v: unknown): CanvasVersion[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).content === 'string')
    .map((x) => ({
      content: String(x.content).slice(0, MAX_VERSION_CHARS),
      at: typeof x.at === 'number' && Number.isFinite(x.at) ? x.at : Date.now(),
      note: typeof x.note === 'string' ? x.note.slice(0, 60) : '',
    }))
    .slice(-MAX_VERSIONS);
}

/** 加一版：和最新一版一样就不加；超过上限丢最早的（第一版 AI 原稿保留） */
export function addVersion(versions: CanvasVersion[], content: string, note: string): CanvasVersion[] {
  const last = versions[versions.length - 1];
  if (last && last.content === content) return versions;
  const next = [...versions, { content: content.slice(0, MAX_VERSION_CHARS), at: Date.now(), note: note.slice(0, 60) }];
  return next.length > MAX_VERSIONS ? [next[0], ...next.slice(-(MAX_VERSIONS - 1))] : next;
}

/**
 * 改写的提示词。
 * - 选中了一段：只改这一段、只输出改好的这一段——给全文是为了让它知道上下文（口吻、前后衔接），不是让它重写全文
 * - 没选：整篇按要求改，输出完整的新版
 */
export function buildRewritePrompt(p: { doc: string; selection?: string; instruction: string; context?: string }): string {
  const ctx = p.context?.trim() ? `${p.context.trim()}\n\n` : '';
  const rules = '- 不要编原文和账号背景里没有的数字、经历；原文有的事实不要改\n- 不要解释你改了什么，不要加"改写如下"这类开场白，不要用代码块包起来';
  if (p.selection?.trim()) {
    return `${ctx}【任务】下面是一份完整的稿子，编导选中了其中一段，要你**只改这一段**。

【改的要求】${p.instruction.trim()}

【完整稿子（只用来看上下文，不要改别的地方）】
${p.doc}

【要改的这一段】
${p.selection}

【输出】只输出改好的这一段，能直接替换进原文：前后要和原文接得上，格式（列表、加粗、换行）跟原来这一段保持一致。
${rules}`;
  }
  return `${ctx}【任务】按要求修改下面这份稿子，输出改好后的**完整稿子**。

【改的要求】${p.instruction.trim()}

【原稿】
${p.doc}

【输出】完整的新稿子，结构和格式尽量保持原样，只改要求涉及的地方。
${rules}`;
}

/** 模型偶尔还是会加开场白、代码块：剥掉 */
export function cleanRewriteOutput(text: string): string {
  let t = text.trim();
  const fence = t.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
  if (fence) t = fence[1].trim();
  t = t.replace(/^(?:好的[，,。！!]?\s*)?(?:改写|修改|优化)(?:后|好)(?:的)?(?:这一段|内容|版本|稿子)?(?:如下)?[：:]\s*\n?/, '');
  return t.trim();
}

/** 把选中的那段换成改好的；选区对不上（文档已经变了）返回 null */
export function replaceSelection(doc: string, start: number, end: number, expected: string, replacement: string): string | null {
  if (start < 0 || end > doc.length || start > end || doc.slice(start, end) !== expected) return null;
  return doc.slice(0, start) + replacement + doc.slice(end);
}

export interface DiffLine { type: 'same' | 'add' | 'del'; text: string }

/**
 * 逐行对比（最长公共子序列）。稿子一般几十到两百行，O(n·m) 够用；太长就只标"整体不同"，免得卡页面。
 */
export function lineDiff(a: string, b: string): DiffLine[] {
  const x = a.split('\n');
  const y = b.split('\n');
  if (x.length * y.length > 400_000) {
    return [...x.map((text) => ({ type: 'del' as const, text })), ...y.map((text) => ({ type: 'add' as const, text }))];
  }
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { out.push({ type: 'same', text: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'del', text: x[i++] });
    else out.push({ type: 'add', text: y[j++] });
  }
  while (i < x.length) out.push({ type: 'del', text: x[i++] });
  while (j < y.length) out.push({ type: 'add', text: y[j++] });
  return out;
}

/** 引用追问：把选中的话变成引用块放进输入框 */
export function quoteForInput(selected: string, existing: string): string {
  const quote = selected.trim().split('\n').map((l) => `> ${l}`).join('\n');
  return `${quote}\n\n${existing}`.trimEnd() + (existing.trim() ? '' : '\n');
}
