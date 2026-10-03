/**
 * 给「继续对话」预填一句话。
 *
 * 结果下面的「让 AI 改掉」（禁忌扫描）要打开继续对话并填好修改要求。各页面打开对话框的方式都是
 * useGenerationPage 的 openContinuousDialog(result)，要一页页加参数太散——这里放一个只取一次的草稿，
 * 对话框打开时自己取。只填进输入框，不自动发送：发不发由用户看过再说。
 */
let pending: string | null = null;

export function setDialogDraft(text: string): void {
  pending = text;
}

export function takeDialogDraft(): string | null {
  const t = pending;
  pending = null;
  return t;
}
