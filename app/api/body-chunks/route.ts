import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { putChunk } from '@/lib/read-body'

export const dynamic = 'force-dynamic'

/**
 * 大请求分块暂存（2026-10-02）。用户线路差的时候超过约 8KB 的 POST 会被切断，
 * 浏览器端（lib/safe-post）把压缩后还大的请求切成 5KB 一块先送到这里，
 * 最后的请求带着编号，由 lib/read-body 拼回去。只能取自己存的，5 分钟没用就清掉。
 */
export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = request.headers.get('x-body-id') || ''
  const index = Number(request.headers.get('x-chunk-index'))
  const total = Number(request.headers.get('x-chunk-total'))
  const data = Buffer.from(await request.arrayBuffer())
  if (data.length > 64 * 1024) return NextResponse.json({ error: '分块太大' }, { status: 400 })
  const err = putChunk(guard.userId!, id, index, total, data)
  if (err) return NextResponse.json({ error: err }, { status: 400 })
  return NextResponse.json({ ok: true })
}
