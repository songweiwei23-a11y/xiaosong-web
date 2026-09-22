/**
 * 色调 → 完整 Tailwind 类名。
 *
 * 【为什么必须是完整字面量】Tailwind 在构建时扫描源码，把出现过的类名
 * 收集进产物。`bg-${color}-100` 这种运行时拼出来的字符串它看不见，
 * 对应的样式压根不会生成——写了等于没写。
 *
 * 全站原先有 5 处这么写：后台的会员徽章、数据分析的进度条和功能图标、
 * 价格页的套餐图标。它们的颜色从上线起就没生效过，而且不会报错，
 * 只是「看起来有点素」，所以一直没人发现。
 *
 * 用透明度写法（500/15）而不是 -100/-700：后者在深色主题下会变成
 * 浅底深字的突兀色块，而这个产品有深浅两套主题。
 */
export type Tone = 'gray' | 'blue' | 'purple' | 'orange' | 'green' | 'yellow' | 'red' | 'indigo' | 'pink';

/** 图标底色 + 图标本身的颜色 */
export const TONE_SOFT: Record<Tone, string> = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  orange: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  yellow: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  red: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  pink: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
};

/** 进度条的实心填充色 */
export const TONE_BAR: Record<Tone, string> = {
  gray: 'bg-muted-foreground/40',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-amber-500',
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-500',
  red: 'bg-rose-500',
  indigo: 'bg-indigo-500',
  pink: 'bg-pink-500',
};

export const toneSoft = (tone: string) => TONE_SOFT[tone as Tone] ?? TONE_SOFT.gray;
export const toneBar = (tone: string) => TONE_BAR[tone as Tone] ?? TONE_BAR.gray;

/** 各套餐固定的色调，后台和价格页共用，避免同一个套餐在两处是两个颜色 */
export const PLAN_TONE: Record<string, Tone> = {
  free: 'gray',
  basic: 'blue',
  pro: 'purple',
  enterprise: 'orange',
};

/** 各功能固定的色调，图表上认颜色比认文字快 */
export const FEATURE_TONE: Record<string, Tone> = {
  script: 'blue',
  topic: 'yellow',
  positioning: 'indigo',
  freeChat: 'green',
  storyboard: 'purple',
  review: 'red',
  title: 'pink',
  dealReason: 'orange',
};
