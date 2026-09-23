import { LoadingRings } from "@/components/auth/LoadingRings";

/**
 * 路由切换期间的加载态。
 *
 * 原来是一片灰色骨架块。问题不在骨架本身，而在于它夹在
 * 登录页的过渡层和工作台自己的转圈中间——用户连着看到三种不同的
 * 加载画面闪过，比只有一个转圈更像卡。
 * 现在三处用同一个动画，整段等待看起来是连续的。
 */
export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center">
        <LoadingRings size={72} />
        <p className="mt-5 text-[13px] text-muted-foreground">正在准备工作台…</p>
      </div>
    </div>
  );
}
