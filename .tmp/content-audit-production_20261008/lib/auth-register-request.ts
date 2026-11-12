const REGISTER_TIMEOUT_MS = 30_000;

type RegistrationInput = { email: string; password: string; code: string };
type RegistrationResult = { message?: string; error?: string };

/** 注册只发送一次；超时取消真实请求，不能自动重复创建账号。 */
export async function postRegistration(
  input: RegistrationInput,
  signal?: AbortSignal,
  timeoutMs = REGISTER_TIMEOUT_MS,
): Promise<RegistrationResult> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    // 计时覆盖正文读取，避免服务器只返回响应头后一直没有正文。
    const data: RegistrationResult = await response.json().catch((error: unknown) => {
      if (controller.signal.aborted) throw error;
      throw new Error('注册服务暂时无法响应，请稍后重试');
    });
    if (!response.ok) throw new Error(data.error || '注册失败');
    return data;
  } catch (error) {
    if (timedOut) {
      throw new Error('注册响应超时。账号可能已创建，请先切换到登录尝试，避免重复注册。');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
