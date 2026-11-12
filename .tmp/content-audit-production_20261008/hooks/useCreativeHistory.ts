"use client";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { CreativeHistoryInput } from '@/lib/creative-history';
import { postSafely } from '@/lib/safe-post';

/** 未确认入库的结果按账号留在本机，断网后恢复页面会补存；成功即清除备份。 */
export function useCreativeHistory(onSaved: () => void) {
  const [saveError, setSaveError] = useState('');
  const getHistoryOwner = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user.id;
  }, []);
  const save = useCallback(async (input: CreativeHistoryInput) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaveError('尚未保存，请登录后重试保存'); return false; }
    if (input.ownerId && input.ownerId !== session.user.id) return false;
    const key = `kaiwu:pending-history:${session.user.id}:${input.id}`;
    try { localStorage.setItem(key, JSON.stringify(input)); } catch {}
    try {
      // 生成结果动辄上万字：大了自动压缩 / 分块，免得线路差时被切断（lib/safe-post）
      const response = await postSafely('/api/creative-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok || !body.saved) throw new Error(body.error || '历史保存失败');
      try { localStorage.removeItem(key); } catch {}
      setSaveError(''); onSaved(); return true;
    } catch {
      setSaveError('云端暂未保存成功，结果已尝试保留在本机。请重试保存或先复制正文。');
      return false;
    }
  }, [onSaved]);
  const retry = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const prefix = `kaiwu:pending-history:${session.user.id}:`;
    const pending: CreativeHistoryInput[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          try { pending.push(JSON.parse(localStorage.getItem(key) || 'null')); } catch {}
        }
      }
    } catch {}
    for (const input of pending) if (input?.id && !await save(input)) break;
  }, [save]);
  useEffect(() => {
    void retry();
    const onOnline = () => void retry();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [retry]);
  return { saveCreativeHistory: save, saveError, retrySave: retry, getHistoryOwner };
}
