import { requireAdmin } from '@/lib/admin-auth';
import { monitorSignalBus } from '@/lib/admin-monitor-signal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: '需要管理员权限' }, { status: 403 });
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let mode: 'realtime' | 'polling' = 'polling';
      let lastError: string | undefined;
      let unsubscribe = () => {};
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let expiry: ReturnType<typeof setTimeout> | undefined;
      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        if (expiry) clearTimeout(expiry);
        request.signal.removeEventListener('abort', cleanup);
        try { controller.close(); } catch {}
      };
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
        catch { cleanup(); }
      };
      controller.enqueue(encoder.encode('retry: 1000\n\n'));
      unsubscribe = monitorSignalBus().subscribe((signal) => {
        mode = signal.mode;
        lastError = signal.error;
        if (signal.refresh) send('refresh', { now: new Date().toISOString() });
      });
      if (closed) { unsubscribe(); return; }
      // 即使没人操作也校验在线状态、日界线和“最近一小时”的移动窗口。
      heartbeat = setInterval(() => send('state', { mode, error: lastError }), 5000);
      send('state', { mode, error: lastError });
      expiry = setTimeout(cleanup, 55_000); // 重连重新鉴权，撤销管理员权限最多保留这一小段连接
      request.signal.addEventListener('abort', cleanup, { once: true });
      if (request.signal.aborted) cleanup();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'private, no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    'Connection': 'keep-alive',
  } });
}
