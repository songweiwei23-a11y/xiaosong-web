/**
 * 系统健康检查。
 *
 * 【为什么要有】后台概览上原来有一张「系统状态：运行正常 / 所有服务正常」，
 * 是**写死的**——Dify 挂了、数据库连不上、API key 过期，它都照样显示绿色。
 * 一个用来"掌控全站"的面板上放一盏永远亮绿的灯，比没有灯更糟：
 * 真出事时它在告诉你"没事"。
 *
 * 只检查两样真正会让用户用不了的东西：
 *   - 数据库：登录、额度、历史全靠它
 *   - Dify：所有生成都走它。用 /parameters 探活——只读应用配置，
 *     不调模型、不花钱，但能同时验证服务可达和 API key 有效
 */

export interface HealthCheck {
  name: string;
  ok: boolean;
  /** 响应耗时，毫秒 */
  ms: number;
  /** 失败时给管理员看的原因 */
  detail?: string;
}

export interface HealthSummary {
  ok: boolean;
  /** 卡片上的大字 */
  label: string;
  /** 卡片上的小字 */
  note: string;
}

/** 超过这个耗时算"慢"。数据库实测平时约 0.5 秒（隔着 Cloudflare） */
export const SLOW_MS = 3000;

export function summarizeHealth(checks: HealthCheck[]): HealthSummary {
  // 一项都没检查到，不能说"正常"——那正是原来写死的那种假绿
  if (checks.length === 0) return { ok: false, label: '未检查', note: '没有拿到任何检查结果' };

  const down = checks.filter((c) => !c.ok);
  if (down.length) {
    return {
      ok: false,
      label: '有服务异常',
      note: down.map((c) => `${c.name}：${c.detail ?? '不可用'}`).join('；'),
    };
  }
  const slow = checks.filter((c) => c.ms > SLOW_MS);
  if (slow.length) {
    return {
      ok: true,
      label: '运行偏慢',
      note: slow.map((c) => `${c.name} ${(c.ms / 1000).toFixed(1)} 秒`).join('；'),
    };
  }
  return {
    ok: true,
    label: '运行正常',
    note: checks.map((c) => `${c.name} ${c.ms}ms`).join(' · '),
  };
}

/** 带计时和超时地跑一项检查。任何异常都转成 ok:false，不往外抛 */
export async function timed(name: string, fn: () => Promise<string | null>): Promise<HealthCheck> {
  const t0 = Date.now();
  try {
    const problem = await fn();
    return { name, ok: problem === null, ms: Date.now() - t0, ...(problem ? { detail: problem } : {}) };
  } catch (e: any) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return { name, ok: false, ms: Date.now() - t0, detail: timeout ? '超时' : e?.message || '请求失败' };
  }
}
