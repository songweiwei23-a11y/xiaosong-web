'use client';
import { useCallback, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
export function WebSearchQuota() {
  const [quota, setQuota] = useState<{ limit: number; remaining: number; plan: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/web-search/quota', { cache: 'no-store' });
      if (!response.ok) throw new Error('quota unavailable');
      setQuota(await response.json()); setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => {
    void refresh(); window.addEventListener('web-search-quota-updated', refresh);
    return () => window.removeEventListener('web-search-quota-updated', refresh);
  }, [refresh]);
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
    <Globe className="h-3.5 w-3.5" />
    {failed ? '联网额度暂时无法查询' : !quota ? '正在查询联网额度…' : `联网${quota.plan === 'free' ? '体验' : '本期'}剩余 ${quota.remaining} / ${quota.limit} 次`}
    {failed && <button type="button" onClick={() => void refresh()} className="text-primary hover:underline">重试</button>}
    {quota?.remaining === 0 && <span>· 可继续基于已有资料创作</span>}
  </span>;
}
