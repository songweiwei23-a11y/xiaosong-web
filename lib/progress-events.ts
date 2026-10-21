/**
 * 「进度」变了：账号档案、定位（含创作简报）、作品的增删改成功之后调用。
 *
 * 为什么要有这个：引导（顶栏小条、首页大卡）和「先打地基」清单都要看这些数据。
 * 同一个页面里保存了定位，不切换页面也要马上更新，所以不能只靠路由变化。
 *
 * 写入成功之后一律调用 notifyProgressChanged()。tests/guide.test.ts 里有一条测试会检查
 * 写入这三类数据的文件都调用了它，漏了会在测试里失败。
 */

export const PROGRESS_CHANGED = 'kaiwu:progress-changed';

export function notifyProgressChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROGRESS_CHANGED));
}

/** 订阅进度变化，返回取消订阅的函数（给 useEffect 直接 return 用） */
export function onProgressChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PROGRESS_CHANGED, handler);
  return () => window.removeEventListener(PROGRESS_CHANGED, handler);
}
