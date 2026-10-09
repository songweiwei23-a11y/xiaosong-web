/**
 * 按页把数据库查询取完（2026-10-04）。
 *
 * PostgREST 一次最多回 1000 行（Supabase 默认）。直接 .select() 不分页，第 1001 行以后会被悄悄丢掉——
 * 素材库计数少算、作品环节被算成「没做」都是这个原因。凡是"要全部"的读取都走这里。
 */
export const DB_PAGE = 1000;

/** build(from, to) 要自己带稳定的排序（比如 .order('id')），不然翻页会漏行、重行 */
export async function fetchAllPages<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await build(from, from + DB_PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < DB_PAGE) return all;
  }
}
