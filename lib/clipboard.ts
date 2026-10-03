/**
 * 复制到剪贴板（兼容 http 访问）。
 *
 * 【2026-10-03 线上实测】网站是 http + IP 访问，不是"安全连接"，浏览器根本不提供 navigator.clipboard。
 * 全站 25 处复制按钮直接调它：有的报"复制失败"，写成 navigator.clipboard?.writeText 的那几处更糟——
 * 什么都没复制，却提示"已复制"。
 *
 * 做法：用老办法（临时文本框 + execCommand('copy')）复制；它在 http 下照样能用，只要在点击里同步调用。
 * 并在全站入口给 navigator.clipboard 补上同名接口（installClipboardFallback），25 处调用不用逐个改。
 * 以后上了 HTTPS，浏览器自带的接口在，就不会走这里。
 */

/** 同步复制，成功返回 true。必须在点击等用户操作里直接调用 */
export function copyText(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  // 放在屏幕外、只读：不弹手机键盘、不让页面跳动
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  // 复制前用户选中的文字还原回去
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return ok;
}

/** 浏览器没给剪贴板接口（http 访问）时补一个：writeText 走 copyText，失败就 reject，原来的 try/catch 照常生效 */
export function installClipboardFallback(): void {
  if (typeof navigator === 'undefined' || (navigator.clipboard && typeof navigator.clipboard.writeText === 'function')) return;
  const fallback = {
    writeText: (text: string) => (copyText(String(text ?? '')) ? Promise.resolve() : Promise.reject(new Error('复制失败'))),
    readText: () => Promise.reject(new Error('当前连接不支持读取剪贴板')),
  };
  try {
    Object.defineProperty(navigator, 'clipboard', { value: fallback, configurable: true });
  } catch {
    // 个别浏览器不让改 navigator：不影响页面，只是复制仍不可用
  }
}
