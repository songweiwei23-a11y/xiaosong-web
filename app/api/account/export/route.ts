import { requireUser } from '@/lib/api-guard'
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth'
import { fetchAllPages } from '@/lib/db-pages'
import { EXPORT_FORMAT, EXPORT_TABLES, EXPORT_VERSION, stripRow, type ExportBundle } from '@/lib/account-export'

export const dynamic = 'force-dynamic'

/**
 * 全量数据导出，说明见 lib/account-export.ts。恢复预检在浏览器里做（checkExportBundle），导出文件可能好几 MB，不往回传——用户线路传大文件会断。
 * 用登录用户自己的身份读（行级权限），每张表再显式按本人过滤；按页取完。
 */
const missing = (msg: string) => /does not exist|schema cache|not find/i.test(msg)

export async function GET() {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const userId = guard.userId!

  const bundle: ExportBundle = { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), userId, counts: {}, skipped: {}, tables: {} }
  for (const { table } of EXPORT_TABLES) {
    // 有的表没有 id 列（按 user_id 一行）：按 id 排序失败就退回按 user_id 排
    const read = (order: string) => fetchAllPages<Record<string, unknown>>((from, to) =>
      (table === 'research_jobs' ? getServiceSupabase() : supabase).from(table).select('*').eq('user_id', userId).order(order).range(from, to))
    try {
      let rows: Record<string, unknown>[]
      if (table === 'research_sources') {
        // 来源表无user_id，仅以刚查到的本人报告编号读取，不能直读全表。
        if (bundle.skipped.research_jobs) throw new Error('研究报告历史未读完，来源未导出')
        const ids = (bundle.tables.research_jobs || []).filter(r => r.user_id === userId).map(r => String(r.id))
        rows = []
        for (let offset = 0; offset < ids.length; offset += 200) {
          const batch = ids.slice(offset, offset + 200)
          rows.push(...await fetchAllPages<Record<string, unknown>>((from, to) => getServiceSupabase().from('research_sources').select('*').in('job_id', batch).order('job_id').order('n').range(from, to)))
        }
      } else try { rows = await read('id') } catch (e) {
        if (!/\bid\b/.test((e as Error).message)) throw e
        rows = await read('user_id')
      }
      bundle.tables[table] = rows.map((r) => stripRow(table, r))
      bundle.counts[table] = rows.length
    } catch (e) {
      const msg = (e as Error).message
      // 表没建不是"没有数据"：写清楚，导出照样完成
      bundle.skipped[table] = missing(msg) ? '这张表还没建（对应迁移没执行）' : `读取失败：${msg.slice(0, 120)}`
    }
  }
  const day = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(bundle), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="kaiwu-export.json"; filename*=UTF-8''${encodeURIComponent(`开物全部数据_${day}.json`)}`,
      'Cache-Control': 'no-store',
    },
  })
}
