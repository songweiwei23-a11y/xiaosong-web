/** 无档案的旧记录保留在独立范围内，不能当成另一家店的历史。 */
export const DEFAULT_PROFILE_SCOPE = 'default';
export const PROFILE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function historyProfileFilter(profileId: string | null): string | null {
  if (profileId === null) return null; // 全局历史页仍可查看全部档案
  if (profileId === DEFAULT_PROFILE_SCOPE) {
    return 'and(input_data->>profile_id.is.null,input_data->>profileId.is.null)';
  }
  if (!PROFILE_UUID.test(profileId)) throw new Error('档案编号不正确');
  return `input_data->>profile_id.eq.${profileId},input_data->>profileId.eq.${profileId}`;
}

export function profileHistoryQuery(profileId: string | null): string {
  return `&profileId=${encodeURIComponent(profileId || DEFAULT_PROFILE_SCOPE)}`;
}
