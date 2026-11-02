import type { AccountDiagnosis } from '@/lib/account-diagnosis';

/**
 * 页面上取这个档案最近一次的账号诊断（存在「账号作品概况」那一行里）。取不到返回 null，不影响生成。
 * 地基板块（账号定位、深挖定位、行业建议）生成前用它，见 lib/account-diagnosis 的 foundation 口径。
 */
export async function fetchDiagnosis(profileId: string | null | undefined): Promise<AccountDiagnosis | null> {
  if (!profileId) return null;
  try {
    const res = await fetch(`/api/work-insights?profileId=${encodeURIComponent(profileId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { insight?: { diagnosis?: AccountDiagnosis | null } | null } | null;
    return data?.insight?.diagnosis ?? null;
  } catch {
    return null;
  }
}
