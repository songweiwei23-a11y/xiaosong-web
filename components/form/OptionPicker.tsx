"use client";

import { useEffect, useState } from "react";
import type { Option } from "@/lib/profile-options";
import { joinSelections, splitSelections } from "@/lib/profile-options";

/**
 * 多选 + 其他，存回 text 列。
 *
 * 【为什么不复用档案页里原来那个 MultiSelectWithCustom】那个组件把颜色
 * 写死成内联样式（白底、#374151 文字、浅紫渐变面板），暗色主题下整片
 * 格格不入——和之前那批对比度问题是同一类。而且它只认 text[] 字段，
 * 这次要改的恰恰是一批 text 字段。
 *
 * 【为什么要显示「为什么问这个」】填写率低不只是因为要打字，
 * 也因为用户不知道填了有什么用。把用途写在旁边，比加一个红星管用。
 */

interface Props {
  label: string;
  /** 填了有什么用。空着就不显示 */
  why?: string;
  options: Option[];
  /** 当前存的值（顿号分隔的字符串） */
  value: string | null | undefined;
  onChange: (next: string) => void;
  allowOther?: boolean;
  /** 建议最多勾几个——勾满不拦着，只是提示，重点太多等于没重点 */
  maxHint?: number;
  columns?: 1 | 2 | 3;
}

export function OptionPicker({
  label,
  why,
  options,
  value,
  onChange,
  allowOther = true,
  maxHint,
  columns = 2,
}: Props) {
  const parsed = splitSelections(value, options);
  const [selected, setSelected] = useState<string[]>(parsed.selected);
  const [other, setOther] = useState(parsed.other);

  // 外部换了档案（比如切换编辑对象）时跟着重置。
  // 只在 value 真的变化时同步，否则会把用户正在输入的「其他」冲掉
  useEffect(() => {
    const p = splitSelections(value, options);
    setSelected(p.selected);
    setOther(p.other);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value ?? ""]);

  const emit = (sel: string[], oth: string) => {
    setSelected(sel);
    setOther(oth);
    onChange(joinSelections(sel, oth));
  };

  const toggle = (v: string) => {
    emit(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v], other);
  };

  const over = maxHint != null && selected.length > maxHint;

  return (
    <div className="space-y-2.5">
      <div>
        <label className="block text-[13px] font-medium text-foreground">
          {label}
          {maxHint != null && (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              建议选 {maxHint} 个以内
            </span>
          )}
        </label>
        {why && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{why}</p>}
      </div>

      <div
        className={`grid gap-1.5 ${
          columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              aria-pressed={on}
              title={o.hint || undefined}
              className={`glass-interactive rounded-xl border px-3 py-2 text-left ${
                on ? "glass-selected" : "glass-panel"
              }`}
            >
              <div className={`text-[12.5px] font-medium ${on ? "text-primary" : "text-foreground"}`}>
                {o.value}
              </div>
              {o.hint && (
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{o.hint}</div>
              )}
            </button>
          );
        })}
      </div>

      {over && (
        <p className="text-[11px] text-amber-500">
          已选 {selected.length} 个。选得越多重点越散，AI 会不知道该主推哪个。
        </p>
      )}

      {allowOther && (
        <input
          value={other}
          onChange={(e) => emit(selected, e.target.value)}
          placeholder="上面没有的，写在这里（可不填）"
          className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}
    </div>
  );
}

export default OptionPicker;
