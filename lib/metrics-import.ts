/**
 * 批量导入发布数据（2026-10-04）：从抖音 / 视频号 / 小红书后台把数据表复制出来，整段粘贴进来。
 *
 * - 第一行当表头，按列名认出播放、完播率、点赞……（各平台叫法不一样，认不出的列列出来，不瞎猜）
 * - 「1.2万」「32%」「1,200」都认
 * - 按标题对到作品：完全一样优先，其次互相包含（至少 4 个字）；对到多条的算"对不上"，让用户自己选，不乱挂
 * 只解析和匹配，保存走已有的 saveWorkMetrics（服务端再校验一遍，见 lib/performance 的 readMetrics）。
 */
import type { WorkMetrics } from './performance';

type MetricKey = keyof WorkMetrics;

/** 列名 → 字段。顺序有讲究：「完播率」里也有「播」，要先认完播；「3秒完播」算三秒留存 */
const COLUMNS: [RegExp, MetricKey | 'title'][] = [
  [/^(?:作品|视频|笔记)?(?:标题|名称|描述|文案)$|作品名称|视频标题/, 'title'],
  [/(?:3|三)\s*秒/, 'retention3s'],
  [/完播/, 'completion'],
  // 次数类：带「率、时长、占比」的是别的指标（「平均播放时长」「点赞率」），不能当次数
  [/^(?!.*(?:率|时长|时间|占比)).*(?:播放|观看|浏览|阅读)/, 'views'],
  [/^(?!.*(?:率|占比)).*(?:点赞|获赞|喜欢)/, 'likes'],
  [/^(?!.*(?:率|占比)).*评论/, 'comments'],
  [/^(?!.*(?:率|占比)).*(?:分享|转发)/, 'shares'],
  [/^(?!.*(?:率|占比)).*(?:涨粉|新增粉丝|粉丝增长|净增粉)/, 'follows'],
  [/^(?!.*(?:率|占比)).*(?:咨询|私信|留资|线索)/, 'inquiries'],
  [/^(?!.*(?:率|占比|金额)).*(?:成交|订单|到店|核销)/, 'deals'],
  [/平台/, 'platform'],
];

export interface ImportedRow { title: string; metrics: WorkMetrics; line: number }
export interface ParsedTable { rows: ImportedRow[]; columns: { name: string; key: MetricKey | 'title' | null }[]; error?: string }

/** 「1.2万」→ 12000；「32.5%」→ 32.5；「1,200」→ 1200；认不出返回 null */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/[,，\s]/g, '').replace(/%$/, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(万|w|W|千|k|K)?$/);
  if (!m) return null;
  const mult = m[2] === '万' || m[2] === 'w' || m[2] === 'W' ? 10000 : m[2] === '千' || m[2] === 'k' || m[2] === 'K' ? 1000 : 1;
  return Math.round(Number(m[1]) * mult * 10) / 10;
}

/** 一行切成格子：有制表符按制表符（从表格复制出来的），否则按逗号（CSV，认双引号包住的格子） */
function cells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseMetricsTable(text: string): ParsedTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], columns: [], error: '至少要有表头和一行数据' };
  const header = cells(lines[0]);
  const columns = header.map((name) => ({ name, key: COLUMNS.find(([re]) => re.test(name))?.[1] ?? null }));
  const titleAt = columns.findIndex((c) => c.key === 'title');
  if (titleAt < 0) return { rows: [], columns, error: '没找到标题列：表头里要有「标题」或「作品名称」' };
  const rows: ImportedRow[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = cells(line);
    const title = (c[titleAt] ?? '').trim();
    if (!title) return;
    const metrics: WorkMetrics = {};
    columns.forEach((col, j) => {
      if (!col.key || col.key === 'title' || c[j] === undefined || c[j] === '') return;
      if (col.key === 'platform') { metrics.platform = c[j].slice(0, 40); return; }
      const n = parseNumber(c[j]);
      if (n !== null) (metrics as Record<string, number>)[col.key] = n;
    });
    if (Object.keys(metrics).length) rows.push({ title, metrics, line: i + 2 });
  });
  return { rows, columns };
}

const norm = (s: string) => s.replace(/[#＃\s"“”'‘’「」《》【】|｜:：,，.。!！?？~～-]/g, '').toLowerCase();

export interface MatchResult { row: ImportedRow; workId: string | null; workTitle: string | null; reason?: string }

/** 按标题对到作品；对不上、对到多条都不挂，写清原因 */
export function matchRowsToWorks(rows: ImportedRow[], works: { id: string; title: string }[]): MatchResult[] {
  const normalized = works.map((w) => ({ ...w, key: norm(w.title) }));
  return rows.map((row) => {
    const k = norm(row.title);
    const exact = normalized.filter((w) => w.key === k);
    const loose = exact.length ? exact : normalized.filter((w) => w.key.length >= 4 && k.length >= 4 && (k.includes(w.key) || w.key.includes(k)));
    if (loose.length === 1) return { row, workId: loose[0].id, workTitle: loose[0].title };
    return { row, workId: null, workTitle: null, reason: loose.length ? `标题和 ${loose.length} 条作品都像，请手动录` : '没找到标题对得上的已发布作品' };
  });
}
