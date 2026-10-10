import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './helpers/source';

/**
 * 契约测试：代码里每一处 upsert(onConflict: 'a,b')，对应的表必须有 (a,b) 的唯一约束。
 *
 * 2026-10-10 的 42P10 就是这类问题：admin_roles 没有 user_id 唯一约束，
 * upsert(onConflict: 'user_id') 一直报错，而现有测试全是源码扫描，抓不到。
 * 这里从迁移文件里找唯一约束（UNIQUE / PRIMARY KEY / CREATE UNIQUE INDEX），和代码对照。
 *
 * 找不到约束时测试会失败。两种处理：
 *   1) 在迁移里补上唯一索引（推荐）；
 *   2) 确认线上真的有这个约束（而迁移里没写），就把它写进 KNOWN_IN_PRODUCTION，并注明依据。
 */

const ROOT = process.cwd();

/** 线上确实有、但迁移文件里没写清楚的约束。每一条都要写依据 */
const KNOWN_IN_PRODUCTION: Record<string, string[]> = {
  // 线上日志里有 "user_quotas_user_id_key" 的唯一冲突报错，约束确认存在
  'user_quotas:user_id': ['线上日志 duplicate key user_quotas_user_id_key 已确认'],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

interface Use { table: string; cols: string[]; where: string }

function collectOnConflictUses(): Use[] {
  const uses: Use[] = [];
  const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))];
  for (const file of files) {
    // 去掉注释再扫：注释里提到的写法（比如解释为什么不用 onConflict）不算代码
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/onConflict:\s*['"`]([a-z_,\s]+)['"`]/g)) {
      const idx = m.index ?? 0;
      // 往前找最近的 .from(...)，视为这次写入的表。参数可能是字面量，也可能是常量名（要到文件里找它的值）
      const before = src.slice(Math.max(0, idx - 1200), idx);
      const fromMatches = [...before.matchAll(/\.from\(\s*([^)]+?)\s*\)/g)];
      let table = '(未知)';
      if (fromMatches.length) {
        const arg = fromMatches[fromMatches.length - 1][1].trim();
        const literal = arg.match(/^['"`]([a-z_0-9]+)['"`]$/);
        if (literal) table = literal[1];
        else if (/^[A-Za-z_][A-Za-z_0-9]*$/.test(arg)) {
          const assigned = src.match(new RegExp(`${arg}\\s*(?::\\s*string\\s*)?=\\s*['"\`]([a-z_0-9]+)['"\`]`));
          if (assigned) table = assigned[1];
        }
      }
      const cols = m[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
      uses.push({ table, cols, where: `${path.relative(ROOT, file)}` });
    }
  }
  return uses;
}

function loadMigrationSql(): string {
  const dir = path.join(ROOT, 'supabase', 'migrations');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
    .replace(/--[^\n]*/g, '')
    .toLowerCase();
}

const colList = (raw: string) =>
  raw.split(',').map((s) => s.trim().replace(/\s+.*$/, '')).filter(Boolean).sort();

/** 这张表在迁移里是否有 cols 这组唯一约束（唯一索引、唯一约束、主键，或列上直接写 UNIQUE / PRIMARY KEY） */
function hasUniqueInMigrations(sql: string, table: string, cols: string[]): boolean {
  const want = cols.join(',');
  const t = `(?:public\\.)?${table}\\b`;

  // CREATE UNIQUE INDEX ... ON t (a, b)
  for (const m of sql.matchAll(new RegExp(`create\\s+unique\\s+index[^;]*?on\\s+${t}\\s*\\(([^)]*)\\)`, 'g'))) {
    if (colList(m[1]).join(',') === want) return true;
  }
  // ALTER TABLE t ADD CONSTRAINT x UNIQUE (a, b)
  for (const m of sql.matchAll(new RegExp(`alter\\s+table\\s+(?:only\\s+)?${t}[^;]*?unique\\s*\\(([^)]*)\\)`, 'g'))) {
    if (colList(m[1]).join(',') === want) return true;
  }
  // CREATE TABLE t ( ... )：表级 UNIQUE / PRIMARY KEY，以及列级 UNIQUE / PRIMARY KEY
  for (const m of sql.matchAll(new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${t}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`, 'g'))) {
    const body = m[1];
    for (const k of body.matchAll(/(?:unique|primary\s+key)\s*\(([^)]*)\)/g)) {
      if (colList(k[1]).join(',') === want) return true;
    }
    if (cols.length === 1) {
      for (const line of body.split('\n')) {
        const [name] = line.trim().split(/\s+/);
        if (name === cols[0] && /\b(unique|primary\s+key)\b/.test(line)) return true;
      }
    }
  }
  return false;
}

describe('契约：onConflict 的目标列必须有唯一约束', () => {
  const uses = collectOnConflictUses();
  const sql = loadMigrationSql();

  it('能找到 onConflict 的使用（扫描器自检，避免空转）', () => {
    expect(uses.length).toBeGreaterThan(10);
  });

  it('每一处 onConflict 都能在迁移里找到对应的唯一约束（或在 KNOWN_IN_PRODUCTION 里注明依据）', () => {
    const missing: string[] = [];
    for (const u of uses) {
      const key = `${u.table}:${u.cols.join(',')}`;
      if (KNOWN_IN_PRODUCTION[key]) continue;
      if (u.table === '(未知)') {
        missing.push(`无法判断表名：${u.where} onConflict ${u.cols.join(',')}`);
        continue;
      }
      if (!hasUniqueInMigrations(sql, u.table, u.cols)) {
        missing.push(`${key}  <- ${u.where}`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('扫描器本身：能识别唯一索引、表级 UNIQUE、列级 UNIQUE 三种写法', () => {
    const sample = [
      'create unique index if not exists x on public.t1 (user_id, profile_key);',
      'create table if not exists public.t2 (\n  id uuid,\n  user_id uuid unique\n);',
      'create table public.t3 (\n  a text,\n  unique (b, c)\n);',
    ].join('\n').toLowerCase();
    expect(hasUniqueInMigrations(sample, 't1', ['profile_key', 'user_id'])).toBe(true);
    expect(hasUniqueInMigrations(sample, 't2', ['user_id'])).toBe(true);
    expect(hasUniqueInMigrations(sample, 't3', ['b', 'c'])).toBe(true);
    expect(hasUniqueInMigrations(sample, 't3', ['a'])).toBe(false);
  });
});
