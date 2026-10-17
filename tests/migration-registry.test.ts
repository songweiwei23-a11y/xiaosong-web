/**
 * 迁移台账（体检 P0-2）：台账必须和 supabase/migrations 一一对应，且和解析函数的结果一致。
 * 新增迁移后忘了运行 scripts/gen-migration-registry.mjs，这里会红。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MIGRATION_REGISTRY } from '@/lib/migration-registry';
import { parseMigration, stripSqlComments } from '@/lib/migration-parse';

const dir = path.join(process.cwd(), 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

describe('解析迁移 SQL', () => {
  it('认得 CREATE TABLE 和 ADD COLUMN，忽略注释里的', () => {
    const sql = `-- CREATE TABLE fake_in_comment (x int);
      CREATE TABLE IF NOT EXISTS public.Demo_Table (id uuid);
      /* CREATE TABLE also_fake (y int); */
      ALTER TABLE demo_table ADD COLUMN IF NOT EXISTS Extra_Col text;
      ALTER TABLE other ADD COLUMN plain int;
      DROP POLICY IF EXISTS x ON demo_table;`;
    expect(parseMigration(sql)).toEqual({
      tables: ['demo_table'],
      columns: [{ table: 'demo_table', column: 'extra_col' }, { table: 'other', column: 'plain' }],
    });
    expect(stripSqlComments('a -- b\nc /* d */ e')).not.toMatch(/b|d/);
  });
});

describe('迁移台账', () => {
  it('和 supabase/migrations 下的 .sql 文件一一对应（新增迁移必须重新生成）', () => {
    expect(MIGRATION_REGISTRY.map((e) => e.file)).toEqual(files);
  });

  it('每个条目的表和列，和该文件里解析出来的完全一致', () => {
    for (const e of MIGRATION_REGISTRY) {
      const sql = fs.readFileSync(path.join(dir, e.file), 'utf8');
      const parsed = parseMigration(sql);
      expect(e.tables, e.file).toEqual(parsed.tables);
      expect(e.columns, e.file).toEqual(parsed.columns);
    }
  });

  it('本期的表都登记在台账里', () => {
    const all = MIGRATION_REGISTRY.flatMap((e) => e.tables);
    for (const t of ['user_signals', 'course_stars', 'result_feedback', 'creator_preferences', 'user_todos']) {
      expect(all, t).toContain(t);
    }
  });
});
