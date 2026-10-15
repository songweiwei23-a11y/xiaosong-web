/**
 * 首页拦截（第一道）的门票（2026-10-16，服务端）。
 *
 * - 管理员发邀请门票（kind = invite）：给某个人，有进门期限和设备数上限，随时可撤销。
 * - 管理员自己有一张长期门票（kind = admin）：新设备上用它直接过第一道，不依赖登录。
 * - 门票原文只在生成时显示一次，库里只存摘要（sha256）。
 * - 用门票进门后，浏览器拿到一个设备通行 Cookie（随机串），库里只存它的摘要。进门后 30 天有效；门票撤销即失效。
 *
 * 读库都有短缓存（设置 30 秒、设备通行 30 秒、管理员身份 60 秒），撤销最多晚 30 秒生效。
 * 读库失败时：设备通行 / 站点开关沿用最近一次的结果；从没读到过就关门（宁可挡住，不敞开）。
 * 数据库里还没有这些表（迁移没跑）时，首页不拦，免得部署后锁站。
 *
 * 纯规则（解析门票、提示语、状态）在 lib/gate-ticket-format，前后端共用。
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@/lib/supabase/fetch';
import { ticketStatus, type TicketKind, type TicketStatus } from '@/lib/gate-ticket-format';

/**
 * 设备通行在服务器上保留的天数。浏览器里它是会话 Cookie（关掉浏览器就没了），这里只是兜底：
 * 一天以后不管怎样都失效。登录了的账号不靠它（见 lib/site-gate）。
 */
export const DEVICE_PASS_DAYS = 1;
export const ADMIN_MAX_DEVICES = 10;

const TTL_SETTINGS_MS = 30_000;
const TTL_PASS_MS = 30_000;
const TTL_ADMIN_MS = 60_000;

/** 随机串（密码学随机数）：门票用 24 字节（32 位），设备通行用 32 字节 */
export function newSecret(bytes = 24): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 摘要：库里存的、Cookie 比对用的都是它，原文不落库 */
export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kaiwu-gate:v2:${secret}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ───── 库操作 ─────

const MISSING_SCHEMA = /does not exist|Could not find the table|Could not find the function|schema cache|42P01|42883|PGRST20[45]/i;

