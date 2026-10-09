import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/read-body';
import { sseTask } from '@/lib/dify-task';
import { DEFAULT_PROFILE_SCOPE } from '@/lib/profile-history';
import { learnPreferences, missingTable, validProfileKey } from '@/lib/preference-learner';
import { newSince, readStoredItems, readUserItem, settle, sameMeaning, type PreferenceItem } from '@/lib/preferences';

/*
 * 我的创作偏好（2026-10-04，lib/preferences、lib/preference-learner）。
 *   GET  ?profileId=           偏好卡：开关、条目、改稿量变化、上次学习时间、新生效几条
 *   POST { profileId, action }
 *     learn     现在更新（几十秒，SSE 保活；2 分钟内只能点一次）
 *     add       自己加一条（直接生效）
 *     edit      改一条（改过的不再被学习覆盖）
 *     delete    删掉，并记进「不要再学」
 *     activate  观察中的「现在就用」
 *     enable    打开 / 关闭学习（关闭时可同时清空）
 *     clear     清空重新学
 *     seen      看过了（首页「最近又学到 N 条」清零）
 * 表只许服务端读写，这里每一处都按本人过滤；档案必须是本人的。
 */
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers });
const NOT_READY = '「我的创作偏好」还没开通（数据库没升级），请联系管理员';

async function ownsProfile(userId: string, key: string) {
  if (key === DEFAULT_PROFILE_SCOPE) return true;
  const { data } = await getServiceSupabase().from('user_profiles').select('id').eq('id', key).eq('user_id', userId).maybeSingle();
  return !!data;
}

function view(row: Record<string, unknown> | null) {
  const items = readStoredItems(row?.items);
  return {
    ready: true,
    enabled: row?.enabled !== false,
    items,
    stats: row?.stats ?? null,
    learnedAt: row?.learned_at ?? null,
    newCount: newSince(items, row?.seen_at as string | null),
  };
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const key = validProfileKey(new URL(request.url).searchParams.get('profileId'));
  if (!key) return fail('档案编号不正确');
  if (!(await ownsProfile(guard.userId!, key))) return fail('没有这个档案', 404);
  const { data, error } = await getServiceSupabase().from('creator_preferences').select('*').eq('user_id', guard.userId!).eq('profile_key', key).maybeSingle();
  if (missingTable(error)) return Response.json({ ready: false, enabled: true, items: [], stats: null, learnedAt: null, newCount: 0 }, { headers });
  if (error) return fail('偏好暂时读不到，请稍后再试', 503);
  return Response.json(view(data), { headers });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, userId); } catch { return fail('请求格式不正确'); }
  const key = validProfileKey(body?.profileId);
  if (!key) return fail('档案编号不正确');
  if (!(await ownsProfile(userId, key))) return fail('没有这个档案', 404);
  const db = getServiceSupabase();
  const { data: row, error } = await db.from('creator_preferences').select('*').eq('user_id', userId).eq('profile_key', key).maybeSingle();
  if (missingTable(error)) return fail(NOT_READY, 503);
  if (error) return fail('偏好暂时读不到，请稍后再试', 503);
  const now = Date.now();

  if (body.action === 'learn') {
    if (row?.enabled === false) return fail('学习已关闭，先在右上角打开');
    if (row?.learned_at && now - new Date(row.learned_at).getTime() < 2 * 60_000) return fail('刚更新过，过两分钟再试', 429);
    return sseTask(async () => {
      const r = await learnPreferences(userId, key, { force: true, now });
      if (r.status === 'failed') return { event: 'error', message: r.message };
      const { data: fresh } = await db.from('creator_preferences').select('*').eq('user_id', userId).eq('profile_key', key).maybeSingle();
      return { event: 'result', status: r.status, signals: 'signals' in r ? r.signals : 0, ...view(fresh) };
    }, 'preferences-learn');
  }

  let items: PreferenceItem[] = readStoredItems(row?.items);
  let rejected: string[] = Array.isArray(row?.rejected) ? (row!.rejected as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const patch: Record<string, unknown> = {};
  const id = typeof body.id === 'string' ? body.id : '';

  switch (body.action) {
    case 'add': {
      const item = readUserItem(body.item, now);
      if (!item) return fail('写一句具体的偏好，比如：不用「家人们」');
      if (items.some((i) => sameMeaning(i.text, item.text))) return fail('已经有意思差不多的一条了');
      items = [item, ...items];
      rejected = rejected.filter((r) => !sameMeaning(r, item.text));
      break;
    }
    case 'edit': {
      const old = items.find((i) => i.id === id);
      const next = readUserItem({ ...(body.item as object), id }, now);
      if (!old || !next) return fail('没找到这一条，刷新后再试', 404);
      items = items.map((i) => (i.id === id ? { ...next, firstSeen: old.firstSeen, activeAt: old.activeAt ?? next.firstSeen } : i));
      break;
    }
    case 'delete': {
      const old = items.find((i) => i.id === id);
      if (!old) return fail('没找到这一条，刷新后再试', 404);
      items = items.filter((i) => i.id !== id);
      if (!rejected.some((r) => sameMeaning(r, old.text))) rejected = [old.text, ...rejected].slice(0, 100);
      break;
    }
    case 'activate': {
      if (!items.some((i) => i.id === id)) return fail('没找到这一条，刷新后再试', 404);
      items = items.map((i) => (i.id === id ? { ...i, status: 'active', origin: 'manual', activeAt: new Date(now).toISOString() } : i));
      break;
    }
    case 'enable': {
      patch.enabled = body.enabled !== false;
      if (body.enabled === false && body.clear === true) { items = []; patch.signature = null; patch.stats = null; }
      break;
    }
    case 'clear': {
      items = [];
      rejected = [];
      patch.signature = null;
      patch.learned_at = null;
      break;
    }
    case 'seen': {
      patch.seen_at = new Date(now).toISOString();
      break;
    }
    default:
      return fail('不支持的操作');
  }

  const { data: saved, error: saveError } = await db.from('creator_preferences')
    .upsert({ user_id: userId, profile_key: key, items: settle(items, now), rejected, updated_at: new Date(now).toISOString(), ...patch }, { onConflict: 'user_id,profile_key' })
    .select('*').single();
  if (saveError) return fail('没保存上，请重试', 500);
  return Response.json(view(saved), { headers });
}
