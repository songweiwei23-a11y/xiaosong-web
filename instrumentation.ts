export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startResearchRecovery } = await import('./lib/research-runner');
    startResearchRecovery();
    // 我的创作偏好：北京时间每天 3 点学一次（lib/preference-learner）
    const { startPreferenceSchedule } = await import('./lib/preference-learner');
    startPreferenceSchedule();
  }
}