function isMissingSchema(e: unknown): boolean {
  const detail = e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ''}` : String(e);
  return MISSING_SCHEMA.test(detail);
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: supabaseFetch },
  });
}

interface Cached<T> { at: number; value: T }
let settingsCache: Cached<boolean> | null = null;
const passCache = new Map<string, Cached<boolean>>();
const adminCache = new Map<string, Cached<boolean>>();

/** 清掉所有缓存：后台改了开关或门票后调用，本进程立即生效 */
export function resetGateCaches(): void {
  settingsCache = null;
  passCache.clear();
  adminCache.clear();
}

function remember<T>(map: Map<string, Cached<T>>, key: string, value: T, now: number) {
  if (map.size > 5000) map.clear();
  map.set(key, { at: now, value });
}

/** 首页拦截开没开。null = 读不到、又没有缓存：按关门处理 */
export async function gateEnabled(now: number = Date.now()): Promise<boolean | null> {
  if (settingsCache && now - settingsCache.at < TTL_SETTINGS_MS) return settingsCache.value;
  try {
    const { data, error } = await db().from('site_gate_settings').select('enabled').eq('id', 1).maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const enabled = data?.enabled === true;
    settingsCache = { at: now, value: enabled };
    return enabled;
  } catch (e) {
    if (isMissingSchema(e)) {
      settingsCache = { at: now, value: false };
      return false;
    }
    return settingsCache ? settingsCache.value : null;
  }
}

/** 管理员身份：和中间件里 /admin 的判断一致（admin_roles 或 user_settings.is_admin） */
export async function isAdminUser(userId: string, now: number = Date.now()): Promise<boolean> {
  const cached = adminCache.get(userId);
  if (cached && now - cached.at < TTL_ADMIN_MS) return cached.value;
  try {
    const [role, settings] = await Promise.all([
      db().from('admin_roles').select('role').eq('user_id', userId).maybeSingle(),
      db().from('user_settings').select('is_admin').eq('user_id', userId).maybeSingle(),
    ]);
    const ok = !!role.data?.role || settings.data?.is_admin === true;
    remember(adminCache, userId, ok, now);
    return ok;
  } catch {
    return false;
  }
}

/** 这台设备的通行证还有效吗：没过期、门票没撤销、管理员门票的主人还是管理员。读不到就当无效 */
export async function devicePassValid(cookieSecret: string, now: number = Date.now()): Promise<boolean> {
  const key = await hashSecret(cookieSecret);
  const cached = passCache.get(key);
  if (cached && now - cached.at < TTL_PASS_MS) return cached.value;
  try {
    const { data, error } = await db()
      .from('gate_device_passes')
      .select('expires_at, ticket:gate_tickets(kind, revoked_at, created_by)')
      .eq('cookie_hash', key)
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const ticket = data?.ticket as { kind: TicketKind; revoked_at: string | null; created_by: string } | null | undefined;
    let ok = !!data && new Date(data.expires_at).getTime() > now && !!ticket && !ticket.revoked_at;
    if (ok && ticket!.kind === 'admin') ok = await isAdminUser(ticket!.created_by, now);
    remember(passCache, key, ok, now);
    return ok;
  } catch {
    return cached ? cached.value : false;
  }
}

export type ClaimResult = { ok: true; cookieSecret: string } | { ok: false; reason: string };

/** 用门票进门：成功返回设备通行 Cookie 的原文（只在这一刻给浏览器，库里只有摘要） */
export async function claimTicket(secret: string): Promise<ClaimResult> {
  const secretHash = await hashSecret(secret);
  const { data: ticket, error } = await db()
    .from('gate_tickets')
    .select('kind, created_by')
    .eq('secret_hash', secretHash)
    .maybeSingle();
  if (error) return { ok: false, reason: 'unavailable' };
  if (!ticket) return { ok: false, reason: 'not_found' };
  // 管理员门票：主人已经不是管理员，就不认了
  if (ticket.kind === 'admin' && !(await isAdminUser(ticket.created_by))) return { ok: false, reason: 'invalid' };

  const cookieSecret = newSecret(32);
  const { data, error: rpcError } = await db().rpc('claim_gate_ticket', {
    p_secret_hash: secretHash,
    p_cookie_hash: await hashSecret(cookieSecret),
    p_device_days: DEVICE_PASS_DAYS,
  });
  if (rpcError) return { ok: false, reason: 'unavailable' };
  const result = data as { ok?: boolean; reason?: string } | null;
  if (!result?.ok) return { ok: false, reason: result?.reason ?? 'invalid' };
  resetGateCaches();
  return { ok: true, cookieSecret };
}

/** 给一张门票补发一台设备的通行证（管理员开拦截、重新生成门票时，让自己当前的浏览器不被挡住） */
async function issueDevicePass(ticketId: string): Promise<string> {
  const cookieSecret = newSecret(32);
  const { error } = await db().from('gate_device_passes').insert({
    cookie_hash: await hashSecret(cookieSecret),
    ticket_id: ticketId,
    expires_at: new Date(Date.now() + DEVICE_PASS_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`发放设备通行失败：${error.message}`);
  return cookieSecret;
}

export interface CreatedTicket { id: string; secret: string; devicePass?: string }

/** 发一张邀请门票，原文只返回这一次 */
export async function createInviteTicket(input: {
  label: string;
  claimDays: number;
  maxDevices: number;
  createdBy: string;
}): Promise<CreatedTicket> {
  const secret = newSecret(24);
  const claimUntil = new Date(Date.now() + input.claimDays * 86_400_000).toISOString();
  const { data, error } = await db()
    .from('gate_tickets')
    .insert({
      kind: 'invite',
      secret_hash: await hashSecret(secret),
      label: input.label.slice(0, 200),
      created_by: input.createdBy,
      claim_until: claimUntil,
      max_devices: input.maxDevices,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || '生成门票失败');
  return { id: data.id, secret };
}

/**
 * 管理员自己的长期门票。重新生成时，旧的管理员门票立即作废；
 * 当前这台浏览器会拿到新门票的设备通行，不会被挡在外面。
 */
export async function createAdminTicket(adminId: string): Promise<CreatedTicket> {
  const now = new Date().toISOString();
  const { error: revokeError } = await db()
    .from('gate_tickets')
    .update({ revoked_at: now })
    .eq('kind', 'admin')
    .eq('created_by', adminId)
    .is('revoked_at', null);
  if (revokeError) throw new Error(revokeError.message);

  const secret = newSecret(24);
  const { data, error } = await db()
    .from('gate_tickets')
    .insert({
      kind: 'admin',
      secret_hash: await hashSecret(secret),
      label: '管理员长期门票',
      created_by: adminId,
      max_devices: ADMIN_MAX_DEVICES,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || '生成管理员门票失败');
  // 第一次有管理员门票时，首页拦截自动开起来，之后默认一直开着。
  // ignoreDuplicates：已经有设置（比如管理员手动关过）就不动它，免得重新生成门票时把它又打开
  const { error: gateError } = await db()
    .from('site_gate_settings')
    .upsert(
      { id: 1, enabled: true, updated_at: new Date().toISOString(), updated_by: adminId },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  if (gateError) throw new Error(`开启首页拦截失败：${gateError.message}`);
  resetGateCaches();
  const devicePass = await issueDevicePass(data.id);
  return { id: data.id, secret, devicePass };
}

/** 撤销一张门票：它发出去的所有设备通行都立即失效（约 30 秒内生效） */
export async function revokeTicket(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from('gate_tickets')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)
    .select('id');
  if (error) throw new Error(error.message);
  resetGateCaches();
  return (data?.length ?? 0) > 0;
}

export interface TicketRow {
  id: string;
  kind: TicketKind;
  label: string;
  created_at: string;
  claim_until: string | null;
  max_devices: number;
  devices_used: number;
  revoked_at: string | null;
  last_claimed_at: string | null;
  status: TicketStatus;
}

export async function listTickets(now: number = Date.now()): Promise<TicketRow[]> {
  const { data, error } = await db()
    .from('gate_tickets')
    .select('id, kind, label, created_at, claim_until, max_devices, devices_used, revoked_at, last_claimed_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    ...t,
    kind: t.kind as TicketKind,
    status: ticketStatus({ kind: t.kind as TicketKind, revoked_at: t.revoked_at, claim_until: t.claim_until, devices_used: t.devices_used, max_devices: t.max_devices }, now),
  }));
}

export async function hasActiveAdminTicket(adminId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('gate_tickets')
    .select('id')
    .eq('kind', 'admin')
    .eq('created_by', adminId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * 开启或关闭首页拦截。开启时要求当前管理员有自己的长期门票，并给他当前这台浏览器补发一个设备通行，
 * 否则开了拦截自己也进不去。返回：开启时的设备通行原文（要写进 Cookie）。
 */
export async function setGateEnabled(enabled: boolean, adminId: string): Promise<string | null> {
  let devicePass: string | null = null;
  if (enabled) {
    const { data: adminTicket, error } = await db()
      .from('gate_tickets')
      .select('id')
      .eq('kind', 'admin')
      .eq('created_by', adminId)
      .is('revoked_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!adminTicket) throw new Error('请先生成你的管理员门票，再开启首页拦截');
    devicePass = await issueDevicePass(adminTicket.id);
  }
  const { error } = await db()
    .from('site_gate_settings')
    .upsert({ id: 1, enabled, updated_at: new Date().toISOString(), updated_by: adminId }, { onConflict: 'id' });
  if (error) {
    throw new Error(isMissingSchema(error) ? '首页拦截还没有建表，请先执行 supabase/migrations/20261016_gate_tickets.sql' : error.message);
  }
  resetGateCaches();
  return devicePass;
}

/** 应急登录（提示页上的管理员邮箱 + 密码 + 验证器码）开没开。缺字段或读不到都按关闭处理 */
let adminLoginCache: Cached<boolean> | null = null;
export async function gateAdminLoginEnabled(now: number = Date.now()): Promise<boolean> {
  if (adminLoginCache && now - adminLoginCache.at < TTL_SETTINGS_MS) return adminLoginCache.value;
  try {
    const { data, error } = await db().from('site_gate_settings').select('admin_login').eq('id', 1).maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const enabled = data?.admin_login === true;
    adminLoginCache = { at: now, value: enabled };
    return enabled;
  } catch {
    return adminLoginCache ? adminLoginCache.value : false;
  }
}

export async function setAdminLoginEnabled(enabled: boolean, adminId: string): Promise<void> {
  const { error } = await db()
    .from('site_gate_settings')
    .upsert(
      { id: 1, admin_login: enabled, updated_at: new Date().toISOString(), updated_by: adminId },
      { onConflict: 'id' },
    );
  if (error) {
    throw new Error(isMissingSchema(error) ? '还没有执行应急登录的迁移：supabase/migrations/20261017_gate_admin_login.sql' : error.message);
  }
  adminLoginCache = null;
}

/**
 * 作废这台设备的首页通行（退出登录时用）。通行的原文只在浏览器 Cookie 里，这里按摘要删掉库里那一行，
 * 所以就算 Cookie 被复制到别处，也用不了了。之后这台设备再打开首页，必须重新凭邀请链接或门票进门。
 */
export async function revokeDevicePass(cookieSecret: string): Promise<void> {
  const { error } = await db().from('gate_device_passes').delete().eq('cookie_hash', await hashSecret(cookieSecret));
  if (error) throw new Error(error.message);
  resetGateCaches();
}

/**
 * 给管理员签发一台设备的通行（应急登录成功后用）：有有效的管理员门票就用它，没有就新发一张。
 */
export async function issueAdminDevicePass(adminId: string): Promise<string> {
  const { data, error } = await db()
    .from('gate_tickets')
    .select('id')
    .eq('kind', 'admin')
    .eq('created_by', adminId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    const pass = await issueDevicePass(data.id);
    resetGateCaches();
    return pass;
  }
  const created = await createAdminTicket(adminId);
  if (!created.devicePass) throw new Error('发放设备通行失败');
  return created.devicePass;
}
