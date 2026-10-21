import Link from "next/link";
import { Gift } from "lucide-react";
import {
  COUNT_PACKS,
  COUNT_PACK_SALES_ENABLED,
  countPackPurchaseBlock,
  type CountPack,
} from "@/lib/config/count-packs";

/** 有效期的说法：365 天写成「12 个月有效」，不写天数 */
export function packValidityText(pack: CountPack): string {
  return pack.validDays === null ? "长期有效" : `${Math.round(pack.validDays / 30)} 个月有效`;
}

/** 销售是否开放（能不能下单）。购买入口和次数包标签只在开放时出现 */
export function countPackOpen(salesOpen: boolean = COUNT_PACK_SALES_ENABLED): boolean {
  return countPackPurchaseBlock(COUNT_PACKS[0].id, salesOpen) === null;
}

/**
 * 首页额度面板里的次数包：一行。左边是名称和规格，右边是余额和购买按钮。
 * 销售关闭时标「即将开放」，不放按钮。余额读不到显示横杠，不显示成 0。
 */
export function CountPackRow({
  balance,
  loading = false,
  salesOpen = COUNT_PACK_SALES_ENABLED,
}: {
  /** 当前可用的次数。null 表示读取失败，不能显示成 0 */
  balance: number | null;
  loading?: boolean;
  /** 销售是否开放。默认取配置开关，测试时可以传入 */
  salesOpen?: boolean;
}) {
  const pack = COUNT_PACKS[0];
  const buyable = countPackOpen(salesOpen);

  let hint: string;
  if (balance === null) hint = "余额暂时读取不到，稍后刷新";
  else if (balance > 0) hint = "会员额度用完后，自动从这里扣";
  else hint = buyable ? "次数用完了，可以再买一次" : "次数用完了，购买开放后可以再买";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
            <Gift className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{pack.displayName}</span>
            {!buyable && (
              <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[10.5px] font-medium text-primary">
                即将开放
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {pack.credits} 次 · {packValidityText(pack)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {loading ? (
            <span className="h-5 w-10 animate-pulse rounded bg-muted" />
          ) : (
            <span className="text-[16px] font-semibold tabular-nums text-foreground">
              {balance ?? "—"}
              <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">次</span>
            </span>
          )}
          {buyable && (
            <Link
              href={`/payment?plan=${pack.id}`}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground hover:opacity-90"
            >
              购买 ¥{pack.price?.toFixed(1)}
            </Link>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * 会员中心「次数包」标签里的大卡片。销售关闭时不渲染。
 * 页面上的切换标签也要先看 countPackOpen，关闭时整个切换不出现。
 */
export function CountPackHero({ salesOpen = COUNT_PACK_SALES_ENABLED }: { salesOpen?: boolean }) {
  const pack = COUNT_PACKS[0];
  if (!countPackOpen(salesOpen)) return null;
  return (
    <section className="glass-panel rounded-2xl border border-border/60 p-6 sm:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-full bg-primary/12 px-3 py-1 text-[12px] font-medium text-primary">
            不限购 · 用完可再买
          </span>
          <h3 className="mt-3 text-2xl font-bold text-foreground">{pack.displayName}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            一次付款，获得 {pack.credits} 次创作额度。会员额度用完后自动使用，次数没有时间限制，不会过期。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[`${pack.credits} 次`, packValidityText(pack), "会员额度优先"].map((c) => (
              <span key={c} className="rounded-full border border-border/60 px-3 py-1 text-[12px] text-foreground/80">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          <span className="text-4xl font-bold tabular-nums text-foreground">¥{pack.price?.toFixed(1)}</span>
          <Link
            href={`/payment?plan=${pack.id}`}
            className="brand-gradient rounded-xl px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            购买次数包
          </Link>
        </div>
      </div>
    </section>
  );
}
