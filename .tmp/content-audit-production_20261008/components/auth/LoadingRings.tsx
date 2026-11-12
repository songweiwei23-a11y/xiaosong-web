import { Sparkles } from "lucide-react";

/**
 * 三层同心环 + 中心星标。
 *
 * 单独抽出来是为了让登录 → 路由切换 → 工作台拉数据这三段用同一个动画。
 * 三处各画各的话，用户会连着看到三种不同的加载画面闪过，
 * 那比只有一个转圈更像"卡"。
 *
 * 转速和方向刻意各不相同——三个环同步转会看起来像一个静止的粗环。
 */
export function LoadingRings({ size = 96 }: { size?: number }) {
  const inner = Math.round(size * 0.104);
  const core = Math.round(size * 0.229);

  return (
    <div className="auth-anim relative" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary"
        style={{ animation: "authSpin 1.1s linear infinite" }}
      />
      <span
        className="absolute rounded-full border-2 border-primary/15 border-b-primary/70"
        style={{ inset: inner, animation: "authSpin 1.7s linear infinite reverse" }}
      />
      <span
        className="absolute rounded-full border-2 border-primary/10 border-l-primary/50"
        style={{ inset: core, animation: "authSpin 2.4s linear infinite" }}
      />
      <Sparkles
        className="absolute left-1/2 top-1/2 text-primary"
        style={{
          width: size * 0.25,
          height: size * 0.25,
          animation: "authPulse 1.8s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/** 只表达"在推进"，不冒充真实百分比——估不准的数字不该摆给用户看 */
export function LoadingBar({ width = 224 }: { width?: number }) {
  return (
    <div
      className="auth-anim h-1 overflow-hidden rounded-full bg-foreground/10"
      style={{ width }}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: "38%", animation: "authSlide 1.4s ease-in-out infinite" }}
      />
    </div>
  );
}
