import { after } from 'next/server';
import { requireUser, requireUserWithQuota } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/read-body';
import { verifiedAttachments, attachmentTextBlock, CHAT_FILES_BUCKET } from '@/lib/chat-attachments-server';
import { attachmentReadable, attachmentToText } from '@/lib/document-text';
import { getSearchConfig } from '@/lib/search-config';
import { DEEP_RESEARCH_LIMITS } from '@/lib/config/plans';
import { CONTEXT_MAX, TOPIC_MAX, isDepth, progressText, readPlan, type ResearchStep } from '@/lib/research';
import { isStale, runResearch, runResearchPlan, quotaMessage, readResearchQuota } from '@/lib/research-runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 1800;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const missing = (e: { message?: string } | null) => !!e && /schema cache|does not exist/i.test(e.message ?? '');
const headers = { 'Cache-Control': 'private, no-store' };
const failure = (message: string, status = 503) => Response.json({ error: message }, { status, headers });
const notReady = () => failure('深度研究数据库尚未升级，请联系管理员');

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!, db = getServiceSupabase(), sp = new URL(request.url).searchParams;
  const id = sp.get('id'), profileId = sp.get('profileId');
  if (id && !UUID.test(id)) return failure('研究编号不正确', 400);
  if (profileId && profileId !== 'default' && !UUID.test(profileId)) return failure('档案编号不正确', 400);
  if (!id && sp.get('list') !== '1') {
    try {
      const [quota, config] = await Promise.all([readResearchQuota(userId), getSearchConfig()]);
      return Response.json({ quota, searchReady: !!config, message: quota.allowed ? undefined : quotaMessage(quota) }, { headers });
    } catch { return notReady(); }
  }
  if (!id) {
    let query = db.from('research_jobs').select('id,profile_id,topic,depth,status,created_at,updated_at').eq('user_id', userId);
    if (profileId === 'default') query = query.is('profile_id', null);
    else if (profileId) query = query.eq('profile_id', profileId);
    const offset = Math.max(0, Math.min(100_000, Number(sp.get('offset')) || 0));
    const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + 19);
    if (missing(error)) return notReady();
    if (error) return failure('研究历史暂时无法读取');
    return Response.json({ items: data ?? [], hasMore: data?.length === 20 }, { headers });
  }
  let query = db.from('research_jobs').select('id,profile_id,topic,depth,status,plan,steps,report,checks,error,heartbeat_at,created_at,updated_at,retry_count,summary_failed,context,canvas_versions').eq('user_id', userId);
  if (profileId === 'default') query = query.is('profile_id', null);
  else if (profileId) query = query.eq('profile_id', profileId);
  const { data: job, error } = await query.eq('id', id).maybeSingle();
  if (missing(error)) return notReady();
  if (error) return failure('研究进度暂时无法读取');
  if (!job) return failure('没有找到当前档案的研究', 404);
  if (job.status === 'planning' && (!job.heartbeat_at || Date.now() - new Date(job.heartbeat_at).getTime() > 180_000)) after(() => runResearchPlan(job.id));
  else if (isStale(job)) after(() => runResearch(job.id));
  const { data: sources, error: sourceError } = await db.from('research_sources').select('n,step,url,title,site,published,fetched,collected_at').eq('job_id', id).order('n');
  if (sourceError) return failure('来源列表暂时无法读取');
  return Response.json({ ...job, progress: progressText(job.status, (job.steps ?? []) as ResearchStep[]), sources: sources ?? [] }, { headers });
}

