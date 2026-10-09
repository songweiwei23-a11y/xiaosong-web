'use client';
import { useEffect, useRef, useState } from 'react';
import { takeHandoff, type HandoffPayload } from '@/lib/handoff';
import { creationBridgeData, creationBridgePrompt } from '@/lib/creation-bridge';
import { settingsFromInput } from '@/lib/creation-settings';
import { originForResult } from '@/lib/creation-continuation';
import type { CreationContext, CreationTarget } from '@/lib/creation-flow';
import { profileHistoryQuery } from '@/lib/profile-history';

type RecordItem = { result: string; input_data?: Record<string, unknown> | null };

/** 定位/成交分析等无正文框的板块也保留完整交接，并按所选历史版本恢复。 */
export function useCreationBridge(taskType: string, target: CreationTarget | 'creative-brief', profileId: string | null | undefined, loading: boolean) {
  const [payload, setPayload] = useState<HandoffPayload | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const initialProfile = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const data = takeHandoff(`/dashboard/${target}`);
    if (data) setPayload(data);
  }, [target]);
  useEffect(() => {
    if (loading) return;
    const scope = profileId || null;
    if (initialProfile.current !== undefined && initialProfile.current !== scope) {
      initialProfile.current = scope;
      setPayload(current => current && 'profileId' in current && current.profileId === scope ? current : null);
    }
    initialProfile.current = scope;
    setRecords([]);
    const abort = new AbortController();
    fetch(`/api/script-history?taskType=${encodeURIComponent(taskType)}${profileHistoryQuery(scope)}`, { signal: abort.signal })
      .then(r => r.ok ? r.json() : [])
      .then(rows => { if (!abort.signal.aborted && Array.isArray(rows)) setRecords(current => [...current, ...rows]); })
      .catch(() => {});
    return () => abort.abort();
  }, [profileId, loading, taskType]);
  const activePayload = payload && (!('profileId' in payload) || payload.profileId === (profileId || null)) ? payload : null;
  const data = creationBridgeData(activePayload);
  const rememberResult = (result: string, input_data: Record<string, unknown>) => setRecords(current => [{ result, input_data }, ...current.filter(r => r.result !== result)]);
  const flowContext = (result: string): CreationContext => {
    const record = records.find(r => r.result === result);
    return record ? { settings: settingsFromInput(record.input_data), originContent: originForResult(result, [record], '') } : {};
  };
  return { payload: activePayload, ...data, prompt: creationBridgePrompt(activePayload), flowContext, rememberResult };
}
