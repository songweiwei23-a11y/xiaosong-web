import type { WorkDetail } from './resume';
import { buildCreationHandoff, creationScript, type CreationTarget } from './creation-flow';
import { mergeCreationSettings, settingsFromInput, settingsFromText } from './creation-settings';
import { extractOpening, type HandoffPayload } from './handoff';

const SOURCES: Record<string, string> = {
  '选题策划': 'topic', '开篇钩子': 'growth', '脚本生成': 'script',
  '审稿优化': 'review', '分镜脚本': 'storyboard', '标题封面': 'title',
};

/** 作品链接没有一次性交接数据，也必须恢复整条创作链的选择。 */
export function workCreationHandoff(work: WorkDetail, target: CreationTarget): HandoffPayload {
  const items = [...(work.items || [])].filter(item => item.result).sort((a, b) => a.created_at.localeCompare(b.created_at));
  let settings = mergeCreationSettings({ topic: work.title });
  let originContent = '';
  for (const item of items) {
    const input = item.input_data || {};
    settings = mergeCreationSettings(settings, settingsFromText(item.result), settingsFromInput(input));
    if (!originContent && typeof input.originContent === 'string' && input.originContent.trim()) originContent = input.originContent;
    if (['脚本生成', '审稿优化'].includes(item.task_type)) settings.workingScript = creationScript(SOURCES[item.task_type], item.result);
  }
  const latest = items.at(-1);
  const body = latest?.result || work.title;
  const payload = buildCreationHandoff(SOURCES[latest?.task_type || ''] || 'script', target, body, {
    from: '创作进度', title: work.title, topic: work.title, workId: work.id,
    originContent: originContent || items[0]?.result || work.title, settings,
  });
  payload.profileId = work.profile_id;
  payload.topic = settings.topic || work.title;
  if (settings.workingScript && ['review', 'storyboard'].includes(target)) payload.scriptContent = settings.workingScript;
  if (target === 'growth' && settings.workingScript) payload.currentOpening = settings.openingLine || extractOpening(settings.workingScript);
  return payload;
}
