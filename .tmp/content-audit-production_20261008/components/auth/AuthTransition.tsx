"use client";

import { useEffect, useState } from "react";
import { LoadingRings, LoadingBar } from "./LoadingRings";

/**
 * 登录成功到工作台真正出现之间的过渡层。
 *
 * 【为什么需要】登录页原本只在按钮上转圈，而那个圈在真正的等待**开始之前**
 * 就停了：handleAuth 的 finally 立刻 setLoading(false)，然后才 setTimeout
 * 跳转，跳转之后还要等 /dashboard 加载（它挂载后还要并发拉四个接口）。
 * 用户看到的是：转一下 → 停了 → 按钮好像又能点了 → 卡住不动 → 才进去。
 * 那几秒没有任何反馈，就是"卡"的感觉的来源。
 *
 * 【为什么是分阶段文案而不是一个转圈】同样等三秒，一个不动的圈让人怀疑
 * 是不是死了；文案每隔一会儿往前走一步，人就知道它在推进。
 * 这些阶段是按经验节奏推的，不是真实进度——所以只说在做什么，
 * 不报百分比、不说还剩几秒，免得把估不准的数字摆给用户看。
 *
 * 【兜底】万一跳转卡死（网络断了、路由出错），不能让人永远盯着动画。
 */

const STAGES = [
  { at: 0, text: "正在验证身份" },
  { at: 900, text: "正在读取你的账号档案" },
  { at: 2200, text: "正在准备工作台" },
  { at: 4000, text: "马上就好" },
];

/** 超过这么久还没走掉，就认为可能卡住了 */
const STUCK_AFTER = 9000;

export function AuthTransition({
  show,
  name,
  onRetry,
}: {
  show: boolean;
  /** 打个招呼用，没有就不显示 */
  name?: string;
  onRetry?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!show) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - t0), 200);
    return () => clearInterval(timer);
  }, [show]);

  if (!show) return null;

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at) ?? STAGES[0];
  const stuck = elapsed >= STUCK_AFTER;

  return (
    <div
      role="status"
      aria-live="polite"
      className="auth-anim fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl"
      style={{ animation: "authFadeIn .22s ease-out" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
        style={{ background: "radial-gradient(circle,hsl(var(--primary)/.22),transparent 70%)" }}
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="mb-8">
          <LoadingRings />
        </div>

        {name && (
          <p className="mb-1.5 text-[15px] font-medium text-foreground">
            欢迎回来，{name}
          </p>
        )}

        {/* key 换了才会重新播入场动画，让文字"走一步"看得出来 */}
        <p
          key={stage.text}
          className="text-[14px] text-muted-foreground"
          style={{ animation: "authRise .35s ease-out" }}
        >
          {stage.text}
          <span style={{ animation: "authBlink 1.4s steps(4) infinite" }}>…</span>
        </p>

        <div className="mt-6">
          <LoadingBar />
        </div>

        {stuck && (
          <div className="mt-7 max-w-xs">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              比平时慢了一些，可能是网络不稳。
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 text-[12.5px] font-medium text-primary underline underline-offset-4"
              >
                点这里重新试一次
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
