/**
 * 首页拦截的访问码从哪里来（2026-10-15，服务端）。
 *
 * 顺序：后台设置的（数据库 site_access_settings）优先；没有这一行，用环境变量 SITE_ACCESS_CODE。
 * 读数据库有 30 秒缓存，免得每个页面请求都查一次。读失败时：沿用最近一次读到的结果；
 * 从没读到过，用环境变量；环境变量也没有，就关上门——宁可挡住，也不因为数据库抖一下就敞开。
 * 表还没建（迁移没跑）时按「没有设置」处理，用环境变量，不挡人。
 *
 * 这个文件用 supabase-js 直接连库，不用 next/headers，中间件里也能用。
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@/lib/supabase/fetch';
import { validSiteAccessCode } from '@/lib/site-access-code';

export interface GateSetting {
  code: string;
  enabled: boolean;
  /** unavailable：读不到库、环境变量也没有，此时谁都进不去（code 为空，不能拿来比对） */
  source: 'database' | 'environment' | 'unavailable';
}

type GateRow = { code: string; enabled: boolean } | null;

const TTL_MS = 30_000;
let cache: { at: number; setting: GateSetting | null } | null = null;

export function envGateCode(): string {
  return (process.env.SITE_ACCESS_CODE || '').trim();
}

export function resetGateCache(): void {
  cache = null;
}

/** 数据库那一行优先；没有就用环境变量；两者都没有就是「没有设置」（null，首页不拦） */
export function settingFromRow(row: GateRow, env: string): GateSetting | null {
  if (row && validSiteAccessCode(row.code)) return { code: row.code, enabled: row.enabled, source: 'database' };
  if (env) return { code: env, enabled: true, source: 'environment' };
  return null;
}

const MISSING_TABLE = /does not exist|Could not find the table|schema cache|42P01|PGRST205/i;

export async function loadGateSetting(
  read: () => Promise<GateRow> = readGateRow,
  env: string = envGateCode(),
  now: number = Date.now(),
): Promise<GateSetting | null> {
  if (cache && now - cache.at < TTL_MS) return cache.setting;
  try {
    const setting = settingFromRow(await read(), env);
    cache = { at: now, setting };
    return setting;
  } catch (e) {
    const detail = e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ''}` : String(e);
    if (MISSING_TABLE.test(detail)) {
      const setting = settingFromRow(null, env);
      cache = { at: now, setting };
      return setting;
    }
    // 读不到：沿用最近一次的结果（不更新缓存时间，下次还会再试）
    if (cache) return cache.setting;
    return env
      ? { code: env, enabled: true, source: 'environment' }
      : { code: '', enabled: true, source: 'unavailable' };
  }
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: supabaseFetch },
  });
}

async function readGateRow(): Promise<GateRow> {
  const { data, error } = await serviceClient()
    .from('site_access_settings')
    .select('code, enabled')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return (data as GateRow) ?? null;
}

/** 后台保存访问码和开关。保存后当前进程的缓存立即作废，新码马上生效 */
export async function saveGateSetting(code: string, enabled: boolean, adminId: string): Promise<void> {
  const { error } = await serviceClient()
    .from('site_access_settings')
    .upsert(
      { id: 1, code, enabled, updated_at: new Date().toISOString(), updated_by: adminId },
      { onConflict: 'id' },
    );
  if (error) {
    const missing = MISSING_TABLE.test(error.message);
    throw new Error(missing ? '首页拦截还没有建表，请先执行 supabase/migrations/20261015_site_access_settings.sql' : error.message);
  }
  resetGateCache();
}
