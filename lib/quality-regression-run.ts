/**
 * 手动质检回归的后台运行状态（2026-10-10 巡检 M3）。
 *
 * 为什么放在 lib 而不是路由文件：Next 的 route.ts 只能导出 HTTP 方法和配置项，
 * 状态和启动逻辑要单独放，才能被测试直接引用。
 *
 * 状态只在本进程内存里：进程重启会丢掉「正在跑」的标记，结果已经写进库的不受影响。
 */

export type RegressionRunState = {
  status: 'running' | 'done' | 'failed'
  startedAt: string
  finishedAt?: string
  stored?: boolean
  passed?: number
  total?: number
  error?: string
}

let current: RegressionRunState | null = null

export function getRunState(): RegressionRunState | null {
  return current
}

/** 只给测试用：清掉内存里的运行状态 */
export function resetRunState() {
  current = null
}

/**
 * 开始一次后台运行。已经在跑就不重复开，直接返回那一次的状态（started 为 false）。
 * job 的失败会被记成 failed，不会变成未处理的异常。
 */
export function startRun(job: () => Promise<Partial<RegressionRunState>>): { run: RegressionRunState; started: boolean } {
  if (current?.status === 'running') return { run: current, started: false }

  const run: RegressionRunState = { status: 'running', startedAt: new Date().toISOString() }
  current = run
  void job().then(
    (result) => {
      Object.assign(run, { status: 'done', finishedAt: new Date().toISOString(), ...result })
    },
    (e: unknown) => {
      Object.assign(run, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: (e as Error)?.message || '回归没有完成',
      })
    }
  )
  return { run, started: true }
}
