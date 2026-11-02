import { getServiceSupabase } from '@/lib/admin-auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max = 40) => (Array.isArray(v) ? v.filter(Boolean).join('、') : typeof v === 'string' ? v : '').trim().slice(0, max);

/**
 * 联网读需求用的一行档案（lib/search-plan）：行业、赛道、主卖什么、地区。
 * 用户问同行、案例、价格、本地的事却没说行业和地点时，搜索词用它补。只读这几项，读不到就空。
 */
export async function searchProfileHint(userId: string, profileId: unknown): Promise<string> {
  if (typeof profileId !== 'string' || !UUID.test(profileId)) return '';
  try {
    const { data } = await getServiceSupabase()
      .from('user_profiles')
      .select('industry,account_track,product_category,target_region')
      .eq('id', profileId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return '';
    const d = data as Record<string, unknown>;
    return [
      text(d.industry) && `行业：${text(d.industry)}`,
      text(d.account_track) && `赛道：${text(d.account_track)}`,
      text(d.product_category, 60) && `主卖：${text(d.product_category, 60)}`,
      text(d.target_region) && `地区：${text(d.target_region)}`,
    ].filter(Boolean).join('；');
  } catch {
    return '';
  }
}
