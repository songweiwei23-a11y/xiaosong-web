/**
 * 助理查编导知识库（2026-10-21）：和知识库板块用的是同一批 Dify 知识库，只读检索。
 *
 * - 走 Dify 知识库的检索接口（DIFY_DATASET_API_KEY，dataset- 开头），不走 /api/dify/chat，不扣自由对话额度。
 * - 额度由调用方（lib/assistant/tools.ts）按「知识库查询」预留和结算，和知识库板块一样。
 * - 数据集列表缓存 10 分钟；检索失败返回 null，由调用方如实告诉用户，不编造资料。
 * - 密钥只在服务端读取，不写进代码，也不返回给界面。
 */

export interface KnowledgeHit {
  /** 资料名，例如「开篇36计_完整知识体系精编版」 */
  doc: string;
  content: string;
  /** Dify 给的相关度；有的库不给分，记 0 */
  score: number;
}

export interface DifyKnowledgeConfig {
  base: string;
  key: string;
}

interface DifyRecord {
  score?: number;
  segment?: { content?: string; document?: { name?: string } };
}

/** 最多给模型几段资料 */
const TOP_K = 6;
/** 每段资料给模型看的字数上限 */
export const KNOWLEDGE_HIT_CHARS = 900;
/** 问题超过这个长度就截断：知识库检索看的是问题的核心，太长只会稀释 */
const MAX_QUERY_CHARS = 200;
const TIMEOUT_MS = 8000;
const LIST_TTL_MS = 10 * 60 * 1000;

let listCache: { at: number; datasets: { id: string; name: string }[] } | null = null;

/** 读配置：没配置或密钥格式不对就返回 null，不发任何请求 */
export function readKnowledgeConfig(): DifyKnowledgeConfig | null {
  const key = (process.env.DIFY_DATASET_API_KEY ?? '').trim();
  if (!key.startsWith('dataset-')) return null;
  const base = (process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/+$/, '');
  return { base, key };
}

export function knowledgeConfigured(): boolean {
  return readKnowledgeConfig() !== null;
}

/** 测试用：清掉数据集列表的缓存 */
export function resetKnowledgeCache(): void {
  listCache = null;
}

async function difyJson(doFetch: typeof fetch, cfg: DifyKnowledgeConfig, endpoint: string, body?: unknown): Promise<unknown> {
  const res = await doFetch(`${cfg.base}${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`知识库接口 ${endpoint.split('?')[0]} 返回 ${res.status}`);
  return res.json();
}

async function listDatasets(doFetch: typeof fetch, cfg: DifyKnowledgeConfig): Promise<{ id: string; name: string }[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.datasets;
  const r = (await difyJson(doFetch, cfg, '/datasets?page=1&limit=100')) as { data?: { id?: string; name?: string }[] };
  const datasets = (r.data ?? []).filter((d): d is { id: string; name: string } => !!d.id && !!d.name);
  listCache = { at: Date.now(), datasets };
  return datasets;
}

function hitsOf(records: DifyRecord[]): KnowledgeHit[] {
  return records
    .map((rec) => ({
      doc: rec.segment?.document?.name?.trim() || '未命名资料',
      content: (rec.segment?.content ?? '').trim(),
      score: typeof rec.score === 'number' && Number.isFinite(rec.score) ? rec.score : 0,
    }))
    .filter((h) => h.content);
}

/**
 * 在所有知识库里检索，合并后按相关度排，去掉重复的段落，只留前几段。
 *   返回数组（可能为空）：查到了，但没有相关资料
 *   返回 null：没配置、列表读不出来、或者所有库都查不了 —— 调用方要如实说明
 * 某一个库失败不影响其他库。
 */
export async function searchKnowledge(
  question: string,
  opts: { fetchImpl?: typeof fetch; config?: DifyKnowledgeConfig | null } = {},
): Promise<KnowledgeHit[] | null> {
  const cfg = opts.config === undefined ? readKnowledgeConfig() : opts.config;
  if (!cfg) return null;
  const query = question.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_CHARS);
  if (!query) return [];
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const datasets = await listDatasets(doFetch, cfg);
    if (!datasets.length) return [];
    const settled = await Promise.allSettled(
      datasets.map(async (ds) => {
        const r = (await difyJson(doFetch, cfg, `/datasets/${ds.id}/retrieve`, { query })) as { records?: DifyRecord[] };
        return hitsOf(r.records ?? []);
      }),
    );
    if (settled.every((s) => s.status === 'rejected')) return null;
    const hits = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
    const seen = new Set<string>();
    return hits
      .sort((a, b) => b.score - a.score)
      .filter((h) => {
        // 同一段话可能在几个库里都有，只留一条
        const key = h.content.slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, TOP_K);
  } catch {
    return null;
  }
}

/** 给模型看的资料文本：标明每段出自哪篇，并提醒只用来回答方法，无关的不硬套 */
export function knowledgeResultText(hits: KnowledgeHit[]): string {
  const body = hits
    .map((h, i) => `【资料 ${i + 1}】来源：《${h.doc}》\n${h.content.slice(0, KNOWLEDGE_HIT_CHARS)}`)
    .join('\n\n');
  return `编导知识库里找到的相关资料（按相关程度排序）。回答方法类问题以这些资料为准，并写出依据的是哪篇（《资料名》）；与问题无关的资料不要硬套。\n\n${body}`;
}
