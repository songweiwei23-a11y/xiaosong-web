"use client";

import { useEffect, useState } from "react";
import { Palette, Check, X } from "lucide-react";

/**
 * 配色方案切换器。
 *
 * 眼下的用途是选型：配色好不好看必须放进真实界面里看，色卡图没有参考价值。
 * 选定之后，这个组件可以直接删掉（把选中的那套设为默认即可），
 * 也可以留着当成给用户的个性化选项。
 */

export const PALETTE_STORAGE_KEY = "xiaosong-palette";

type PaletteId = "default" | "graphite" | "midnight" | "ember" | "teal";

const PALETTES: {
  id: PaletteId;
  name: string;
  desc: string;
  /** 预览色：底色、卡片色、强调色 */
  swatch: [string, string, string];
}[] = [
  {
    id: "graphite",
    name: "石墨",
    desc: "近中性冷灰，只用蓝色点一下。最克制，也最耐看",
    swatch: ["hsl(240 8% 7%)", "hsl(240 7% 15%)", "hsl(220 90% 64%)"],
  },
  {
    id: "midnight",
    name: "墨蓝",
    desc: "深蓝夜色配天青，沉稳专业，适合久看",
    swatch: ["hsl(220 40% 7%)", "hsl(219 35% 15%)", "hsl(210 90% 62%)"],
  },
  {
    id: "ember",
    name: "暖炭",
    desc: "暖灰底配香槟金，有器物感，市面上少见",
    swatch: ["hsl(30 10% 7%)", "hsl(30 9% 15%)", "hsl(40 85% 62%)"],
  },
  {
    id: "teal",
    name: "松石",
    desc: "深青配翡翠，冷静的科技感，不刺眼",
    swatch: ["hsl(195 30% 6%)", "hsl(195 25% 14%)", "hsl(165 75% 50%)"],
  },
  {
    id: "default",
    name: "紫粉",
    desc: "当前这套。饱和度偏高，做对比用",
    swatch: ["hsl(265 35% 7%)", "hsl(265 28% 16%)", "hsl(270 85% 68%)"],
  },
];

function applyPalette(id: PaletteId) {
  const root = document.documentElement;
  if (id === "default") {
    delete root.dataset.palette;
  } else {
    root.dataset.palette = id;
  }
}

export function PaletteSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<PaletteId>("default");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PALETTE_STORAGE_KEY) as PaletteId | null;
      if (stored) {
        setCurrent(stored);
        applyPalette(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const choose = (id: PaletteId) => {
    setCurrent(id);
    applyPalette(id);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div className="glass w-[300px] rounded-2xl p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-medium text-foreground">配色方案</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            {PALETTES.map((p) => {
              const active = current === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => choose(p.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${
                    active ? "bg-primary/12" : "hover:bg-foreground/[0.06]"
                  }`}
                >
                  {/* 三色预览：底色 / 卡片 / 强调色，叠成一个小圆片 */}
                  <span className="flex shrink-0 -space-x-1.5">
                    {p.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 rounded-full border border-white/20"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {p.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground/80">
            选好告诉我哪套，我把它定为默认并删掉这个按钮。右上角可切换明暗。
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="glass flex h-11 w-11 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105"
        aria-label="切换配色方案"
        title="试配色方案"
      >
        <Palette className="h-5 w-5 text-primary" />
      </button>
    </div>
  );
}
