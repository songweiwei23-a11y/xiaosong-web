import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './helpers/source';

/**
 * account_positioning.positioning_type 的取值必须与数据库 check 约束一致。
 *
 * 约束只放了三种时，「创作简报」「行业建议」保存都会被数据库拒绝，接口只回 500，
 * 页面静默失败。这里取最新一条约束迁移里的允许值，再扫代码里实际写入的值做对照。
 */

const ROOT = process.cwd();
const ROOTS = ['app', 'lib', 'components', 'hooks'];
const TS_TYPE_KEYWORDS = new Set(['string', 'number', 'boolean', 'any', 'unknown']);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function latestAllowedValues(): string[] {
  const dir = path.join(ROOT, 'supabase/migrations');
  const latest = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /add constraint account_positioning_type_check/.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    .pop();
  if (!latest) throw new Error('找不到 account_positioning_type_check 的约束迁移');
  const sql = fs.readFileSync(path.join(dir, latest), 'utf8');
  const list = sql.match(/check\s*\(\s*positioning_type in \(([^)]*)\)/)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)));
const codeOf = new Map(files.map((f) => [f, stripComments(fs.readFileSync(f, 'utf8'))]));

function resolveConst(name: string): string | null {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*(['"])([^'"]+)\\1`);
  for (const code of codeOf.values()) {
    const m = code.match(re);
    if (m) return m[2];
  }
  return null;
}

/** DeepDivePage 的 title 由各板块页面传入，取它们渲染时写的 title="..." */
function deepDiveTitles(): string[] {
  return [...codeOf.entries()]
    .filter(([, code]) => code.includes('<DeepDivePage'))
    .flatMap(([, code]) => [...code.matchAll(/\btitle="([^"]+)"/g)].map((m) => m[1]));
}

function collectWrittenTypes() {
  const used = new Map<string, string>();
  const unresolved: string[] = [];
  const WRITE = /positioning_type:\s*(?:(['"])([^'"]+)\1|([A-Za-z_]\w*))/g;
  for (const [file, code] of codeOf) {
    for (const m of code.matchAll(WRITE)) {
      const where = path.relative(ROOT, file).replace(/\\/g, '/');
      if (m[2]) {
        used.set(m[2], where);
        continue;
      }
      const id = m[3];
      if (TS_TYPE_KEYWORDS.has(id)) continue;
      const value = resolveConst(id);
      if (value) used.set(value, where);
      else if (id === 'title') for (const t of deepDiveTitles()) used.set(t, where);
      else unresolved.push(`${where}: ${id}`);
    }
  }
  return { used, unresolved };
}

describe('positioning_type 取值与数据库约束一致', () => {
  const allowed = latestAllowedValues();
  const { used, unresolved } = collectWrittenTypes();

  it('约束迁移里有全部五种取值', () => {
    expect(allowed).toEqual(expect.arrayContaining(['账号定位', '商业定位', '内容定位', '创作简报', '行业建议']));
  });

  it('扫描到了代码里已知的写入点（防止路径写错导致用例空过）', () => {
    for (const v of ['账号定位', '商业定位', '内容定位', '创作简报', '行业建议']) {
      expect(used.has(v), `没扫到 ${v}`).toBe(true);
    }
  });

  it('代码里写入的每个取值都在约束里', () => {
    const bad = [...used.entries()].filter(([v]) => !allowed.includes(v)).map(([v, where]) => `${where} → ${v}`);
    expect(bad).toEqual([]);
  });

  it('没有无法解析的变量写入', () => {
    expect(unresolved).toEqual([]);
  });
});
