/**
 * 全量数据导出与恢复预检（2026-10-04）。
 *
 * 产品要求："明确保留政策、全量数据导出、备份和恢复演练。"
 * - 导出：本人在开物里留下的全部内容（档案、定位、生成历史、作品、素材库、风格预设、对话、前采、待办……），
 *   每张表按页取完，不受数据库一次 1000 行的上限影响。表没建的（迁移没跑）记在 skipped 里，不当成"没有数据"。
 * - 恢复预检：读一份导出文件，核对格式、是不是本人的、每张表条数和行数对得上——只检查不写库。
 *   真正写回数据库要处理冲突（同一条已存在、档案已删），等确认方案后再做，见交付报告。
 */

/** 导出哪些表：都是按 user_id 归属本人的内容表。管理、额度计数、支付审核内部表不导 */
export const EXPORT_TABLES = [
  { table: 'user_profiles', label: '账号档案' },
  { table: 'account_positioning', label: '定位与创作简报' },
  { table: 'deal_reasons', label: '成交理由' },
  { table: 'interview_imports', label: '前采建档' },
  { table: 'works', label: '作品' },
  { table: 'script_history', label: '生成历史（含画布改稿）' },
  { table: 'material_library', label: '素材库收藏与真实素材' },
  { table: 'creator_presets', label: '风格预设' },
  { table: 'creator_preferences', label: '我的创作偏好' },
  { table: 'chat_conversations', label: '自由对话与持续对话' },
  { table: 'research_jobs', label: '深度研究报告与改稿历史' },
  { table: 'research_sources', label: '深度研究参考来源' },
  { table: 'creation_sessions', label: '跨板块创作需求' },
  { table: 'user_todos', label: '待办' },
  { table: 'launch_plans', label: '7 天起号计划' },
  { table: 'course_progress', label: '新手课进度' },
  { table: 'user_settings', label: '偏好设置' },
  { table: 'subscriptions', label: '会员订阅' },
  { table: 'payment_orders', label: '支付订单' },
] as const;

export const EXPORT_FORMAT = 'kaiwu-account-export';
export const EXPORT_VERSION = 1;

export interface ExportBundle {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  userId: string;
  counts: Record<string, number>;
  /** 表还没建或读取失败的，带原因 */
  skipped: Record<string, string>;
  tables: Record<string, Record<string, unknown>[]>;
}

/** 导出里去掉的字段：支付凭证图片地址等敏感内部字段不随导出外流 */
const DROP_FIELDS: Record<string, string[]> = {
  payment_orders: ['proof_url', 'proof_path', 'review_note_internal'],
  research_jobs: ['run_token', 'quota_request_id', 'client_request_id', 'heartbeat_at', 'input_hash'],
};

export function stripRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const drop = DROP_FIELDS[table];
  if (!drop) return row;
  const out = { ...row };
  for (const k of drop) delete out[k];
  return out;
}

export interface RestoreCheck {
  ok: boolean;
  problems: string[];
  summary: { table: string; label: string; rows: number }[];
}

/** 恢复预检：只读，核对导出文件能不能用来恢复这个账号 */
export function checkExportBundle(raw: unknown, userId: string): RestoreCheck {
  const problems: string[] = [];
  const b = raw as Partial<ExportBundle> | null;
  if (!b || typeof b !== 'object' || b.format !== EXPORT_FORMAT) return { ok: false, problems: ['不是开物导出的数据文件'], summary: [] };
  if (b.version !== EXPORT_VERSION) problems.push(`导出格式版本 ${String(b.version)} 不认识（当前是 ${EXPORT_VERSION}）`);
  if (b.userId !== userId) problems.push('这份数据属于另一个账号，不能恢复到当前账号');
  const tables = b.tables && typeof b.tables === 'object' ? b.tables : {};
  const counts = b.counts && typeof b.counts === 'object' ? b.counts : {};
  const summary = EXPORT_TABLES.map(({ table, label }) => {
    const rows = Array.isArray(tables[table]) ? tables[table] : [];
    if (counts[table] !== undefined && counts[table] !== rows.length) problems.push(`${label}：记录数 ${counts[table]} 条，实际只有 ${rows.length} 条，文件可能不完整`);
    const foreign = rows.filter((r) => r && typeof r === 'object' && 'user_id' in r && r.user_id !== b.userId).length;
    if (foreign) problems.push(`${label}：有 ${foreign} 条不属于这个账号`);
    return { table, label, rows: rows.length };
  });
  for (const t of Object.keys(tables)) if (!EXPORT_TABLES.some((x) => x.table === t)) problems.push(`有不认识的表：${t}`);
  const researchRows = Array.isArray(tables.research_jobs) ? tables.research_jobs : [];
  const sourceRows = Array.isArray(tables.research_sources) ? tables.research_sources : [];
  const researchIds = new Set(researchRows.filter(r => r && typeof r === 'object' && r.user_id === b.userId && typeof r.id === 'string').map(r => r.id));
  if (sourceRows.some(r => !r || typeof r !== 'object' || !researchIds.has(r.job_id))) problems.push('研究来源：存在不属于本份报告历史的来源');
  return { ok: problems.length === 0, problems, summary };
}
