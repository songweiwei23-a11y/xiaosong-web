/**
 * 联网搜索（阿里云 OpenSearch 联网搜索 Lite）的服务地址和密钥。只在服务端用。
 *
 * 【为什么要后台设置】原来密钥只填在 Dify 的环境变量里（加密，读不出来），开物服务端自己调不了搜索。
 * 深度研究要在服务端一轮轮地搜、读网页，所以要一份服务端能用的密钥。
 * 2026-10-04 产品方：怕填错。于是做成后台「联网搜索密钥」页——粘进去点「验证并保存」，
 * 先真搜一次，搜通了才保存（app/api/admin/search-key）；保存后只显示「已配置、哪天验证过」，不回显密钥。
 *
 * 读的顺序：后台保存的（app_secrets 表，只有服务端能读）→ 环境变量 ALI_SEARCH_API_KEY / ALI_SEARCH_ENDPOINT。
 */
import { getServiceSupabase } from '@/lib/admin-auth';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function wrappingKey() {
  const secret = process.env.SEARCH_KEY_ENCRYPTION_SECRET || process.env.DIFY_API_KEY;
  if (!secret) throw new Error('搜索密钥加密未配置');
  return createHash('sha256').update(secret).digest();
}
export function sealSearchKey(key: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', wrappingKey(), iv);
  const bytes = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), bytes.toString('base64')].join(':');
}
export function openSearchKey(value: string): string | null {
  if (!value.startsWith('v1:')) return validApiKey(value); // 兼容此前配置，只在服务端读取。
  try {
    const [, iv, tag, body] = value.split(':');
    const decipher = createDecipheriv('aes-256-gcm', wrappingKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return validApiKey(Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8'));
  } catch { return null; }
}

/** Dify 工作流里那个 HTTP 节点用的地址（docs/dify 的 DSL），默认就用它 */
export const DEFAULT_SEARCH_ENDPOINT =
  'https://default-2te6.platform-cn-shanghai.opensearch.aliyuncs.com/v3/openapi/workspaces/default/web-search/ops-web-search-001';
export const SEARCH_SECRET_NAME = 'ali_web_search';

export interface SearchConfig {
  endpoint: string;
  apiKey: string;
  source: 'admin' | 'env';
}

/** 地址只认阿里云 OpenSearch 的 https 地址：防止有人在后台填一个地址，把密钥连同搜索词发到别处 */
export function validEndpoint(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (!/(^|\.)opensearch\.aliyuncs\.com$/i.test(u.hostname)) return null;
  if (!/\/web-search\//.test(u.pathname)) return null;
  return `${u.origin}${u.pathname}`;
}

/** 密钥只做形状检查（长度、不含空白），对不对靠真搜一次 */
export function validApiKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/^Bearer\s+/i, '');
  if (s.length < 16 || s.length > 512 || /\s/.test(s)) return null;
  return s;
}

let cache: { at: number; value: SearchConfig | null } | null = null;
const CACHE_MS = 60_000;

export function clearSearchConfigCache() {
  cache = null;
}

export async function getSearchConfig(): Promise<SearchConfig | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value: SearchConfig | null = null;
  try {
    const { data } = await getServiceSupabase().from('app_secrets').select('value, meta').eq('name', SEARCH_SECRET_NAME).maybeSingle();
    const key = typeof data?.value === 'string' ? openSearchKey(data.value) : null;
    const endpoint = validEndpoint((data?.meta as Record<string, unknown> | null)?.endpoint) || DEFAULT_SEARCH_ENDPOINT;
    if (key) value = { endpoint, apiKey: key, source: 'admin' };
  } catch {
    // 表还没建（迁移没跑）：退回环境变量
  }
  if (!value) {
    const key = validApiKey(process.env.ALI_SEARCH_API_KEY);
    if (key) value = { endpoint: validEndpoint(process.env.ALI_SEARCH_ENDPOINT) || DEFAULT_SEARCH_ENDPOINT, apiKey: key, source: 'env' };
  }
  cache = { at: Date.now(), value };
  return value;
}

/** 给后台看的状态：不含密钥本身 */
export async function searchConfigStatus(): Promise<{ configured: boolean; source?: 'admin' | 'env'; verifiedAt?: string; endpoint?: string; tableMissing?: boolean }> {
  try {
    const { data, error } = await getServiceSupabase().from('app_secrets').select('meta, updated_at').eq('name', SEARCH_SECRET_NAME).maybeSingle();
    if (error && /schema cache|does not exist/i.test(error.message)) return { configured: !!validApiKey(process.env.ALI_SEARCH_API_KEY), source: 'env', tableMissing: true };
    if (data) {
      const meta = (data.meta || {}) as Record<string, unknown>;
      return { configured: true, source: 'admin', verifiedAt: String(meta.verifiedAt || data.updated_at || ''), endpoint: String(meta.endpoint || DEFAULT_SEARCH_ENDPOINT) };
    }
  } catch { /* 读不到按没配处理 */ }
  return validApiKey(process.env.ALI_SEARCH_API_KEY) ? { configured: true, source: 'env' } : { configured: false };
}

export async function saveSearchConfig(endpoint: string, apiKey: string, adminId: string) {
  const now = new Date().toISOString();
  const { error } = await getServiceSupabase().from('app_secrets').upsert({
    name: SEARCH_SECRET_NAME,
    value: sealSearchKey(apiKey),
    meta: { endpoint, verifiedAt: now, encryption: 'aes-256-gcm-v1' },
    updated_at: now,
    updated_by: adminId,
  }, { onConflict: 'name' });
  clearSearchConfigCache();
  if (error) throw new Error(/schema cache|does not exist/i.test(error.message) ? '数据库还没升级：请先执行 supabase/migrations/20261004_deep_research.sql' : '保存失败，请重试');
}
