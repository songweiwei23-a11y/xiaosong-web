"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getActiveProfileId, onActiveProfileChange } from '@/lib/active-profile';
import { ACTIVE_GENERATION_STATUSES, scopedGenerationTaskType } from '@/lib/generation-scope';

export type GenerationTaskView = {
  id: string;
  profile_id: string | null;
  feature: string;
  task_type: string;
  request_id: string;
  status: string;
  stage: string;
  error_code: string | null;
  error_message: string | null;
  created_at?: string;
  latest?: { version: number; kind: 'draft' | 'processed' | 'final'; stage: string; result: string; created_at: string; metadata?: Record<string, unknown> } | null;
};

const legacyPrefix = 'kaiwu:generation-task:';

export function sameTaskScope(task: Pick<GenerationTaskView, 'task_type' | 'profile_id'>, taskType: string, profileId: string | null) {
  return task.task_type === taskType && task.profile_id === profileId;
}

/**
 * 浏览器只保存任务编号，正文事实在服务端任务表。重新进入、断线或切页后，
 * 可从任务接口恢复草稿或最终版本，不依赖旧页面 state 一直存在。
 */
export function useGenerationTask(baseTaskType: string, onRestore?: (text: string, previous: string | null, task: GenerationTaskView) => void, resolvedProfileId?: string | null, scope?: string | null, requestId?: string) {
  const taskType = scopedGenerationTaskType(baseTaskType, scope);
  const [storedProfileId, setStoredProfileId] = useState<string | null>();
  const profilePending = resolvedProfileId === undefined;
  useLayoutEffect(() => {
    if (!profilePending) return;
    const syncProfile = () => setStoredProfileId(getActiveProfileId());
    syncProfile();
    return onActiveProfileChange(syncProfile);
  }, [profilePending]);
  // 恢复已保存任务不依赖定位、经营数据等生成上下文。归属仍由服务端和任务档案共同校验。
  const profileId = profilePending ? storedProfileId : resolvedProfileId;
  const [task, setTask] = useState<GenerationTaskView | null>(null);
  const [taskError, setTaskError] = useState('');
  const key = profileId === undefined || scope === null ? '' : 'kaiwu:last-task:' + JSON.stringify([profileId, taskType]);
  const epoch = useRef(0);
  const applied = useRef<{ id: string; version: number; text: string } | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);
  const activeKey = useRef(key);
  useLayoutEffect(() => {
    activeKey.current = key;
    applied.current = null;
    setWatchId(null);
    setTask(null);
    setTaskError('');
    return () => { epoch.current++; activeKey.current = ''; };
  }, [key]);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const remember = useCallback((taskId: string) => {
    try { sessionStorage.setItem(key, taskId); } catch { /* private mode still keeps in-memory state */ }
  }, [key]);

  const load = useCallback(async (taskId: string | null, ticket = epoch.current, legacy = false, preferredId?: string | null) => {
    if (!key || profileId === undefined || activeKey.current !== key || ticket !== epoch.current) return null;
    try {
      const params = new URLSearchParams({
        taskType, ...(profileId ? { profileId } : {}), ...(preferredId ? { preferredId } : {}), ...(requestId ? { requestId } : {}),
      });
      const url = taskId ? `/api/generation-tasks/${encodeURIComponent(taskId)}` : `/api/generation-tasks?${params}`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
      const data = await res.json().catch(() => null) as GenerationTaskView | { error?: string } | null;
      if (ticket !== epoch.current || activeKey.current !== key) return null;
      if ((!taskId && res.ok && data === null) || (taskId && res.status === 404)) return null;
      if (!res.ok || !data || !('id' in data)) {
        if (!legacy) setTaskError((data && 'error' in data && data.error) || '生成任务暂时无法恢复，请稍后重试。');
        return null;
      }
      // 当前档案只能恢复自己的任务；不匹配时既不写页面正文，也不覆盖当前任务状态。
      if (!sameTaskScope(data, taskType, profileId)) return null;
      setTask(data);
      setTaskError('');
      if (data.latest?.result && (applied.current?.id !== data.id || applied.current.version < data.latest.version)) {
        onRestoreRef.current?.(data.latest.result, applied.current?.id === data.id ? applied.current.text : null, data);
        applied.current = { id: data.id, version: data.latest.version, text: data.latest.result };
      }
      setWatchId(ACTIVE_GENERATION_STATUSES.includes(data.status) ? data.id : null);
      remember(data.id);
      return data;
    } catch {
      if (!legacy && ticket === epoch.current) setTaskError('生成任务暂时无法恢复，请检查网络后重试。');
      return null;
    }
  }, [key, profileId, taskType, remember, requestId]);

  const accept = useCallback((next: { taskId: string; requestId?: string; status: string; stage: string }) => {
    if (!key || profileId === undefined || activeKey.current !== key) return;
    epoch.current++;
    setWatchId(null);
    applied.current = null;
    remember(next.taskId);
    setTask((current) => current?.id === next.taskId
      ? { ...current, status: next.status, stage: next.stage }
      : { id: next.taskId, profile_id: profileId, feature: '', task_type: taskType, request_id: next.requestId || '', status: next.status, stage: next.stage, error_code: null, error_message: null, latest: null });
  }, [remember, key, profileId, taskType]);

  const stage = useCallback((next: { taskId: string; status: string; stage: string; message?: string }) => {
    setTask((current) => current?.id === next.taskId ? { ...current, status: next.status, stage: next.stage, error_message: next.message || null } : current);
  }, []);

  const forgetTask = useCallback(() => {
    if (activeKey.current !== key) return;
    epoch.current++;
    applied.current = null;
    setWatchId(null);
    setTask(null);
    setTaskError('');
    try { sessionStorage.removeItem(key); } catch { /* task remains in the server ledger */ }
  }, [key]);

  const restoreLast = useCallback(async () => {
    if (!key) return;
    const ticket = epoch.current;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(key);
    } catch { /* The server lookup also works without browser storage. */ }
    if (await load(null, ticket, false, id) || ticket !== epoch.current || requestId) return;
    try {
      // Migrate IDs recorded by older clients only after the server confirms their scope.
      for (const legacyKey of Object.keys(sessionStorage).filter(item => item.startsWith(legacyPrefix)).reverse().slice(0, 8)) {
        if (ticket !== epoch.current) break;
        const oldId = sessionStorage.getItem(legacyKey);
        if (oldId && await load(oldId, ticket, true)) {
          remember(oldId);
          break;
        }
      }
    } catch { /* no session storage available */ }
  }, [key, load, remember, requestId]);

  useEffect(() => { void restoreLast(); }, [restoreLast]);
  useEffect(() => {
    if (!watchId) return;
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const updated = await load(watchId);
      if (!stopped && (!updated || ACTIVE_GENERATION_STATUSES.includes(updated.status))) {
        timeout = setTimeout(tick, 3000);
      }
    };
    timeout = setTimeout(tick, 2000);
    return () => { stopped = true; clearTimeout(timeout); };
  }, [watchId, load]);
  return { task, taskError, acceptTask: accept, updateTaskStage: stage, restoreTask: load, restoreLastTask: restoreLast, forgetTask };
}
