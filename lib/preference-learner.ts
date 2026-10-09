/**
 * 我的创作偏好 · 学习（服务端）。规则和提示词在 lib/preferences。
 *
 * 证据从库里现有的数据取，不另加埋点：
 *   - 改稿：各板块「画布改稿」历史（script_history，input_data.canvasOf，第一版是 AI 原稿）+ 自由对话里的画布版本
 *   - 收藏：素材库（真实素材不算，那是事实不是写法）
 *   - 已拍/已发：创作进度里拍了、发了的作品的最终稿（审稿稿优先，其次脚本）
 * 每次都在最近一段时间的证据里整体重算（不靠增量游标），证据没变就不调模型（signature）。
 * 学习不扣任何次数。
 */
import { createHash } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { askDify } from '@/lib/dify-task';
import { historyProfileFilter, DEFAULT_PROFILE_SCOPE, PROFILE_UUID } from '@/lib/profile-history';
import { buildProfileSummary } from '@/lib/profile-summary';
import { todayCN } from '@/lib/web-query';
import {
  MIN_SIGNALS, buildLearnPrompt, diffEdit, editEvidenceText, editRatio, editTrend, mergePreferences, parseLearned, readStoredItems,
  type Evidence, type PreferenceItem,
} from '@/lib/preferences';

type Db = ReturnType<typeof getServiceSupabase>;
const MAX_EDITS = 30, MAX_SAVES = 12, MAX_PUBLISHED = 8, EXCERPT = 700;

export const missingTable = (e: { message?: string } | null | undefined) => !!e && /schema cache|does not exist/i.test(e.message || '');

export function validProfileKey(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '' || raw === DEFAULT_PROFILE_SCOPE) return DEFAULT_PROFILE_SCOPE;
  return typeof raw === 'string' && PROFILE_UUID.test(raw) ? raw : null;
}

interface Collected { evidence: Evidence[]; ratios: number[]; signature: string }

const versionsOf = (v: unknown): { content: string; at: number }[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x.content === 'string').map((x) => ({ content: x.content, at: typeof x.at === 'number' ? x.at : 0 })) : [];

/** 取证据。每一类单独 try：某张表没建（迁移没跑）不影响别的 */
export async function collectEvidence(db: Db, userId: string, profileKey: string): Promise<Collected> {
  const edits: { at: number; board: string; diff: ReturnType<typeof diffEdit>; key: string }[] = [];
  const saves: Evidence[] = [];
  const published: Evidence[] = [];
  const isDefault = profileKey === DEFAULT_PROFILE_SCOPE;

  try {
    let q = db.from('script_history').select('id, task_type, created_at, input_data').eq('user_id', userId)
      .not('input_data->>canvasOf', 'is', null).order('created_at', { ascending: false }).limit(40);
    const f = historyProfileFilter(profileKey);
    if (f) q = q.or(f);
    const { data } = await q;
    for (const r of data ?? []) {
      const v = versionsOf((r.input_data as Record<string, unknown> | null)?.canvasVersions);
      if (v.length < 2) continue;
      const diff = diffEdit(v[0].content, v[v.length - 1].content);
      if (!diff.changed) continue;
      edits.push({ at: v[v.length - 1].at || Date.parse(r.created_at), board: r.task_type, diff, key: `h${r.id}:${v.length}:${diff.changed}` });
    }
  } catch { /* 读不到就少一类证据 */ }

  try {
    let q = db.from('chat_conversations').select('id, messages, updated_at').eq('user_id', userId).eq('kind', 'free_chat')
      .order('updated_at', { ascending: false }).limit(20);
    q = isDefault ? q.is('profile_id', null) : q.eq('profile_id', profileKey);
    const { data } = await q;
    for (const c of data ?? []) {
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      msgs.forEach((m: Record<string, unknown>, i: number) => {
        const v = versionsOf(m?.canvas);
        if (m?.role !== 'assistant' || v.length < 2) return;
        const diff = diffEdit(v[0].content, v[v.length - 1].content);
        if (diff.changed) edits.push({ at: v[v.length - 1].at || Date.parse(c.updated_at), board: '自由对话', diff, key: `c${c.id}:${i}:${v.length}:${diff.changed}` });
      });
    }
  } catch { /* 同上 */ }

  try {
    let q = db.from('material_library').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(MAX_SAVES + 6);
    q = isDefault ? q.is('profile_id', null) : q.eq('profile_id', profileKey);
    const { data } = await q;
    for (const r of data ?? []) {
      if (r.kind === 'real' || typeof r.content !== 'string' || !r.content.trim()) continue;
      if (saves.length >= MAX_SAVES) break;
      saves.push({ id: '', kind: 'save', board: String(r.source || r.category || '素材库'), at: String(r.created_at), text: `${r.kind === 'approved' ? '（他标为认可的好稿）' : ''}${String(r.title || '')}\n${r.content.slice(0, EXCERPT)}` });
    }
  } catch { /* 同上 */ }

  try {
    let q = db.from('works').select('id, title, shoot_status, updated_at').eq('user_id', userId).in('shoot_status', ['shot', 'published'])
      .order('updated_at', { ascending: false }).limit(MAX_PUBLISHED);
    q = isDefault ? q.is('profile_id', null) : q.eq('profile_id', profileKey);
    const { data: works } = await q;
    const ids = (works ?? []).map((w) => w.id);
    if (ids.length) {
      const { data: hist } = await db.from('script_history').select('work_id, task_type, result, created_at').eq('user_id', userId)
        .in('work_id', ids).in('task_type', ['审稿优化', '脚本生成']).order('created_at', { ascending: false }).limit(80);
      for (const w of works ?? []) {
        const rows = (hist ?? []).filter((h) => h.work_id === w.id);
        const best = rows.find((h) => h.task_type === '审稿优化') ?? rows[0];
        const text = typeof best?.result === 'string' ? best.result : best?.result ? JSON.stringify(best.result) : '';
        if (text.trim()) published.push({ id: '', kind: 'published', board: `${w.shoot_status === 'published' ? '已发布' : '已拍摄'}·${best!.task_type}`, at: String(w.updated_at), text: `${w.title}\n${text.slice(0, EXCERPT)}` });
      }
    }
  } catch { /* 同上 */ }

  edits.sort((a, b) => a.at - b.at);
  const ratios = edits.map((e) => editRatio(e.diff));
  const recentEdits = edits.slice(-MAX_EDITS);
  const evidence: Evidence[] = [
    ...recentEdits.map((e) => ({ id: '', kind: 'edit' as const, board: e.board, at: new Date(e.at || Date.now()).toISOString(), text: editEvidenceText(e.diff) })),
    ...saves,
    ...published,
  ].filter((e) => e.text.trim()).map((e, i) => ({ ...e, id: `E${i + 1}` }));
  const signature = createHash('sha1').update(JSON.stringify([recentEdits.map((e) => e.key), saves.map((s) => s.at + s.text.length), published.map((p) => p.at + p.text.length)])).digest('hex');
  return { evidence, ratios, signature };
}

