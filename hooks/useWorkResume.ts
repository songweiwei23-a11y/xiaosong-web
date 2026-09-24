"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/components/ui/feedback";
import { fetchWork, workIdFromUrl, type WorkDetail } from "@/lib/resume";

/**
 * 地址上带了 ?work=编号 时，把这个作品取回来交给页面去填。
 *
 * 各页面自己决定填什么：脚本页填选题和最新一版脚本，分镜页填脚本正文和
 * 最新一版分镜……这里只管"取"，不管"填"。
 *
 * 回调用 ref 存：页面每次渲染都会生成新的回调函数，放进依赖会导致反复取。
 */
export function useWorkResume(onWork: (work: WorkDetail) => void) {
  const ref = useRef(onWork);
  ref.current = onWork;

  useEffect(() => {
    const id = workIdFromUrl();
    if (!id) return;
    let cancelled = false;
    fetchWork(id).then((work) => {
      if (cancelled) return;
      if (work) ref.current(work);
      // 取不到要说出来。不说的话页面空着，用户以为是"记忆"又坏了
      else notify("这条作品找不到了，可能已经被删除");
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
