"use client";

import type { ContractReading } from "@/lib/creation-tree";

/**
 * 契约认不出来时的提示（2026-10-31）：认不出一定要说明原因，不能静默回退。
 * node 为空（结构没认出）时下游不能照着它写，要请编导手选；只有缺项时只提醒，不挡住生成。
 */
export function ContractNotice(props: { reading: ContractReading | null; what: string; hint?: string }) {
  const { reading, what, hint } = props;
  if (!reading || reading.problems.length === 0) return null;
  const blocking = !reading.node;
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-[12px] leading-relaxed ${
        blocking
          ? "border-amber-400/60 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-border bg-foreground/[0.03] text-muted-foreground"
      }`}
    >
      <p className="font-medium">{blocking ? `${what}没认出结构，后面的板块不能照着它写` : `${what}有缺项`}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {reading.problems.map((p, i) => (
          <li key={`${p.code}-${i}`}>{p.text}</li>
        ))}
      </ul>
      <p className="mt-1">
        {hint ??
          (blocking
            ? "请在下面手选脚本类型和结构再生成；也可以把选题正文里的「🅰 打法」改成标准写法：36计·第N计 计名，或 四大脚本·结构全名。"
            : "缺的项不影响这一步生成，但后面的板块会少一层约束。")}
      </p>
    </div>
  );
}
