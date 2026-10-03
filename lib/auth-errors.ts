/**
 * 登录 / 注册报错翻成人话。
 *
 * 认证服务的报错可能是英文（Invalid login credentials、Load failed……），
 * 原来原样显示在登录框下面，用户看不懂、截图给我们也要猜。
 * 认不出的保留原文放在括号里，方便排查。
 */
const RULES: [RegExp, string][] = [
  [/invalid login credentials|invalid_credentials/i, '邮箱或密码不对。注意密码区分大小写；忘了可以找管理员重置'],
  [/email not confirmed/i, '邮箱还没验证，请联系管理员处理'],
  [/user is banned|banned/i, '这个账号已被停用，请联系管理员'],
  [/rate limit|too many requests|429/i, '尝试次数太多，请过几分钟再试'],
  [/timeout|timed out/i, '登录响应超时，请稍后重试'],
  [/aborterror|aborted|abort signal|operation was aborted/i, '登录请求已中断，请重试'],
  [/failed to fetch|load failed|networkerror|network request failed|fetch failed/i, '连不上登录服务器，请检查网络后再试一次'],
  [/database error/i, '登录服务出错了，请把这段提示截图发给管理员'],
];

export function authErrorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? '');
  // 服务端给出的中文说明原样保留，尤其注册超时的“账号可能已创建”。
  if (/[一-龥]/.test(raw)) return raw;
  const name = typeof error === 'object' && error && 'name' in error ? String((error as { name: unknown }).name) : '';
  const hit = RULES.find(([re]) => re.test(`${name} ${raw}`));
  if (hit) return hit[1];
  return raw ? `操作失败（${raw}）` : '操作失败，请重试';
}
