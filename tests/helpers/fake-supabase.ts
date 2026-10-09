/**
 * 内存版 Supabase（只实现接口里用到的那部分查询语法），给路由做行为测试：
 * 真的按条件筛、排序、分页、计数，能测出"第 1001 条以后看不到""别人的数据混进来"这类问题，
 * 而不是只断言源码里出现了某个按钮。
 *
 * 支持：select(列 / 别名:json路径, { count, head })、eq / neq / in / is / gte / gt / lt / lte / ilike / or（含 and(...)）、
 * order（多列）、range、limit、maybeSingle / single、insert、upsert（onConflict、ignoreDuplicates）、update、delete。
 * PostgREST 默认最多回 1000 行：没写 range/limit 时同样截到 maxRows，测试能抓到漏翻页。
 */
type Row = Record<string, any>;
interface Unique { cols: string[]; where?: (r: Row) => boolean; key?: (r: Row) => string }

export interface FakeDbOptions {
  maxRows?: number;
  unique?: Record<string, Unique[]>;
  /** 让某张表"不存在"：模拟迁移没跑 */
  missingTables?: string[];
  /** 让某些列"不存在"：模拟迁移没跑 */
  missingColumns?: Record<string, string[]>;
}

const OPS = ['eq', 'neq', 'ilike', 'like', 'is', 'gte', 'gt', 'lte', 'lt', 'in'] as const;

function readPath(row: Row, expr: string): any {
  const m = expr.match(/^(\w+)(?:(->>?)(\w+))?$/);
  if (!m) return undefined;
  const base = row[m[1]];
  if (!m[2]) return base;
  const v = base && typeof base === 'object' ? base[m[3]] : undefined;
  if (v === undefined || v === null) return null;
  return m[2] === '->>' ? (typeof v === 'string' ? v : JSON.stringify(v)) : v;
}

const likeToRegex = (p: string, flags: string) =>
  new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*').replace(/_/g, '.')}$`, flags);

