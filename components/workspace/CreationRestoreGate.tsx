'use client';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { putHandoff } from '@/lib/handoff';
import { getActiveProfileId, setActiveProfileId } from '@/lib/active-profile';
import { CREATION_UUID, readCreationSnapshot } from '@/lib/creation-snapshot';
import { creationRestorePlan, markCreationRestored, wasCreationRestored } from '@/lib/creation-restore';
import { fetchWork } from '@/lib/resume';
import type { HandoffPayload } from '@/lib/handoff';

/**
 * Mount destination forms after durable intent is available, including refresh/new devices.
 *
 * 2026-10-04：创作链接（?creation=）只在第一次打开时把跳转那一刻的需求填进页面。
 * 之后刷新、或者这条作品在这个板块已经生成过新版本（换设备打开旧链接），改由作品恢复（?work=，见 useWorkResume）
 * 取最新采用的稿子和作品需求——不再永远回到跳转时那份不可变快照，把用户后来改过、生成过的覆盖掉。
 */
export function CreationRestoreGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const id = params.get('creation') || '';
  const [ready, setReady] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [otherProfile, setOtherProfile] = useState<HandoffPayload | null>(null);
  const restore = (payload: HandoffPayload) => {
    if (!putHandoff(payload)) { setError('浏览器暂时不能恢复创作需求，请允许本站存储后重试'); return; }
    markCreationRestored(id);
    setOtherProfile(null); setError(''); setReady(id);
  };
  useEffect(() => {
    if (!id) return;
    setError(''); setOtherProfile(null);
    if (!CREATION_UUID.test(id)) { setError('创作链接不正确'); return; }
    const abort = new AbortController();
    fetch(`/api/creation-sessions?id=${encodeURIComponent(id)}`, { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '暂时无法恢复创作需求');
        const payload = readCreationSnapshot(data.payload);
        if (!payload || payload.target !== pathname) throw new Error('此链接属于另一创作板块，请从作品打开对应环节');
        if (abort.signal.aborted) return;
        if (payload.profileId && payload.profileId !== getActiveProfileId()) { setOtherProfile(payload); return; }
        // 有作品时看一眼作品：这个板块在跳转之后已经生成过，就以作品里最新的为准
        const work = payload.workId && !wasCreationRestored(id) ? await fetchWork(payload.workId).catch(() => null) : null;
        if (abort.signal.aborted) return;
        const plan = creationRestorePlan({ id, payload, createdAt: typeof data.created_at === 'string' ? data.created_at : null, work, restoredBefore: wasCreationRestored(id) });
        if (plan === 'snapshot') restore(payload);
        else { markCreationRestored(id); setReady(id); }
      }).catch(e => { if (!abort.signal.aborted) setError(e.message || '网络异常，请重试'); });
    return () => abort.abort();
    // restore runs only for this immutable URL; form changes must never trigger rehydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pathname, retry]);
  if (!id || ready === id) return <>{children}</>;
  return <div className="mx-auto max-w-lg p-6"><div className="glass-panel rounded-2xl p-5 text-sm">
    {otherProfile ? <><p>这条作品属于另一个账号档案，切换后继续，避免混用资料。</p><button className="mt-4 rounded-xl bg-primary px-4 py-2 text-primary-foreground" onClick={() => { setActiveProfileId(otherProfile.profileId || null); restore(otherProfile); }}>切换到作品档案并继续</button></>
      : error ? <><p role="alert">{error}</p><button className="mt-4 text-primary" onClick={() => setRetry(x => x + 1)}>重新恢复</button></>
        : <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />正在恢复本条作品的创作需求…</p>}
  </div></div>;
}
