// 同一档案先完成一轮、存好会话，再允许下一轮读取会话。
// 生产应用为单进程。同一进程的生成和追问共用此队列。
const windows = new Map<string, Promise<void>>();

export async function acquireCreationWindow(userId: string, profileId: string | null, signal: AbortSignal): Promise<() => void> {
  signal.throwIfAborted();
  const key = JSON.stringify([userId, profileId]);
  const previous = windows.get(key) ?? Promise.resolve();
  let resolve!: () => void;
  const done = new Promise<void>((finish) => { resolve = finish; });
  const tail = previous.then(() => done);
  windows.set(key, tail);
  const release = () => {
    resolve();
    void tail.then(() => { if (windows.get(key) === tail) windows.delete(key); });
  };

  const wait = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
  let onAbort!: () => void;
  try {
    await Promise.race([previous, new Promise<never>((_, reject) => {
      onAbort = () => reject(wait.reason);
      wait.addEventListener('abort', onAbort, { once: true });
      if (wait.aborted) onAbort();
    })]);
    wait.throwIfAborted();
    return release;
  } catch (error) {
    release();
    if (!signal.aborted && wait.aborted) {
      throw Object.assign(new Error('这个档案的上一轮创作还在进行，请等它结束后继续'), { code: 'creation_window_wait' });
    }
    throw error;
  } finally {
    wait.removeEventListener('abort', onAbort);
  }
}
