export const ACTIVE_GENERATION_STATUSES = ['accepted', 'queued', 'generating', 'draft_saved', 'post_processing'];

export function scopedGenerationTaskType(taskType: string, scope: unknown = undefined): string {
  return typeof scope === 'string' && /^[a-zA-Z0-9:_-]{1,120}$/.test(scope)
    ? taskType + '#' + scope
    : taskType;
}
