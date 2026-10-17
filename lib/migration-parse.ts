/**
 * 解析一个迁移 SQL 文件：它建了哪些表、给哪些表加了哪些列（体检 P0-2：迁移台账）。
 * 只认两种语句：CREATE TABLE、ALTER TABLE ... ADD COLUMN。删策略、改数据、建函数的不算，
 * 台账里会标成「无法自动检测」。纯函数，给生成脚本（scripts/gen-migration-registry.ts）和测试用。
 */

export interface ParsedMigration {
  tables: string[];
  columns: { table: string; column: string }[];
}

/** 去掉 -- 行注释和 /* *\/ 块注释，避免注释里的 CREATE TABLE 被当成真的 */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

export function parseMigration(sql: string): ParsedMigration {
  const clean = stripSqlComments(sql);
  const tables = new Set<string>();
  const columns = new Map<string, { table: string; column: string }>();
  for (const m of clean.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/gi)) {
    tables.add(m[1].toLowerCase());
  }
  for (const m of clean.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)) {
    const table = m[1].toLowerCase();
    const column = m[2].toLowerCase();
    columns.set(`${table}.${column}`, { table, column });
  }
  return { tables: [...tables].sort(), columns: [...columns.values()].sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`)) };
}
