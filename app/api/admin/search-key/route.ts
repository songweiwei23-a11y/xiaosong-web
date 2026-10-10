import { requireAdmin, requireAdminPermission } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { readJsonBody } from '@/lib/read-body';
import { aliSearch, SEARCH_FAILURE_TEXT } from '@/lib/ali-search';
import { DEFAULT_SEARCH_ENDPOINT, saveSearchConfig, searchConfigStatus, validApiKey, validEndpoint } from '@/lib/search-config';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: '需要管理员权限' }, { status: 403 });
  return Response.json(await searchConfigStatus(), { headers });
}
export async function POST(request: Request) {
  const admin = await requireAdminPermission('manage_secrets');
  if (!admin) return Response.json({ error: '无权更换搜索密钥' }, { status: 403 });
  const url = new URL(request.url);
  const host = new URL(`http://${request.headers.get('host') || url.host}`).hostname;
  if (process.env.NODE_ENV === 'production' && request.headers.get('x-forwarded-proto') !== 'https' && url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(host)) return Response.json({ error: '当前入口未启用HTTPS，请用本机安全配置脚本经SSH保存密钥' }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, admin.userId); } catch { return Response.json({ error: '请求格式不正确' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: '请求格式不正确' }, { status: 400 });
  const apiKey = validApiKey(body.apiKey), endpoint = validEndpoint(body.endpoint || DEFAULT_SEARCH_ENDPOINT);
  if (!apiKey || !endpoint) return Response.json({ error: '请输入有效密钥及阿里云 OpenSearch HTTPS 地址' }, { status: 400 });
  const result = await aliSearch('公开网页联网搜索配置验证', { endpoint, apiKey, source: 'admin' }, { topK: 1 });
  if (!result.ok) return Response.json({ error: SEARCH_FAILURE_TEXT[result.reason] }, { status: 422, headers });
  try {
    await saveSearchConfig(endpoint, apiKey, admin.userId);
    // 留痕只记接口主机名和时间，绝不记密钥本身
    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.UPDATE_SEARCH_KEY,
      target_type: 'system',
      target_id: 'search_key',
      details: { host: new URL(endpoint).host },
    });
    return Response.json({ ok: true, ...(await searchConfigStatus()) }, { headers });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 503, headers }); }
}
