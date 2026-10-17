import { Star } from "lucide-react";
import { MAX_STAR } from "@/lib/newbie-course";

/** 三颗星，拿到几颗就亮几颗。深色、浅色底都能用：空星颜色由调用方定 */
export function StarRow({
  n,
  className = "",
  emptyClassName = "text-muted-foreground/40",
}: {
  n: number;
  className?: string;
  emptyClassName?: string;
}) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${n} 颗星`}>
      {Array.from({ length: MAX_STAR }, (_, k) => (
        <Star key={k} className={`h-3.5 w-3.5 ${k < n ? "fill-amber-400 text-amber-400" : emptyClassName}`} />
      ))}
    </span>
  );
}
