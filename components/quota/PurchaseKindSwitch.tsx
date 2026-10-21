"use client";

import { COUNT_PACKS, COUNT_PACK_SALES_ENABLED } from "@/lib/config/count-packs";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";
import { countPackOpen, packValidityText } from "@/components/quota/CountPackPanel";

/*
 * 购买方式分两类：包月会员（订阅）和次数包（一次付款）。
 * 两张毛玻璃卡分开放，选中的那张高亮，一眼看出是两类。会员中心和首页价格方案共用这一个组件。
 * 销售关闭（countPackOpen 为假）时不渲染，页面只剩套餐。文字里的数字都从配置取。
 */

export type PurchaseKind = "plans" | "pack";

const PACK = COUNT_PACKS[0];

const KINDS: { key: PurchaseKind; title: string; tag: string; desc: string; price: string }[] = [
  {
    key: "plans",
    title: "包月会员",
    tag: "按月订阅",
    desc: "每期额度回满；当期没用完的次数到期清零，不累计到下一期",
    price: `基础会员 ¥${SUBSCRIPTION_PLANS.basic.price} 起 / 月`,
  },
  {
    key: "pack",
    title: "次数包",
    tag: "一次付款",
    desc: `买一批创作次数，${PACK.credits} 次，${packValidityText(PACK)}，不限购，用完可以再买`,
    price: `¥${PACK.price?.toFixed(1)} 一次付款`,
  },
];

export function PurchaseKindSwitch({
  value,
  onChange,
  salesOpen = COUNT_PACK_SALES_ENABLED,
}: {
  value: PurchaseKind;
  onChange: (kind: PurchaseKind) => void;
  /** 销售是否开放。默认取配置开关，测试时可以传入 */
  salesOpen?: boolean;
}) {
  if (!countPackOpen(salesOpen)) return null;
  return (
    <div className="mx-auto mb-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      {KINDS.map((k) => {
        const active = value === k.key;
        return (
          <button
            key={k.key}
            type="button"
            onClick={() => onChange(k.key)}
            aria-pressed={active}
            className={`glass-panel glass-interactive rounded-2xl p-5 text-left ${active ? "glass-selected" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[17px] font-semibold text-foreground">{k.title}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.07] text-muted-foreground"
                }`}
              >
                {active ? "当前查看" : k.tag}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{k.desc}</p>
            <p className="mt-3 text-[14px] font-medium text-foreground">{k.price}</p>
          </button>
        );
      })}
    </div>
  );
}