export async function POST(request: Request) {
  const guard = await requireUserWithQuota();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!, db = getServiceSupabase();
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, userId); } catch { return failure('请求格式不正确', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return failure('请求格式不正确', 400);
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (topic.length < 4 || topic.length > TOPIC_MAX) return failure(`研究主题需4～${TOPIC_MAX}字`, 400);
  if (!isDepth(body.depth) || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) return failure('研究参数不正确，请刷新后再试', 400);
  const profileId = typeof body.profileId === 'string' && body.profileId ? body.profileId : null;
  if (profileId && !UUID.test(profileId)) return failure('档案编号不正确', 400);
  if (profileId) {
    const { data, error } = await db.from('user_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle();
    if (error) return failure('档案暂时无法读取');
    if (!data) return failure('不能使用其他账号的档案', 403);
  }
  try {
    const quota = await readResearchQuota(userId);
    if (['plan_not_included', 'membership_expired', 'account_inactive', 'period_unavailable'].includes(quota.reason ?? '')) return failure(quotaMessage(quota), 402);
  } catch { return notReady(); }
  if (!(await getSearchConfig())) return failure('管理员尚未配置深度研究的联网搜索，请稍后再试');
  let files;
  try { files = verifiedAttachments(body.files, userId); } catch { return failure('附件验证失败，请重新上传', 400); }
  const parts: string[] = [];
  if (typeof body.profileContext === 'string' && body.profileContext.trim()) parts.push(`【账号档案，作为背景而非网页来源】\n${body.profileContext.slice(0, 4000)}`);
  if (typeof body.material === 'string' && body.material.trim()) parts.push(`【用户提供的资料】\n${body.material.slice(0, 8000)}`);
  if (files.some(f => f.type === 'document' && attachmentReadable(f.name))) {
    try {
      const storage = db.storage.from(CHAT_FILES_BUCKET);
      const block = await attachmentTextBlock(files, async file => {
        if (!attachmentReadable(file.name)) return null;
        const { data, error } = await storage.download(file.storagePath);
        return error || !data ? null : Buffer.from(await data.arrayBuffer());
      }, attachmentToText);
      if (block.trim()) parts.push(block.trim());
    } catch { return failure('附件暂时无法读取，请重试'); }
  }
  let context = parts.join('\n\n');
  if (context.length > CONTEXT_MAX) context = context.slice(0, CONTEXT_MAX) + '\n【背景资料超过本轮上限，后文未纳入本次研究，请缩短或拆分主题】';
  const { data, error } = await db.rpc('kaiwu_create_research', { p_user_id: userId, p_request_id: body.requestId, p_profile_id: profileId, p_topic: topic, p_depth: body.depth, p_context: context, p_limits: DEEP_RESEARCH_LIMITS, p_attachments: files });
  if (missing(error)) return notReady();
  if (error) return failure('研究未创建，请检查是否重复修改了同一次请求', 409);
  if (!data?.id) return failure(data?.reason === 'too_many_jobs' ? '同时最多保留两个未完成研究，请先完成或停止已有任务' : data?.reason === 'planning_limit' ? '今天创建研究计划过于频繁，请明天再试' : quotaMessage(data), 402);
  if (data.status === 'planning') after(() => runResearchPlan(data.id));
  return Response.json({ id: data.id, status: data.status }, { headers });
}

export async function PATCH(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!, db = getServiceSupabase();
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, userId); } catch { return failure('请求格式不正确', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return failure('请求格式不正确', 400);
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return failure('研究编号不正确', 400);
  if (body.action === 'cancel') {
    const { data, error } = await db.rpc('kaiwu_cancel_research', { p_user_id: userId, p_job_id: body.id });
    if (error) return failure('研究未停止，请重试');
    return data?.found ? Response.json({ ok: true }, { headers }) : failure('研究不存在', 404);
  }
  if (body.action === 'save_versions') {
    const { data: job, error } = await db.from('research_jobs').select('id,status,report').eq('id', body.id).eq('user_id', userId).maybeSingle();
    if (error) return failure('研究暂时无法读取');
    if (!job) return failure('研究不存在', 404);
    const versions = Array.isArray(body.versions) ? body.versions : [];
    if (job.status !== 'done' || !versions.length || versions.length > 50 || JSON.stringify(versions).length > 1_000_000 || versions.some(v => !v || typeof v.content !== 'string' || !v.content.trim() || !Number.isFinite(v.at))) return failure('改稿版本无效或过大，请导出后分批编辑', 400);
    const { error: saveError } = await db.from('research_jobs').update({ canvas_versions: versions, updated_at: new Date().toISOString() }).eq('id', body.id).eq('user_id', userId).eq('status', 'done');
    return saveError ? failure('改稿未同步，请重试') : Response.json({ ok: true }, { headers });
  }
  if (body.action !== 'start' && body.action !== 'retry') return failure('不支持的操作', 400);
  const activeGuard = await requireUserWithQuota();
  if (!activeGuard.ok) return activeGuard.response!;
  if (!(await getSearchConfig())) return failure('联网搜索暂未配置，请联系管理员');
  const { data: job, error } = await db.from('research_jobs').select('depth').eq('id', body.id).eq('user_id', userId).maybeSingle();
  if (error) return failure('研究暂时无法读取');
  if (!job) return failure('研究不存在', 404);
  const plan = body.action === 'start' ? readPlan(body.plan, job.depth) : null;
  if (body.action === 'start' && !plan) return failure('至少保留一个子问题及搜索词', 400);
  const { data, error: startError } = await db.rpc('kaiwu_start_research', { p_user_id: userId, p_job_id: body.id, p_plan: plan, p_retry: body.action === 'retry', p_limits: DEEP_RESEARCH_LIMITS });
  if (startError) return failure('研究未启动，请重试');
  if (!data?.allowed) return failure(data?.reason === 'retry_unavailable' ? '无法重试：最多补跑三次，或当前任务还在运行' : data?.reason === 'state_changed' || data?.reason === 'already_done' ? '任务状态已变化，请刷新查看' : quotaMessage(data), 409);
  after(() => runResearch(body.id as string));
  return Response.json({ ok: true, status: 'running' }, { headers });
}
