/**
 * 登录页「欢迎回来」记住的名字。
 *
 * 只存邮箱 @ 前面那一段，放在这台电脑的 localStorage 里，方便同一个人下次打开登录页
 * 被叫出名字。这不是登录状态：退出登录、注销账号时必须清掉，否则共用电脑的下一个人
 * 打开 /login 仍能看到上一个账号。
 * 读写都包在 try 里：隐私模式、禁用存储时照常登录，只是不认人、也清不掉。
 */

const NAME_KEY = "kaiwu:login-name";

/** 登录成功后记下名字。没有 @、或 @ 前面是空的，就不记 */
export function rememberLoginName(email: string) {
  const name = email.includes("@") ? email.split("@")[0].slice(0, 20) : "";
  try { if (name) window.localStorage.setItem(NAME_KEY, name); } catch { /* 存不了就下次不认人 */ }
}

/** 登录页读上次记下的名字。读不到就当没记过 */
export function readLoginName(): string {
  try { return window.localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}

/** 退出登录、注销、或用户点「不是你？」时清掉，登录页不再喊上一个账号 */
export function forgetLoginName() {
  try { window.localStorage.removeItem(NAME_KEY); } catch { /* 清不掉就下次还可能认人 */ }
}