export type LearnResult =
  | { status: 'learned'; items: PreferenceItem[]; signals: number }
  | { status: 'unchanged' | 'not_enough' | 'disabled'; signals: number }
  | { status: 'failed'; message: string };

/**
 * 学一个档案。force = 用户点了「现在更新」，证据没变也重新总结。
 * 写回前重新读一次卡片：学习这几十秒里用户改过、删过的，以最新的为准。
 */
export async function learnPreferences(userId: string, profileKey: string, opts: { force?: boolean; ask?: typeof askDify; now?: number } = {}): Promise<LearnResult> {
  const db = getServiceSupabase();
  const now = opts.now ?? Date.now();
  const { data: row, error } = await db.from('creator_preferences').select('*').eq('user_id', userId).eq('profile_key', profileKey).maybeSingle();
  if (missingTable(error)) return { status: 'failed', message: '「我的创作偏好」还没开通（数据库没升级），请联系管理员' };
  if (error) return { status: 'failed', message: '偏好读取失败，请稍后再试' };
  if (row && row.enabled === false) return { status: 'disabled', signals: 0 };

  const { evidence, ratios, signature } = await collectEvidence(db, userId, profileKey);
  const stats = editTrend(ratios);
  const base = { user_id: userId, profile_key: profileKey, signature, stats, updated_at: new Date(now).toISOString() };
  if (evidence.length < MIN_SIGNALS) {
    await db.from('creator_preferences').upsert(base, { onConflict: 'user_id,profile_key' });
    return { status: 'not_enough', signals: evidence.length };
  }
  if (!opts.force && row?.signature === signature) {
    if (JSON.stringify(row?.stats ?? null) !== JSON.stringify(stats)) await db.from('creator_preferences').upsert(base, { onConflict: 'user_id,profile_key' });
    return { status: 'unchanged', signals: evidence.length };
  }

  let profileSummary = '';
  if (profileKey !== DEFAULT_PROFILE_SCOPE) {
    try {
      const { data: profile } = await db.from('user_profiles').select('*').eq('id', profileKey).eq('user_id', userId).maybeSingle();
      if (profile) profileSummary = buildProfileSummary(profile);
    } catch { /* 没档案摘要也能学，只是少了冲突判断 */ }
  }
  const current = readStoredItems(row?.items);
  const rejected = Array.isArray(row?.rejected) ? (row!.rejected as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const prompt = buildLearnPrompt({ evidence, current, rejected, profileSummary, today: todayCN(now) });
  const ask = opts.ask ?? askDify;
  let ans = await ask(prompt, userId, '');
  if (!ans.ok) ans = await ask(prompt, userId, '');
  if (!ans.ok) return { status: 'failed', message: ans.message };
  const learned = parseLearned(ans.text);
  if (!learned) return { status: 'failed', message: '这次没总结出来，请稍后再试' };

  // 写回前重读：用户在这期间改过、删过、关掉了的，以最新为准
  const { data: fresh } = await db.from('creator_preferences').select('items, rejected, enabled').eq('user_id', userId).eq('profile_key', profileKey).maybeSingle();
  if (fresh && fresh.enabled === false) return { status: 'disabled', signals: evidence.length };
  const freshRejected = Array.isArray(fresh?.rejected) ? (fresh!.rejected as unknown[]).filter((x): x is string => typeof x === 'string') : rejected;
  const items = mergePreferences({ current: fresh ? readStoredItems(fresh.items) : current, learned, evidence, rejected: freshRejected, now });
  const { error: saveError } = await db.from('creator_preferences').upsert({ ...base, items, learned_at: new Date(now).toISOString() }, { onConflict: 'user_id,profile_key' });
  if (saveError) return { status: 'failed', message: '学到的偏好没存上，请稍后再试' };
  return { status: 'learned', items, signals: evidence.length };
}

/**
 * 每晚一次：找出最近一天有新动静的（用户, 档案），逐个学。证据没变的不调模型。
 * 只看「新建」类的动静；在一条旧的画布记录上接着改，第二天别的动静或用户点「现在更新」时会一起学到。
 */
export async function runNightlyPreferences(now = Date.now()) {
  const db = getServiceSupabase();
  const since = new Date(now - 26 * 3600_000).toISOString();
  const pairs = new Map<string, { userId: string; key: string }>();
  const add = (userId: unknown, profile: unknown) => {
    if (typeof userId !== 'string') return;
    const key = validProfileKey(profile);
    if (key) pairs.set(`${userId}:${key}`, { userId, key });
  };
  const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* 某张表读不到不影响别的 */ } };
  await safe(async () => {
    const { data } = await db.from('script_history').select('user_id, input_data').not('input_data->>canvasOf', 'is', null).gte('created_at', since).limit(1000);
    for (const r of data ?? []) add(r.user_id, (r.input_data as Record<string, unknown> | null)?.profileId ?? null);
  });
  await safe(async () => {
    const { data } = await db.from('chat_conversations').select('user_id, profile_id').eq('kind', 'free_chat').gte('updated_at', since).limit(1000);
    for (const r of data ?? []) add(r.user_id, r.profile_id);
  });
  await safe(async () => {
    const { data } = await db.from('material_library').select('user_id, profile_id').gte('created_at', since).limit(1000);
    for (const r of data ?? []) add(r.user_id, r.profile_id);
  });
  await safe(async () => {
    const { data } = await db.from('works').select('user_id, profile_id').in('shoot_status', ['shot', 'published']).gte('updated_at', since).limit(1000);
    for (const r of data ?? []) add(r.user_id, r.profile_id);
  });
  let learned = 0;
  for (const { userId, key } of [...pairs.values()].slice(0, 300)) {
    try {
      const r = await learnPreferences(userId, key, { now });
      if (r.status === 'learned') learned++;
    } catch (e) { console.warn('[preferences] 学习失败', (e as Error).message); }
  }
  console.log(`[preferences] 夜间学习：检查 ${pairs.size} 个档案，更新 ${learned} 个`);
  return { checked: pairs.size, learned };
}

/** 北京时间每天 3 点跑一次（和夜间质检同一时段）。在服务进程里定时，不用改服务器的定时任务 */
let timer: ReturnType<typeof setInterval> | undefined;
let lastDay = '';
export function startPreferenceSchedule() {
  if (timer) return;
  const tick = () => {
    const bj = new Date(Date.now() + 8 * 3600_000);
    const day = bj.toISOString().slice(0, 10);
    if (bj.getUTCHours() !== 3 || lastDay === day) return;
    lastDay = day;
    void runNightlyPreferences().catch((e) => console.warn('[preferences] 夜间学习没跑成', (e as Error).message));
  };
  timer = setInterval(tick, 10 * 60_000);
  timer.unref();
}
