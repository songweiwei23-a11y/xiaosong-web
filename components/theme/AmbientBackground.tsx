/**
 * 页面背景的氛围层：几团极淡的色光 + 细网格。
 *
 * 这一层是毛玻璃质感的前提。半透明卡片必须有东西可透，若背景是一整片纯色，
 * 玻璃就只是一块灰板——加再多 blur 也出不来效果。
 *
 * 实现上的三点考量：
 * - fixed + pointer-events-none：不参与布局、不挡点击，滚动时光晕保持不动，
 *   内容在光斑上滑过才有"景深"；跟着滚会晃眼。
 * - 用 CSS 径向渐变而不是图片：任意分辨率都不糊，且随主题变量自动换色。
 * - 不做动画：常驻的大面积动画会持续占用合成器，笔记本上能明显听见风扇。
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 底色。深浅主题各自的背景色，作为光晕的画布 */}
      <div className="absolute inset-0 bg-background" />

      {/* 左上：主色光团 */}
      <div
        className="absolute -left-[10%] -top-[15%] h-[55vh] w-[55vw] rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--glow-primary) / var(--glow-opacity)) 0%, transparent 70%)',
        }}
      />

      {/* 右上：强调色光团，与主色拉开色相，交界处产生色彩过渡 */}
      <div
        className="absolute -right-[15%] top-[5%] h-[50vh] w-[50vw] rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--glow-accent) / var(--glow-opacity)) 0%, transparent 70%)',
        }}
      />

      {/* 左下：补一团弱光，避免长页面往下滚之后背景变成死黑 */}
      <div
        className="absolute -bottom-[20%] left-[15%] h-[45vh] w-[45vw] rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--glow-primary) / calc(var(--glow-opacity) * 0.7)) 0%, transparent 70%)',
        }}
      />

      {/* 细网格：给玻璃一点可参照的纹理，透过卡片能看到极淡的线，质感来源之一 */}
      <div
        className="absolute inset-0 opacity-[0.15] dark:opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)',
        }}
      />
    </div>
  );
}
