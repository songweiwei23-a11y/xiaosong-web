/**
 * 抖音链接是哪一种（2026-11-10，见 app/api/douyin-link）：
 *   short   分享短链接（v.douyin.com/xxx），要跟一遍跳转才知道是什么
 *   profile 账号主页（www.douyin.com/user/xxx，或 App 分享页 iesdouyin.com/share/user/xxx）
 *   work    作品（/video/xxx、/note/xxx、/share/video/xxx，或带 modal_id 的）
 *   other   别的（首页、搜索页……）：插件打开了也采不了
 */
export type DouyinLinkKind = 'short' | 'profile' | 'work' | 'other';

export function isDouyinHost(host: string): boolean {
  return /(^|\.)(douyin|iesdouyin)\.com$/i.test(host);
}

export function classifyDouyinUrl(raw: string): DouyinLinkKind {
  let u: URL;
  try { u = new URL(raw); } catch { return 'other'; }
  if (!isDouyinHost(u.hostname)) return 'other';
  if (/^v\.douyin\.com$/i.test(u.hostname)) return 'short';
  const p = u.pathname;
  if (/^\/(?:share\/)?user\/(?!self\b)[\w-]+/.test(p)) return 'profile';
  if (/^\/(?:share\/)?(?:video|note)\/\d+/.test(p) || u.searchParams.has('modal_id')) return 'work';
  return 'other';
}

/** 插件只在 www.douyin.com 上运行：App 分享页（iesdouyin.com/share/user/xxx）换成网页版主页地址 */
export function webProfileUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/^\/(?:share\/)?user\/([\w-]+)/);
    if (m && !/^www\.douyin\.com$/i.test(u.hostname)) return `https://www.douyin.com/user/${m[1]}`;
    const v = u.pathname.match(/^\/(?:share\/)?(video|note)\/(\d+)/);
    if (v && !/^www\.douyin\.com$/i.test(u.hostname)) return `https://www.douyin.com/${v[1]}/${v[2]}`;
    return u.href;
  } catch {
    return raw;
  }
}

/** 解析失败时给编导的话 */
export const DOUYIN_LINK_BAD = '这个链接打开的不是账号主页（可能复制不全，或者链接过期了）：到抖音 App 里点自己头像进主页 →「分享主页」→「复制链接」，整段粘过来再点；电脑上也可以直接复制浏览器地址栏里的主页地址';
