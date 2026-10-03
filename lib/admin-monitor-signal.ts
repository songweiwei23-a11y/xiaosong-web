import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/admin-auth';

export type MonitorSignal = { mode: 'realtime' | 'polling'; error?: string; refresh?: boolean };

/** 每个服务进程共用一次订阅和一秒一次版本校验，不为每块屏幕扫描业务表。 */
export class MonitorSignalBus {
  private listeners = new Set<(signal: MonitorSignal) => void>();
  private timer?: ReturnType<typeof setInterval>;
  private channel?: RealtimeChannel;
  private reading = false;
  private revision = '';
  private subscribed = false;
  private generation = 0;
  private state: MonitorSignal = { mode: 'polling' };
  constructor(private db: SupabaseClient) {}

  subscribe(listener: (signal: MonitorSignal) => void) {
    this.listeners.add(listener);
    listener({ ...this.state, refresh: true });
    if (!this.timer) this.start();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  }

  private emit(signal: MonitorSignal) {
    this.state = { mode: signal.mode, error: signal.error };
    for (const listener of this.listeners) listener(signal);
  }

  private start() {
    const generation = ++this.generation;
    this.channel = this.db.channel('admin-monitor-signal').on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'admin_monitor_signal',
    }, () => {
      if (generation === this.generation) this.emit({ ...this.state, refresh: true });
    }).subscribe((status) => {
      if (generation !== this.generation) return;
      this.subscribed = status === 'SUBSCRIBED';
      void this.check(generation);
    });
    this.timer = setInterval(() => void this.check(generation), 1000);
    void this.check(generation);
  }

  private async check(generation: number) {
    if (this.reading) return;
    this.reading = true;
    try {
      const { data, error } = await this.db.from('admin_monitor_signal').select('revision,updated_at').eq('id', 1).maybeSingle();
      if (generation !== this.generation) return;
      if (error || !data) {
        // 未迁移也能秒级更新；界面如实显示降级状态。
        this.emit({ mode: 'polling', error: error && !['PGRST205', '42P01'].includes(error.code) ? '实时通道校验失败，正在重试' : undefined, refresh: true });
        return;
      }
      const revision = `${data.revision}:${data.updated_at}`;
      const changed = revision !== this.revision;
      this.revision = revision;
      this.emit({ mode: this.subscribed ? 'realtime' : 'polling', refresh: changed });
    } catch {
      if (generation === this.generation) this.emit({ mode: 'polling', error: '实时连接中断，正在重试', refresh: true });
    } finally {
      this.reading = false;
    }
  }

  private stop() {
    ++this.generation;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.subscribed = false;
    this.state = { mode: 'polling' };
    if (this.channel) void this.db.removeChannel(this.channel);
    this.channel = undefined;
  }
}

export function monitorSignalBus() {
  const processState = globalThis as unknown as { adminMonitorSignalBus?: MonitorSignalBus };
  return processState.adminMonitorSignalBus ??= new MonitorSignalBus(getServiceSupabase());
}
