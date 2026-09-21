"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 配色方案的数据与读写逻辑。
 *
 * 与明暗（ThemeProvider）是两个正交的维度：明暗决定亮度，配色决定色相，
 * 两者自由组合，共 5 × 2 种外观。因此不把配色塞进 ThemeProvider，
 * 而是各管各的，避免出现「切了深色就丢配色」这类耦合问题。
 */

export type PaletteId = "default" | "graphite" | "midnight" | "ember" | "teal";

export const PALETTE_STORAGE_KEY = "xiaosong-palette";

/** 未做选择时的默认配色，需与 app/layout.tsx 的首屏脚本保持一致 */
export const DEFAULT_PALETTE: PaletteId = "graphite";

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  desc: string;
  /** 预览色：底色、卡片、强调色。深色模式下的取值，用作色点 */
  swatch: [string, string, string];
}

export const PALETTES: PaletteMeta[] = [
  {
    id: "graphite",
    name: "石墨",
    desc: "近中性冷灰，克制耐看",
    swatch: ["hsl(240 8% 7%)", "hsl(240 7% 15%)", "hsl(220 90% 64%)"],
  },
  {
    id: "midnight",
    name: "墨蓝",
    desc: "深蓝夜色，沉稳专业",
    swatch: ["hsl(220 40% 7%)", "hsl(219 35% 15%)", "hsl(210 90% 62%)"],
  },
  {
    id: "ember",
    name: "暖炭",
    desc: "暖灰香槟金，有温度",
    swatch: ["hsl(30 10% 7%)", "hsl(30 9% 15%)", "hsl(40 85% 62%)"],
  },
  {
    id: "teal",
    name: "松石",
    desc: "深青翡翠，冷静清爽",
    swatch: ["hsl(195 30% 6%)", "hsl(195 25% 14%)", "hsl(165 75% 50%)"],
  },
  {
    id: "default",
    name: "紫霞",
    desc: "紫粉渐变，鲜明活泼",
    swatch: ["hsl(265 35% 7%)", "hsl(265 28% 16%)", "hsl(270 85% 68%)"],
  },
];

export function applyPalette(id: PaletteId) {
  const root = document.documentElement;
  // 紫霞是 globals.css 里的基准配色，不需要 data-palette 覆盖
  if (id === "default") {
    delete root.dataset.palette;
  } else {
    root.dataset.palette = id;
  }
}

export function usePalette() {
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PALETTE_STORAGE_KEY) as PaletteId | null;
      if (stored && PALETTES.some((p) => p.id === stored)) {
        setPaletteState(stored);
      }
    } catch {
      // 隐私模式下 localStorage 可能抛错，用默认值即可
    }
  }, []);

  const setPalette = useCallback((id: PaletteId) => {
    setPaletteState(id);
    applyPalette(id);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
      // 存不下就只在本次会话生效，不影响使用
    }
  }, []);

  return { palette, setPalette };
}
