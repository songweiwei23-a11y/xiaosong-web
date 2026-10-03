"use client";
import { useEffect, useRef, useState } from 'react';

/** 大屏与漏斗共用一个通知源；断线自动重连，同时以一秒轮询兜底。 */
export function useRealtimeMonitor() {
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<'realtime' | 'polling' | 'connecting'>('connecting');
  const [connectionError, setConnectionError] = useState('');
  useEffect(() => {
    let lastHeartbeat = 0;
    let connected = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (debounce) return;
      debounce = setTimeout(() => { debounce = undefined; setRevision((v) => v + 1); }, 100);
    };
    const source = new EventSource('/api/admin/monitor/stream');
    source.addEventListener('refresh', () => { lastHeartbeat = Date.now(); refresh(); });
    source.addEventListener('state', (event) => {
      try {
        const state = JSON.parse((event as MessageEvent).data);
        lastHeartbeat = Date.now(); connected = true;
        setMode(state.mode === 'realtime' ? 'realtime' : 'polling');
        setConnectionError(state.error || '');
      } catch { setConnectionError('实时通道响应异常'); }
    });
    source.onerror = () => { connected = false; setMode('connecting'); setConnectionError('实时连接中断，正在重连；暂以每秒刷新更新'); };
    const timer = setInterval(() => {
      if (!connected || Date.now() - lastHeartbeat > 15_000) {
        setMode('connecting'); refresh();
      }
    }, 1000);
    const aging = setInterval(refresh, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      source.close(); clearInterval(timer); clearInterval(aging);
      if (debounce) clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, []);
  return { revision, mode, connectionError };
}

/** 同一路径最多一个在途请求；请求期间的新通知合并为一次补取。 */
export function useMonitorQuery<T>(url: string, revision: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const trigger = useRef<() => void>(() => {});
  const previousRevision = useRef(revision);
  useEffect(() => {
    let alive = true, running = false, dirty = false;
    const controller = new AbortController();
    setData(null); setError('');
    const load = async () => {
      dirty = true;
      if (running) return;
      running = true;
      while (alive && dirty) {
        dirty = false;
        const requestController = new AbortController();
        const cancel = () => requestController.abort();
        controller.signal.addEventListener('abort', cancel, { once: true });
        const timeout = setTimeout(cancel, 15_000);
        try {
          const response = await fetch(url, { cache: 'no-store', signal: requestController.signal });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || `接口返回 ${response.status}`);
          if (alive) { setData(body as T); setError(''); }
        } catch (e) {
          if (alive) setError(e instanceof Error ? e.message : String(e));
        } finally {
          clearTimeout(timeout);
          controller.signal.removeEventListener('abort', cancel);
        }
      }
      running = false;
    };
    trigger.current = () => void load();
    void load();
    return () => { alive = false; controller.abort(); trigger.current = () => {}; };
  }, [url]);
  useEffect(() => {
    if (revision !== previousRevision.current) { previousRevision.current = revision; trigger.current(); }
  }, [revision]);
  return { data, error };
}
