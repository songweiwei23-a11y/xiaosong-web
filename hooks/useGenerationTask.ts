"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

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
  latest?: { version: number; kind: 'draft' | 'processed' | 'final'; stage: string; result: string; created_at: string } | null;
};

const keyOf = (taskId: string) => `kaiwu:generation-task:${taskId}`;

/**
 * 浏览器只保存任务编号，正文事实在服务端任务表。重新进入、断线或切页后，
 * 可从任务接口恢复草稿或最终版本，不依赖旧页面 state 一直存在。
 */
export function useGenerationTask(onRestore?: (text: string) => void, profileId: string | null = null) {
  const [task, setTask] = useState<GenerationTaskView | null>(null);
  const [taskError, setTaskError] = useState('');
  const restoring = useRef(false);

  const remember = useCallback((taskId: string) => {
    try { sessionStorage.setItem(keyOf(taskId), taskId); } catch { /* private mode still keeps in-memory state */ }
  }, []);

  const load = useCallback(async (taskId: string) => {
    if (!taskId || restoring.current) return null;
    restoring.current = true;
    try {
      const res = await fetch(`/api/generation-tasks/${encodeURIComponent(taskId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null) as GenerationTaskView | { error?: string } | null;
      if (!res.ok || !data || !('id' in data)) {
        setTaskError((data && 'error' in data && data.error) || '生成任务暂时无法恢复，请稍后重试。');
        return null;
      }
      setTask(data);
      setTaskError('');
      if (data.latest?.result) onRestore?.(data.latest.result);
      return data;
    } catch {
      setTaskError('生成任务暂时无法恢复，请检查网络后重试。');
      return null;
    } finally {
      restoring.current = false;
    }
  }, [onRestore]);

  const accept = useCallback((next: { taskId: string; requestId?: string; status: string; stage: string }) => {
    remember(next.taskId);
    setTask((current) => current?.id === next.taskId
      ? { ...current, status: next.status, stage: next.stage }
      : { id: next.taskId, profile_id: profileId, feature: '', task_type: '', request_id: next.requestId || '', status: next.status, stage: next.stage, error_code: null, error_message: null, latest: null });
  }, [remember]);

  const stage = useCallback((next: { taskId: string; status: string; stage: string; message?: string }) => {
    setTask((current) => current?.id === next.taskId ? { ...current, status: next.status, stage: next.stage } : current);
  }, []);

  const restoreLast = useCallback(async () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('kaiwu:generation-task:')) keys.push(key);
      }
      for (const key of keys.reverse()) {
        const id = sessionStorage.getItem(key) || '';
        const restored = await load(id);
        if (restored && (!profileId || restored.profile_id === profileId)) break;
      }
    } catch { /* no session storage available */ }
  }, [load, profileId]);

  useEffect(() => { void restoreLast(); }, [restoreLast]);
  return { task, taskError, acceptTask: accept, updateTaskStage: stage, restoreTask: load, restoreLastTask: restoreLast };
}
