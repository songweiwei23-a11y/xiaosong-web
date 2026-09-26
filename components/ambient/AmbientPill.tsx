"use client";

import { Pause, Play, SkipForward } from "lucide-react";
import { useAmbient } from "@/hooks/useAmbient";
import { AMBIENT_SOUNDS } from "@/lib/ambient/synth";
import { next, toggle } from "@/lib/ambient/engine";

/**
 * 顶栏的白噪音小条：在脚本页、选题页也能暂停、继续、切换，不用回首页找。
 * 放过之后才出现；暂停了也留着（换成继续按钮），方便在别的页面接着放。
 */
export function AmbientPill() {
  const s = useAmbient();
  const names = AMBIENT_SOUNDS.filter((x) => s.mix[x.id] !== undefined).map((x) => x.name);
  if (!s.started || names.length === 0) return null;

  const btn = "rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground";
  return (
    <div className="glass-panel flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-[12px] text-muted-foreground">
      <span className={`kw-eq flex h-3 items-end gap-[2px] ${s.playing ? "" : "kw-eq-paused"}`} aria-hidden>
        <span className="w-[2px] rounded-full bg-primary" />
        <span className="w-[2px] rounded-full bg-primary" />
        <span className="w-[2px] rounded-full bg-primary" />
      </span>
      <span className="ml-1 hidden max-w-[10rem] truncate sm:inline">{names.join(" · ")}</span>
      <button type="button" onClick={() => next()} title="切换到下一种声音" aria-label="切换" className={`ml-1 ${btn}`}>
        <SkipForward className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => toggle()}
        title={s.playing ? "暂停白噪音" : "继续播放"}
        aria-label={s.playing ? "暂停" : "继续播放"}
        className={btn}
      >
        {s.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
