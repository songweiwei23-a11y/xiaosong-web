// 生成迁移台账 lib/migration-registry.ts（体检 P0-2）。
// 新增或修改 supabase/migrations 下的迁移后，运行一次：node scripts/gen-migration-registry.mjs
// 解析规则必须和 lib/migration-parse.ts 完全一致；tests/migration-registry.test.ts 会比对两者，不一致就红。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'supabase', 'migrations');
const out = path.join(root, 'lib', 'migration-registry.ts');

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

function parseMigration(sql) {
  const clean = stripSqlComments(sql);
  const tables = new Set();
  const columns = new Map();
  for (const m of clean.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/gi)) {
    tables.add(m[1].toLowerCase());
  }
  for (const m of clean.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)) {
    const table = m[1].toLowerCase();
    const column = m[2].toLowerCase();
    columns.set(`${table}.${column}`, { table, column });
  }
  return {
    tables: [...tables].sort(),
    columns: [...columns.values()].sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`)),
  };
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const entries = files.map((file) => ({ file, ...parseMigration(fs.readFileSync(path.join(dir, file), 'utf8')) }));

const body = entries.map((e) => `  {\n    file: ${JSON.stringify(e.file)},\n    tables: ${JSON.stringify(e.tables)},\n    columns: ${JSON.stringify(e.columns)},\n  },`).join('\n');
const text = `// 本文件由 scripts/gen-migration-registry.mjs 生成，请勿手改。新增或修改迁移后重新运行该脚本。
// 每个迁移建了哪些表、加了哪些列（体检 P0-2）。管理后台「迁移状态」页用它逐一探测哪些已经执行。

export interface MigrationEntry {
  /** 文件名，例如 20261017_learning_signals.sql */
  file: string;
  /** 建的表（CREATE TABLE） */
  tables: string[];
  /** 加的列（ALTER TABLE ... ADD COLUMN） */
  columns: { table: string; column: string }[];
}

export const MIGRATION_REGISTRY: MigrationEntry[] = [
${body}
];
`;
fs.writeFileSync(out, text, 'utf8');
console.log(`迁移台账：${entries.length} 个文件，写入 ${path.relative(root, out)}`);
