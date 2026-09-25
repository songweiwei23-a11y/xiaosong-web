"use client";

import { BookOpen, AudioLines, CloudRain, Coffee, Flame, Pause, Play, SkipForward, Timer, Volume2, Waves } from "lucide-react";
import { useAmbient } from "@/hooks/useAmbient";
import { useNow } from "@/hooks/useNow";
import { AMBIENT_SOUNDS, type AmbientId } from "@/lib/ambient/synth";
import { next, setMaster, setTimer, setVolume, toggle, toggleSound } from "@/lib/ambient/engine";

const ICONS: Record<AmbientId, React.ComponentType<{ className?: string }>> = {
  rain: CloudRain,
  cafe: Coffee,
  fire: Flame,
  pages: BookOpen,
  waves: Waves,
  brown: AudioLines,
};

/** 定时选项：点一下换下一档，一圈回到"不定时" */
const TIMER_STEPS = [null, 25, 45, 60] as const;

/**
 * 首页的白噪音面板：点声音就开始放，可以叠几种一起听，各自调音量。
 * 声音是在浏览器里现场合成的（见 lib/ambient/synth），切到别的页面也会继续放。
 */
export function AmbientMixer() {
  const s = useAmbient();
  const now = useNow();
  const active = AMBIENT_SOUNDS.filter((x) => s.mix[x.id] !== undefined);

  // 用此刻的真实时间算：useNow 的值最多旧一秒，向上取整会把"45 分钟"显示成 46
  const timerLeft = s.timerEnd && now ? Math.max(0, Math.ceil((s.timerEnd - Date.now()) / 60_000)) : null;
  const nextTimer = () => {
    const i = TIMER_STEPS.indexOf(s.timerMinutes as (typeof TIMER_STEPS)[number]);
    setTimer(TIMER_STEPS[(Math.max(0, i) + 1) % TIMER_STEPS.length]);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">白噪音</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={nextTimer}
            title="定时关闭：25 / 45 / 60 分钟，再点一下取消"
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] tabular-nums transition-colors ${
              s.timerEnd ? "bg-primary/10 text-primary" : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            {timerLeft !== null ? `${timerLeft} 分钟后停` : "定时"}
          </button>
          <button
            type="button"
            onClick={() => next()}
            title="切换到下一种声音"
            aria-label="切换"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggle()}
            aria-label={s.playing ? "暂停" : "播放"}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              s.playing ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/15"
            }`}
          >
            {s.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {AMBIENT_SOUNDS.map((snd) => {
          const Icon = ICONS[snd.id];
          const on = s.mix[snd.id] !== undefined;
          const loading = s.loading.includes(snd.id);
          return (
            <button
              key={snd.id}
              type="button"
              onClick={() => toggleSound(snd.id)}
              aria-pressed={on}
              aria-label={snd.name}
              title={snd.hint}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                on
                  ? s.playing
                    ? "bg-primary/10 text-primary"
                    : "bg-foreground/[0.06] text-foreground/80"
                  : "text-muted-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
              } ${loading ? "animate-pulse" : ""}`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[11px] leading-none">{snd.name}</span>
            </button>
          );
        })}
      </div>

      {active.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {active.map((snd) => (
            <label key={snd.id} className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
              <span className="w-10 shrink-0">{snd.name}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={s.mix[snd.id] ?? 0}
                onChange={(e) => setVolume(snd.id, Number(e.target.value))}
                aria-label={`${snd.name}音量`}
                className="h-1 flex-1 cursor-pointer accent-primary"
              />
            </label>
          ))}
          {/* 总音量一直给：只放一种声音时也要能一把调小 */}
          {active.length > 0 && (
            <label className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
              <span className="flex w-10 shrink-0 items-center gap-1">
                <Volume2 className="h-3 w-3" />
                总
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={s.master}
                onChange={(e) => setMaster(Number(e.target.value))}
                aria-label="总音量"
                className="h-1 flex-1 cursor-pointer accent-primary"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
