/**
 * 迁移状态探测（体检 P0-2）：逐个看台账里的表、列是不是已经存在。
 * 做法：对每张表、每列做一次「只取 0 行」的查询，出现「不存在」的错误就记为缺失。
 * 只读，不改数据。只给管理员看（/admin/migrations）。
 *
 * 局限：只能看「建了什么」，看不出「建完又删了」或「改过结构」；没有建表 / 加列的迁移（只改策略、只写数据）
 * 没法自动检测，记为 unknown，需要管理员自己确认。
 */
import type { MigrationEntry } from './migration-registry';
import { isMissingSchemaError } from '@/lib/feature-status';

export type MigrationState = 'applied' | 'partial' | 'missing' | 'unknown';

export interface MigrationStatus {
  file: string;
  state: MigrationState;
  checked: number;
  missingTables: string[];
  missingColumns: string[];
}

/** 探测只用到这一小块查询接口，方便测试时换成内存库 */
export interface ProbeDb {
  from(table: string): {
    select(cols: string): { limit(n: number): PromiseLike<{ error: { message?: string } | null }> };
  };
}

export async function probeMigration(db: ProbeDb, entry: MigrationEntry): Promise<MigrationStatus> {
  const tableProbes = entry.tables.map(async (t) => {
    const { error } = await db.from(t).select('*').limit(0);
    return isMissingSchemaError(error?.message) ? t : null;
  });
  const columnProbes = entry.columns.map(async (c) => {
    const { error } = await db.from(c.table).select(c.column).limit(0);
    return isMissingSchemaError(error?.message) ? `${c.table}.${c.column}` : null;
  });
  const [tables, columns] = await Promise.all([Promise.all(tableProbes), Promise.all(columnProbes)]);
  const missingTables = tables.filter((x): x is string => !!x);
  const missingColumns = columns.filter((x): x is string => !!x);
  const checked = entry.tables.length + entry.columns.length;
  const state: MigrationState = checked === 0
    ? 'unknown'
    : missingTables.length
      ? 'missing'
      : missingColumns.length
        ? 'partial'
        : 'applied';
  return { file: entry.file, state, checked, missingTables, missingColumns };
}

export async function probeAll(db: ProbeDb, entries: MigrationEntry[]): Promise<MigrationStatus[]> {
  return Promise.all(entries.map((e) => probeMigration(db, e)));
}

export function summarize(statuses: MigrationStatus[]) {
  const count = (s: MigrationState) => statuses.filter((x) => x.state === s).length;
  return { total: statuses.length, applied: count('applied'), partial: count('partial'), missing: count('missing'), unknown: count('unknown') };
}
