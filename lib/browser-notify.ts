/**
 * 拆解这类要几分钟的任务：用户切去别的页面、别的窗口时，做完了给一条系统通知。
 * 通知只是锦上添花，任何一步失败都不影响结果本身（结果已经存进历史）。
 */

/** 要在用户点击的那一下调用（浏览器只在用户操作时弹授权框）。已经同意或拒绝过的不再问。 */
export function askDoneNotice(): void {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch { /* 浏览器不支持通知就算了 */ }
}

/**
 * 完成时调用。away：用户已经离开了这个页面（组件已卸载），或者标签页在后台，才发通知；
 * 用户还在看着就不打扰。
 */
export function notifyDone(title: string, body: string, away: boolean): void {
  try {
    if (typeof document === 'undefined' || typeof Notification === 'undefined') return;
    if (!away && !document.hidden) return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body });
  } catch { /* 通知失败不影响结果 */ }
}
