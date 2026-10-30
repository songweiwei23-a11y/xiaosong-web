"use client";

import { TacticMixBar } from "@/components/workspace/TacticMix";
import { ScriptRoutePicker } from "@/components/workspace/ScriptRoutePicker";

/**
 * 内容规划、创作方向共用的「脚本打法」区（2026-10-30）。
 * 开关关着：按 36 计与四大脚本的比例分（滑条）；开关打开：自己勾选要用的打法，只用勾选的。
 * 两派只选一派，不叠加。开关和勾选都由页面保存，页面据此把 scriptsShare / pickedRoutes 传给提示词。
 */
export function ScriptRouteSection(props: {
  manual: boolean;
  onManual: (v: boolean) => void;
  share: number;
  onShare: (v: number) => void;
  picked: string[];
  onPicked: (v: string[]) => void;
}) {
  const { manual, onManual, share, onShare, picked, onPicked } = props;
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-[12.5px]">
        <span>
          <span className="font-medium text-foreground">自己选脚本结构</span>
          <span className="ml-2 text-[11px] text-muted-foreground">
            {manual ? "已开：只用下面勾选的打法" : "未开：按下面的比例分 36 计和四大脚本"}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-checked={manual}
          checked={manual}
          onChange={(e) => onManual(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </label>
      {manual ? (
        <ScriptRoutePicker multi value={picked} onChange={(v) => onPicked(Array.isArray(v) ? v : [])} />
      ) : (
        <TacticMixBar value={share} onChange={onShare} />
      )}
    </div>
  );
}
