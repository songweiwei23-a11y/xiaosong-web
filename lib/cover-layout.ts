/**
 * 封面图排版（整改 C · 封面图）。纯函数：算字号和换行，画图由组件用 canvas 完成。
 * 不调外部图片服务、不花钱：编导要的是「大字 + 底色」这种能直接发的封面，不是 AI 画图。
 */

export const COVER_WIDTH = 1080;
export const COVER_HEIGHT = 1440;

export interface CoverPreset {
  id: string;
  name: string;
  from: string;
  to: string;
  text: string;
  accent: string;
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: 'warm', name: '暖橙', from: '#ff8a3d', to: '#ffb36b', text: '#ffffff', accent: '#3b1d08' },
  { id: 'dark', name: '夜色', from: '#1f2937', to: '#111827', text: '#ffffff', accent: '#fbbf24' },
  { id: 'fresh', name: '青绿', from: '#10b981', to: '#34d399', text: '#ffffff', accent: '#064e3b' },
  { id: 'paper', name: '米白', from: '#fdf6ec', to: '#f5e6d3', text: '#2b2118', accent: '#c2410c' },
];

export type CoverLayout = 'top' | 'center' | 'bottom';
export const COVER_LAYOUTS: { id: CoverLayout; name: string }[] = [
  { id: 'top', name: '顶部' },
  { id: 'center', name: '居中' },
  { id: 'bottom', name: '底部' },
];

/** 大字能用的字号范围（像素）。太长的标题会往下缩，缩到最小还放不下就截断 */
const MAX_FONT = 150;
const MIN_FONT = 72;
const MAX_LINES = 4;

export interface TitleLayout {
  lines: string[];
  fontPx: number;
  truncated: boolean;
}

/**
 * 把标题排进封面宽度里：中文按一个字一个字量（字宽约等于字号），先试大字号，放不下就逐级缩小。
 * 每行尽量按标点断开；超过 MAX_LINES 行时截断并加省略号。
 */
export function layoutTitle(title: string, widthPx = COVER_WIDTH - 160): TitleLayout {
  const text = title.replace(/\s+/g, ' ').trim();
  if (!text) return { lines: [], fontPx: MAX_FONT, truncated: false };

  for (let font = MAX_FONT; font >= MIN_FONT; font -= 8) {
    const perLine = Math.max(1, Math.floor(widthPx / font));
    const lines = wrap(text, perLine);
    if (lines.length <= MAX_LINES) return { lines, fontPx: font, truncated: false };
  }
  // 最小字号也放不下：按最小字号截断
  const perLine = Math.max(1, Math.floor(widthPx / MIN_FONT));
  const lines = wrap(text, perLine).slice(0, MAX_LINES);
  const last = lines[lines.length - 1];
  lines[lines.length - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : `${last}…`;
  return { lines, fontPx: MIN_FONT, truncated: true };
}

/** 按每行字数断行：优先在标点后面断开，断不开再硬切 */
function wrap(text: string, perLine: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > perLine) {
    const window = rest.slice(0, perLine + 1);
    const cut = Math.max(window.lastIndexOf('，'), window.lastIndexOf('、'), window.lastIndexOf(' '), window.lastIndexOf('！'), window.lastIndexOf('？'));
    const at = cut >= Math.floor(perLine / 2) ? cut + 1 : perLine;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function coverFileName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 20);
  return base ? `${base}-封面.png` : '封面.png';
}
