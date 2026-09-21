"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Check, Palette } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { PALETTES, usePalette, type PaletteId } from "./palettes";

/**
 * 外观设置入口：明暗 + 配色，两个维度自由组合。
 *
 * 合成一个入口而不是并排放两个按钮：它们都属于「外观」，
 * 分开摆会让顶栏出现两个功能相近的控件，用户得先猜哪个是哪个。
 *
 * 组件名保持 ThemeToggle 不变，因为首页、登录页、工作台、后台
 * 共 5 处都在引用它，改名等于同时改 5 个文件而没有实际收益。
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";
  const current = PALETTES.find((p) => p.id === palette) ?? PALETTES[0];

  // 点外面关闭。面板是浮层，不做这个就得专门去点按钮才能收起
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choosePalette = (id: PaletteId) => setPalette(id);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="外观设置"
        aria-expanded={open}
        title="外观设置"
        className={`flex h-9 items-center gap-2 rounded-full border border-border px-3 transition-colors ${
          open ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.06]"
        }`}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-foreground/80" />
        ) : (
          <Sun className="h-4 w-4 text-foreground/80" />
        )}
        {/* 当前配色的色点，不用展开就能看出正在用哪套 */}
        <span
          className="h-3.5 w-3.5 rounded-full border border-white/25"
          style={{ background: current.swatch[2] }}
        />
      </button>

      {open && (
        <div className="glass absolute right-0 top-11 z-50 w-[272px] rounded-2xl p-3 shadow-2xl">
          {/* 明暗 */}
          <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            明暗
          </div>
          <div className="mb-3 flex gap-1 rounded-xl bg-foreground/[0.05] p-1">
            {([
              { id: "light" as const, label: "浅色", icon: Sun },
              { id: "dark" as const, label: "深色", icon: Moon },
            ]).map((m) => {
              const active = theme === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setTheme(m.id)}
                  aria-pressed={active}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm transition-colors ${
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <m.icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* 配色：仅深色可用 */}
          <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            <Palette className="h-3 w-3" />
            配色
            {!isDark && <span className="normal-case tracking-normal">· 仅深色可选</span>}
          </div>

          {!isDark && (
            <p className="mb-2 rounded-lg bg-foreground/[0.05] px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
              浅色是单独设计的一套：它靠阴影分层，每换一个色相都要重新调阴影与对比度才不显脏。
              想换配色请先切到深色。
            </p>
          )}

          {/* 浅色下整组置灰并屏蔽点击，而不是直接隐藏——隐藏会让人以为功能没了 */}
          <div className={`space-y-0.5 ${isDark ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!isDark}>
            {PALETTES.map((p) => {
              const active = palette === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => choosePalette(p.id)}
                  // 名称与选中态都显式声明：色点是纯装饰的 span，
                  // 不加这两个属性，读屏软件只会读出一个没有名字的按钮
                  aria-label={`配色：${p.name}`}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
                    active ? "bg-primary/12" : "hover:bg-foreground/[0.06]"
                  }`}
                >
                  <span className="flex shrink-0 -space-x-1.5">
                    {p.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="h-4.5 w-4.5 rounded-full border border-white/20"
                        style={{ background: c, height: 18, width: 18 }}
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
        </div>
      )}
    </div>
  );
}
