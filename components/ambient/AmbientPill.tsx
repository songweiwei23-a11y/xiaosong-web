"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, SkipForward } from "lucide-react";
import { useAmbient } from "@/hooks/useAmbient";
import { AMBIENT_SOUNDS } from "@/lib/ambient/synth";
import { next, toggle } from "@/lib/ambient/engine";
import { AdaptivePopover } from "@/components/ui/AdaptivePopover";
import { AmbientMixer } from "./AmbientMixer";

/**
 * 顶栏的白噪音条：每个板块都在，样子始终一样。
 *
 * 原来要先在首页点过播放它才出现——在脚本页、选题页想开白噪音，
 * 得先跑回首页。现在一直在：点播放就响，点名字展开和首页一样的完整面板
 * （选声音、叠加、各自音量、总音量、定时），手机上从底部升起。
 *
 * 顶栏在后台的公共框架里，换板块时它不会重新挂载；声音由 lib/ambient/engine
 * 在模块里放，换页面也不会断。
 */
export function AmbientPill() {
  const s = useAmbient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const names = AMBIENT_SOUNDS.filter((x) => s.mix[x.id] !== undefined).map((x) => x.name);

  // 点外面关闭。手机上面板挂在 body 上，不在这棵树里，也要算"里面"
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
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

  const btn =
    "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground";
  return (
    <div ref={rootRef} className="relative">
      <div className="glass-panel flex h-9 items-center gap-0.5 rounded-full px-1 text-[12px] text-muted-foreground">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="白噪音设置"
          aria-expanded={open}
          title="白噪音：选声音、调音量、定时"
          className={`flex h-7 items-center gap-1.5 rounded-full px-2 transition-colors ${
            open ? "bg-foreground/[0.08] text-foreground" : "hover:bg-foreground/[0.06] hover:text-foreground"
          }`}
        >
          <span className={`kw-eq flex h-3 items-end gap-[2px] ${s.playing ? "" : "kw-eq-paused"}`} aria-hidden>
            <span className="w-[2px] rounded-full bg-primary" />
            <span className="w-[2px] rounded-full bg-primary" />
            <span className="w-[2px] rounded-full bg-primary" />
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{names.length ? names.join(" · ") : "白噪音"}</span>
          <ChevronDown className={`hidden h-3 w-3 transition-transform sm:block ${open ? "rotate-180" : ""}`} />
        </button>
        <button type="button" onClick={() => next()} title="切换到下一种声音" aria-label="切换" className={btn}>
          <SkipForward className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => toggle()}
          title={s.playing ? "暂停白噪音" : "播放白噪音"}
          aria-label={s.playing ? "暂停" : "播放"}
          className={`${btn} ${s.playing ? "text-primary" : ""}`}
        >
          {s.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>
      </div>

      <AdaptivePopover
        open={open}
        onClose={() => setOpen(false)}
        panelRef={panelRef}
        desktopClassName="glass absolute right-0 top-11 z-50 w-[320px] rounded-2xl p-4 shadow-2xl"
      >
        <AmbientMixer />
      </AdaptivePopover>
    </div>
  );
}
