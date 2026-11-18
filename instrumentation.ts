export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startResearchRecovery } = await import('./lib/research-runner');
    startResearchRecovery();
    // 生成任务恢复：PM2 重启后标记陈旧任务，页面可取回草稿且不会重复扣费。
    const { startGenerationTaskRecovery } = await import('./lib/generation-task-runner');
    startGenerationTaskRecovery();
    // 我的创作偏好：北京时间每天 3 点学一次（lib/preference-learner）
    const { startPreferenceSchedule } = await import('./lib/preference-learner');
    startPreferenceSchedule();
  }
}
