"use client";

import { useCallback, useEffect, useRef } from 'react';
import { onActiveProfileChange } from '@/lib/active-profile';

/** 请求仍存入原档案的历史，迟到的输出不能写到新档案的页面。 */
export function useProfileRequestGuard() {
  const version = useRef(0);
  useEffect(() => {
    const unsubscribe = onActiveProfileChange(() => { ++version.current; });
    return () => { ++version.current; unsubscribe(); };
  }, []);
  return useCallback(() => {
    const started = version.current;
    return () => version.current === started;
  }, []);
}
