import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { historyProfileFilter } from '@/lib/profile-history'
import { splitTopicSections } from '@/lib/topic-library'
import { OUTPUT_SKIP_TASKS, libraryOfTask, outputLibrary, outputPreview, outputTitle } from '@/lib/library-outputs'

export const dynamic = 'force-dynamic'

/**
 * 素材库「全部产出」（2026-10-02）：历史记录里生成过的结果，按库（选题库、脚本库……）列出来。
 *
 *   ?profileId=           只看这个档案的（不传看全部）
 *   ?lib=script&q=关键词   某个库的列表：只给标题、预览、时间——全文很大，点开再取
 *   ?id=…                 一条的全文；选题库的一条是「批次id#序号」
 *
 * 不传 lib 只回各库的数量。选题库按一条一条数（一批 10 个选题算 10 条）。
 * 用户的网络对大请求敏感（见 lib/api-error 的 fetchGeneration），所以列表绝不带全文。
 */
const MAX_LIST = 100

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const sp = new URL(request.url).searchParams

  let profileFilter: string | null
  try { profileFilter = historyProfileFilter(sp.get('profileId')) } catch { return NextResponse.json({ error: '档案编号不正确' }, { status: 400 }) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = <T,>(q: T): T => (profileFilter ? (q as any).or(profileFilter) : q)

  // 一条的全文
  const id = sp.get('id')
  if (id) {
    const [historyId, part] = id.split('#')
    const { data, error } = await supabase.from('script_history').select('task_type, result').eq('id', historyId).eq('user_id', guard.userId!).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: '没找到这条内容' }, { status: 404 })
    if (part !== undefined) {
      const sec = splitTopicSections(String(data.result || ''))[Number(part)]
      if (!sec) return NextResponse.json({ error: '没找到这条选题' }, { status: 404 })
      return NextResponse.json({ body: `### ${sec.title}\n${sec.body}` })
    }
    return NextResponse.json({ body: String(data.result || '') })
  }

  // 选题批次：数量和选题库列表都要按一条一条拆
  const topicRows = await scoped(
    supabase.from('script_history').select('id, result, created_at, work_id').eq('user_id', guard.userId!).eq('task_type', '选题策划').order('created_at', { ascending: false }).limit(300)
  )
  if (topicRows.error) return NextResponse.json({ error: topicRows.error.message }, { status: 500 })
  const topics = (topicRows.data ?? []).flatMap((r) =>
    splitTopicSections(String(r.result || '')).map((s, i) => ({
      id: `${r.id}#${i}`, historyId: r.id, taskType: '选题策划', title: s.title.slice(0, 80),
      preview: outputPreview(s.body), createdAt: r.created_at, workId: r.work_id ?? null, body: s.body,
    }))
  )

  // 其余各库的数量
  const typeRows = await scoped(
    supabase.from('script_history').select('task_type').eq('user_id', guard.userId!).neq('task_type', '选题策划').limit(5000)
  )
  if (typeRows.error) return NextResponse.json({ error: typeRows.error.message }, { status: 500 })
  const counts: Record<string, number> = { topic: topics.length }
  for (const r of typeRows.data ?? []) {
    if (OUTPUT_SKIP_TASKS.has(r.task_type)) continue
    const lib = libraryOfTask(r.task_type)
    if (lib) counts[lib.id] = (counts[lib.id] ?? 0) + 1
  }

  const libId = sp.get('lib')
  if (!libId) return NextResponse.json({ counts })
  const lib = outputLibrary(libId)
  if (!lib) return NextResponse.json({ error: '没有这个库' }, { status: 400 })
  const kw = (sp.get('q') || '').trim().slice(0, 40)

  if (lib.id === 'topic') {
    const items = topics
      .filter((t) => !kw || t.title.includes(kw) || t.body.includes(kw))
      .slice(0, 300)
      .map(({ body: _body, ...rest }) => rest)
    return NextResponse.json({ counts, items })
  }

  let q = supabase
    .from('script_history')
    .select('id, task_type, input_data, result, created_at, work_id')
    .eq('user_id', guard.userId!)
    .in('task_type', lib.taskTypes)
    .order('created_at', { ascending: false })
    .limit(MAX_LIST)
  // 关键词里的 % _ 是通配符，去掉免得搜出一堆不相干的
  if (kw) q = q.ilike('result', `%${kw.replace(/[%_\\]/g, '')}%`)
  const { data, error } = await scoped(q)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const items = (data ?? []).map((r) => ({
    id: r.id, historyId: r.id, taskType: r.task_type,
    title: outputTitle(String(r.result || ''), r.input_data as Record<string, unknown> | null, r.task_type),
    preview: outputPreview(String(r.result || '')), createdAt: r.created_at, workId: r.work_id ?? null,
  }))
  return NextResponse.json({ counts, items })
}
