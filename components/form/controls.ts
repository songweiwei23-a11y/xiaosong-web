/**
 * 表单控件的共用样式。
 *
 * 抽成常量而不是每处写一遍长串类名：八个页面共几十个控件，散着写的结果
 * 就是圆角、内边距、聚焦环各不相同——改版前光 rounded 就有三种值，
 * 有的聚焦时用 focus:border-transparent（边框直接消失，反而看不出焦点在哪）。
 */

const BASE =
  "w-full rounded-xl border border-border bg-background/50 text-[13px] text-foreground " +
  "placeholder:text-muted-foreground/70 transition-colors " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export const INPUT_CLS = `${BASE} px-3 py-2.5`;
export const SELECT_CLS = `${BASE} px-3 py-2.5`;
export const TEXTAREA_CLS = `${BASE} resize-none px-3.5 py-3 leading-relaxed`;

/** 可点选的小标签：平台、时长、元素等多处共用 */
export function chipCls(selected: boolean) {
  return `glass-interactive rounded-lg border px-2.5 py-1.5 text-[12px] ${
    selected ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
  }`;
}

/** 主操作按钮：整页只应有一个 */
export const PRIMARY_BTN =
  "btn-brand flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold disabled:cursor-not-allowed";

/** 次级按钮：复制、下载、保存这类 */
export const SECONDARY_BTN =
  "glass-panel glass-interactive flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium";
