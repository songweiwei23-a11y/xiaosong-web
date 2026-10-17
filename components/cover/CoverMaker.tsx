"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import {
  COVER_HEIGHT,
  COVER_LAYOUTS,
  COVER_PRESETS,
  COVER_WIDTH,
  coverFileName,
  layoutTitle,
  type CoverLayout,
} from "@/lib/cover-layout";

/**
 * 封面图（整改 C · 封面图）：在浏览器里用 canvas 排出「大字 + 底色」封面，3:4，直接下载 PNG。
 * 不调外部图片服务、不花钱；想要 AI 画图的，需要另外选图片服务，这里不做。
 */
export function CoverMaker({ initialTitle = "" }: { initialTitle?: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState("");
  const [presetId, setPresetId] = useState(COVER_PRESETS[0].id);
  const [layout, setLayout] = useState<CoverLayout>("center");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const preset = COVER_PRESETS.find((p) => p.id === presetId) ?? COVER_PRESETS[0];
  const laid = useMemo(() => layoutTitle(title), [title]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = COVER_WIDTH;
    canvas.height = COVER_HEIGHT;

    // 底色：从上到下的渐变
    const grad = ctx.createLinearGradient(0, 0, 0, COVER_HEIGHT);
    grad.addColorStop(0, preset.from);
    grad.addColorStop(1, preset.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

    const font = (px: number, weight = 800) => `${weight} ${px}px "PingFang SC","Microsoft YaHei",sans-serif`;
    const lineGap = laid.fontPx * 1.25;
    const blockH = laid.lines.length * lineGap;
    const sub = subtitle.trim();
    const subPx = 56;

    // 纵向位置：顶部 / 居中 / 底部
    const top = layout === "top" ? 200 : layout === "bottom" ? COVER_HEIGHT - 260 - blockH : (COVER_HEIGHT - blockH) / 2;

    ctx.fillStyle = preset.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = font(laid.fontPx);
    laid.lines.forEach((line, i) => ctx.fillText(line, COVER_WIDTH / 2, top + i * lineGap));

    if (sub) {
      ctx.font = font(subPx, 500);
      ctx.fillStyle = preset.accent;
      ctx.fillText(sub, COVER_WIDTH / 2, top + blockH + 48);
    }
  }, [laid, subtitle, preset, layout]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !title.trim()) {
      notify("先填标题，再下载", "error");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        notify("这次没能生成图片，请再试一次", "error");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = coverFileName(title);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">大字 + 底色，在浏览器里直接生成，3:4 竖版，下载 PNG 就能用。</p>

      <label className="block text-[12px] text-muted-foreground">
        封面大字
        <input
          aria-label="封面大字"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：一元一串，老板亲手烤"
          className="mt-1 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground"
        />
      </label>

      <label className="block text-[12px] text-muted-foreground">
        小字（可不填）
        <input
          aria-label="封面小字"
          value={subtitle}
          maxLength={30}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="例如：锅底现熬，不加香精"
          className="mt-1 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground"
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        {COVER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPresetId(p.id)}
            aria-pressed={presetId === p.id}
            className={`rounded-lg border px-2.5 py-1 text-[12px] ${presetId === p.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: p.from }} />
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {COVER_LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLayout(l.id)}
            aria-pressed={layout === l.id}
            className={`rounded-lg border px-2.5 py-1 text-[12px] ${layout === l.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {l.name}
          </button>
        ))}
      </div>

      {laid.truncated && <p className="text-[11.5px] text-amber-600 dark:text-amber-400">标题太长，已截断。建议缩短到 40 字以内。</p>}

      <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-xl border border-border/60">
        <canvas ref={canvasRef} aria-label="封面预览" className="block h-auto w-full" />
      </div>

      <button
        type="button"
        onClick={download}
        disabled={!title.trim()}
        className="brand-gradient inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
      >
        <Download className="h-4 w-4" />下载封面 PNG
      </button>
    </div>
  );
}
