import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { readJsonBody } from '@/lib/read-body';
import { aliSearch, SEARCH_FAILURE_TEXT } from '@/lib/ali-search';
import { DEFAULT_SEARCH_ENDPOINT, saveSearchConfig, searchConfigStatus, validApiKey, validEndpoint } from '@/lib/search-config';
import { ENGINE_LABEL, EXTRA_ENGINES, engineSearch, engineStates, saveEngineKey, setEngineEnabled, type ExtraEngine } from '@/lib/search-engines';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  if (!(await requireAdminPermission('manage_secrets'))) return Response.json({ error: '需要管理员权限' }, { status: 403 });
  return Response.json({ ...(await searchConfigStatus()), engines: await engineStates() }, { headers });
}

/**
 * 第二个搜索引擎（lib/search-engines）：{engine, apiKey} 先真搜一次、读得出结果才加密保存；{engine, enabled} 打开 / 关掉。
 * 留痕只记引擎名和动作，绝不记密钥。
 */
async function saveExtraEngine(body: Record<string, unknown>, adminId: string): Promise<Response> {
  const engine = body.engine as ExtraEngine;
  if (!EXTRA_ENGINES.includes(engine)) return Response.json({ error: '不认识的搜索引擎' }, { status: 400, headers });
  if (typeof body.enabled === 'boolean' && body.apiKey === undefined) {
    try { await setEngineEnabled(engine, body.enabled, adminId); }
    catch (e) { return Response.json({ error: (e as Error).message }, { status: 400, headers }); }
    await logAdminAction({ admin_id: adminId, action: AdminActions.UPDATE_SEARCH_KEY, target_type: 'system', target_id: `search_engine_${engine}`, details: { enabled: body.enabled } });
    return Response.json({ ok: true, ...(await searchConfigStatus()), engines: await engineStates() }, { headers });
  }
  const apiKey = validApiKey(body.apiKey);
  if (!apiKey) return Response.json({ error: '请输入有效密钥' }, { status: 400, headers });
  const result = await engineSearch(engine, apiKey, '今日新闻', { topK: 3, timeoutMs: 15_000 });
  if (!result.ok) return Response.json({ error: `${ENGINE_LABEL[engine]}验证没通过：${SEARCH_FAILURE_TEXT[result.reason]}` }, { status: 422, headers });
  if (!result.hits.length) return Response.json({ error: `${ENGINE_LABEL[engine]}能连上，但这次没读出任何结果（返回格式可能和预期不同），先不保存` }, { status: 422, headers });
  try {
    await saveEngineKey(engine, apiKey, adminId);
    await logAdminAction({ admin_id: adminId, action: AdminActions.UPDATE_SEARCH_KEY, target_type: 'system', target_id: `search_engine_${engine}`, details: { verified: true, hits: result.hits.length } });
    return Response.json({ ok: true, ...(await searchConfigStatus()), engines: await engineStates() }, { headers });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 503, headers }); }
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
  if (body.engine !== undefined) return saveExtraEngine(body, admin.userId);
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
    return Response.json({ ok: true, ...(await searchConfigStatus()), engines: await engineStates() }, { headers });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 503, headers }); }
}
