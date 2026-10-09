import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/read-body';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[a-zA-Z0-9_-]{16,128}$/;
const response = (data: unknown, status=200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET() {
  if (!await requireAdmin()) return response({ error: '无权查看' },403);
  try {
    const { data,error } = await getServiceSupabase().from('creation_requests')
      .select('user_id,request_id,feature,status,created_at,expires_at,creation_completion_evidence(content_chars,result_sha256,terminal,completed_at,usage_metadata)')
      .eq('status','pending').order('created_at').limit(50);
    if (error) return response({ error: '对账记录暂时无法读取' },503);
    return response({ requests:data ?? [], note:'没有可信完成证据的请求保持未知，不根据过期时间扣次数' });
  } catch { return response({ error:'对账服务暂时不可用' },503); }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return response({ error: '无权对账' },403);
  let body: Record<string, unknown>;
  try { body=await readJsonBody(request,admin.userId); }
  catch { return response({ error:'对账请求格式不正确' },400); }
  const rows=body.requests;
  if (rows != null && (!Array.isArray(rows) || rows.length>50 || rows.some(row =>
    !row || typeof row !== 'object' || typeof row.userId !== 'string' || !UUID.test(row.userId) || typeof row.requestId !== 'string' || !ID.test(row.requestId)))) {
    return response({ error:'最多选择 50 条合法的账号与生成编号' },400);
  }
  // Omitted requests automatically select up to 50 evidenced pending completions; preview is the default.
  const dryRun=body.dryRun !== false;
  try {
    const { data,error }=await getServiceSupabase().rpc('kaiwu_reconcile_creation', {
      p_actor:admin.userId,p_requests:rows ?? null,p_dry_run:dryRun,
    });
    if (error || !data) return response({ error:'对账未完成，请稍后重试；不会凭空扣除未知请求' },503);
    return response(data);
  } catch { return response({ error:'对账服务暂时不可用' },503); }
}
