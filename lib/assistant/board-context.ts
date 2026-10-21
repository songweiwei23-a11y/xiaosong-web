import type { CreatorContext, CreatorProfile } from '@/lib/creator-context';
import { BRIEF_TYPE } from '@/lib/creative-brief';
import { ADVICE_TYPE, staleUpstream } from '@/lib/industry-advice';

/**
 * 服务端版的「创作上下文」：和 hooks/useCreatorContext 拼出的内容一致，只是数据靠用户的 Cookie 调现有接口取。
 * 助理调用审稿等板块时，要带上和页面一样的账号背景，模型才不会凭空写。
 *
 * 不含风格预设和创作偏好：那两份在客户端取（fetchActivePreset / fetchActivePreferences），
 * 助理版暂时没有，板块提示词里会少这两段（这一点会在报告里说明）。
 */

export interface BoardContextDeps {
  cookie: string;
  /** 内部接口的地址，例如 http://127.0.0.1:3000 */
  base: string;
  fetchImpl?: typeof fetch;
}

async function getJson(deps: BoardContextDeps, path: string): Promise<unknown> {
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${deps.base}${path}`, { headers: { cookie: deps.cookie }, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

type PositioningRow = {
  profile_id?: string | null;
  positioning_type?: string | null;
  positioning_name?: string | null;
  positioning_description?: string | null;
  full_content?: string | null;
  strategy_summary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const asRows = (v: unknown): PositioningRow[] => (Array.isArray(v) ? (v as PositioningRow[]) : []);

/** 只取这个档案自己的那份；没有才退回没挂档案的老数据（和页面一致，不拿别的号的定位顶上） */
function pickOwn(rows: PositioningRow[], profileId: string | null): PositioningRow | null {
  return (profileId ? rows.find((x) => x.profile_id === profileId) : null) || rows.find((x) => !x.profile_id) || null;
}

export async function loadBoardContext(deps: BoardContextDeps, preferredProfileId: string | null): Promise<CreatorContext> {
  const [profilesRaw, posRaw, brief, advice, content, business] = await Promise.all([
    getJson(deps, '/api/profiles'),
    getJson(deps, `/api/positioning?type=${encodeURIComponent('账号定位')}`),
    getJson(deps, `/api/positioning?type=${encodeURIComponent(BRIEF_TYPE)}`),
    getJson(deps, `/api/positioning?type=${encodeURIComponent(ADVICE_TYPE)}`),
    getJson(deps, `/api/positioning?type=${encodeURIComponent('内容定位')}`),
    getJson(deps, `/api/positioning?type=${encodeURIComponent('商业定位')}`),
  ]);

  const list = Array.isArray(profilesRaw) ? (profilesRaw as CreatorProfile[]) : [];
  const profile: CreatorProfile | null =
    (preferredProfileId && list.find((p) => p.id === preferredProfileId)) || list[0] || null;
  const profileId = profile?.id ?? preferredProfileId ?? null;

  const posRows = asRows(posRaw);
  const ownPos = pickOwn(posRows, profileId);
  const positioning = ownPos
    ? {
        name: ownPos.positioning_name || '账号定位',
        summary: ownPos.strategy_summary || ownPos.full_content || '',
        full: ownPos.full_content || ownPos.strategy_summary || '',
      }
    : null;

  const contentPick = pickOwn(asRows(content), profileId);
  const businessPick = pickOwn(asRows(business), profileId);

  const dealRaw = profileId ? await getJson(deps, `/api/deal-reasons?profileId=${encodeURIComponent(profileId)}`) : null;
  const dealReasons: string[] = Array.isArray((dealRaw as { reasons?: unknown })?.reasons)
    ? ((dealRaw as { reasons: unknown[] }).reasons.filter(Boolean) as string[])
    : [];

  const briefRows = asRows(brief);
  const briefPick = pickOwn(briefRows, profileId);
  const briefText = briefPick?.full_content || null;

  const adviceRows = asRows(advice);
  const ownAdvice = profileId ? adviceRows.find((x) => x.profile_id === profileId) : null;
  const adviceText = ownAdvice?.full_content || null;
  const adviceAt = ownAdvice?.created_at || null;
  const adviceStale = adviceText
    ? staleUpstream(adviceAt, [
        { name: '账号定位', at: ownPos?.created_at ?? null },
        { name: '内容定位', at: contentPick?.created_at ?? null },
        { name: '商业定位', at: businessPick?.created_at ?? null },
      ])
    : [];

  let performance: CreatorContext['performance'] = null;
  if (profileId) {
    const perf = (await getJson(deps, `/api/works/performance?profileId=${encodeURIComponent(profileId)}`)) as
      | { count?: unknown }
      | null;
    if (perf && typeof perf.count === 'number' && perf.count > 0) performance = perf as CreatorContext['performance'];
  }

  // 账号作品概况：和客户端的 useCreatorContext 取的是同一个接口，助理和页面看到的一样
  let workInsight: CreatorContext['workInsight'] = null;
  if (profileId) {
    const got = (await getJson(deps, `/api/work-insights?profileId=${encodeURIComponent(profileId)}`)) as
      | { insight?: CreatorContext['workInsight'] }
      | null;
    workInsight = got?.insight ?? null;
  }

  return {
    profile,
    positioning,
    dealReasons,
    brief: briefText,
    briefAt: briefPick?.updated_at || briefPick?.created_at || null,
    briefFacts: typeof briefPick?.positioning_description === 'string' ? briefPick.positioning_description : null,
    performance,
    workInsight,
    preset: null,
    preferences: null,
    advice: adviceText,
    adviceAt,
    adviceStale,
    contentPositioning: contentPick?.full_content || contentPick?.strategy_summary || null,
    businessPositioning: businessPick?.full_content || businessPick?.strategy_summary || null,
  } as CreatorContext;
}
