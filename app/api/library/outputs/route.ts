import { NextResponse } from 'next/server'
import { settingsFromInput } from '@/lib/creation-settings'
import { originForResult } from '@/lib/creation-continuation'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { historyProfileFilter } from '@/lib/profile-history'
import { splitTopicSections } from '@/lib/topic-library'
import { OUTPUT_LIBRARIES, OUTPUT_SKIP_TASKS, outputLibrary, outputPreview, outputTitle } from '@/lib/library-outputs'
import { cleanKeyword, dateRange, pageOf } from '@/lib/library'
import { countIndexedTopics, listIndexedTopics, scanTopics, syncTopicIndex, type TopicScope } from '@/lib/library-topic-index'

export const dynamic = 'force-dynamic'

/**
 * 素材库「全部产出」（2026-10-02，2026-10-03 改成完整分页）：历史记录里生成过的结果，按库（选题库、脚本库……）列出来。
 *
 *   ?profileId=             只看这个档案的（不传看全部；default = 没有档案的旧记录）
 *   ?from=2026-09-01&to=…   按日期筛（北京时间，含两头）
 *   ?lib=script&q=关键词     某个库的一页：只给标题、预览、时间——全文很大，点开再取
 *   &offset=0&limit=20      翻页；返回 total（这个库、这个筛选下一共多少条）
 *   ?id=…                   一条的全文；选题库的一条是「批次id#序号」
 *
 * 不传 lib 只回各库的数量。数量用数据库计数（不受默认 1000 行上限影响）；
 * 选题库按一条一条数，靠选题索引（lib/library-topic-index），不再每次拆全部全文。
 * 用户的网络对大请求敏感（见 lib/api-error 的 fetchGeneration），所以列表绝不带全文。
 */
export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const sp = new URL(request.url).searchParams
  const userId = guard.userId!

  // 一条的全文
  const id = sp.get('id')
  if (id) {
    const [historyId, part] = id.split('#')
    const { data, error } = await supabase.from('script_history').select('task_type, result, input_data, work_id').eq('id', historyId).eq('user_id', userId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: '没找到这条内容' }, { status: 404 })
    const creationContext = { settings: settingsFromInput(data.input_data), originContent: originForResult(data.result, [data], ''), workId: data.work_id || undefined }
    if (part !== undefined) {
      const sec = splitTopicSections(String(data.result || ''))[Number(part)]
      if (!sec) return NextResponse.json({ error: '没找到这条选题' }, { status: 404 })
      return NextResponse.json({ body: `### ${sec.title}\n${sec.body}`, creationContext })
    }
    return NextResponse.json({ body: String(data.result || ''), creationContext })
  }

  const rawProfile = sp.get('profileId')
  let profileFilter: string | null
  try { profileFilter = historyProfileFilter(rawProfile) } catch { return NextResponse.json({ error: '档案编号不正确' }, { status: 400 }) }
  const range = dateRange(sp.get('from'), sp.get('to'))
  const topicScope: TopicScope = { profileKey: rawProfile, range }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase 查询链类型随 select 变化
  const scoped = (q: any) => {
    let r = profileFilter ? q.or(profileFilter) : q
    if (range.gte) r = r.gte('created_at', range.gte)
    if (range.lt) r = r.lt('created_at', range.lt)
    return r
  }

  const libId = sp.get('lib')
  const lib = libId ? outputLibrary(libId) : undefined
  if (libId && !lib) return NextResponse.json({ error: '没有这个库' }, { status: 400 })

  try {
    // 先把选题索引补齐（新出的、删过的批次）；表没建时 indexReady=false，选题库走全量现拆。
    // 翻其他库的页用不到选题，不补。
    const sync = !lib || lib.id === 'topic' ? await syncTopicIndex(supabase, userId) : { pending: 0 }
    const indexReady = sync !== null
    const indexing = sync?.pending ?? 0
    const meta = { indexReady, indexing }

    if (lib) {
      const kw = cleanKeyword(sp.get('q'))
      const page = pageOf(sp)
      if (lib.id === 'topic') {
        const r = indexReady
          ? await listIndexedTopics(supabase, userId, topicScope, kw, page)
          : await scanTopics(supabase, userId, profileFilter, range, kw, page)
        return NextResponse.json({ ...meta, ...r, offset: page.offset, limit: page.limit })
      }
      let q = supabase
        .from('script_history')
        .select('id, task_type, input_data, result, created_at, work_id', { count: 'exact' })
        .eq('user_id', userId)
        .in('task_type', lib.taskTypes)
      if (kw) q = q.ilike('result', `%${kw}%`)
      const { data, error, count } = await scoped(q)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(page.offset, page.offset + page.limit - 1)
      if (error) throw new Error(error.message)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (data ?? []).map((r: any) => ({
        id: r.id, historyId: r.id, taskType: r.task_type,
        title: outputTitle(String(r.result || ''), r.input_data as Record<string, unknown> | null, r.task_type),
        preview: outputPreview(String(r.result || '')), createdAt: r.created_at, workId: r.work_id ?? null,
      }))
      return NextResponse.json({ ...meta, items, total: count ?? items.length, offset: page.offset, limit: page.limit })
    }

    // 各库数量：每个库一次计数查询，不取行
    const others = OUTPUT_LIBRARIES.filter((l) => l.id !== 'topic')
    const heads = await Promise.all(others.map((l) =>
      scoped(supabase.from('script_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('task_type', l.taskTypes.filter((t) => !OUTPUT_SKIP_TASKS.has(t))))
    ))
    const counts: Record<string, number> = {}
    for (const [i, l] of others.entries()) {
      if (heads[i].error) throw new Error(heads[i].error.message)
      counts[l.id] = heads[i].count ?? 0
    }
    counts.topic = indexReady
      ? await countIndexedTopics(supabase, userId, topicScope)
      : (await scanTopics(supabase, userId, profileFilter, range, '', { offset: 0, limit: 0 })).total
    return NextResponse.json({ counts, ...meta })
  } catch (e) {
    console.error('[library/outputs] 读取失败:', (e as Error).message)
    return NextResponse.json({ error: '读取失败，请稍后重试' }, { status: 500 })
  }
}
