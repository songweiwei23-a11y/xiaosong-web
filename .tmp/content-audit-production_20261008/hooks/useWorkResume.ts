"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/components/ui/feedback";
import { fetchWork, workIdFromUrl, type WorkDetail } from "@/lib/resume";
import { hasPendingHandoff } from '@/lib/handoff';
import { usePathname } from 'next/navigation';
import { workCreationHandoff } from '@/lib/creation-work-resume';
import { CREATION_DESTINATIONS, type CreationTarget } from '@/lib/creation-flow';
import type { HandoffPayload } from '@/lib/handoff';

/**
 * 地址上带了 ?work=编号 时，把这个作品取回来交给页面去填。
 *
 * 各页面自己决定填什么：脚本页填选题和最新一版脚本，分镜页填脚本正文和
 * 最新一版分镜……这里只管"取"，不管"填"。
 *
 * 回调用 ref 存：页面每次渲染都会生成新的回调函数，放进依赖会导致反复取。
 */
export function useWorkResume(onWork: (work: WorkDetail, setup: HandoffPayload) => void) {
  const ref = useRef(onWork);
  const pathname = usePathname();
  const incomingCreation = useRef(hasPendingHandoff(pathname || undefined));
  ref.current = onWork;

  useEffect(() => {
    // 刚携带新版本跳过来时，以新稿为准，作品旧稿不能覆盖它。
    if (incomingCreation.current) return;
    const id = workIdFromUrl();
    if (!id) return;
    let cancelled = false;
    fetchWork(id).then((work) => {
      if (cancelled) return;
      if (work) {
        const target = pathname?.split('/')[2] || 'script';
        const safeTarget = CREATION_DESTINATIONS.some(v => v.id === target) ? target as CreationTarget : 'script';
        ref.current(work, workCreationHandoff(work, safeTarget));
      }
      // 取不到要说出来。不说的话页面空着，用户以为是"记忆"又坏了
      else notify("这条作品找不到了，可能已经被删除");
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