function test(op: string, actual: any, expected: any): boolean {
  switch (op) {
    case 'eq': return actual !== null && actual !== undefined && String(actual) === String(expected);
    case 'neq': return String(actual) !== String(expected);
    case 'is': return expected === null || expected === 'null' ? actual === null || actual === undefined : actual === expected;
    case 'gte': return actual >= expected;
    case 'gt': return actual > expected;
    case 'lte': return actual <= expected;
    case 'lt': return actual < expected;
    case 'in': return (expected as any[]).map(String).includes(String(actual));
    case 'ilike': return actual != null && likeToRegex(String(expected), 'is').test(String(actual));
    case 'like': return actual != null && likeToRegex(String(expected), 's').test(String(actual));
  }
  throw new Error(`fake-supabase: 不支持的操作 ${op}`);
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function orTerm(term: string): (r: Row) => boolean {
  const and = term.match(/^and\((.*)\)$/);
  if (and) { const parts = splitTop(and[1]).map(orTerm); return (r) => parts.every((p) => p(r)); }
  const m = term.match(/^(.+?)\.(eq|neq|ilike|like|is|gte|gt|lte|lt)\.(.*)$/);
  if (!m) throw new Error(`fake-supabase: 看不懂的 or 条件 ${term}`);
  const val = m[3] === 'null' ? null : m[3];
  return (r) => test(m[2], readPath(r, m[1]), val);
}

function project(row: Row, cols: string): Row {
  if (cols.trim() === '*') return { ...row };
  const out: Row = {};
  for (const raw of cols.split(',').map((c) => c.trim()).filter(Boolean)) {
    const [alias, expr] = raw.includes(':') ? raw.split(':') : [raw.replace(/^.*->>?/, ''), raw];
    out[alias] = readPath(row, expr);
  }
  return out;
}

export function createFakeDb(seed: Record<string, Row[]> = {}, opts: FakeDbOptions = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  const maxRows = opts.maxRows ?? 1000;
  const calls: { table: string; op: string; args: any[] }[] = [];
  let idSeq = 0;

  // 按整个列名比（user_id 不算 id）
  const missingCol = (table: string, cols: string[]) => {
    const tokens = new Set(cols.flatMap((x) => String(x).split(/[^A-Za-z0-9_]+/)));
    return (opts.missingColumns?.[table] ?? []).find((c) => tokens.has(c));
  };
  const uniqueKey = (u: Unique, r: Row) => (u.key ? u.key(r) : u.cols.map((c) => String(r[c] ?? '∅')).join('|'));
  const violates = (table: string, candidate: Row, ignore?: Row) =>
    (opts.unique?.[table] ?? []).some((u) => (!u.where || u.where(candidate)) &&
      (tables[table] ?? []).some((r) => r !== ignore && (!u.where || u.where(r)) && uniqueKey(u, r) === uniqueKey(u, candidate)));

  function from(table: string) {
    const st: any = { table, filters: [] as ((r: Row) => boolean)[], orders: [] as [string, boolean][], kind: 'select', cols: '*', countMode: undefined, head: false, range: null as null | [number, number], limit: null as null | number, single: null as null | 'maybe' | 'one', payload: null, upsert: null as any, returning: null as null | string, colsUsed: [] as string[] };
    const q: any = {};
    const filter = (op: string) => (col: string, val: any) => { st.colsUsed.push(col); calls.push({ table, op, args: [col, val] }); st.filters.push((r: Row) => test(op, readPath(r, col), val)); return q; };
    for (const op of OPS) q[op] = filter(op);
    q.not = (col: string, op: string, val: any) => { st.colsUsed.push(col); calls.push({ table, op: 'not', args: [col, op, val] }); st.filters.push((r: Row) => !test(op, readPath(r, col), val)); return q; };
    q.or = (expr: string) => { calls.push({ table, op: 'or', args: [expr] }); const parts = splitTop(expr).map(orTerm); st.filters.push((r: Row) => parts.some((p) => p(r))); return q; };
    q.select = (cols = '*', o: any = {}) => {
      if (st.kind === 'select') { st.cols = cols; st.countMode = o.count; st.head = !!o.head; st.colsUsed.push(cols); } else st.returning = cols;
      calls.push({ table, op: 'select', args: [cols, o] });
      return q;
    };
    q.order = (col: string, o: any = {}) => { st.colsUsed.push(col); st.orders.push([col, o.ascending !== false]); return q; };
    q.range = (a: number, b: number) => { calls.push({ table, op: 'range', args: [a, b] }); st.range = [a, b]; return q; };
    q.limit = (n: number) => { st.limit = n; return q; };
    q.maybeSingle = () => { st.single = 'maybe'; return q; };
    q.single = () => { st.single = 'one'; return q; };
    q.insert = (rows: Row | Row[]) => { st.kind = 'insert'; st.payload = Array.isArray(rows) ? rows : [rows]; calls.push({ table, op: 'insert', args: [st.payload] }); return q; };
    q.upsert = (rows: Row | Row[], o: any = {}) => { st.kind = 'upsert'; st.payload = Array.isArray(rows) ? rows : [rows]; st.upsert = o; calls.push({ table, op: 'upsert', args: [st.payload, o] }); return q; };
    q.update = (patch: Row) => { st.kind = 'update'; st.payload = patch; calls.push({ table, op: 'update', args: [patch] }); return q; };
    q.delete = () => { st.kind = 'delete'; calls.push({ table, op: 'delete', args: [] }); return q; };
    q.then = (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject);

    function run() {
      if (opts.missingTables?.includes(table)) return { data: null, error: { message: `relation "public.${table}" does not exist`, code: '42P01' }, count: null };
      const used = [...st.colsUsed, ...(st.kind !== 'select' && st.payload ? (Array.isArray(st.payload) ? st.payload.flatMap(Object.keys) : Object.keys(st.payload)) : [])];
      const bad = missingCol(table, used);
      if (bad) return { data: null, error: { message: `column ${table}.${bad} does not exist`, code: '42703' }, count: null };
      const rows = (tables[table] ??= []);
      const match = (r: Row) => st.filters.every((f: (r: Row) => boolean) => f(r));

      if (st.kind === 'insert' || st.kind === 'upsert') {
        const out: Row[] = [];
        for (const p of st.payload as Row[]) {
          const row: Row = { id: p.id ?? `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`, created_at: p.created_at ?? new Date(Date.UTC(2026, 9, 3, 0, 0, idSeq)).toISOString(), ...p };
          if (st.kind === 'upsert' && st.upsert.onConflict) {
            const keys = String(st.upsert.onConflict).split(',').map((s: string) => s.trim());
            const existing = rows.find((r) => keys.every((k) => String(r[k]) === String(row[k])));
            if (existing) { if (!st.upsert.ignoreDuplicates) { Object.assign(existing, p); out.push(existing); } continue; }
          }
          if (violates(table, row)) return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' }, count: null };
          rows.push(row);
          out.push(row);
        }
        return finish(out);
      }
      if (st.kind === 'update') {
        const hit = rows.filter(match);
        for (const r of hit) if (violates(table, { ...r, ...st.payload }, r)) return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' }, count: null };
        for (const r of hit) Object.assign(r, st.payload);
        return finish(hit);
      }
      if (st.kind === 'delete') {
        const keep = rows.filter((r) => !match(r));
        const gone = rows.filter(match);
        tables[table] = keep;
        return finish(gone);
      }

      let hit = rows.filter(match);
      const count = st.countMode ? hit.length : null;
      if (st.head) return { data: null, error: null, count };
      hit = [...hit].sort((a, b) => {
        for (const [c, asc] of st.orders) {
          const x = readPath(a, c); const y = readPath(b, c);
          if (x === y) continue;
          return (x > y ? 1 : -1) * (asc ? 1 : -1);
        }
        return 0;
      });
      if (st.range) hit = hit.slice(st.range[0], st.range[1] + 1);
      if (st.limit !== null) hit = hit.slice(0, st.limit);
      hit = hit.slice(0, maxRows);
      const data = hit.map((r) => project(r, st.cols));
      if (st.single) return { data: data[0] ?? null, error: st.single === 'one' && !data.length ? { message: 'no rows' } : null, count };
      return { data, error: null, count };
    }

    function finish(rows: Row[]) {
      const data = st.returning ? rows.map((r) => project(r, st.returning)) : null;
      if (st.single) return { data: data?.[0] ?? null, error: null, count: null };
      return { data, error: null, count: null };
    }
    return q;
  }

  return { from, tables, calls };
}
